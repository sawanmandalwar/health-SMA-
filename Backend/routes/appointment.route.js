const express = require("express");

const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");

const router = express.Router();

// ==========================================
// ADD APPOINTMENT(S)
// Accepts `times` (array of strings) so the same doctor can have several
// visit times on the same day. One document is stored per time slot.
// ==========================================
const APPOINTMENT_TIME_PATTERN =
  /^\d{1,2}:\d{2}\s*([AaPp])\.?\s?[Mm]\.?$/;

const APPOINTMENT_TIME_24H_PATTERN = /^\d{1,2}:\d{2}$/;

function normalizeTimeSlot(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function isValidTimeSlot(value) {
  return (
    APPOINTMENT_TIME_PATTERN.test(value) ||
    APPOINTMENT_TIME_24H_PATTERN.test(value)
  );
}

router.post("/", auth, async (req, res) => {
  try {
    const {
      doctor,
      specialty,
      hospital,
      date,
      time,
      times,
      reason,
      reminder,
    } = req.body;

    if (
      !doctor ||
      !specialty ||
      !hospital ||
      !date ||
      !reason
    ) {
      return res.status(400).json({
        message: "Please provide all appointment details",
      });
    }

    // Build the list of time slots. `times` wins when provided; otherwise
    // fall back to the single `time` field for API compatibility.
    const rawSlots = Array.isArray(times) && times.length > 0
      ? times
      : [time];

    const timeSlots = rawSlots
      .map((slot) => normalizeTimeSlot(slot))
      .filter((slot) => slot.length > 0);

    if (timeSlots.length === 0) {
      return res.status(400).json({
        message: "Please provide an appointment time",
      });
    }

    const invalidSlot = timeSlots.find((slot) => !isValidTimeSlot(slot));

    if (invalidSlot) {
      return res.status(400).json({
        message: `Invalid appointment time: "${invalidSlot}". Use a format such as 10:00 AM.`,
      });
    }

    const baseAppointment = {
      userId: req.userId,
      doctor: String(doctor).trim(),
      specialty: String(specialty).trim(),
      hospital: String(hospital).trim(),
      date: String(date).trim(),
      reason: String(reason).trim(),
      reminder: reminder ?? true,
      status: "Upcoming",
    };

    const appointments = await Appointment.create(
      timeSlots.map((slot) => ({
        ...baseAppointment,
        time: slot,
      }))
    );

    res.status(201).json({
      message: "Appointment added successfully",
      appointments,
      appointment: appointments[0],
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

    // A rebooked date/time must go through missed-check + caregiver email
    // again, even if the appointment was already marked missed.
    if (date !== undefined || time !== undefined) {
      appointment.appointmentAt = undefined;
      appointment.appointmentAtFailed = false;
      appointment.missedAt = undefined;
      appointment.caregiverNotified = false;
      appointment.caregiverNotifySkipped = false;
      appointment.caregiverNotifyAttempts = 0;
      appointment.caregiverNotifyLastAttemptAt = undefined;
    }

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