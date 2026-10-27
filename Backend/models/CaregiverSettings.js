const mongoose = require("mongoose");

const caregiverSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    alertsEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const CaregiverSettings = mongoose.model(
  "CaregiverSettings",
  caregiverSettingsSchema
);

module.exports = CaregiverSettings;
