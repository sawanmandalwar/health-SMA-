const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ['Medicine', 'Appointment', 'General'],
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    scheduledFor: {
      type: Date,
      default: null,
    },

    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
      index: true,
    },

    doseId: {
      type: String,
      default: null,
    },

    notificationKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index(
  { userId: 1, notificationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { notificationKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);