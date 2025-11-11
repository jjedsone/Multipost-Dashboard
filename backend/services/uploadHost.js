const path = require('node:path');

const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_UPLOAD_FOLDER = 'multipost',
} = process.env;

let cloudinaryConfigured = false;

function ensureCloudinaryConfig() {
  if (cloudinaryConfigured) return true;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  cloudinaryConfigured = true;
  return true;
}

async function uploadToCloudinary(filePath) {
  if (!ensureCloudinaryConfig()) {
    return null;
  }

  const options = {
    resource_type: 'auto',
    folder: CLOUDINARY_UPLOAD_FOLDER,
    overwrite: true,
    use_filename: true,
    unique_filename: false,
  };

  const response = await cloudinary.uploader.upload(filePath, options);

  return {
    url: response.secure_url,
    publicId: response.public_id,
    size: response.bytes,
    resourceType: response.resource_type,
  };
}

module.exports = {
  uploadToCloudinary,
  ensureCloudinaryConfig,
};

