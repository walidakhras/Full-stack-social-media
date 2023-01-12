const Post = require('../models/post')
const User = require('../models/user')
const multer = require('multer')
const crypto = require('crypto')
const sharp = require('sharp')

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");



// const storage = multer.memoryStorage()
// const upload = multer({ storage: storage })
require('dotenv').config()

const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey,
    },
    region: bucketRegion
})

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

const saveS3Image = async (req) => {
    const buffer = await sharp(req.file.buffer).resize({ height: 400, width: 400, fit: "contain" }).toBuffer()
    const imageName = randomImageName()
    const params = {
        Bucket: bucketName,
        Key: imageName,
        Body: buffer,
        ContentType: req.file.mimetype
    }
    const command = new PutObjectCommand(params)
    await s3.send(command)

    return imageName
}

const deleteS3Image = async (post) => {
    const delete_params = {
        Bucket: bucketName,
        Key: post.image,
    }

    const delete_command = new DeleteObjectCommand(delete_params)
    await s3.send(delete_command)
}

const generateS3ImageURL = async (post) => {
    const getObjectParams = {
        Bucket: bucketName,
        Key: r.image
    }

    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    post.imageURL = url
    await post.save()
}



//upload.single('image')

module.exports.new_post = async(req, res, next) => {
    if (!req.session.loggedIn) { return }
    // const post = new Post({ title: req.body.title, body: req.body.body, author: req.session.user_id })
    // console.log(req.file)
    // req.file.buffer //Actual image data, what we will send to S3

    const imageName = await saveS3Image(req)

    const post = new Post({ 
        isMain: true,
        title: req.body.title, 
        body: req.body.body, 
        author: req.session.user_id, 
        image: imageName, 
        parent: null
    })


    await post.save()
    res.redirect(`/posts/${post._id}`)
}

module.exports.index = async(req, res) => {
    const posts = await Post.find()

    for (let post of posts) {
        if (post.isMain && (!post.imageURL)) {
            generateS3ImageURL(post)
        }
    }

    res.render('posts/index', { posts })
}

module.exports.post = async(req, res) => {
    const post = await Post.findById(req.params.id)
    const author = await User.findById(post.author)    

    const replies = []
    await Promise.all(post.replies.map(async reply => {
        // console.log("REPLY:" + reply)
        const r = await Post.findById({ _id: reply })

        if (r.image) {
            const getObjectParams = {
                Bucket: bucketName,
                Key: r.image
            }
            const command = new GetObjectCommand(getObjectParams)
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
            r.imageURL = url
            await r.save()
        }
        replies.push(r)


        // const getObjectParams = {
        //     Bucket: bucketName,
        //     Key: r.image
        // }
        // const command = new GetObjectCommand(getObjectParams)
        // const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
        // r.imageURL = url
        // await r.save()
        // replies.push(r)
    
    }))
    
    const getObjectParams = {
        Bucket: bucketName,
        Key: post.image
    }
    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })

    post.imageURL = url
    post.views = post.views + 1
    await post.save()

    // post = await Post.findByIdAndUpdate({ _id: req.params.id}, { imageURL: url, views: { $inc: { views: 1 }}})

    res.render('posts/post', { data: { post, author, session: req.session, url, replies }})
}

module.exports.render_edit = async(req, res) => {
    const post = await Post.findById(req.params.id)
    res.render('posts/edit', { post })
}
 
module.exports.edit_post = async(req, res) => {
    
    const post = await Post.findById(req.params.id)

    if (post.image) {
        deleteS3Image(post)
    }
    // const delete_params = {
    //     Bucket: bucketName,
    //     Key: post.image,
    // }

    // const delete_command = new DeleteObjectCommand(delete_params)
    // await s3.send(delete_command)

    const imageName = await saveS3Image(req)

    // const buffer = await sharp(req.file.buffer).resize({ height: 500, width: 500, fit: "contain" }).toBuffer()

    // const imageName = randomImageName()
    // const new_img_params = {
    //     Bucket: bucketName,
    //     Key: imageName,
    //     Body: buffer,
    //     ContentType: req.file.mimetype
    // }

    // const new_img_command = new PutObjectCommand(new_img_params)
    // await s3.send(new_img_command)

    post.title = req.body.title
    post.body = req.body.body
    post.editted = true 
    post.image = imageName
    await post.save()

    // post = await Post.findByIdAndUpdate({ _id: req.params.id }, { title: req.body.title, body: req.body.body, editted: true })
    res.redirect(`/posts/${post._id}`)
}

