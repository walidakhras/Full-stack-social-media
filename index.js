const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const nodemailer = require("nodemailer")
const Bcrypt = require("bcryptjs")
const crypto = require("crypto")
const session = require('express-session');

require('dotenv').config()
// const bodyParser = require('body-parser')

const app = express()

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname))

app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: true,
	saveUninitialized: true
}))

const database = 'mongodb://localhost:27017/social-media'

mongoose.connect(database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})

const User = require("./models/user.js")
const Token = require("./models/token.js")

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Error connecting to database:"))
db.once("open", () => {
    console.log("Database successfully connected");
})

const hashPassword = async (pw) => {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(pw, salt);
    return hash
}

const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
        user: process.env.NODEMAILER_USER, 
        pass: process.env.NODEMAILER_PASSWORD 
    } 
})

app.get("/", (req, res) => {
    res.render("home")
})

app.get("/signup", (req, res) => {
    res.render("signup")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.post("/login", async (req, res) => {
        User.findOne({ email: req.body.email }, function(err, user) {
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
                // return res.status(200).send('User successfully logged in.')
                res.redirect('home')
            }
        });
    });


app.post("/signup", async (req, res) => {
    User.findOne({ email: req.body.email }, function (err, user) {

        if(err){
            return res.status(500).send({msg: err.message});
        }
        
        else if (user) {
            return res.status(400).send({msg:'This email address is already associated with another account.'});
        }
        
        else{
            
            req.body.password = Bcrypt.hashSync(req.body.password, 10);
            
            user = new User({ name: req.body.username, email: req.body.email, password: req.body.password, createdOn: req.body.createdOn });
            user.save(function (err) {
                if (err) { 
                  return res.status(500).send({msg:err.message});
                }
                
                // generate token and save
                const token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
                token.save((err) => {
                  if(err){
                    return res.status(500).send({msg:err.message});
                  }

                    const mailOptions = 
                    { 
                        from: 'no-reply@example.com', 
                        to: user.email, subject: 'Account Verification Link', 
                        text: 'Hello ' + req.body.username +',\n\n' + 'Please verify your account with the following link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nIf you did not sign up for X, than you may ignore this email. Thank you!\n' };
                    transporter.sendMail(mailOptions, function (err) {
                        if (err) { 
                            return res.status(500).send({msg:'Technical Issue!, Please click on resend for verify your Email.'});
                         }
                        return res.status(200).send('A verification email has been sent to ' + user.email);
                    });
                });
            });
        }
        
      })
})

app.get('/confirmation/:email/:token', async (req, res, next) => {
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
});

app.get('/home', (req, res) => {
	// If the user is loggedin
	if (req.session.loggedIn) {
		// Output username
		res.send('Welcome back, ' + req.session.email + '!');
	} else {
		// Not logged in
		res.send('Please login to view this page!');
	}
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send("Your are logged out ");
});


app.listen(3000, () => {
    console.log("Listening! on poop 3000")
})