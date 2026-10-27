const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    token: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
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
      maxlength: 120,
    },
  },
  {
    timestamps: true,
  }
);

pushTokenSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });

module.exports = mongoose.model("PushToken", pushTokenSchema);
