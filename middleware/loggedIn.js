const User = require('./models/user')

module.exports.isLoggedIn = async (req, res) => {
    if (!req.session.isLoggedIn) {
        console.log('You must be logged in.')
        res.redirect('/login')
    }
    next()
}