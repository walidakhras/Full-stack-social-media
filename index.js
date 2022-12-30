const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const session = require('express-session')
const method_override = require('method-override')
const multer = require('multer')

const user_controller = require('./controllers/users.js')
const post_controller = require('./controllers/posts')

require('dotenv').config()
// const bodyParser = require('body-parser')

const app = express()

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname))
app.use(method_override('_method'))

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

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

//upload.single('image')


app.get("/", (req, res) => {
    res.render("home", { session: req.session })
})

app.get("/signup", (req, res) => {
    res.render("signup")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.get("/new", (req, res) => {
    res.render("posts/new", { session: req.session })
})

app.get("/posts", post_controller.index)

app.post("/login", user_controller.login);

app.post("/signup", user_controller.signup)

app.get('/confirmation/:email/:token', user_controller.confirm_email)

app.post('/new', upload.single('image'), post_controller.new_post)

app.get('/posts/:id', post_controller.post)

app.get('/posts/edit/:id', post_controller.render_edit)

app.put('/posts/:id', post_controller.edit_post)

app.delete('/posts/delete/:id', post_controller.delete_post)


// app.get('/home', (req, res) => {
// 	if (req.session.loggedIn) {
// 		res.send('Welcome back, ' + req.session.email + '!')
// 	} else {
// 		res.send('Please login to view this page!')
// 	}
// })

app.get("/logout", (req, res) => {
    req.session.destroy()
    res.redirect('/')
})


app.listen(3000, () => {
    console.log("Listening! on poop 3000")
})