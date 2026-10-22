const mongoose = require("mongoose");

// One scheduled dose per day (e.g. "8:00 AM", 2 tablets).
const doseScheduleSchema = new mongoose.Schema(
  {
    time: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },

    label: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const medicineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    dosage: {
      type: String,
      required: true,
      trim: true,
    },

    timing: {
      type: String,
      required: true,
      trim: true,
    },

    time: {
      type: String,
      required: true,
      trim: true,
    },

    frequency: {
      type: String,
      required: true,
      trim: true,
    },

    startDate: {
      type: String,
      default: "",
    },

    endDate: {
      type: String,
      default: "",
    },

    // Multiple scheduled doses per day. Empty for older records, which fall
    // back to the single legacy "time" field.
    schedules: {
      type: [doseScheduleSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["Pending", "Taken", "Missed"],
      default: "Pending",
    },

    // ==========================================
    // REFILL / STOCK TRACKING
    // All optional (null) so older records remain valid.
    // ==========================================

    initialQuantity: {
      type: Number,
      default: null,
      min: 0,
    },

    remainingQuantity: {
      type: Number,
      default: null,
      min: 0,
    },

    unit: {
      type: String,
      default: "",
      trim: true,
    },

    refillThreshold: {
      type: Number,
      default: null,
      min: 0,
    },

    dailyConsumption: {
      type: Number,
      default: null,
      min: 0,
    },

    refillReminderDays: {
      type: Number,
      default: 3,
      min: 0,
    },

    estimatedRunOutDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Medicine = mongoose.model("Medicine", medicineSchema);

module.exports = Medicine;