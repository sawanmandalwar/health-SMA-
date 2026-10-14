const express = require("express");

const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");

const router = express.Router();

// ==========================================
// ADD APPOINTMENT
// ==========================================
router.post("/", auth, async (req, res) => {
  try {
    const {
      doctor,
      specialty,
      hospital,
      date,
      time,
      reason,
      reminder,
    } = req.body;

    if (
      !doctor ||
      !specialty ||
      !hospital ||
      !date ||
      !time ||
      !reason
    ) {
      return res.status(400).json({
        message: "Please provide all appointment details",
      });
    }

    const appointment = await Appointment.create({
      userId: req.userId,
      doctor,
      specialty,
      hospital,
      date,
      time,
      reason,
      reminder: reminder ?? true,
      status: "Upcoming",
    });

    res.status(201).json({
      message: "Appointment added successfully",
      appointment,
    });
  } catch (error) {
    console.error("Add Appointment Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// GET USER'S APPOINTMENTS
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      userId: req.userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      appointments,
    });
  } catch (error) {
    console.error("Get Appointments Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// UPDATE APPOINTMENT
// ==========================================
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      doctor,
      specialty,
      hospital,
      date,
      time,
      reason,
      reminder,
      status,
    } = req.body;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    if (doctor !== undefined) appointment.doctor = doctor;
    if (specialty !== undefined) appointment.specialty = specialty;
    if (hospital !== undefined) appointment.hospital = hospital;
    if (date !== undefined) appointment.date = date;
    if (time !== undefined) appointment.time = time;
    if (reason !== undefined) appointment.reason = reason;
    if (reminder !== undefined) appointment.reminder = reminder;
    if (status !== undefined) appointment.status = status;

    await appointment.save();

    res.status(200).json({
      message: "Appointment updated successfully",
      appointment,
    });
  } catch (error) {
    console.error("Update Appointment Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// DELETE APPOINTMENT
// ==========================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    await Appointment.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });

    res.status(200).json({
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    console.error("Delete Appointment Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;