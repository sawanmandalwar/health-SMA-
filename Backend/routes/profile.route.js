const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const User = require("../models/User");
const auth = require("../middleware/auth");
const { isValidTimeZone } = require("../services/timezoneService");

const router = express.Router();

// Profile photos are served from /uploads/avatars by server.js.
const AVATARS_DIR = path.join(__dirname, "..", "uploads", "avatars");

// Pick a safe file extension from the uploaded MIME type (fall back to
// jpg for unknown image/* types).
function getPhotoExtension(file) {
  const mime = String(file?.mimetype || "").toLowerCase();

  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";

  return "jpg";
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const originalName = String(file.originalname || "").toLowerCase();

    const mimeIsImage = mime.startsWith("image/");
    const extensionIsImage = [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
    ].includes(path.extname(originalName).replace(".", ""));

    // Some clients send unknown MIME types for images, so the extension
    // is accepted as a fallback.
    if (mimeIsImage || extensionIsImage) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// GET LOGGED-IN USER PROFILE
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// UPDATE LOGGED-IN USER PROFILE
router.put("/", auth, async (req, res) => {
  try {
    const { name, phone, timezone } = req.body;

    if (timezone !== undefined && !isValidTimeZone(timezone)) {
      return res.status(400).json({
        message: "Invalid timezone",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (name !== undefined) {
      user.name = name;
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (timezone !== undefined) {
      user.timezone = timezone.trim();
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// UPDATE TIMEZONE
router.patch("/timezone", auth, async (req, res) => {
  try {
    const { timezone } = req.body;

    if (!isValidTimeZone(timezone)) {
      return res.status(400).json({
        message: "A valid IANA timezone is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { timezone: timezone.trim() },
      { returnDocument: "after", select: "-password" }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Timezone updated successfully",
      timezone: user.timezone,
    });
  } catch (error) {
    console.error("Update Timezone Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// UPLOAD PROFILE PHOTO (multipart form-data, field name "photo")
router.post(
  "/photo",
  auth,
  avatarUpload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({
          message: "Photo file is required",
        });
      }

      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      // Make sure the upload folder exists.
      if (!fs.existsSync(AVATARS_DIR)) {
        fs.mkdirSync(AVATARS_DIR, { recursive: true });
      }

      // Delete the previous photo so the uploads folder stays small.
      if (user.photoUrl) {
        const previousName = String(user.photoUrl).split("/").pop();

        if (previousName && previousName !== req.file.filename) {
          const previousPath = path.join(
            AVATARS_DIR,
            path.basename(previousName)
          );

          if (fs.existsSync(previousPath)) {
            try {
              fs.unlinkSync(previousPath);
            } catch (cleanupError) {
              console.warn(
                "Could not delete previous profile photo:",
                cleanupError && cleanupError.message
                  ? cleanupError.message
                  : cleanupError
              );
            }
          }
        }
      }

      // Save as <userId>-<timestamp>.<ext> so devices can't be served a
      // cached image after a re-upload.
      const extension = getPhotoExtension(req.file);
      const filename = `${String(req.userId)}-${Date.now()}.${extension}`;
      const filePath = path.join(AVATARS_DIR, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      user.photoUrl = `/uploads/avatars/${filename}`;
      await user.save();

      const sanitized = user.toObject();
      delete sanitized.password;

      res.status(200).json({
        message: "Profile photo updated successfully",
        user: sanitized,
      });
    } catch (error) {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Photo is too large (max 5 MB)"
            : error.message;

        return res.status(400).json({ message });
      }

      console.error("Upload Profile Photo Error:", error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// DELETE PROFILE PHOTO
router.delete("/photo", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.photoUrl) {
      const fileName = String(user.photoUrl).split("/").pop();

      if (fileName) {
        const filePath = path.join(AVATARS_DIR, path.basename(fileName));

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.warn(
              "Could not delete profile photo:",
              cleanupError && cleanupError.message
                ? cleanupError.message
                : cleanupError
            );
          }
        }
      }
    }

    user.photoUrl = "";
    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;

    res.status(200).json({
      message: "Profile photo removed successfully",
      user: sanitized,
    });
  } catch (error) {
    console.error("Delete Profile Photo Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;