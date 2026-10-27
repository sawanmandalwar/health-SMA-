const mongoose = require("mongoose");

const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const {
  runInTransaction,
  isTransactionUnsupportedError,
  computeEstimatedRunOutDate,
} = require("./refillService");
const {
  normalizeTimeZone,
  getDayKeyForDate,
  getUtcRangeForDayKey,
  zonedDateTimeToUtc,
} = require("./timezoneService");

// Tri-state cache: null = unknown, true = supported, false = unsupported.
let transactionsEnabled = null;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeQuantity(value, fallback = 1) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// "8:00 AM" / "08:30" -> minutes since midnight (for ordering). Null if invalid.
function timeToMinutes(time) {
  const match = String(time || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3] ? match[3].toUpperCase() : null;

  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === "AM" && hour === 12) hour = 0;
    else if (period === "PM" && hour !== 12) hour += 12;
  }

  return hour * 60 + minute;
}

function getDayKey(reference = new Date()) {
  const date = new Date(reference);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRange(reference = new Date()) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getDayRangeForTimeZone(reference = new Date(), timeZone) {
  const zone = normalizeTimeZone(timeZone);
  const date = new Date(reference);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const dayKey = getDayKeyForDate(safeDate, zone);
  const range = getUtcRangeForDayKey(dayKey, zone);

  return {
    dayKey,
    start: range.start,
    end: range.end,
  };
}

function buildDoseKey(medicineId, doseId, dayKey) {
  return `${String(medicineId)}::${String(doseId)}::${dayKey}`;
}

function resolveScheduledAt({ when, schedule, timeZone }) {
  const zone = normalizeTimeZone(timeZone);
  const dayKey = getDayKeyForDate(when, zone);
  const minutes = timeToMinutes(schedule.time);

  if (minutes === null) {
    return { dayKey, scheduledAt: when };
  }

  const [year, month, day] = dayKey.split("-").map(Number);
  const scheduledAt = zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    },
    zone
  );

  return { dayKey, scheduledAt };
}

// Normalise stored schedules into entries that always have time/quantity.
function getSchedulesWithIds(medicine) {
  const list = Array.isArray(medicine?.schedules) ? medicine.schedules : [];

  const cleaned = list
    .filter((entry) => entry && String(entry.time || "").trim())
    .map((entry) => ({
      id: entry._id ? String(entry._id) : "default",
      time: String(entry.time).trim(),
      quantity: normalizeQuantity(entry.quantity, 1),
      label: entry.label ? String(entry.label).trim() : "",
    }))
    .sort((a, b) => {
      const am = timeToMinutes(a.time);
      const bm = timeToMinutes(b.time);
      if (am === null || bm === null) return 0;
      return am - bm;
    });

  if (cleaned.length > 0) return cleaned;

  // Older records: single implicit dose from the legacy "time" field.
  return [
    {
      id: "default",
      time: medicine?.time || "",
      quantity: 1,
      label: "",
    },
  ];
}

// Resolve the requested dose for a medicine, safely handling invalid ids.
function resolveSchedule(medicine, doseId) {
  const schedules = getSchedulesWithIds(medicine);
  const wanted = doseId === undefined || doseId === null ? "" : String(doseId);

  if (wanted && wanted !== "default") {
    const found = schedules.find((entry) => entry.id === wanted);
    if (!found) throw httpError(400, "Invalid dose id for this medicine.");
    return found;
  }

  if (schedules.length === 1) return schedules[0];

  throw httpError(400, "A dose id is required for this medicine.");
}

// Validate client-supplied schedules; invalid entries are dropped.
function normalizeSchedules(input) {
  if (!Array.isArray(input)) return [];

  const result = [];

  for (const entry of input) {
    if (!entry) continue;
    const time = typeof entry.time === "string" ? entry.time.trim() : "";
    if (!time) continue;

    const schedule = {
      time,
      quantity: normalizeQuantity(entry.quantity, 1),
      label: entry.label ? String(entry.label).trim() : "",
    };

    // Preserve the existing subdocument id so today's logged doses stay valid.
    const rawId = entry._id || entry.id;
    if (rawId && mongoose.Types.ObjectId.isValid(String(rawId))) {
      schedule._id = String(rawId);
    }

    result.push(schedule);
  }

  return result;
}

