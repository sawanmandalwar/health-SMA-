const mongoose = require("mongoose");

const Medicine = require("../models/Medicine");
const RefillHistory = require("../models/RefillHistory");

const DAY_MS = 24 * 60 * 60 * 1000;

// Tri-state cache: null = unknown, true = supported, false = unsupported.
let transactionsEnabled = null;

// ==========================================
// SMALL HELPERS
// ==========================================

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfToday(from = new Date()) {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Parse a free-text frequency into a daily dose count.
function parseFrequencyToDaily(frequency) {
  const raw = String(frequency || "").toLowerCase().trim();
  if (!raw) return null;

  // Slot notation such as "1-0-1" or "1-1-1".
  const slotMatch = raw.match(
    /^(\d+)\s*[-+]\s*(\d+)(?:\s*[-+]\s*(\d+))?(?:\s*[-+]\s*(\d+))?$/
  );
  if (slotMatch) {
    const taken = slotMatch
      .slice(1)
      .filter((part) => part !== undefined)
      .filter((part) => Number(part) > 0).length;
    return taken > 0 ? taken : null;
  }

  // "every 8 hours"
  const hoursMatch = raw.match(
    /every\s*(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)\b/
  );
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    if (hours > 0) return Math.min(24, 24 / hours);
  }

  // "2 times a day", "3x daily", "2 tablets per day"
  const timesMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:x|times|time|dose|doses|tablet|tablets|pill|pills)\b/
  );
  if (timesMatch) {
    const count = Number(timesMatch[1]);
    if (count > 0) return count;
  }

  if (/\b(qid|q\.i\.d|four\s*times)\b/.test(raw)) return 4;
  if (/\b(thrice|three\s*times|tds|tid|t\.i\.d)\b/.test(raw)) return 3;
  if (/\b(twice|two\s*times|bd|bid|b\.i\.d)\b/.test(raw)) return 2;
  if (/\b(once|single|od|qd)\b/.test(raw)) return 1;
  if (/\b(alternate|every\s*other|eod|alternate\s*day)\b/.test(raw)) return 0.5;
  if (/\b(weekly|once\s*a\s*week|per\s*week|1\s*\/\s*week)\b/.test(raw)) {
    return 1 / 7;
  }
  if (
    /\b(daily|everyday|every\s*day|once\s*a\s*day|1\s*\/\s*day)\b/.test(raw)
  ) {
    return 1;
  }

  return null;
}

// Expected daily consumption: sum of the per-dose schedule when present,
// otherwise the explicit value, otherwise derived from frequency text.
function getDailyConsumption(medicine) {
  const schedules = Array.isArray(medicine?.schedules)
    ? medicine.schedules
    : [];

  if (schedules.length > 0) {
    const total = schedules.reduce((sum, entry) => {
      const quantity = toNumber(entry?.quantity, 1);
      return sum + (quantity && quantity > 0 ? quantity : 0);
    }, 0);

    if (total > 0) return total;
  }

  const explicit = toNumber(medicine?.dailyConsumption, null);
  if (explicit !== null && explicit > 0) return explicit;
  return parseFrequencyToDaily(medicine?.frequency);
}

// Estimated run-out date = today + ceil(remaining / daily consumption).
function computeEstimatedRunOutDate(medicine, from = new Date()) {
  const remaining = toNumber(medicine?.remainingQuantity, null);
  const daily = getDailyConsumption(medicine);

  if (remaining === null) return null;

  const base = startOfToday(from);

  if (remaining <= 0) return base;
  if (daily === null || daily <= 0) return null;

  const days = Math.ceil(remaining / daily);
  const runOut = new Date(base);
  runOut.setDate(runOut.getDate() + days);
  return runOut;
}

// A medicine needs a refill when the remaining stock is at/below threshold,
// or when it will run out within the configured reminder window.
function isRefillNeeded(medicine, from = new Date()) {
  const remaining = toNumber(medicine?.remainingQuantity, null);
  if (remaining === null) return false;

  const threshold = toNumber(medicine?.refillThreshold, 0) || 0;
  if (remaining <= threshold) return true;

  const runOut = computeEstimatedRunOutDate(medicine, from);
  if (!runOut) return false;

  const reminderDays = toNumber(medicine?.refillReminderDays, 0) || 0;
  const daysLeft = (runOut.getTime() - startOfToday(from).getTime()) / DAY_MS;
  return daysLeft <= reminderDays;
}

function serializeStock(medicine, from = new Date()) {
  return {
    id: String(medicine._id),
    medicineId: String(medicine._id),
    name: medicine.name,
    unit: medicine.unit || "",
    initialQuantity: medicine.initialQuantity ?? null,
    remainingQuantity: medicine.remainingQuantity ?? null,
    refillThreshold: medicine.refillThreshold ?? null,
    dailyConsumption: medicine.dailyConsumption ?? null,
    refillReminderDays: medicine.refillReminderDays ?? null,
    estimatedRunOutDate: medicine.estimatedRunOutDate || null,
    effectiveDailyConsumption: getDailyConsumption(medicine),
    needsRefill: isRefillNeeded(medicine, from),
  };
}

// ==========================================
// TRANSACTION SUPPORT
// ==========================================

const UNSUPPORTED_TRANSACTION_MESSAGES = [
  "Transaction numbers are only allowed on a replica set member or mongos",
  "This MongoDB deployment does not support retryable writes",
  "Transactions are not supported",
  "Transaction is not supported",
  "does not support transactions",
];

