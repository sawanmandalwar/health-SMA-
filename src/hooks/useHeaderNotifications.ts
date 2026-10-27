import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from 'expo-router';

import { apiFetch, parseJson } from '../services/api';

// ============================================================
// useHeaderNotifications — single source of truth for the
// notification bell on every screen (unread badge + dropdown).
// ============================================================
// 1. Fetches /api/notifications on every screen focus, so the unread
//    badge appears reliably and disappears as soon as notifications
//    are cleared.
// 2. Re-fetches when the dropdown opens.
// 3. Mark-as-read updates the list and the badge immediately.
// ============================================================

export type HeaderNotification = {
  _id: string;
  title: string;
  message: string;
  type: 'Medicine' | 'Appointment' | 'General' | string;
  isRead: boolean;
  createdAt: string;
};

export function useHeaderNotifications() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState<HeaderNotification[]>(
    [],
  );

  const [unreadCount, setUnreadCount] = useState(0);

  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [notificationsError, setNotificationsError] = useState('');

  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError('');

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        setNotificationsError('Please log in again to view notifications.');
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const response = await apiFetch(`/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await parseJson(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not load notifications.');
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.log('Fetch notifications failed:', error);
      setNotificationsError(
        'Could not load notifications. Check that the backend is running.',
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          setNotificationsError(
            'Please log in again to update notifications.',
          );
          return;
        }

        const response = await apiFetch(
          `/api/notifications/${notificationId}/read`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await parseJson(response);

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not update notification.');
        }

        setNotifications((current) =>
          current.map((item) =>
            item._id === notificationId ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        console.log('Mark notification read failed:', error);
        setNotificationsError(
          'Could not update this notification. Please try again.',
        );
      }
    },
    [],
  );

  // Fresh data on every screen focus so the badge is always current.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        await fetchNotifications();
      })();
    }, [fetchNotifications]),
  );

  // Refresh whenever the dropdown is opened.
  useEffect(() => {
    if (!notificationsOpen) return;

    (async () => {
      await fetchNotifications();
    })();
  }, [notificationsOpen, fetchNotifications]);

  return {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    unreadCount,
    notificationsLoading,
    notificationsError,
    fetchNotifications,
    markNotificationRead,
  };
}
