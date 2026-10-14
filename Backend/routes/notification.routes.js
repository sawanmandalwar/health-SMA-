const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');

// GET: Fetch notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

// POST: Save a notification
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, message, type, scheduledFor } = req.body;

    if (!title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and type are required',
      });
    }

    if (!['Medicine', 'Appointment', 'General'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type',
      });
    }

    const notification = await Notification.create({
      userId: req.userId,
      title,
      message,
      type,
      scheduledFor: scheduledFor || null,
    });

    res.status(201).json({
      success: true,
      notification,
      message: 'Notification saved successfully',
    });
  } catch (error) {
    console.error('Save notification error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to save notification',
    });
  }
});

// PATCH: Mark one notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
    });
  }
});

// DELETE: Clear one notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

module.exports = router;