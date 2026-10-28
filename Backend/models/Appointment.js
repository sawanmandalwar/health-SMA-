const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    doctor: {
      type: String,
      required: true,
      trim: true,
    },

    specialty: {
      type: String,
      required: true,
      trim: true,
    },

    hospital: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      required: true,
      trim: true,
    },

    time: {
      type: String,
      required: true,
      trim: true,
    },

    // Shared by every document created from one "Add Appointment" form
    // submission (one document per time slot). Lets an edit replace the
    // whole set of timings for the same visit.
    groupId: {
      type: String,
      default: null,
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    reminder: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["Upcoming", "Previous"],
      default: "Upcoming",
    },

    // Parsed UTC instant of date + time in the user's timezone. Cached on
    // the document so the missed-appointment sweep does not re-parse free
    // text date/time strings on every run.
    appointmentAt: {
      type: Date,
      default: null,
    },

    appointmentAtFailed: {
      type: Boolean,
      default: false,
    },

    // Set (with status moved to "Previous") once the appointment time has
    // passed the grace window without the user completing it.
    missedAt: {
      type: Date,
      default: null,
    },

    // Caregiver email delivery state for the miss.
    caregiverNotified: {
      type: Boolean,
      default: false,
    },

    caregiverNotifySkipped: {
      type: Boolean,
      default: false,
    },

    caregiverNotifyAttempts: {
      type: Number,
      default: 0,
    },

    caregiverNotifyLastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Appointment = mongoose.model(
  "Appointment",
  appointmentSchema
);

module.exports = Appointment;