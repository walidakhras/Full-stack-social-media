const User = require('../models/user')
const Token = require('../models/token')
const Bcrypt = require("bcryptjs")
const nodemailer = require("nodemailer")
const crypto = require("crypto")
require('dotenv').config()

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

module.exports.login = async (req, res) => { User.findOne({ email: req.body.email }, function(err, user) {
    // error occur
    if(err){
        return res.status(500).send({msg: err.message});
    }
    // user is not found in database i.e. user is not registered yet.
    else if (!user){
        return res.status(401).send({ msg:'The email address ' + req.body.email + ' is not associated with any account. please check and try again!'});
    }
    // comapre user's password if user is find in above step
    else if(!Bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).send({msg:'Wrong Password!'})
    }
    // check user is verified or not
    else if (!user.isVerified){
        return res.status(401).send({msg:'Your Email has not been verified. Please click on resend'});
    } 
    // user successfully logged in
    else {
        req.session.loggedIn = true
        req.session.email = req.body.email
        req.session.user_id = user._id
        // return res.status(200).send('User successfully logged in.')
        res.redirect('home')
    }
})}

module.exports.signup = async (req, res) => {
    User.findOne({ email: req.body.email }, function (err, user) {

        if (err) {
            return res.status(500).send({ msg: err.message});
        }
        
        else if (user) {
            return res.status(400).send({ msg:'This email address is already associated with another account.'});
        }
        
        else {
            let hashed_pw = hashPassword(req.body.password)
            
            user = new User({ name: req.body.username, email: req.body.email, password: hashed_pw, createdOn: req.body.createdOn });
            user.save(function (err) {
                if (err) { 
                  return res.status(500).send({msg:err.message});
                }
                
                const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
                token.save((err) => {
                  if(err){
                    return res.status(500).send({msg:err.message});
                  }

                const mailOptions = { 
                    from: 'no-reply@example.com', 
                    to: user.email, subject: 'Account Verification Link', 
                    text: 'Hello ' + req.body.username +',\n\n' + 'Please verify your account with the following link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nIf you did not sign up for X, than you may ignore this email. Thank you!\n' 
                }
                
                transporter.sendMail(mailOptions, function (err) {
                    if (err) { 
                        return res.status(500).send({ msg:'Technical Issue!, Please click on resend for verify your Email.'});
                    }
                    return res.status(200).send('A verification email has been sent to ' + user.email);
                })
                })
            });
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