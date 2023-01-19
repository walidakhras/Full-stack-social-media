const User = require('../models/user')
const Token = require('../models/token')
const Post = require('../models/post')

const crypto = require('crypto')
const Bcrypt = require("bcryptjs")
const nodemailer = require("nodemailer")
require('dotenv').config()

const { catchErrors } = require('../funcs/asyncErrors')
const { saveS3Image, deleteS3Image, generateS3ImageURL } = require('../funcs/S3setup')


const hashPassword = (pw) => {
    const salt = Bcrypt.genSaltSync(12);
    const hash = Bcrypt.hashSync(pw, salt);
    return hash
}

const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
        user: process.env.NODEMAILER_USER, 
        pass: process.env.NODEMAILER_PASSWORD 
    } 
})



module.exports.login = catchErrors(async (req, res) => { User.findOne({ email: req.body.email }, async function(err, user) {
    if (err) {
        req.flash('error', 'An unknown error occurred. Please try logging in again.')
    }
    else if (!user){
        req.flash('info', 'This email is not associated with any account. If this is your email, please register.')
    }
    else if(!Bcrypt.compareSync(req.body.password, user.password)) {
        req.flash('error', 'Incorrect password')
    }
    else if (!user.isVerified){
        req.flash('error', 'This email has not been verified.')
    } 
    else {
        req.session.loggedIn = true
        req.session.email = req.body.email
        req.session.user_id = user._id
        req.session.username = user.username
        return res.redirect('/')
    }
    return res.redirect('/login')
})})

module.exports.signup = async (req, res) => {
    User.findOne({ email: req.body.email }, async (err, user) => {

        if (user) {
            req.flash('error', 'This email address is already associated with another account.')
            return res.redirect('/signup')
        }
        
        else {
            if (req.body.password !== req.body.password2) {
                req.flash('error', 'The passwords do not match')
            }
            let hashed_pw = hashPassword(req.body.password)
            user = new User({ username: req.body.username, email: req.body.email, password: hashed_pw, })
            if (req.file) {
                const imageName = await saveS3Image(req)
                user.image = imageName
            }
            
            user.save(function (err) {
                if (err) { 
                    console.log(err)
                    req.flash('error', 'An unknown error occurred the user. Please try again.')
                    return res.redirect('/signup')
                }
                
                const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') })
                token.save((err) => {
                  if(err){
                    req.flash('error', 'An unknown error occurred with the token. Please try again.')
                    return res.redirect('/signup')
                  }

                const mailOptions = { 
                    from: 'no-reply@example.com', 
                    to: user.email, subject: 'Account Verification Link', 
                    text: 'Hello ' + req.body.username +',\n\n' + 'Please verify your account with the following link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nIf you did not sign up for X, than you may ignore this email. Thank you!\n' 
                }
                
                transporter.sendMail(mailOptions, function (err) {
                    if (err) { 
                        req.flash('error', 'An unknown error occurred with nodemailer. Please try again.')
                        console.log(err.message)
                        return res.redirect('/signup')
                        
                    }
                    req.flash('info', 'A verification email has been sent to ' + user.email)
                    return res.redirect('/login')
                })
                })
            })
        }                 
    })
}

module.exports.confirm_email = catchErrors(async (req, res, next) => {
    Token.findOne({ token: req.params.token }, (err, token) => {
        if (!token){
            req.flash('error', 'The verification link has expired. Please sign up again.')
            return res.redirect('/signup')
        }
        else{
            User.findOne({ _id: token._userId, email: req.params.email }, function (err, user) {
                if (!user){
                    req.flash('error', 'We were unable to find a user associated with this link. Please sign up again')
                    return res.redirect('/signup')
                } 
                else if (user.isVerified){
                    req.flash('info', 'This email has already been verified. Please login')
                    return res.redirect('/login')
                }
                else{
                    user.isVerified = true
                    user.save((err) => {
                        if(err){
                            req.flash('error', 'An unknown error occurred with saving the user')
                            console.log(err.message)
                            return res.redirect('/login')
                        }
                        else {
                            return res.status(200).send('Your email has been succesfully verified. You may safely close this window.')
                        }
                    })
                }
            })
        }     
    })
})

module.exports.show_user_profile = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    
    if (req.params.id == req.session.user_id) {
        return res.render('user/user_settings', { user, session: req.session })
    } else {
        return res.render('user/profile', { user, session: req.session })
    }
})

module.exports.render_settings = catchErrors(async (req, res) => {
    User.findById(req.params.id, async (err, user) => {
        if (!user) {
            req.flash('error', "User not found")
        } else if (err) {
            req.flash('error', "An error occurred")     
        } else {
            if (user.image) {
                user.imageURL = await generateS3ImageURL(user)
            }
            return res.render('user/user_settings', { user, session: req.session })
        }
        return res.redirect("/posts")
    })

})

module.exports.render_user_edit = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/edit_user', { user, session: req.session })
})



module.exports.render_image_edit = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/change_image', { user, session: req.session })
})

module.exports.render_username_edit = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/change_username', { user, session: req.session })
})

module.exports.edit_user_image = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)

    if (user.image) {
        deleteS3Image(user)
    }

    if (req.file) {
        const imageName = await saveS3Image(req, 75, 75)
        user.image = imageName
    }

    await user.save()
    req.flash('success', 'Profile picture successfully updated')
    return res.redirect(`/users/settings/${user._id}`)
})

