

const dns = require("dns");
require("dotenv").config();
const path = require("path");
const appointmentRoutes = require("./routes/appointment.route");
// MongoDB Atlas DNS fix
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const medicineRoutes = require("./routes/medicine.routes");
const refillRoutes = require("./routes/refill.routes");
const doseRoutes = require("./routes/dose.routes");
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.route");
const profileRoutes = require("./routes/profile.route");
const caregiverRoutes = require("./routes/caregiver.route");
const historyRoutes = require("./routes/history.routes");
const notificationRoutes = require('./routes/notification.routes');
const cronRoutes = require("./routes/cron.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const placesRoutes = require("./routes/places.route");
const {
  startMissedDoseScheduler,
} = require("./services/missedDoseScheduler");
const {
  startMissedAppointmentScheduler,
} = require("./services/missedAppointmentScheduler");
const {
  startReminderScheduler,
} = require("./services/reminderSweep");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());
// Ensure MongoDB is connected before handling API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({
      message: "Database connection unavailable",
    });
  }
});

// Global request logger
app.use((req, res, next) => {
  console.log("REQUEST RECEIVED:", req.method, req.originalUrl);
  next();
});

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/caregiver", caregiverRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/medicines", refillRoutes);
app.use("/api/medicines", doseRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/history", historyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/places", placesRoutes);

// Profile photo uploads are stored locally and served statically.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
  })
);

// Show registered authentication routes
console.log(
  "Auth routes:",
  authRoutes.stack.map((r) => ({
    path: r.route?.path,
    methods: r.route?.methods,
  }))
);

// ===============================
// CONNECT MONGODB
// ===============================

// Start background schedulers only during local development.
// Vercel serverless functions should use a separate scheduled job.
if (require.main === module) {
  connectDB()
    .then(() => {
      const schedulerState = startMissedDoseScheduler();
      console.log(
        `Missed-dose scheduler ${
          schedulerState.started ? "started" : "not started"
        } (enabled=${schedulerState.enabled}).`
      );

      const appointmentSchedulerState =
        startMissedAppointmentScheduler();

      console.log(
        `Missed-appointment scheduler ${
          appointmentSchedulerState.started ? "started" : "not started"
        } (enabled=${appointmentSchedulerState.enabled}).`
      );

      const reminderSchedulerState = startReminderScheduler();

      console.log(
        `Web-push reminder scheduler ${
          reminderSchedulerState.started ? "started" : "not started"
        }.`
      );
    })
    .catch((error) => {
      console.error("Backend initialization failed:", error.message);
    });
}

// ===============================
// TEST ROUTE
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "Health-Saathi Backend is running!",
  });
});

// ===============================
// JSON 404 (unknown routes)
// ===============================

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ===============================
// JSON ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  const isBadJson = err && err.type === "entity.parse.failed";
  const status = isBadJson ? 400 : err.status || err.statusCode || 500;

  console.error("Request error:", req.method, req.originalUrl, err.message);

  res.status(status).json({
    message: isBadJson ? "Invalid JSON body" : "Server error",
  });
});

// ===============================
// START SERVER
// ===============================

// Export Express app for Vercel
module.exports = app;

// Run locally only
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}