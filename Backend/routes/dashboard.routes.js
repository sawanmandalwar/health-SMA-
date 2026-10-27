const express = require("express");

const User = require("../models/User");
const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");
const {
  buildDoseViews,
  deriveMedicineStatus,
} = require("../services/doseService");
const {
  syncMedicineNotifications,
} = require("../services/notificationService");

const router = express.Router();

// ==========================================
// DATE HELPERS (safe parsing)
// ==========================================

const MONTHS = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

// Parse a date string in several formats without silently rolling over.
function parseDateOnly(value) {
  if (!value) return null;

  const text = String(value).trim().replace(/\s+/g, " ");

  // "14 October 2026" / "14 Oct 2026"
  let match = text.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month === undefined) return null;
    return buildDate(Number(match[3]), month, Number(match[1]));
  }

  // "2026-10-14" or ISO string
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    return buildDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // "14/10/2026" (day-first) or "10/14/2026" (month-first)
  match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    let day;
    let month;
    if (a > 12 && b <= 12) {
      day = a;
      month = b - 1;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a - 1;
    } else {
      day = a;
      month = b - 1;
    }
    return buildDate(Number(match[3]), month, day);
  }

  const fallback = new Date(text);
  return isValidDate(fallback) ? fallback : null;
}

function buildDate(year, month, day) {
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// Parse "11:50 PM" into 24-hour components.
function parseTime(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (period === "AM" && hour === 12) hour = 0;
  else if (period === "PM" && hour !== 12) hour += 12;

  return { hour, minute };
}

function toDateTime(dateValue, timeValue) {
  const date = parseDateOnly(dateValue);
  if (!date) return null;
  const time = parseTime(timeValue);
  if (time) date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

// ==========================================
// GET DASHBOARD
// ==========================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [user, medicines, history, appointments] = await Promise.all([
      User.findById(userId).select("-password"),
      Medicine.find({ userId }).sort({ createdAt: -1 }),
      MedicineHistory.find({ userId }).sort({
        scheduledDate: -1,
        createdAt: -1,
      }),
      Appointment.find({ userId }).sort({ createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
      await syncMedicineNotifications(userId, {
        medicines,
        history,
        timeZone: user.timezone,
      });
    } catch (notificationError) {
      console.error(
        "Dashboard medicine notification sync error:",
        notificationError
      );
    }

    const unreadNotifications = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    // ------------------------------------------
    // TODAY'S MEDICINES + STATUS
    // ------------------------------------------
    const todaysMedicines = medicines
      .filter((medicine) => {
        const start = parseDateOnly(medicine.startDate);
        const end = parseDateOnly(medicine.endDate);
        if (start && todayEnd < startOfDay(start)) return false;
        if (end && todayStart > endOfDay(end)) return false;
        return true;
      })
      .map((medicine) => {
        const records = history.filter((item) => {
          const itemDate = new Date(item.scheduledDate || item.createdAt);
          return (
            String(item.medicineId) === String(medicine._id) &&
            isValidDate(itemDate) &&
            itemDate >= todayStart &&
            itemDate <= todayEnd
          );
        });

        const doses = buildDoseViews(medicine, records, now);

        return {
          id: String(medicine._id),
          name: medicine.name,
          dosage: medicine.dosage,
          timing: medicine.timing || "",
          time: medicine.time,
          frequency: medicine.frequency,
          schedules: (medicine.schedules || []).map((schedule) => ({
            id: schedule._id ? String(schedule._id) : "default",
            time: schedule.time,
            quantity: schedule.quantity,
          })),
          doses,
          status: deriveMedicineStatus(doses, "Pending"),
        };
      });

    const takenToday = todaysMedicines.filter(
      (item) => item.status === "Taken"
    ).length;
    const missedToday = todaysMedicines.filter(
      (item) => item.status === "Missed"
    ).length;
    const pendingToday = todaysMedicines.filter(
      (item) => item.status === "Pending"
    ).length;

    const allDoses = todaysMedicines.flatMap((item) => item.doses || []);
    const dosesTaken = allDoses.filter((dose) => dose.status === "Taken").length;
    const dosesMissed = allDoses.filter((dose) => dose.status === "Missed").length;
    const dosesPending = allDoses.filter((dose) => dose.status === "Pending").length;

    // ------------------------------------------
    // WEEKLY ADHERENCE (Monday - Sunday)
    // ------------------------------------------
    const weekStart = startOfDay(now);
    const daysSinceMonday = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysSinceMonday);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekHistory = history.filter((item) => {
      const itemDate = new Date(item.scheduledDate || item.createdAt);
      return isValidDate(itemDate) && itemDate >= weekStart && itemDate < weekEnd;
    });

    const weeklyTaken = weekHistory.filter(
      (item) => item.status === "Taken"
    ).length;
    const weeklyMissed = weekHistory.filter(
      (item) => item.status === "Missed"
    ).length;
    const weeklyTotal = weeklyTaken + weeklyMissed;
    const weeklyPercentage =
      weeklyTotal === 0 ? 0 : Math.round((weeklyTaken / weeklyTotal) * 100);

    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(weekStart.getDate() + i);
      const dayEnd = endOfDay(dayStart);

      const dayRecords = weekHistory.filter((item) => {
        const itemDate = new Date(item.scheduledDate || item.createdAt);
        return itemDate >= dayStart && itemDate <= dayEnd;
      });

      days.push({
        date: `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`,
        label: dayLabels[i],
        taken: dayRecords.filter((item) => item.status === "Taken").length,
        missed: dayRecords.filter((item) => item.status === "Missed").length,
      });
    }

    // ------------------------------------------
    // NEXT UPCOMING APPOINTMENT
    // ------------------------------------------
    const upcoming = appointments
      .filter((appointment) => appointment.status === "Upcoming")
      .map((appointment) => ({
        appointment,
        dateTime: toDateTime(appointment.date, appointment.time),
      }))
      .filter((entry) => entry.dateTime && entry.dateTime.getTime() >= now.getTime())
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    const next = upcoming[0];
    const nextAppointment = next
      ? {
          id: String(next.appointment._id),
          doctor: next.appointment.doctor,
          specialty: next.appointment.specialty,
          hospital: next.appointment.hospital,
          date: next.appointment.date,
          time: next.appointment.time,
          reason: next.appointment.reason,
          status: next.appointment.status,
        }
      : null;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photoUrl: user.photoUrl || "",
      },
      today: todayStart.toISOString().slice(0, 10),
      stats: {
        medicinesScheduled: todaysMedicines.length,
        taken: takenToday,
        missed: missedToday,
        pending: pendingToday,
        dosesScheduled: allDoses.length,
        dosesTaken,
        dosesMissed,
        dosesPending,
        upcomingAppointments: upcoming.length,
      },
      medicines: todaysMedicines,
      weeklyAdherence: {
        taken: weeklyTaken,
        missed: weeklyMissed,
        totalDue: weeklyTotal,
        percentage: weeklyPercentage,
        days,
      },
      nextAppointment,
      unreadNotifications,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load dashboard",
    });
  }
});

module.exports = router;
