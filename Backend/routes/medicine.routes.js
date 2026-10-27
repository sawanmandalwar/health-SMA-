const express = require("express");

const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const auth = require("../middleware/auth");
const {
  computeEstimatedRunOutDate,
  isRefillNeeded,
  getDailyConsumption,
} = require("../services/refillService");
const {
  normalizeSchedules,
  buildDoseViews,
  deriveMedicineStatus,
  getDayRange,
} = require("../services/doseService");
const {
  syncMedicineNotifications,
  clearMedicineNotifications,
} = require("../services/notificationService");

const router = express.Router();

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Add medicine
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      dosage,
      timing,
      time,
      frequency,
      startDate,
      endDate,
      initialQuantity,
      remainingQuantity,
      unit,
      refillThreshold,
      dailyConsumption,
      refillReminderDays,
    } = req.body;

    // Multiple scheduled doses per day (each with its own quantity).
    const schedules = normalizeSchedules(req.body.schedules);

    const primaryTime =
      (typeof time === "string" && time.trim()) ||
      (schedules[0] ? schedules[0].time : "");

    const derivedFrequency =
      (typeof frequency === "string" && frequency.trim()) ||
      (schedules.length > 0
        ? `${schedules.length} time${schedules.length > 1 ? "s" : ""} daily`
        : "Once Daily");

    if (!name || !dosage || !timing || !primaryTime) {
      return res.status(400).json({
        message: "Please provide all required medicine details",
      });
    }

    const medicine = await Medicine.create({
      userId: req.userId,
      name,
      dosage,
      timing,
      time: primaryTime,
      frequency: derivedFrequency,
      schedules,
      startDate: startDate || "",
      endDate: endDate || "",
      initialQuantity: optionalNumber(initialQuantity),
      remainingQuantity: optionalNumber(remainingQuantity),
      unit: unit !== undefined ? String(unit || "").trim() : "",
      refillThreshold: optionalNumber(refillThreshold),
      dailyConsumption: optionalNumber(dailyConsumption),
      refillReminderDays:
        optionalNumber(refillReminderDays) === null
          ? 3
          : optionalNumber(refillReminderDays),
    });

    medicine.estimatedRunOutDate = computeEstimatedRunOutDate(medicine);
    await medicine.save();

    try {
      await syncMedicineNotifications(req.userId, { medicines: [medicine] });
    } catch (notificationError) {
      console.error(
        "Medicine notification sync error:",
        notificationError
      );
    }

    res.status(201).json({
      message: "Medicine added successfully",
      medicine,
    });
  } catch (error) {
    console.error("Add Medicine Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// Get user's medicines
router.get("/", auth, async (req, res) => {
  try {
    const medicines = await Medicine.find({
      userId: req.userId,
    }).sort({ createdAt: -1 });

    // Today's dose records drive per-dose status for every medicine.
    const { start, end } = getDayRange(new Date());
    const todayHistory = await MedicineHistory.find({
      userId: req.userId,
      scheduledDate: { $gte: start, $lt: end },
    });

    // Attach computed refill state and per-dose status without persisting it.
    const enriched = medicines.map((medicine) => {
      const records = todayHistory.filter(
        (item) => String(item.medicineId) === String(medicine._id)
      );
      const doses = buildDoseViews(medicine, records);

      return {
        ...medicine.toObject(),
        needsRefill: isRefillNeeded(medicine),
        effectiveDailyConsumption: getDailyConsumption(medicine),
        todayDoses: doses,
        status: deriveMedicineStatus(doses, medicine.status),
      };
    });

    res.status(200).json({
      medicines: enriched,
    });
  } catch (error) {
    console.error("Get Medicines Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});
// Delete medicine
router.delete("/:id", auth, async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!medicine) {
      return res.status(404).json({
        message: "Medicine not found",
      });
    }

    await Medicine.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });

    try {
      await clearMedicineNotifications(req.userId, medicine._id);
    } catch (notificationError) {
      console.error(
        "Medicine notification cleanup error:",
        notificationError
      );
    }

    res.status(200).json({
      message: "Medicine deleted successfully",
    });
  } catch (error) {
    console.error("Delete Medicine Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});
// Update medicine
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name,
      dosage,
      timing,
      time,
      frequency,
      startDate,
      endDate,
      status,
      initialQuantity,
      remainingQuantity,
      unit,
      refillThreshold,
      dailyConsumption,
      refillReminderDays,
    } = req.body;

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!medicine) {
      return res.status(404).json({
        message: "Medicine not found",
      });
    }

    if (name !== undefined) medicine.name = name;
    if (dosage !== undefined) medicine.dosage = dosage;
    if (timing !== undefined) medicine.timing = timing;
    if (time !== undefined) medicine.time = time;
    if (frequency !== undefined) medicine.frequency = frequency;
    if (startDate !== undefined) medicine.startDate = startDate;
    if (endDate !== undefined) medicine.endDate = endDate;
    if (status !== undefined) medicine.status = status;
    if (initialQuantity !== undefined) {
      medicine.initialQuantity = optionalNumber(initialQuantity);
    }
    if (remainingQuantity !== undefined) {
      medicine.remainingQuantity = optionalNumber(remainingQuantity);
    }
    if (unit !== undefined) medicine.unit = String(unit || "").trim();
    if (refillThreshold !== undefined) {
      medicine.refillThreshold = optionalNumber(refillThreshold);
    }
    if (dailyConsumption !== undefined) {
      medicine.dailyConsumption = optionalNumber(dailyConsumption);
    }
    if (refillReminderDays !== undefined) {
      medicine.refillReminderDays =
        optionalNumber(refillReminderDays) === null
          ? 3
          : optionalNumber(refillReminderDays);
    }

    if (Array.isArray(req.body.schedules)) {
      const schedules = normalizeSchedules(req.body.schedules);
      medicine.schedules = schedules;
      if (schedules.length > 0 && time === undefined) {
        medicine.time = schedules[0].time;
      }
    }

    medicine.estimatedRunOutDate = computeEstimatedRunOutDate(medicine);

    await medicine.save();

    try {
      await clearMedicineNotifications(req.userId, medicine._id);
      await syncMedicineNotifications(req.userId, { medicines: [medicine] });
    } catch (notificationError) {
      console.error(
        "Medicine notification sync error:",
        notificationError
      );
    }

    res.status(200).json({
      message: "Medicine updated successfully",
      medicine,
    });
  } catch (error) {
    console.error("Update Medicine Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});
module.exports = router;