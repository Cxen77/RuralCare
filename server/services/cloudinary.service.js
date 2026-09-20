/**
 * RuralCare Cloudinary Upload Service
 *
 * Uploads emergency capture images directly to Cloudinary folder `ruralcare/emergencies`.
 * Reads purely from environment variables:
 *  - CLOUDINARY_CLOUD_NAME
 *  - CLOUDINARY_API_KEY
 *  - CLOUDINARY_API_SECRET
 *
 * If environment variables are not yet configured in development,
 * gracefully persists files locally under `server/uploads/emergencies`
 * and generates a mock Cloudinary asset descriptor so systems work end-to-end.
 */

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  console.log(`[cloudinary] Configured with cloud: ${cloudName}`);
} else {
  console.log('[cloudinary] Credentials not set in env; using local fallback directory: server/uploads/emergencies');
}

/**
 * Ensure local uploads directory exists for fallback
 */
const localUploadsDir = path.join(__dirname, '..', 'uploads', 'emergencies');
if (!fs.existsSync(localUploadsDir)) {
  try {
    fs.mkdirSync(localUploadsDir, { recursive: true });
  } catch (err) {
    console.warn('[cloudinary] Failed to create local uploads folder:', err.message);
  }
}

/**
 * Upload a file buffer to Cloudinary (or local fallback).
 *
 * @param {Buffer} buffer File buffer from multer (memoryStorage)
 * @param {string} originalName Original filename or generated name
 * @param {string} mimeType Mime type (e.g. image/jpeg)
 * @returns {Promise<{ imageUrl: string, cloudinaryPublicId: string }>}
 */
async function uploadEmergencyImage(buffer, originalName = 'emergency.jpg', mimeType = 'image/jpeg') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid image payload: buffer is empty or missing.');
  }

  // If real Cloudinary credentials are provided, attempt stream upload
  if (isConfigured) {
    try {
      const cldResult = await new Promise((resolve, reject) => {
        const timeoutTimer = setTimeout(() => {
          reject(new Error('Cloudinary upload timed out after 6s.'));
        }, 6000);

        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'ruralcare/emergencies',
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            clearTimeout(timeoutTimer);
            if (error) {
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            resolve({
              imageUrl: result.secure_url,
              cloudinaryPublicId: result.public_id,
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        );

        uploadStream.end(buffer);
      });

      return cldResult;
    } catch (cldErr) {
      console.warn(`[cloudinary] Cloudinary stream failed (${cldErr.message}); falling back to local storage.`);
    }
  }

  // Graceful fallback for local development before credentials are provided
  const ext = path.extname(originalName) || (mimeType.includes('png') ? '.png' : '.jpg');
  const filename = `emg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`;
  const filePath = path.join(localUploadsDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  const serverPort = process.env.PORT || 4000;
  const imageUrl = `http://localhost:${serverPort}/uploads/emergencies/${filename}`;
  const cloudinaryPublicId = `cld_dev_${filename.replace(/\.[^/.]+$/, '')}`;

  return {
    url: imageUrl,
    publicId: cloudinaryPublicId,
    imageUrl,
    cloudinaryPublicId,
  };
}

module.exports = {
  uploadEmergencyImage,
  uploadToCloudinary: uploadEmergencyImage,
  isCloudinaryConfigured: () => isConfigured,
};
