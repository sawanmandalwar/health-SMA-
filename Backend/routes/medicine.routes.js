const express = require("express");

const Medicine = require("../models/Medicine");
const auth = require("../middleware/auth");

const router = express.Router();

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
    } = req.body;

    if (!name || !dosage || !timing || !time || !frequency) {
      return res.status(400).json({
        message: "Please provide all required medicine details",
      });
    }

    const medicine = await Medicine.create({
      userId: req.userId,
      name,
      dosage,
      timing,
      time,
      frequency,
      startDate: startDate || "",
      endDate: endDate || "",
    });

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

    res.status(200).json({
      medicines,
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

    await medicine.save();

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