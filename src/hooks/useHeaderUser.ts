import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from 'expo-router';

import { apiFetch, parseJson, apiUrl } from '../services/api';

// ============================================================
// useHeaderUser — single source of truth for the top header
// (greeting name + profile photo) across all screens.
// ============================================================
// 1. Instantly shows the cached 'user' entry from AsyncStorage.
// 2. On every screen focus, fetches /api/profile with the auth token
//    and updates the header, so the name/photo are always current even
//    when the cache was saved before a profile edit or photo upload.
// 3. Keeps the shared cache in sync so other screens agree.
// ============================================================

export function useHeaderUser() {
  const [userName, setUserName] = useState('');

  const [userPhoto, setUserPhoto] = useState('');

  // Instant paint from the cache on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');

        if (!raw) return;

        const parsed = JSON.parse(raw);

        if (parsed && parsed.name) setUserName(parsed.name);

        if (parsed && parsed.photoUrl) {
          setUserPhoto(apiUrl(String(parsed.photoUrl)));
        }
      } catch {
        // The header simply shows the default avatar on failure.
      }
    })();
  }, []);

  // Fresh data on every focus.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');

          if (!token) return;

          const response = await apiFetch(`/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const data = await parseJson(response);

          if (!response.ok || !data.user) return;

          if (data.user.name) setUserName(data.user.name);

          if (data.user.photoUrl) {
            setUserPhoto(apiUrl(String(data.user.photoUrl)));
          } else {
            setUserPhoto('');
          }

          // Keep the shared 'user' cache in sync so other screens agree.
          const raw = await AsyncStorage.getItem('user');

          if (raw) {
            try {
              const cachedUser = JSON.parse(raw);

              await AsyncStorage.setItem(
                'user',
                JSON.stringify({
                  ...cachedUser,
                  photoUrl: data.user.photoUrl || '',
                })
              );
            } catch {
              // Ignore cache parse errors.
            }
          }
        } catch (error) {
          console.log('Header user refresh failed:', error);
        }
      })();
    }, []),
  );

  const displayName = userName.trim() || 'there';

  const avatarLetter = (userName.trim().charAt(0) || 'U').toUpperCase();

  return {
    userName,
    userPhoto,
    setUserPhoto,
    displayName,
    avatarLetter,
  };
}