// Build today's (or a given day's) dose list with per-dose status.
function buildDoseViews(medicine, historyRecords, reference = new Date()) {
  const schedules = getSchedulesWithIds(medicine);

  return schedules.map((schedule) => {
    const record = (historyRecords || []).find(
      (item) => String(item.doseId) === String(schedule.id)
    );

    return {
      doseId: schedule.id,
      time: schedule.time,
      quantity: schedule.quantity,
      label: schedule.label,
      status: record ? record.status : "Pending",
      historyId: record ? String(record._id) : null,
      takenAt: record && record.takenAt ? record.takenAt : null,
    };
  });
}

// Overall status for a medicine derived from its individual doses.
function deriveMedicineStatus(doses, fallback = "Pending") {
  if (!Array.isArray(doses) || doses.length === 0) return fallback;

  const statuses = doses.map((dose) => dose.status);

  if (statuses.every((status) => status === "Taken")) return "Taken";
  if (statuses.every((status) => status === "Missed")) return "Missed";
  if (
    statuses.some((status) => status === "Missed") &&
    !statuses.some((status) => status === "Pending")
  ) {
    return "Missed";
  }
  return "Pending";
}

// ==========================================
// MARK A DOSE
// ==========================================

async function applyMarkDoseTx({
  userId,
  medicineId,
  doseId,
  status,
  when,
  timeZone,
  session,
}) {
  const medicine = await Medicine.findOne({ _id: medicineId, userId }).session(
    session
  );
  if (!medicine) throw httpError(404, "Medicine not found.");

  const schedule = resolveSchedule(medicine, doseId);
  const { dayKey, scheduledAt } = resolveScheduledAt({
    when,
    schedule,
    timeZone,
  });
  const doseKey = buildDoseKey(medicineId, schedule.id, dayKey);

  let history = await MedicineHistory.findOne({ doseKey }).session(session);

  if (!history) {
    history = new MedicineHistory({
      userId,
      medicineId,
      doseId: schedule.id,
      doseKey,
      medicineName: medicine.name,
      dosage: medicine.dosage,
      time: schedule.time,
      quantity: schedule.quantity,
      status,
      scheduledDate: scheduledAt,
      takenAt: status === "Taken" ? when : null,
      stockDeducted: false,
    });
  } else {
    history.doseId = schedule.id;
    history.time = schedule.time;
    history.quantity = schedule.quantity;
    history.scheduledDate = scheduledAt;
    if (!history.medicineName) history.medicineName = medicine.name;
    if (!history.dosage) history.dosage = medicine.dosage;
  }

  const alreadyDeducted = history.stockDeducted === true;
  let deductedNow = false;

  if (status === "Taken") {
    history.status = "Taken";
    history.takenAt = history.takenAt || when;

    const remaining = medicine.remainingQuantity;
    const hasStock = remaining !== null && remaining !== undefined;

    if (!alreadyDeducted && hasStock && schedule.quantity > 0) {
      medicine.remainingQuantity = Math.max(
        0,
        Number(remaining) - schedule.quantity
      );
      medicine.estimatedRunOutDate = computeEstimatedRunOutDate(medicine);
      history.stockDeducted = true;
      deductedNow = true;
    }
  } else if (history.status !== "Taken") {
    // Missed: never deduct. Never downgrade an already-taken dose.
    history.status = "Missed";
    history.takenAt = null;
  }

  await medicine.save({ session });
  await history.save({ session });

  return { history, medicine, deductedNow, duplicate: alreadyDeducted };
}

