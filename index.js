const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const session = require('express-session')
const method_override = require('method-override')
const multer = require('multer')
const ejsMate = require('ejs-mate')
const flash = require('connect-flash')
const mongoSanitize = require('express-mongo-sanitize');

const user_controller = require('./controllers/users.js')
const post_controller = require('./controllers/posts')
const User = require("./models/user.js")
const Post = require("./models/post.js")


require('dotenv').config()

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname))
app.use(method_override('_method'))
app.use(flash())
app.use(mongoSanitize())

app.use(session({
    name: 'epicsession',
	secret: process.env.SESSION_SECRET,
	resave: true,
	saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
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

const isLoggedIn = async (req, res, next) => {
    if (!req.session.loggedIn) {
        console.log("loggedin middleware")
        req.flash('info', 'You must be logged in')
        return res.redirect('/login')
    }
    next()
}

const isPostAuthor = async (req, res, next) => {
    const post = await Post.findById(req.params.id)
    if (post.author != req.session.user_id) {
        console.log("post author middleware")
        req.flash('error', 'Unable to access')
        return res.redirect('/')
    }
    next()
}

const isUser = async(req, res, next) => {
    if (req.params.id != req.session.user_id) {
        console.log("isUser middleware")
        req.flash('error', "Unable to access")
        return res.redirect('/')
    }
    next()
}



app.get("/", (req, res) => {
    res.redirect('/posts')
    // res.render("home", { sessfion: req.session })
})

// User - Login and Signup
app.get("/signup", (req, res) => {
    res.render("signup")
})

app.get("/login", (req, res) => {
    res.render("login", { session: req.session, host: req.headers.host })
})

app.post("/login", user_controller.login);

app.post("/signup", upload.single('image'), user_controller.signup)

app.get("/logout", (req, res) => {
    req.session.destroy()
    res.redirect('/')
})

app.get('/confirmation/:email/:token', user_controller.confirm_email)

app.post('/search', post_controller.search)


// Posts - Posting
app.get("/new", isLoggedIn, post_controller.render_new)

app.post('/new', isLoggedIn, upload.single('image'), post_controller.new_post)

app.get("/posts", post_controller.index)

app.get('/posts/:id', post_controller.post)

app.get('/posts/edit/:id', isLoggedIn, isPostAuthor, post_controller.render_edit)

app.put('/posts/:id', isLoggedIn, isPostAuthor, upload.single('image'), post_controller.edit_post)

app.delete('/posts/delete/:id', isLoggedIn, isPostAuthor, post_controller.delete_post)


// Replies
app.get('/posts/reply/:id', post_controller.get_reply)

app.post('/posts/reply/:id', isLoggedIn, isPostAuthor, upload.single('image'), post_controller.post_reply)

app.get('/posts/reply/edit/:id', isLoggedIn, isPostAuthor, post_controller.render_reply_edit)

app.put('/posts/reply/edit/:id', isLoggedIn, isPostAuthor, upload.single('image'), post_controller.edit_reply)

app.delete('/posts/reply/delete/:id', isLoggedIn, isPostAuthor, post_controller.delete_reply)

app.get('/posts/reply/:parentId/:childId', post_controller.get_child_reply)

app.post('/posts/reply/:parentId/:childId', isLoggedIn, isPostAuthor, upload.single('image'), post_controller.post_child_reply)

// User - Profile
app.get('/users/:id', user_controller.show_user_profile) // What OTHER users see when clicking a profile

app.get('/users/settings/:id', isUser, user_controller.render_settings) // What YOU see when clicking your OWN profile

app.get('/users/edit/:id', isUser, user_controller.render_user_edit)

app.get('/users/settings/allposts/:id', isUser, user_controller.user_all_posts)

app.get('/users/settings/allreplies/:id', isUser, user_controller.user_all_replies)


// User - Editing profile
app.get('/users/edit/username/:id', isUser, user_controller.render_username_edit)

app.get('/users/edit/image/:id', isUser, user_controller.render_image_edit)

app.get('/users/edit/bio/:id', isUser, user_controller.render_bio_edit)

app.put('/users/edit/image/:id', isUser, upload.single('image'), user_controller.edit_user_image)

app.put('/users/edit/username/:id', isUser, user_controller.edit_username)

app.put('/users/edit/bio/:id', isUser, user_controller.edit_bio)

// User - Deleting profile
app.get('/users/delete/confirm/:id', isUser, user_controller.render_confirm_delete)

app.delete('/users/delete/:id', isUser, user_controller.delete_user)

// User - Password
app.get('/users/edit/password/:id', isUser, user_controller.render_password_change)

app.put('/users/edit/password/:id', isUser, user_controller.change_password)

app.get('/forgot_pass', user_controller.render_forgot_password)

app.post('/forgot_pass', user_controller.forgot_pass_email)

app.get('/forgot_your_pass/:email/:token', user_controller.render_pass_form)

app.put('/forgot_your_pass/:email/:token', user_controller.change_forgotten_pass)

app.all('*', (req, res, next) => {
    req.flash('error', "Page not found")
    res.redirect("/posts")
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('genericerror', { err })
})


app.listen(3000, () => {
    console.log("Listening! on poop 3000")
})