import { v2 as cloudinary } from 'cloudinary'

let configured = false

function configure() {
  if (configured) return
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

export function uploadBuffer(buffer, folder = 'blog') {
  configure()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Cap stored dimensions so a 6000px phone photo does not become the
        // asset every reader has to download.
        transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
      },
      (err, result) =>
        err
          ? reject(err)
          : resolve({ url: result.secure_url, width: result.width, height: result.height }),
    )
    stream.end(buffer)
  })
}
