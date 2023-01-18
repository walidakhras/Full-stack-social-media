const Post = require('../models/post')
const User = require('../models/user')

const { catchErrors } = require('../funcs/asyncErrors')
const { saveS3Image, deleteS3Image, generateS3ImageURL } = require('../funcs/S3setup')


module.exports.render_new = (req, res) => {
    res.render("posts/new", { session: req.session })
}

module.exports.new_post = catchErrors(async(req, res, next) => {
    if (!(req.file && req.body.title && req.body.body)) {
        req.flash('error', "All fields must be filled out")
        return res.redirect('/new')
    }

    const imageName = await saveS3Image(req)

    const post = new Post({ 
        isMain: true,
        title: req.body.title, 
        body: req.body.body, 
        author: req.session.user_id, 
        image: imageName, 
        parent: null,
        username: req.session.username
    })


    await post.save()
    res.redirect(`/posts/${post._id}`)
})

module.exports.index = catchErrors(async(req, res) => {
    const posts = await Post.find()

    for (let post of posts) {
        if (post.isMain && (!post.imageURL)) {
            post.imageURL = await generateS3ImageURL(post)
            await post.save()
        }
    }

    res.render('posts/index', { posts })
})

module.exports.post = catchErrors(async(req, res) => {
    const post = await Post.findById(req.params.id)
    const author = await User.findById(post.author)    

    const replies = []
    await Promise.all(post.replies.map(async reply => {
        // console.log("REPLY:" + reply)
        const r = await Post.findById({ _id: reply })

        if (r.image) {
            r.imageURL = await generateS3ImageURL(r)
            await r.save()
        }
        replies.push(r)

    }))
    post.imageURL = await generateS3ImageURL(post)
    
    post.views = post.views + 1
    await post.save()

    res.render('posts/post', { data: { post, author, session: req.session, replies }})
})

module.exports.render_edit = catchErrors(async(req, res) => {
    const post = await Post.findById(req.params.id)
    res.render('posts/edit', { post })
})
 
module.exports.edit_post = catchErrors(async(req, res) => {
    
    const post = await Post.findById(req.params.id)

    if (!(req.body.title && req.body.body)) {
        req.flash('error', "All fields must be filled out")
        return res.redirect(`/posts/${post._id}`)
    }

    if (req.file && post.image) {
        deleteS3Image(post)
        const imageName = await saveS3Image(req)
        post.image = imageName
    }


    post.title = req.body.title
    post.body = req.body.body
    post.editted = true 
    await post.save()
    res.redirect(`/posts/${post._id}`)
})

module.exports.delete_post = catchErrors(async(req, res) => {
    const post = await Post.findById({ _id: req.params.id })
    
    deleteS3Image(post)

    for (let reply of post.replies) {
        if (reply.image) {
            deleteS3Image(reply)
        }
    }
    await Post.deleteMany({ parent: post._id })
    await Post.findOneAndDelete({ _id: req.params.id })
    res.redirect('/posts')
})

module.exports.get_reply = catchErrors(async(req, res) => {
    const parent_post = await Post.findById({ _id: req.params.id })
    res.render('posts/reply', { parent_post })
})

module.exports.get_child_reply = catchErrors(async(req, res) => {
    const parent_post = await Post.findById(req.params.parentId)
    res.render('posts/reply', { parent_post })
})

module.exports.post_reply = catchErrors(async(req, res) => {
    const parent_post = await Post.findById({ _id: req.params.id })

    const reply = new Post({ 
        isMain: false,
        title: null,
        image: null,
        body: req.body.body, 
        author: req.session.user_id, 
        parent: req.params.id,
        replyingToUser: null,
        username: req.session.username
    })

    if (req.file) {
        console.log('test')
        const imageName = await saveS3Image(req)
        reply.image = imageName
    }

    parent_post.replies.push(reply)
    await reply.save()
    await parent_post.save()
    
    res.redirect(`/posts/${parent_post._id}`)
})

module.exports.delete_reply = catchErrors(async(req, res) => {
    const reply = await Post.findById({ _id: req.params.id })
    if (!reply) {
        res.status(404).send("Post not found")
        return
    }

    await Post.findByIdAndUpdate(reply.parent._id, { $pull: { replies: req.params.id }})
    
    if (reply.image) {
        deleteS3Image(reply)
    }

    await Post.findOneAndDelete({ _id: req.params.id })
    
    res.redirect('/posts')
})

module.exports.edit_reply = catchErrors(async(req, res) => {
    const reply = await Post.findByIdAndUpdate({ _id: req.params.id }, { body: req.body.body, editted: true })

    if (req.file) {
        if (reply.image) {
            deleteS3Image(reply)
        }
        const imageName = await saveS3Image(req)
        reply.image = imageName
        await reply.save()
    }
    const parent_post = await Post.findById(reply.parent)

    res.redirect(`/posts/${parent_post._id}`)
})

module.exports.render_reply_edit = catchErrors(async(req, res) => {
    const reply = await Post.findById({ _id: req.params.id })
    const parent_post = reply.parent
    res.render('posts/edit_reply', { reply, parent_post, session: req.session })
})

module.exports.post_child_reply = catchErrors(async(req, res) => {
    const parent = await Post.findById( req.params.parentId )
    const immediateParent = await Post.findById(req.params.childId)
    const immediateParentUsername = await User.findOne({ _id: immediateParent.author })

    const reply = new Post({ 
        isMain: false,
        title: null,
        body: req.body.body, 
        author: req.session.user_id, 
        parent: req.params.parentId,
        replyingToUser: req.params.childId,
        replyingToUsername: immediateParentUsername.username,
        username: req.session.username
    })

    if (req.file) {
        const imageName = await saveS3Image(req)
        reply.image = imageName
    }

    parent.replies.push(reply)
    immediateParent.replies.push(reply)
    await reply.save()
    await parent.save()
    await immediateParent.save()
    return res.redirect(`/posts/${parent._id}`)
})

module.exports.search = catchErrors(async(req, res) => {
    const regex = new RegExp(req.body.search, 'i') 
    const posts = await Post.find({
        "$or": [
            { title: { $regex: regex } },
            { body: { $regex: regex } }
        ]
    })
    console.log(posts)
    res.render("posts/search_result", { posts })
})

