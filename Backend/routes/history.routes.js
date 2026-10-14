const express = require('express');
const router = express.Router();

const MedicineHistory = require('../models/MedicineHistory');
const authMiddleware = require('../middleware/auth');
// const authMiddleware = require('../middleware/authMiddleware');

// GET: Retrieve medicine history for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const history = await MedicineHistory.find({ userId })
      .sort({ timestamp: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Get medicine history error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Unable to retrieve medicine history.',
    });
  }
});

// POST: Save a medicine history record
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const {
      medicineId,
      medicineName,
      dosage,
      time,
      status,
      scheduledDate,
      takenAt,
    } = req.body;

    if (
      !medicineId ||
      !medicineName ||
      !dosage ||
      !time ||
      !['Taken', 'Missed'].includes(status) ||
      !scheduledDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required history fields.',
      });
    }

    const record = await MedicineHistory.create({
      userId,
      medicineId,
      medicineName,
      dosage,
      time,
      status,
      scheduledDate,
      takenAt: status === 'Taken' ? takenAt || new Date() : null,
    });

    res.status(201).json({
      success: true,
      message: 'Medicine history saved successfully.',
      history: record,
    });
  } catch (error) {
    console.error('Save medicine history error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Unable to save medicine history.',
    });
  }
});

module.exports = router;