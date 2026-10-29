const express = require("express");

const router = express.Router();

const { runReminderSweep } = require("../services/reminderSweep");

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// configured for the project. A query-string secret is also accepted so an
// external cron service (e.g. cron-job.org) can trigger the sweep.
function isAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "").trim();

  if (!secret) {
    console.warn(
      "[cron] CRON_SECRET is not set; the reminder endpoint is publicly reachable."
    );
    return true;
  }

  const authorization = String(req.headers.authorization || "");

  if (authorization === `Bearer ${secret}`) return true;

  return String(req.query.secret || "") === secret;
}

async function handleSweep(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    const summary = await runReminderSweep();

    return res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error(
      "Reminder cron error:",
      error && error.message ? error.message : error
    );

    return res.status(500).json({
      success: false,
      message: "Reminder sweep failed",
    });
  }
}

router.get("/reminders", handleSweep);
router.post("/reminders", handleSweep);

module.exports = router;
