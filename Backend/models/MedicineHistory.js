const mongoose = require('mongoose');

const medicineHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },

    medicineName: {
      type: String,
      required: true,
      trim: true,
    },

    dosage: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['Taken', 'Missed'],
      required: true,
    },

    scheduledDate: {
      type: Date,
      required: true,
    },

    takenAt: {
      type: Date,
      default: null,
    },

    // Which scheduled dose this record belongs to (id of the schedule entry).
    doseId: {
      type: String,
      default: null,
      index: true,
    },

    // Prescribed quantity for this dose (used for stock deduction).
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // True once this Taken dose has reduced the medicine stock, so repeated
    // submissions never deduct twice.
    stockDeducted: {
      type: Boolean,
      default: false,
    },

    // Unique per medicine + dose + calendar day, used to block duplicates.
    doseKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Guarantees one record per dose per day, while leaving legacy records
// (which have no doseKey) untouched.
medicineHistorySchema.index(
  { doseKey: 1 },
  {
    unique: true,
    partialFilterExpression: { doseKey: { $type: 'string' } },
  }
);

medicineHistorySchema.index({ userId: 1, scheduledDate: -1 });

module.exports = mongoose.model(
  'MedicineHistory',
  medicineHistorySchema
);