module.exports.edit_username = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)

    if (req.body.username) {
        user.username = req.body.username
    }
    await user.save()
    req.flash('success', 'Username successfully updated')
    return res.redirect(`/users/settings/${user._id}`)
})


module.exports.render_password_change = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/change_password', { user, session: req.session })
})

module.exports.change_password = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    console.log(user)

    // Plaintext v. hash
    if (!Bcrypt.compareSync(req.body.oldpass, user.password)) {
        req.flash('error', 'Incorrect password.')
    } else if (Bcrypt.compareSync(req.body.newpass, user.password)) {
        req.flash('error', 'The current and new password must be different.')
    }
    else if (req.body.newpass !== req.body.newpass2) {
        req.flash('error', 'Passwords do not match.')
    } else {
        user.password = hashPassword(req.body.newpass)
        await user.save()
        req.flash('success', 'Password successfully changed.')
        return res.redirect('/')
    }
    res.redirect(`/users/edit/password/${user._id}`)
})

module.exports.render_forgot_password = (req, res) => {
    const user = null
    res.render('user/forgot_password', { user, session: req.session })
}

module.exports.forgot_pass_email = catchErrors(async (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (err) {
            req.flash('error', 'An unknown error occurred with finding the user')
            return res.redirect('/login')
        }
        else if (!user) {
            req.flash('error', 'A user with this email does not exist')
            return res.redirect('/login')
        } else {
            const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') })

            token.save((err) => {
                if(err){
                    req.flash('error', 'An unknown error occurred with the token')
                    return res.redirect('/login')
                }

              const mailOptions = { 
                  from: 'no-reply@example.com', 
                  to: user.email, subject: 'Reset Password', 
                  text: 'Hello ' + user.username +',\n\n' + 'Please reset your password with the following link: \nhttp:\/\/' + req.headers.host + '\/forgot_your_pass\/' + user.email + '\/' + token.token + '\n' 
              }
              
              transporter.sendMail(mailOptions, function (err) {
                  if (err) { 
                    req.flash('error', 'An unknown error occurred with nodemailer')
                    return res.redirect('/login')
                  }
                    req.flash('info', 'An email with a link has been sent to ' + user.email)
                    return res.redirect('/login')
              })
              })
        }
    })
})

module.exports.render_pass_form = catchErrors(async (req, res) => {
    const user = await User.findOne({ email: req.params.email })
    res.render('user/forgot_pass_form', { user, token: req.params.token })
})

module.exports.change_forgotten_pass = catchErrors(async (req, res) => {
    const user = await User.findOne({ email: req.params.email })
    if (!user) {
        req.flash('error', "User does not exist")
        return res.redirect('/login')
    } else if (!req.body.email) {
        req.flash('error', 'Please enter your email')
        return res.redirect(`/forgot_your_pass/${req.params.email}/${req.params.token}`)
    }
    else if (req.body.pass1 !== req.body.pass2) {
        req.flash('error', 'Passwords do not match')
        return res.redirect(`/forgot_your_pass/${req.params.email}/${req.params.token}`)
    } else {
        user.password = hashPassword(req.body.pass1)
        await user.save()
        req.flash('success', 'Password successfully changed')
        return res.redirect('/login')
    }
})

module.exports.render_bio_edit = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/change_bio', { user, session: req.session })
})

module.exports.edit_bio = async (req, res) => {
    const user = await User.findById(req.params.id)

    if (req.body.bio.length > 300) {
        req.flash('error', "Bio has a max length of 300")
        return res.redirect('/')
    }

    else if (!req.body.bio) {
        user.bio = ""
    } else {
        user.bio = req.body.bio
    }
        
    await user.save()
    req.flash('success', "Bio successfully changed")
    return res.redirect(`/users/settings/${user._id}`)
}

module.exports.render_confirm_delete = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/confirm_delete', { user, session: req.session })
})

module.exports.delete_user = catchErrors(async (req, res) => {
    const user = await User.findById(req.params.id)

    if (user.image) {
        deleteS3Image(user)
        // const params = {
        //     Bucket: bucketName,
        //     Key: user.image,
        // }
        // const command = new DeleteObjectCommand(params)
        // await s3.send(command)
    }

    await Post.deleteMany({ author: req.params.id })
    await Token.findOneAndDelete({ _userID: req.params.id })
    await User.findByIdAndDelete(req.params.id)
    
    req.session.destroy()
    return res.redirect('/')
})

module.exports.user_all_posts = catchErrors(async(req, res) => {
    // /users/settings/allposts/:id
    User.findOne({ _id: req.params.id }, async (err, user) => {
        if (!user) {
            req.flash('error', 'User not found')
            return res.redirect('/')
        }
        else {
            const postsArr = await Post.find({ author: user._id, isMain: true })
            // const postsArr = []
            // for (let post of posts) {
            //     if (post.isMain) {
            //         postsArr.push(post)
            //     }
            // }
            return res.render("user/all_posts", { postsArr, user })
        }
    })
})

module.exports.user_all_replies = catchErrors(async(req, res) => {
    User.findOne({ _id: req.params.id }, async(err, user) => {
        if (!user) {
            req.flash('error', 'User not found')
            return res.redirect('/')
        } else {
            const postsArr = await Post.find({ author: user._id, isMain: false })
            return res.render("user/all_replies", { postsArr, user })
        }
    })
})
