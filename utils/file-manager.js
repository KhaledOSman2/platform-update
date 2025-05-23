const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: "dp6y9qk9l",
  api_key:    "182218919357853",
  api_secret: "fwwXyU2qE-ETEijjrB6fPD2yINw",
});

console.clear()
console.log(`- Connected to Cloudinary`);

const upload = multer({ storage: multer.memoryStorage() });

function extractCloudinaryPublicId(fileUrl) {
  if (!fileUrl) return null;
  try {
    const patterns = ['/image/upload/', '/video/upload/', '/raw/upload/', '/upload/'];
    let uploadIndex = -1;
    let matchedPattern = '';
    for (const pattern of patterns) {
      uploadIndex = fileUrl.indexOf(pattern);
      if (uploadIndex !== -1) {
        matchedPattern = pattern;
        break;
      }
    }
    if (uploadIndex !== -1) {
      let publicId = fileUrl.substring(uploadIndex + matchedPattern.length);
      publicId = publicId.replace(/^v\d+\//, '').split('?')[0];
      if (matchedPattern !== '/raw/upload/') {
        const extIndex = publicId.lastIndexOf('.');
        if (extIndex !== -1) publicId = publicId.substring(0, extIndex);
      }
      return publicId;
    }
  } catch (e) {
    console.error('[Cloudinary] extractPublicId error:', error.message);
  }
  return null;
}

function getCloudinaryResourceType(mimetype, fileUrl) {
  if (mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
  }
  if (fileUrl) {
    if (fileUrl.includes('/video/')) return 'video';
    if (fileUrl.includes('/raw/')) return 'raw';
    if (fileUrl.includes('/image/')) return 'image';
  }
  const ext = fileUrl ? fileUrl.split('.').pop().toLowerCase() : '';
  if (['mp4','mov','avi','webm','mkv'].includes(ext)) return 'video';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
  return 'raw';
}

async function deleteCloudinaryFileByUrl(fileUrl) {
  if (!fileUrl) return;
  const publicId = extractCloudinaryPublicId(fileUrl);
  if (!publicId) {
    console.error('[Cloudinary Delete] publicId extraction failed for:', fileUrl);
    return;
  }
  const resourceTypes = ['raw', 'image', 'video'];
  for (const type of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
      console.log(`[Cloudinary Delete] Tried ${type}:`, result);
      if (result.result === 'ok') return;
    } catch (err) {
      console.error(`[Cloudinary Delete] Error for ${type}:`, err.message);
    }
  }
  console.warn('[Cloudinary Delete] File not found:', fileUrl);
}

async function uploadToCloudinary(buffer, mimetype, folder = 'the-platform', originalname = '') {
  const resource_type = getCloudinaryResourceType(mimetype);
  const public_id = Date.now().toString() + '-' + Math.floor(Math.random() * 1000000).toString();
  let format;
  if (originalname) {
    const lastDot = originalname.lastIndexOf('.');
    if (lastDot !== -1) {
      format = originalname.substring(lastDot + 1).toLowerCase();
    }
  }
  return new Promise((resolve, reject) => {
    const options = { folder, resource_type, public_id };
    if (format) options.format = format;
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

const uploadCourseImage = upload.single('courseImage');
const uploadActivityFile = upload.single('activityFile');
async function replaceCourseImage(oldUrl, file) {
  if (oldUrl) await deleteCloudinaryFileByUrl(oldUrl);
  if (!file) return '';
  const result = await uploadToCloudinary(file.buffer, file.mimetype, 'courses', file.originalname);
  return result.secure_url;
}

async function replaceActivityFile(oldUrl, file) {
  if (oldUrl) await deleteCloudinaryFileByUrl(oldUrl);
  if (!file) return '';
  const result = await uploadToCloudinary(file.buffer, file.mimetype, 'activities', file.originalname);
  return result.secure_url;
}

module.exports = {
  uploadCourseImage,
  uploadActivityFile,
  replaceCourseImage,
  replaceActivityFile,
  deleteCloudinaryFileByUrl,
  uploadToCloudinary,
};
