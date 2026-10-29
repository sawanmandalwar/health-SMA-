const mongoose = require("mongoose");

// One row per browser/device that subscribed to Web Push for a user.
// The endpoint is unique per browser subscription, so re-subscribing the same
// device updates the existing row instead of creating duplicates.
const webPushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    endpoint: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 2048,
    },

    // Encryption keys returned by PushSubscription.toJSON().keys.
    keys: {
      p256dh: {
        type: String,
        required: true,
        trim: true,
      },
      auth: {
        type: String,
        required: true,
        trim: true,
      },
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 512,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    lastError: {
      type: String,
      default: "",
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  }
);

webPushSubscriptionSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model(
  "WebPushSubscription",
  webPushSubscriptionSchema
);