function isTransactionUnsupportedError(error) {
  if (!error) return false;
  if (error.code === 20 || error.codeName === "IllegalOperation") return true;
  const message = String(error.message || "");
  return UNSUPPORTED_TRANSACTION_MESSAGES.some((pattern) =>
    message.includes(pattern)
  );
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ==========================================
// REFILL OPERATIONS
// ==========================================

async function applyRefillTx({
  medicineId,
  userId,
  quantity,
  unit,
  refilledAt,
  session,
}) {
  const medicine = await Medicine.findOne({ _id: medicineId, userId }).session(
    session
  );
  if (!medicine) throw httpError(404, "Medicine not found.");

  const previousQuantity = toNumber(medicine.remainingQuantity, 0) || 0;
  const newQuantity = previousQuantity + quantity;

  medicine.remainingQuantity = newQuantity;
  if (medicine.initialQuantity === null || medicine.initialQuantity === undefined) {
    medicine.initialQuantity = newQuantity;
  }
  if (unit && !String(medicine.unit || "").trim()) {
    medicine.unit = String(unit).trim();
  }
  medicine.estimatedRunOutDate = computeEstimatedRunOutDate(medicine);

  await medicine.save({ session });

  const [history] = await RefillHistory.create(
    [
      {
        userId,
        medicineId,
        quantityAdded: quantity,
        previousQuantity,
        newQuantity,
        unit: unit || medicine.unit || "",
        refilledAt,
      },
    ],
    { session }
  );

  return { medicine, history, previousQuantity, newQuantity };
}

// Fallback for deployments without transaction support: atomic $inc-equivalent
// update first, then the history row, compensating the stock on failure.
async function applyRefillFallback({
  medicineId,
  userId,
  quantity,
  unit,
  refilledAt,
}) {
  const updated = await Medicine.findOneAndUpdate(
    { _id: medicineId, userId },
    [
      {
        $set: {
          remainingQuantity: {
            $add: [{ $ifNull: ["$remainingQuantity", 0] }, quantity],
          },
        },
      },
    ],
    { new: true }
  );

  if (!updated) throw httpError(404, "Medicine not found.");

  const newQuantity = updated.remainingQuantity;
  const previousQuantity = newQuantity - quantity;

  try {
    if (
      updated.initialQuantity === null ||
      updated.initialQuantity === undefined
    ) {
      updated.initialQuantity = newQuantity;
    }
    if (unit && !String(updated.unit || "").trim()) {
      updated.unit = String(unit).trim();
    }
    updated.estimatedRunOutDate = computeEstimatedRunOutDate(updated);
    await updated.save();

    const history = await RefillHistory.create({
      userId,
      medicineId,
      quantityAdded: quantity,
      previousQuantity,
      newQuantity,
      unit: unit || updated.unit || "",
      refilledAt,
    });

    return { medicine: updated, history, previousQuantity, newQuantity };
  } catch (error) {
    // Roll back the stock change so we never inflate quantity without history.
    await Medicine.updateOne(
      { _id: medicineId, userId },
      { $set: { remainingQuantity: previousQuantity } }
    );
    throw error;
  }
}

async function recordRefill({
  userId,
  medicineId,
  quantityAdded,
  unit,
  refilledAt,
} = {}) {
  const quantity = toNumber(quantityAdded, null);
  if (quantity === null || quantity <= 0) {
    throw httpError(400, "quantityAdded must be a positive number.");
  }

  const medicine = await Medicine.findOne({ _id: medicineId, userId });
  if (!medicine) throw httpError(404, "Medicine not found.");

  const parsedDate = refilledAt ? new Date(refilledAt) : new Date();
  const when = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  if (transactionsEnabled !== false) {
    try {
      const result = await runInTransaction((session) =>
        applyRefillTx({
          medicineId,
          userId,
          quantity,
          unit,
          refilledAt: when,
          session,
        })
      );
      transactionsEnabled = true;
      return result;
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) throw error;
      transactionsEnabled = false;
      console.warn(
        "MongoDB transactions unavailable; using atomic fallback for refill."
      );
    }
  }

  return applyRefillFallback({
    medicineId,
    userId,
    quantity,
    unit,
    refilledAt: when,
  });
}

async function updateStock({ userId, medicineId, ...fields } = {}) {
  const medicine = await Medicine.findOne({ _id: medicineId, userId });
  if (!medicine) throw httpError(404, "Medicine not found.");

  const numericFields = [
    "initialQuantity",
    "remainingQuantity",
    "refillThreshold",
    "dailyConsumption",
    "refillReminderDays",
  ];

  for (const key of numericFields) {
    if (fields[key] !== undefined) {
      medicine[key] = toNumber(fields[key], null);
    }
  }

  if (fields.unit !== undefined) {
    medicine.unit = String(fields.unit || "").trim();
  }

  medicine.estimatedRunOutDate = computeEstimatedRunOutDate(medicine);

  await medicine.save();
  return medicine;
}

module.exports = {
  getDailyConsumption,
  parseFrequencyToDaily,
  computeEstimatedRunOutDate,
  isRefillNeeded,
  serializeStock,
  recordRefill,
  updateStock,
  runInTransaction,
  isTransactionUnsupportedError,
};
