const express = require("express");
const mongoose = require("mongoose");

const Medicine = require("../models/Medicine");
const RefillHistory = require("../models/RefillHistory");
const auth = require("../middleware/auth");
const {
  recordRefill,
  updateStock,
  isRefillNeeded,
  serializeStock,
} = require("../services/refillService");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ==========================================
// GET MEDICINES THAT NEED REFILLING
// ==========================================
router.get("/needs-refill", auth, async (req, res) => {
  try {
    const medicines = await Medicine.find({
      userId: req.userId,
      remainingQuantity: { $ne: null },
    }).sort({ estimatedRunOutDate: 1 });

    const needsRefill = medicines.filter((medicine) =>
      isRefillNeeded(medicine)
    );

    res.status(200).json({
      success: true,
      count: needsRefill.length,
      medicines: needsRefill.map((medicine) => serializeStock(medicine)),
    });
  } catch (error) {
    console.error("Needs Refill Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load medicines that need refilling.",
    });
  }
});

// ==========================================
// GET FULL REFILL HISTORY FOR THE USER
// ==========================================
router.get("/refill-history", auth, async (req, res) => {
  try {
    const history = await RefillHistory.find({ userId: req.userId }).sort({
      refilledAt: -1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Refill History Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load refill history.",
    });
  }
});

// ==========================================
// GET MEDICINE STOCK
// ==========================================
router.get("/:id/stock", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id.",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found.",
      });
    }

    res.status(200).json({
      success: true,
      stock: serializeStock(medicine),
    });
  } catch (error) {
    console.error("Get Stock Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load medicine stock.",
    });
  }
});

// ==========================================
// UPDATE MEDICINE STOCK
// ==========================================
router.put("/:id/stock", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id.",
      });
    }

    const {
      initialQuantity,
      remainingQuantity,
      unit,
      refillThreshold,
      dailyConsumption,
      refillReminderDays,
    } = req.body;

    const medicine = await updateStock({
      userId: req.userId,
      medicineId: req.params.id,
      initialQuantity,
      remainingQuantity,
      unit,
      refillThreshold,
      dailyConsumption,
      refillReminderDays,
    });

    res.status(200).json({
      success: true,
      message: "Medicine stock updated successfully.",
      stock: serializeStock(medicine),
    });
  } catch (error) {
    console.error("Update Stock Error:", error.message);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update medicine stock.",
    });
  }
});

// ==========================================
// RECORD A REFILL
// ==========================================
router.post("/:id/refill", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id.",
      });
    }

    const { quantityAdded, unit, refilledAt } = req.body;

    const result = await recordRefill({
      userId: req.userId,
      medicineId: req.params.id,
      quantityAdded,
      unit,
      refilledAt,
    });

    res.status(201).json({
      success: true,
      message: "Refill recorded successfully.",
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
      stock: serializeStock(result.medicine),
      history: result.history,
    });
  } catch (error) {
    console.error("Record Refill Error:", error.message);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to record refill.",
    });
  }
});

// ==========================================
// GET REFILL HISTORY FOR ONE MEDICINE
// ==========================================
router.get("/:id/refill-history", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id.",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found.",
      });
    }

    const history = await RefillHistory.find({
      userId: req.userId,
      medicineId: req.params.id,
    }).sort({ refilledAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Medicine Refill History Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load refill history for this medicine.",
    });
  }
});

module.exports = router;
