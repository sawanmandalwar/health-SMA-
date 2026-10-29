const mongoose = require("mongoose");

// Records every reminder occurrence that has already been pushed, so a sweep
// running every minute (or two overlapping serverless invocations) cannot send
// the same medicine dose or appointment reminder twice.
const reminderDeliverySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Stable per-occurrence key, e.g.
    //   medicine:<medicineId>:<doseId>:<YYYY-MM-DD>
    //   appointment:<appointmentId>:lead|at
    reminderKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    type: {
      type: String,
      enum: ["medicine", "appointment"],
      required: true,
    },

    // The wall-clock instant the reminder was for (not when it was sent).
    dueAt: {
      type: Date,
      required: true,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },

    // How many subscriptions received the push for this occurrence.
    deliveredCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    title: {
      type: String,
      default: "",
      maxlength: 200,
    },

    body: {
      type: String,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

reminderDeliverySchema.index({ userId: 1, reminderKey: 1 }, { unique: true });
reminderDeliverySchema.index({ dueAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model("ReminderDelivery", reminderDeliverySchema);
