const User = require('../models/user')
const Token = require('../models/token')
const Post = require('../models/post')

const Bcrypt = require("bcryptjs")
const nodemailer = require("nodemailer")
const crypto = require("crypto")
const sharp = require('sharp')

require('dotenv').config()

const hashPassword = (pw) => {
    const salt = Bcrypt.genSaltSync(12);
    const hash = Bcrypt.hashSync(pw, salt);
    return hash
}

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

const flashAndRedirect = () => {}

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");


const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
        user: process.env.NODEMAILER_USER, 
        pass: process.env.NODEMAILER_PASSWORD 
    } 
})

require('dotenv').config()

const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey,
    },
    region: bucketRegion
})


module.exports.login = async (req, res) => { User.findOne({ email: req.body.email }, async function(err, user) {
    if (err) {
        req.flash('error', 'An unknown error occurred. Please try logging in again.')
        res.redirect('login')
        console.log(err.message)
    }
    else if (!user){
        req.flash('info', 'This email is not associated with any account. If this is your email, please register.')
        res.redirect('login')
        // return res.status(401).send({ msg:'The email address ' + req.body.email + ' is not associated with any account. please check and try again!'});
    }
    // comapre user's password if user is find in above step
    else if(!Bcrypt.compareSync(req.body.password, user.password)) {
        req.flash('error', 'Incorrect password')
        res.redirect('login')
        // return res.status(401).send({msg:'Wrong Password!'})
    }
    // check user is verified or not
    else if (!user.isVerified){
        req.flash('error', 'This email has not been verified.')
        res.redirect('login')
        // return res.status(401).send({msg:'Your Email has not been verified. Please click on resend'});
    } 
    // user successfully logged in
    else {
        req.session.loggedIn = true
        req.session.email = req.body.email
        req.session.user_id = user._id
        req.session.username = user.username
        // return res.status(200).send('User successfully logged in.')
        res.redirect('/')
    }
})}

module.exports.signup = async (req, res) => {
    User.findOne({ email: req.body.email }, async (err, user) => {

        if (err) {
            req.flash('error', 'An unknown error occurred. Please try again.')
            res.redirect('signup')
            console.log(err.message)
            // return res.status(500).send({ msg: err.message});
        }
        
        else if (user) {
            req.flash('error', 'This email address is already associated with another account.')
            res.redirect('signup')
            // return res.status(400).send({ msg:'This email address is already associated with another account.'});
        }
        
        else {
            let hashed_pw = hashPassword(req.body.password)
            const buffer = await sharp(req.file.buffer).resize({ height: 50, width: 50, fit: "contain" }).toBuffer()

            const imageName = randomImageName()
            const params = {
                Bucket: bucketName,
                Key: imageName,
                Body: buffer,
                ContentType: req.file.mimetype
            }

            const command = new PutObjectCommand(params)
            await s3.send(command)
            
            user = new User({ username: req.body.username, email: req.body.email, password: hashed_pw, image: imageName })
            user.save(function (err) {
                if (err) { 
                    req.flash('error', 'An unknown error occurred the user. Please try again.')
                    res.redirect('signup')
                    console.log(err.message)
                    // return res.status(500).send({msg:err.message});
                }
                
                const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') })
                token.save((err) => {
                  if(err){
                    req.flash('error', 'An unknown error occurred with the token. Please try again.')
                    res.redirect('signup')
                    console.log(err.message)
                    // return res.status(500).send({msg:err.message})
                  }

                const mailOptions = { 
                    from: 'no-reply@example.com', 
                    to: user.email, subject: 'Account Verification Link', 
                    text: 'Hello ' + req.body.username +',\n\n' + 'Please verify your account with the following link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nIf you did not sign up for X, than you may ignore this email. Thank you!\n' 
                }
                
                transporter.sendMail(mailOptions, function (err) {
                    if (err) { 
                        req.flash('error', 'An unknown error occurred with nodemailer. Please try again.')
                        res.redirect('signup')
                        console.log(err.message)
                        // return res.status(500).send({ msg:'Technical Issue!, Please click on resend for verify your Email.'})
                    }
                    req.flash('info', 'A verification email has been sent to ' + user.email)
                    res.redirect('login')
                    // return res.status(200).send('A verification email has been sent to ' + user.email)
                })
                })
            })
        }
    })
}