module.exports.delete_post = async(req, res) => {
    const post = await Post.findById({ _id: req.params.id })
    if (!post) {
        res.status(404).send("Post not found")
        return
    }
    
    const params = {
        Bucket: bucketName,
        Key: post.image,
    }
    const command = new DeleteObjectCommand(params)
    await s3.send(command)

    for (let reply of post.replies) {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: reply.image
        }))
    }
    await Post.deleteMany({ parent: post._id })
    await Post.findOneAndDelete({ _id: req.params.id })
    res.redirect('/posts')
}

module.exports.get_reply = async(req, res) => {
    const parent_post = await Post.findById({ _id: req.params.id })
    res.render('posts/reply', { parent_post })
}

module.exports.get_child_reply = async(req, res) => {
    const parent_post = await Post.findById(req.params.parentId)
    // const child = await Post.findById(req.params.childId)
    res.render('posts/reply', { parent_post })
}

module.exports.post_reply = async(req, res) => {
    const parent_post = await Post.findById({ _id: req.params.id })
    const reply = new Post({ 
        isMain: false,
        title: null,
        image: null,
        body: req.body.body, 
        author: req.session.user_id, 
        parent: req.params.id,
        replyingToUser: null
    })

    if (req.file) {
        console.log('test')
        const imageName = await saveS3Image(req)
        reply.image = imageName
    }

    // const buffer = await sharp(req.file.buffer).resize({ height: 500, width: 500, fit: "contain" }).toBuffer()
    // const imageName = randomImageName()
    // const params = {
    //     Bucket: bucketName,
    //     Key: imageName,
    //     Body: buffer,
    //     ContentType: req.file.mimetype
    // }

    // const command = new PutObjectCommand(params)
    // await s3.send(command)

    parent_post.replies.push(reply)
    await reply.save()
    await parent_post.save()
    
    res.redirect(`/posts/${parent_post._id}`)
}

module.exports.delete_reply = async(req, res) => {
    const reply = await Post.findById({ _id: req.params.id })
    if (!reply) {
        res.status(404).send("Post not found")
        return
    }

    await Post.findByIdAndUpdate(reply.parent._id, { $pull: { replies: req.params.id }})
    
    if (reply.image) {
        deleteS3Image(reply)
    }
    // const params = {
    //     Bucket: bucketName,
    //     Key: reply.image,
    // }
    // const command = new DeleteObjectCommand(params)
    // await s3.send(command)


    await Post.findOneAndDelete({ _id: req.params.id })
    
    res.redirect('/posts')
}

module.exports.edit_reply = async(req, res) => {
    console.log('test1!')
    const reply = await Post.findByIdAndUpdate({ _id: req.params.id }, { body: req.body.body, editted: true })
    console.log(req.file.buffer)
    if (req.file) {
        console.log('test!')
        const imageName = await saveS3Image(req)
        reply.image = imageName
        await reply.save()
    }
    const parent_post = await Post.findById(reply.parent)

    res.redirect(`/posts/${parent_post._id}`)
}

module.exports.render_reply_edit = async(req, res) => {
    const reply = await Post.findById({ _id: req.params.id })
    const parent_post = reply.parent
    res.render('posts/edit_reply', { reply, parent_post })
}

module.exports.post_child_reply = async(req, res) => {
    const parent = await Post.findById( req.params.parentId )

    const imageName = await saveS3Image(req)

    const reply = new Post({ 
        isMain: false,
        title: null,
        body: req.body.body, 
        author: req.session.user_id, 
        image: imageName, 
        parent: req.params.parentId,
        immediateParent: req.params.childId
    })
    parent.replies.push(reply)
    // child.replies.push(reply) 
    await reply.save()
    await parent.save()
    res.redirect(`/posts/${parent._id}`)
}
