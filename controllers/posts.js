const Post = require('../models/post')
const User = require('../models/user')
const multer = require('multer')
const crypto = require('crypto')
const sharp = require('sharp')

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");



const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
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

const getDate = () => {
    let today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    const yyyy = today.getFullYear();

    today = mm + '/' + dd + '/' + yyyy;
    return today
}


//upload.single('image')

module.exports.new_post = async(req, res, next) => {
    if (!req.session.loggedIn) { return }
    // const post = new Post({ title: req.body.title, body: req.body.body, author: req.session.user_id })
    // console.log(req.file)
    // req.file.buffer //Actual image data, what we will send to S3
    const buffer = await sharp(req.file.buffer).resize({ height: 1920, width: 1080, fit: "contain" }).toBuffer()

    const imageName = randomImageName()
    const params = {
        Bucket: bucketName,
        Key: imageName,
        Body: buffer,
        ContentType: req.file.mimetype
    }

    const command = new PutObjectCommand(params)
    await s3.send(command)
    const post = new Post({ title: req.body.title, body: req.body.body, author: req.session.user_id, image: imageName, createdOn: new Date() })



    await post.save()
    res.redirect(`/posts/${post._id}`)
}

module.exports.index = async(req, res) => {
    const posts = await Post.find()
    res.render('posts/index', { posts })
}

module.exports.post = async(req, res) => {
    let post = await Post.findById(req.params.id)
    const author = await User.findById(post.author)

    const getObjectParams = {
        Bucket: bucketName,
        Key: post.image
    }
    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    post = await Post.findByIdAndUpdate({ _id: req.params.id}, { imageURL: url})

    res.render('posts/post', { data: { post, author, session: req.session, url } })
}

module.exports.render_edit = async(req, res) => {
    const post = await Post.findById(req.params.id)
    res.render('posts/edit', { post })
}
 
module.exports.edit_post = async(req, res) => {
    const post = await Post.findByIdAndUpdate({ _id: req.params.id }, { title: req.body.title, body: req.body.body })
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

    await Post.findOneAndDelete({ _id: req.params.id })
    res.redirect('/posts')
}
