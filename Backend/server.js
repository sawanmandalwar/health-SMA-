

const dns = require("dns");
const appointmentRoutes = require("./routes/appointment.route");
// MongoDB Atlas DNS fix
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const medicineRoutes = require("./routes/medicine.routes");
const refillRoutes = require("./routes/refill.routes");
const doseRoutes = require("./routes/dose.routes");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.route");
const profileRoutes = require("./routes/profile.route");
const historyRoutes = require("./routes/history.routes");
const notificationRoutes = require('./routes/notification.routes');
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());

// Global request logger
app.use((req, res, next) => {
  console.log("REQUEST RECEIVED:", req.method, req.originalUrl);
  next();
});

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/medicines", refillRoutes);
app.use("/api/medicines", doseRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/history", historyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

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

connectDB();

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});