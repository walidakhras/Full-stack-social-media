const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const session = require('express-session')

const user_controller = require('./controllers/users.js')
const post_controller = require('./controllers/posts')

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

const db = mongoose.connection
db.on("error", console.error.bind(console, "Error connecting to database:"))
db.once("open", () => {
    console.log("Database successfully connected");
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

app.get("/new", (req, res) => {
    res.render("new")
})

app.post("/login", user_controller.login);

app.post("/signup", user_controller.signup)

app.get('/confirmation/:email/:token', user_controller.confirm_email)

app.post('/new', post_controller.new_post)





app.get('/home', (req, res) => {
	if (req.session.loggedIn) {
		res.send('Welcome back, ' + req.session.email + '!')
	} else {
		res.send('Please login to view this page!')
	}
})

app.get("/logout", (req, res) => {
    req.session.destroy()
    res.send("Your are logged out ")
})


app.listen(3000, () => {
    console.log("Listening! on poop 3000")
})