const express = require("express");
const mongoose = require("mongoose");

const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const auth = require("../middleware/auth");
const { serializeStock } = require("../services/refillService");
const {
  markDose,
  buildDoseViews,
  deriveMedicineStatus,
  getDayRange,
} = require("../services/doseService");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function loadDoses(userId, medicine, reference) {
  const { start, end } = getDayRange(reference);
  const history = await MedicineHistory.find({
    userId,
    medicineId: medicine._id,
    scheduledDate: { $gte: start, $lt: end },
  });
  return buildDoseViews(medicine, history, reference);
}

// ==========================================
// ALL MEDICINES: TODAY'S DOSE STATUS
// ==========================================
router.get("/doses/today", auth, async (req, res) => {
  try {
    const reference = req.query.date ? new Date(req.query.date) : new Date();
    const when = Number.isNaN(reference.getTime()) ? new Date() : reference;

    const medicines = await Medicine.find({ userId: req.userId });

    const { start, end } = getDayRange(when);
    const history = await MedicineHistory.find({
      userId: req.userId,
      scheduledDate: { $gte: start, $lt: end },
    });

    const medicines_ = medicines.map((medicine) => {
      const records = history.filter(
        (item) => String(item.medicineId) === String(medicine._id)
      );
      const doses = buildDoseViews(medicine, records, when);

      return {
        medicineId: String(medicine._id),
        name: medicine.name,
        status: deriveMedicineStatus(doses, medicine.status),
        doses,
      };
    });

    res.status(200).json({
      success: true,
      date: start,
      medicines: medicines_,
    });
  } catch (error) {
    console.error("Today Doses Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load today's doses.",
    });
  }
});

// ==========================================
// ONE MEDICINE: DOSE STATUS FOR A DAY
// ==========================================
router.get("/:id/doses", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid medicine id." });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found." });
    }

    const reference = req.query.date ? new Date(req.query.date) : new Date();
    const when = Number.isNaN(reference.getTime()) ? new Date() : reference;

    const doses = await loadDoses(req.userId, medicine, when);

    res.status(200).json({
      success: true,
      date: getDayRange(when).start,
      medicineStatus: deriveMedicineStatus(doses, medicine.status),
      doses,
      stock: serializeStock(medicine),
    });
  } catch (error) {
    console.error("Medicine Doses Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load doses.",
    });
  }
});

// ==========================================
// MARK A SINGLE DOSE TAKEN / MISSED
// ==========================================
router.post("/:id/doses/:doseId/status", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid medicine id." });
    }

    const { status, date } = req.body;

    const result = await markDose({
      userId: req.userId,
      medicineId: req.params.id,
      doseId: req.params.doseId,
      status,
      when: date,
    });

    const doses = await loadDoses(req.userId, result.medicine, result.history.scheduledDate);

    res.status(200).json({
      success: true,
      message: result.duplicate
        ? "Dose already recorded; stock unchanged."
        : `Dose marked ${result.history.status}.`,
      doseId: req.params.doseId,
      status: result.history.status,
      duplicate: Boolean(result.duplicate),
      stockDeducted: Boolean(result.deductedNow),
      medicineStatus: deriveMedicineStatus(doses, result.medicine.status),
      doses,
      stock: serializeStock(result.medicine),
    });
  } catch (error) {
    console.error("Mark Dose Error:", error.message);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to update dose.",
    });
  }
});

module.exports = router;