module.exports.confirm_email = async (req, res, next) => {
    Token.findOne({ token: req.params.token }, (err, token) => {
        // token is not found into database i.e. token may have expired 
        if (!token){
            return res.status(400).send({msg:'Your verification link may have expired. Please click on resend for verify your Email.'})
        }
        // if token is found then check valid user 
        else{
            User.findOne({ _id: token._userId, email: req.params.email }, function (err, user) {
                // not valid user
                if (!user){
                    return res.status(401).send({ msg:'We were unable to find a user for this verification. Please SignUp!'})
                } 
                // user is already verified
                else if (user.isVerified){
                    return res.status(200).send('User has been already verified. Please Login')
                }
                // verify user
                else{
                    // change isVerified to true
                    user.isVerified = true
                    user.save((err) => {
                        // error occur
                        if(err){
                            return res.status(500).send({msg: err.message})
                        }
                        // account successfully verified
                        else{
                          return res.status(200).send('Your account has been successfully verified')
                        }
                    })
                }
            })
        }     
    })
}

module.exports.render_settings = async (req, res) => {
    const user = await User.findById(req.params.id)
    console.log(user)

    const getObjectParams = {
        Bucket: bucketName,
        Key: user.image
    }
    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })

    user.imageURL = url
    await user.save()

    res.render('user/user_settings', { user, session: req.session })
}

// module.exports.render_settings = async (req, res) => {
//     const user = await User.findById(req.params.id)
//     res.render('user/user_settings', { user, session: req.session })
// }

module.exports.render_user_edit = async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/edit_user', { user, session: req.session })
}

module.exports.edit_user = async (req, res) => {
    const user = await User.findById(req.params.id)

    const params = {
        Bucket: bucketName,
        Key: user.image,
    }
    const command = new DeleteObjectCommand(params)
    await s3.send(command)

    const buffer = await sharp(req.file.buffer).resize({ height: 75, width: 75, fit: "contain" }).toBuffer()

    const imageName = randomImageName()
    const new_img_params = {
        Bucket: bucketName,
        Key: imageName,
        Body: buffer,
        ContentType: req.file.mimetype
    }

    const new_img_command = new PutObjectCommand(new_img_params)
    await s3.send(new_img_command)
    user.image = imageName
    user.username = req.body.username
    await user.save()
    res.redirect(`/users/settings/${user._id}`)
}

module.exports.delete_user = async (req, res) => {
    const user = await User.findById(req.params.id)

    const params = {
        Bucket: bucketName,
        Key: user.image,
    }
    const command = new DeleteObjectCommand(params)
    await s3.send(command)


    await Post.deleteMany({ author: req.params.id })
    await Token.findOneAndDelete({ _userID: req.params.id })
    await User.findByIdAndDelete(req.params.id)

    res.redirect('/')
}

module.exports.render_password_change = async (req, res) => {
    const user = await User.findById(req.params.id)
    res.render('user/change_password', { user, session: req.session })
}

module.exports.change_password = async (req, res) => {
    const user = await User.findById(req.params.id)

    // Plaintext v. hash
    if (!Bcrypt.compareSync(req.body.oldpass, user.password)) {
        return res.status(401).send({msg:'Wrong Password!'})
    } else if (req.body.newpass !== req.body.newpass2) {
        return res.status(401).send({ msg: 'Passwords do not match!'})
    } else {
        user.password = hashPassword(req.body.newpass)
        await user.save()
        return res.status(400).send({msg: 'Password successfully changed'})
    }
}

module.exports.render_forgot_password = async (req, res) => {
    res.render('user/forgot_password', { session: req.session })
}

module.exports.forgot_pass_email = async (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (err) {
            return res.status(500).send({ msg: err.message});
        }
        else if (!user) {
            return res.status(400).send({ msg:'A user with this email does not exist.'});
        } else {
            const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') })

            token.save((err) => {
                if(err){
                  return res.status(500).send({msg:err.message})
                }

              const mailOptions = { 
                  from: 'no-reply@example.com', 
                  to: user.email, subject: 'Reset Password', 
                  text: 'Hello ' + user.username +',\n\n' + 'Please reset your password with the following link: \nhttp:\/\/' + req.headers.host + '\/forgot_your_pass\/' + user.email + '\/' + token.token + '\n' 
              }
              
              transporter.sendMail(mailOptions, function (err) {
                  if (err) { 
                      return res.status(500).send({ msg: err.message })
                  }
                  return res.status(200).send('An email with a link has been sent to ' + user.email)
              })
              })
        }
    })
}

module.exports.render_pass_form = async (req, res) => {
    const user = await User.findOne({ email: req.params.email })
    res.render('user/forgot_pass_form', { user, token: req.params.token })
}

module.exports.change_forgotten_pass = async (req, res) => {
    const user = await User.findOne({ email: req.params.email })

    if (req.body.pass1 !== req.body.pass2) {
        return res.status(401).send({msg:'Passwords do not match!'})
    } else {
        user.password = hashPassword(req.body.pass1)
        await user.save()
        return res.status(400).send({msg: 'Password successfully changed'})
    }
}   

