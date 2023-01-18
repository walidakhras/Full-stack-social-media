module.exports.isLoggedIn = async (req, res) => {
    if (!req.session.isLoggedIn) {
        req.flash('info', 'You must be logged in')
        res.redirect('/login')
    }
    next()
}