const express = require("express");
const mongoose = require("mongoose");

const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { serializeStock } = require("../services/refillService");
const {
  markDose,
  buildDoseViews,
  deriveMedicineStatus,
  getDayRangeForTimeZone,
} = require("../services/doseService");
const {
  syncMedicineNotifications,
} = require("../services/notificationService");
const {
  closeOpenAlertForTaken,
  processMissedDosesForUser,
} = require("../services/missedDoseService");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getUserTimeZone(userId) {
  const user = await User.findById(userId).select("timezone").lean();
  return user?.timezone || "Asia/Kolkata";
}

async function loadDoses(userId, medicine, reference, timeZone) {
  const { start, end } = getDayRangeForTimeZone(reference, timeZone);
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

    const [medicines, timeZone] = await Promise.all([
      Medicine.find({ userId: req.userId }),
      getUserTimeZone(req.userId),
    ]);

    const { start, end } = getDayRangeForTimeZone(when, timeZone);
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

    const [medicine, timeZone] = await Promise.all([
      Medicine.findOne({
        _id: req.params.id,
        userId: req.userId,
      }),
      getUserTimeZone(req.userId),
    ]);

    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found." });
    }

    const reference = req.query.date ? new Date(req.query.date) : new Date();
    const when = Number.isNaN(reference.getTime()) ? new Date() : reference;

    const range = getDayRangeForTimeZone(when, timeZone);
    const doses = await loadDoses(req.userId, medicine, when, timeZone);

    res.status(200).json({
      success: true,
      date: range.start,
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
    const timeZone = await getUserTimeZone(req.userId);

    const result = await markDose({
      userId: req.userId,
      medicineId: req.params.id,
      doseId: req.params.doseId,
      status,
      when: date,
      timeZone,
    });

    if (status === "Taken") {
      try {
        await closeOpenAlertForTaken({
          userId: req.userId,
          takenAt: result.history.scheduledDate,
          doseKey: result.history.doseKey,
        });
      } catch (alertError) {
        console.error("Dose alert close error:", alertError);
      }
    } else if (status === "Missed" && !result.duplicate) {
      // The user just asserted a dose was missed: run the missed-dose alert
      // pipeline right away so threshold reached here emails the caregiver
      // immediately instead of whenever the next periodic sweep lands.
      processMissedDosesForUser(req.userId, { now: new Date() })
        .then((summary) => {
          console.log("Immediate missed-dose processing:", JSON.stringify(summary));
        })
        .catch((processingError) => {
          console.error(
            "Immediate missed-dose processing error:",
            processingError && processingError.message
              ? processingError.message
              : processingError
          );
        });
    }

    const doses = await loadDoses(
      req.userId,
      result.medicine,
      result.history.scheduledDate,
      timeZone
    );

    try {
      await syncMedicineNotifications(req.userId, { timeZone });
    } catch (notificationError) {
      console.error(
        "Dose notification sync error:",
        notificationError
      );
    }

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
