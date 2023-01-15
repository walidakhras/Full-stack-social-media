const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const session = require('express-session')
const method_override = require('method-override')
const multer = require('multer')
const ejsMate = require('ejs-mate')
const flash = require('connect-flash')

const user_controller = require('./controllers/users.js')
const post_controller = require('./controllers/posts')

const Token = require('./models/token')

require('dotenv').config()
// const bodyParser = require('body-parser')

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname))
app.use(method_override('_method'))
app.use(flash())

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

function passSession(req, res, next) {
    res.locals.isLoggedIn = req.session.loggedIn
    res.locals.loggedInID = req.session.user_id
    res.locals.loggedInName = req.session.username
    

    res.locals.flashSuccess = req.flash('success')
    res.locals.flashInfo = req.flash('info')
    res.locals.flashError = req.flash('error')
    next()
}

app.use(passSession)

//upload.single('image')

const isLoggedIn = async (req, res, next) => {
    if (!req.session.loggedIn) {
        req.flash('info', 'You must be logged in')
        return res.redirect('/login')
    }
    next()
}


app.get("/", (req, res) => {
    res.render("home", { session: req.session })
})

app.get("/signup", (req, res) => {
    res.render("signup")
})

app.get("/login", (req, res) => {
    res.render("login", { session: req.session, host: req.headers.host })
})


// Posts - Posting
app.get("/new", isLoggedIn, (req, res) => {
    res.render("posts/new", { session: req.session })
})

app.post('/new', isLoggedIn, upload.single('image'), post_controller.new_post)


app.get("/posts", post_controller.index)

app.post("/login", user_controller.login);

app.post("/signup", upload.single('image'), user_controller.signup)

app.get('/confirmation/:email/:token', user_controller.confirm_email)

app.get('/posts/:id', post_controller.post)

app.get('/posts/edit/:id', post_controller.render_edit)

app.put('/posts/:id', upload.single('image'), post_controller.edit_post)

app.delete('/posts/delete/:id', post_controller.delete_post)

// Replies
app.get('/posts/reply/:id', post_controller.get_reply)

app.post('/posts/reply/:id', upload.single('image'), post_controller.post_reply)

app.get('/posts/reply/edit/:id', post_controller.render_reply_edit)

app.put('/posts/reply/edit/:id', upload.single('image'), post_controller.edit_reply)

app.delete('/posts/reply/delete/:id', post_controller.delete_reply)

app.get('/posts/reply/:parentId/:childId', post_controller.get_child_reply)

app.post('/posts/reply/:parentId/:childId', upload.single('image'), post_controller.post_child_reply)

// User - Profile
// app.get('/users/:id', user_controller.show_user_profile) // What OTHER users see when clicking a profile

app.get('/users/settings/:id', user_controller.render_settings) // What YOU see when clicking your OWN profile

app.get('/users/edit/:id', user_controller.render_user_edit)


// User - Editing profile
app.get('/users/edit/username/:id', user_controller.render_username_edit)

app.get('/users/edit/image/:id', user_controller.render_image_edit)

app.get('/users/edit/bio/:id', user_controller.render_bio_edit)

// User - Deleting profile
app.get('/users/delete/confirm/:id', user_controller.render_confirm_delete)

app.delete('/users/delete/:id', user_controller.delete_user)

// User - Password
app.get('/users/edit/password/:id', isLoggedIn, user_controller.render_password_change)

app.put('/users/edit/password/:id', user_controller.change_password)

app.get('/users/forgot_pass', user_controller.render_forgot_password)

app.post('/users/forgot_pass', user_controller.forgot_pass_email)








app.put('/users/edit/image/:id', upload.single('image'), user_controller.edit_user_image)

app.put('/users/edit/username/:id', user_controller.edit_username)

app.put('/users/edit/bio/:id', user_controller.edit_bio)








app.get('/forgot_your_pass/:email/:token', user_controller.render_pass_form)

app.put('/forgot_your_pass/:email/:token', user_controller.change_forgotten_pass)




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