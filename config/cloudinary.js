const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (filePath, folder = 'video-thumbnails') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { width: 640, height: 360, crop: 'fill' },
        { quality: 'auto' }
      ]
    });
    return result;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
};

const uploadFromUrl = async (imageUrl, folder = 'video-thumbnails') => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { width: 640, height: 360, crop: 'fill' },
        { quality: 'auto' }
      ]
    });
    return result;
  } catch (error) {
    console.error('Cloudinary URL Upload Error:', error);
    throw error;
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  uploadFromUrl,
  deleteFromCloudinary
};