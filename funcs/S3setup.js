const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const crypto = require('crypto')
const sharp = require('sharp')
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

module.exports.saveS3Image = async (req, height = 400, width = 400) => {
    const buffer = await sharp(req.file.buffer).resize({ height: height, width: width, fit: "contain" }).toBuffer()
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

module.exports.deleteS3Image = async (post) => {
    const delete_params = {
        Bucket: bucketName,
        Key: post.image,
    }

    const delete_command = new DeleteObjectCommand(delete_params)
    await s3.send(delete_command)
}

module.exports.generateS3ImageURL = async (post) => {
    const getObjectParams = {
        Bucket: bucketName,
        Key: post.image
    }

    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })

    return url
}



