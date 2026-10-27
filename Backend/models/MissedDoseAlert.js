const mongoose = require("mongoose");

const missedDoseAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Stable id of the first missed occurrence in this episode. Combined with
    // userId, this is the idempotency key that prevents duplicate alerts.
    episodeKey: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },

    consecutiveMissed: {
      type: Number,
      min: 1,
      default: 1,
    },

    firstMissedDoseKey: {
      type: String,
      required: true,
    },

    lastMissedDoseKey: {
      type: String,
      required: true,
    },

    firstMissedAt: {
      type: Date,
      required: true,
    },

    lastMissedAt: {
      type: Date,
      required: true,
    },

    caregiverEmailStatus: {
      type: String,
      enum: [
        "pending",
        "sending",
        "sent",
        "failed",
        "skipped_disabled",
        "skipped_invalid",
        "skipped_not_configured",
      ],
      default: "pending",
    },

    caregiverEmailAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    caregiverEmailLastAttemptAt: {
      type: Date,
      default: null,
    },

    caregiverEmailRetryable: {
      type: Boolean,
      default: true,
    },

    caregiverEmailMessageId: {
      type: String,
      default: "",
      maxlength: 200,
    },

    caregiverEmailLastError: {
      type: String,
      default: "",
      maxlength: 160,
    },

    inAppStatus: {
      type: String,
      enum: ["pending", "created", "failed"],
      default: "pending",
    },

    inAppNotificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
    },

    pushStatus: {
      type: String,
      enum: [
        "not_attempted",
        "sending",
        "accepted",
        "failed",
        "skipped_no_token",
      ],
      default: "not_attempted",
    },

    pushAttemptedAt: {
      type: Date,
      default: null,
    },

    pushTicketId: {
      type: String,
      default: "",
      maxlength: 200,
    },

    pushLastError: {
      type: String,
      default: "",
      maxlength: 160,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    closedByDoseKey: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

missedDoseAlertSchema.index(
  { userId: 1, episodeKey: 1 },
  { unique: true }
);

// A user can have at most one active missed-dose episode. This makes repeated
// scheduler runs safe even if two requests race to create an alert.
missedDoseAlertSchema.index(
  { userId: 1 },
  {
    name: "uniq_open_alert_per_user",
    unique: true,
    partialFilterExpression: { status: "open" },
  }
);

module.exports = mongoose.model("MissedDoseAlert", missedDoseAlertSchema);
