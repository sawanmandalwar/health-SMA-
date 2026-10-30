const cloudinary = require("cloudinary").v2;

// Configure Cloudinary using environment variables. The API key and secret
// are backend-only and must never be exposed to the frontend.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an image buffer to Cloudinary.
 * @param {Buffer} buffer - The image file buffer (from multer memoryStorage).
 * @param {string} originalname - Original filename (used for the public_id prefix).
 * @param {string} userId - The logged-in user's ID (namespacing + cache busting).
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadImage(buffer, originalname, userId) {
  const safeName = String(originalname || "profile")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/\.[^/.]+$/, "");

  const publicId = `health-saathi/avatars/user_${String(userId)}_${safeName}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: "health-saathi/avatars",
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        invalidate: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        }
      }
    ).end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by its public_id.
 * Extracts the public_id from a Cloudinary secure_url.
 * @param {string} secureUrl - The Cloudinary secure_url of the image to delete.
 * @returns {Promise<void>}
 */
async function deleteImage(secureUrl) {
  if (!secureUrl) {
    return;
  }

  try {
    // Cloudinary URLs look like:
    // https://res.cloudinary.com/<cloud_name>/image/upload/<version>/<public_id>.<ext>
    // We extract everything between /upload/ and the last dot-separated extension.
    const url = new URL(secureUrl);
    const pathname = url.pathname; // /image/upload/v1234567890/folder/public_id.ext

    const uploadMarker = "/image/upload/";
    const idx = pathname.indexOf(uploadMarker);

    if (idx === -1) {
      console.warn("Not a Cloudinary URL, skipping delete:", secureUrl);
      return;
    }

    const afterUpload = pathname.slice(idx + uploadMarker.length);
    // Strip version segment (e.g. "v1234567890/")
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    // Remove file extension
    const publicId = withoutVersion.replace(/\.[^/.]+$/, "");

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("Cloudinary delete error:", error.message);
  }
}

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
};
