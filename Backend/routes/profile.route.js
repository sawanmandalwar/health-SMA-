const express = require("express");
const multer = require("multer");

const User = require("../models/User");
const auth = require("../middleware/auth");
const { isValidTimeZone } = require("../services/timezoneService");
const { uploadImage, deleteImage } = require("../services/cloudinary");

const router = express.Router();

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
    ].includes(require("path").extname(originalName).replace(".", ""));

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

      // Delete the previous Cloudinary image if one exists.
      if (user.photoUrl && user.photoUrl.includes("cloudinary.com")) {
        await deleteImage(user.photoUrl).catch((cleanupError) => {
          console.warn(
            "Could not delete previous Cloudinary profile photo:",
            cleanupError && cleanupError.message
              ? cleanupError.message
              : cleanupError
          );
        });
      }

      // Upload to Cloudinary and save the secure_url.
      const { secure_url } = await uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.userId
      );

      user.photoUrl = secure_url;
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

    // Delete from Cloudinary if the URL is a Cloudinary URL.
    if (user.photoUrl && user.photoUrl.includes("cloudinary.com")) {
      await deleteImage(user.photoUrl).catch((cleanupError) => {
        console.warn(
          "Could not delete Cloudinary profile photo:",
          cleanupError && cleanupError.message
            ? cleanupError.message
            : cleanupError
        );
      });
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