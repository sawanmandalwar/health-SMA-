const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const WebPushSubscription = require('../models/WebPushSubscription');
const authMiddleware = require('../middleware/auth');
const {
  getVapidConfig,
  isWebPushConfigured,
  sendWebPushToUser,
  deactivateByEndpoint,
} = require('../services/webPushService');
const {
  syncMedicineNotifications,
} = require('../services/notificationService');
const {
  processMissedDosesForUser,
} = require('../services/missedDoseService');
const {
  isValidExpoPushToken,
} = require('../services/pushService');

// GET: Fetch notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    try {
      await syncMedicineNotifications(userId);
    } catch (notificationError) {
      console.error(
        'Notification medicine sync error:',
        notificationError
      );
    }

    try {
      await processMissedDosesForUser(userId);
    } catch (missedDoseError) {
      console.error(
        'Notification missed-dose sync error:',
        missedDoseError
      );
    }

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

// POST: Register an Expo push token for the logged-in user
router.post('/push-token', authMiddleware, async (req, res) => {
  try {
    const token =
      typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const platform =
      typeof req.body.platform === 'string'
        ? req.body.platform.trim().toLowerCase()
        : '';

    if (!isValidExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        message: 'A valid Expo push token is required',
      });
    }

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'platform must be android or ios',
      });
    }

    const pushToken = await PushToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.userId,
          platform,
          isActive: true,
          lastSeenAt: new Date(),
          lastError: '',
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      registered: true,
      platform: pushToken.platform,
    });
  } catch (error) {
    console.error(
      'Register push token error:',
      error?.code || error?.name || 'unknown_error'
    );

    res.status(500).json({
      success: false,
      message: 'Failed to register push token',
    });
  }
});

// DELETE: Deactivate a push token for the logged-in user
router.delete('/push-token', authMiddleware, async (req, res) => {
  try {
    const token =
      typeof req.body.token === 'string'
        ? req.body.token.trim()
        : typeof req.query.token === 'string'
          ? req.query.token.trim()
          : '';

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'A push token is required',
      });
    }

    const result = await PushToken.updateOne(
      { userId: req.userId, token },
      { $set: { isActive: false } }
    );

    res.status(200).json({
      success: true,
      deactivated: result.modifiedCount > 0,
    });
  } catch (error) {
    console.error(
      'Deactivate push token error:',
      error?.code || error?.name || 'unknown_error'
    );

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate push token',
    });
  }
});

// POST: Check the logged-in user's schedules for missed doses
router.post('/check-missed', authMiddleware, async (req, res) => {
  try {
    const result = await processMissedDosesForUser(req.userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Check missed doses error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to check missed doses',
    });
  }
});

// GET: VAPID public key used by the browser to create a push subscription.
// The public key is safe to expose; it is required by the Push API.
router.get('/web-push/public-key', (req, res) => {
  const config = getVapidConfig();

  res.status(200).json({
    success: true,
    configured: isWebPushConfigured(),
    publicKey: config.publicKey || '',
  });
});

// POST: Store (or refresh) a browser push subscription for the logged-in user.
router.post('/web-push/subscribe', authMiddleware, async (req, res) => {
  try {
    const subscription =
      req.body && typeof req.body.subscription === 'object'
        ? req.body.subscription
        : null;

    const endpoint =
      subscription && typeof subscription.endpoint === 'string'
        ? subscription.endpoint.trim()
        : '';

    const keys =
      subscription && subscription.keys && typeof subscription.keys === 'object'
        ? subscription.keys
        : {};

    const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
    const authKey = typeof keys.auth === 'string' ? keys.auth.trim() : '';

    if (!/^https?:\/\//i.test(endpoint) || endpoint.length > 2048) {
      return res.status(400).json({
        success: false,
        message: 'A valid push subscription endpoint is required',
      });
    }

    if (!p256dh || !authKey) {
      return res.status(400).json({
        success: false,
        message: 'Push subscription keys are required',
      });
    }

    if (!isWebPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Web push is not configured on the server',
      });
    }

    const saved = await WebPushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: req.userId,
          endpoint,
          'keys.p256dh': p256dh,
          'keys.auth': authKey,
          userAgent:
            typeof req.headers['user-agent'] === 'string'
              ? req.headers['user-agent'].slice(0, 512)
              : '',
          isActive: true,
          lastSeenAt: new Date(),
          lastError: '',
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      subscribed: true,
      id: String(saved._id),
    });
  } catch (error) {
    console.error(
      'Register web push subscription error:',
      error?.code || error?.name || 'unknown_error'
    );

    res.status(500).json({
      success: false,
      message: 'Failed to register web push subscription',
    });
  }
});

// DELETE: Deactivate a browser push subscription (logout / unsubscribe).
router.delete('/web-push/subscribe', authMiddleware, async (req, res) => {
  try {
    const endpoint =
      typeof req.body?.endpoint === 'string'
        ? req.body.endpoint.trim()
        : typeof req.query.endpoint === 'string'
          ? req.query.endpoint.trim()
          : '';

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'A push subscription endpoint is required',
      });
    }

    const deactivated = await deactivateByEndpoint(req.userId, endpoint);

    res.status(200).json({
      success: true,
      deactivated,
    });
  } catch (error) {
    console.error(
      'Deactivate web push subscription error:',
      error?.code || error?.name || 'unknown_error'
    );

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate web push subscription',
    });
  }
});

// POST: Send a test notification to the user's browsers. Useful for verifying
// that permission, the service worker and VAPID keys all work end to end.
router.post('/web-push/test', authMiddleware, async (req, res) => {
  try {
    if (!isWebPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Web push is not configured on the server',
      });
    }

    const result = await sendWebPushToUser(req.userId, {
      title: 'Health Saathi test reminder',
      body: 'Web notifications are working on this device.',
      tag: `test:${Date.now()}`,
      data: { type: 'test', url: '/home' },
    });

    res.status(200).json({
      success: result.sent > 0,
      ...result,
    });
  } catch (error) {
    console.error(
      'Web push test error:',
      error?.code || error?.name || 'unknown_error'
    );

    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
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
      { returnDocument: "after" }
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