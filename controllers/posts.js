const Post = require('../models/post')
const User = require('../models/user')

module.exports.new_post = async(req, res, next) => {
    const post = new Post({ title: req.body.title, body: req.body.body, author: req.session.user_id })
    await post.save()
    return res.status(200).send(post);
}