async function applyMarkDoseFallback({
  userId,
  medicineId,
  doseId,
  status,
  when,
  timeZone,
}) {
  const medicine = await Medicine.findOne({ _id: medicineId, userId });
  if (!medicine) throw httpError(404, "Medicine not found.");

  const schedule = resolveSchedule(medicine, doseId);
  const { dayKey, scheduledAt } = resolveScheduledAt({
    when,
    schedule,
    timeZone,
  });
  const doseKey = buildDoseKey(medicineId, schedule.id, dayKey);

  let history = await MedicineHistory.findOne({ doseKey });

  if (!history) {
    try {
      history = await MedicineHistory.create({
        userId,
        medicineId,
        doseId: schedule.id,
        doseKey,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        time: schedule.time,
        quantity: schedule.quantity,
        status,
        scheduledDate: scheduledAt,
        takenAt: status === "Taken" ? when : null,
        stockDeducted: false,
      });
    } catch (error) {
      if (error && error.code === 11000) {
        history = await MedicineHistory.findOne({ doseKey });
      } else {
        throw error;
      }
    }
  }

  if (!history) throw httpError(500, "Unable to record dose.");

  history.doseId = schedule.id;
  history.time = schedule.time;
  history.quantity = schedule.quantity;
  history.scheduledDate = scheduledAt;
  if (!history.medicineName) history.medicineName = medicine.name;
  if (!history.dosage) history.dosage = medicine.dosage;

  const alreadyDeducted = history.stockDeducted === true;
  let deductedNow = false;

  if (status === "Taken") {
    history.status = "Taken";
    history.takenAt = history.takenAt || when;

    const remaining = medicine.remainingQuantity;
    const hasStock = remaining !== null && remaining !== undefined;

    if (!alreadyDeducted && hasStock && schedule.quantity > 0) {
      const updated = await Medicine.findOneAndUpdate(
        { _id: medicineId, userId },
        [
          {
            $set: {
              remainingQuantity: {
                $max: [
                  0,
                  {
                    $subtract: [
                      { $ifNull: ["$remainingQuantity", 0] },
                      schedule.quantity,
                    ],
                  },
                ],
              },
            },
          },
        ],
        { new: true }
      );

      if (updated) {
        updated.estimatedRunOutDate = computeEstimatedRunOutDate(updated);
        await updated.save();
        medicine.remainingQuantity = updated.remainingQuantity;
        medicine.estimatedRunOutDate = updated.estimatedRunOutDate;
      }

      history.stockDeducted = true;
      deductedNow = true;
    }
  } else if (history.status !== "Taken") {
    history.status = "Missed";
    history.takenAt = null;
  }

  await history.save();

  return { history, medicine, deductedNow, duplicate: alreadyDeducted };
}

async function markDose({
  userId,
  medicineId,
  doseId,
  status,
  when,
  timeZone,
} = {}) {
  if (!["Taken", "Missed"].includes(status)) {
    throw httpError(400, "status must be either Taken or Missed.");
  }

  const parsed = when ? new Date(when) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  if (transactionsEnabled !== false) {
    try {
      const result = await runInTransaction((session) =>
        applyMarkDoseTx({
          userId,
          medicineId,
          doseId,
          status,
          when: date,
          timeZone,
          session,
        })
      );
      transactionsEnabled = true;
      return result;
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) throw error;
      transactionsEnabled = false;
      console.warn(
        "MongoDB transactions unavailable; using safe fallback for dose."
      );
    }
  }

  return applyMarkDoseFallback({
    userId,
    medicineId,
    doseId,
    status,
    when: date,
    timeZone,
  });
}

module.exports = {
  timeToMinutes,
  getDayKey,
  getDayRange,
  getDayRangeForTimeZone,
  buildDoseKey,
  getSchedulesWithIds,
  resolveSchedule,
  normalizeSchedules,
  buildDoseViews,
  deriveMedicineStatus,
  markDose,
};
