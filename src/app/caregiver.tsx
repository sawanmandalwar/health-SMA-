import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps } from 'react-native';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

import {
  ApiError,
  apiFetch,
  getApiErrorMessage,
  parseJson,
} from '../services/api';

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',
  primaryGreen: '#39A78D',
  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',
  dangerRed: '#E2574C',
  background: '#EAF3F5',
  text: '#1D2B33',
  secondary: '#71858D',
  white: '#FFFFFF',
  border: '#D5E4E8',
};

const CAREGIVER_KEY = '@health_saathi_caregiver';
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface CaregiverSettings {
  name: string;
  email: string;
  alertsEnabled: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
}

interface CaregiverApiSettings {
  id?: string;
  userId?: string;
  name: string;
  email: string;
  alertsEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CaregiverResponse {
  success?: boolean;
  message?: string;
  settings?: CaregiverApiSettings | null;
}

type LoadState = 'loading' | 'synced' | 'local' | 'empty' | 'error';

type BannerTone = 'info' | 'warning' | 'error';

const getCaregiverError = (error: unknown) => {
  if (error instanceof ApiError) {
    return getApiErrorMessage(error);
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

const toLocalSettings = (
  settings: CaregiverApiSettings
): CaregiverSettings => ({
  name: typeof settings.name === 'string' ? settings.name : '',
  email: typeof settings.email === 'string' ? settings.email : '',
  alertsEnabled: settings.alertsEnabled === true,
});

const readLocalSettings = async (): Promise<CaregiverSettings | null> => {
  try {
    const raw = await AsyncStorage.getItem(CAREGIVER_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const saved = parsed as Partial<CaregiverSettings>;
    const settings: CaregiverSettings = {
      name: typeof saved.name === 'string' ? saved.name : '',
      email: typeof saved.email === 'string' ? saved.email : '',
      alertsEnabled: saved.alertsEnabled === true,
    };

    if (
      !settings.name &&
      !settings.email &&
      !settings.alertsEnabled
    ) {
      return null;
    }

    return settings;
  } catch (error) {
    console.log('[caregiver] Could not read local settings', error);
    return null;
  }
};

const writeLocalSettings = async (settings: CaregiverSettings) => {
  await AsyncStorage.setItem(CAREGIVER_KEY, JSON.stringify(settings));
};

export default function CaregiverScreen() {
  const { width } = useResponsiveDimensions();
  const isMobile = width < 650;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] =
    useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const isLoading = loadState === 'loading';

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const goToProfile = useCallback(() => {
    router.replace('/profile');
  }, []);

  const redirectToLogin = useCallback(() => {
    Alert.alert(
      'Login Required',
      'Your session has expired. Please login again.'
    );
    router.replace('/');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applySettings = (settings: CaregiverSettings) => {
      setName(settings.name);
      setEmail(settings.email);
      setAlertsEnabled(settings.alertsEnabled);
    };

    const loadSettings = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          if (!cancelled) {
            redirectToLogin();
          }
          return;
        }

        const response = await apiFetch('/api/caregiver', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        const data =
          await parseJson<CaregiverResponse>(response);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            typeof data?.message === 'string' &&
              data.message.trim()
              ? data.message
              : 'Could not load caregiver settings.'
          );
        }

        const serverSettings = data?.settings ?? null;

        if (serverSettings) {
          const settings = toLocalSettings(serverSettings);

          applySettings(settings);
          setLoadState('synced');
          setLoadError('');

          try {
            await writeLocalSettings(settings);
          } catch (cacheError) {
            console.log(
              '[caregiver] Could not cache settings locally',
              cacheError
            );
          }

          return;
        }

        const local = await readLocalSettings();

        if (cancelled) {
          return;
        }

        if (local) {
          applySettings(local);
          setLoadState('local');
          setLoadError(
            'No settings were found on the server. These settings were saved on this device and have not been synced.'
          );
        } else {
          setLoadState('empty');
          setLoadError('');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const local = await readLocalSettings();

        if (cancelled) {
          return;
        }

        if (local) {
          applySettings(local);
          setLoadState('local');
          setLoadError(
            `${getCaregiverError(
              error
            )} Showing the settings saved on this device; they have not been synced.`
          );
        } else {
          setLoadState('error');
          setLoadError(getCaregiverError(error));
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [redirectToLogin]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          goToProfile();
          return true;
        }
      );

      return () => subscription.remove();
    }, [goToProfile])
  );

  const clearError = (field: keyof FormErrors) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length > 80) {
      nextErrors.name = 'Name must be 80 characters or fewer.';
    } else if (alertsEnabled && !trimmedName) {
      nextErrors.name = "Please enter your parent or guardian's name.";
    }

    if (trimmedEmail.length > 254) {
      nextErrors.email = 'Email must be 254 characters or fewer.';
    } else if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    } else if (alertsEnabled && !trimmedEmail) {
      nextErrors.email =
        "Please enter your parent or guardian's email address.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const saveSettings = async () => {
    if (isSaving || isLoading) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      redirectToLogin();
      return;
    }

    const settings: CaregiverSettings = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      alertsEnabled,
    };

    setIsSaving(true);
    setSaveError('');

    try {
      const response = await apiFetch('/api/caregiver', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      const data =
        await parseJson<CaregiverResponse>(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.message === 'string' &&
            data.message.trim()
            ? data.message
            : 'Could not save caregiver settings.'
        );
      }

      if (!data?.settings) {
        throw new Error(
          'The server did not return the saved caregiver settings.'
        );
      }

      const saved = toLocalSettings(data.settings);

      setName(saved.name);
      setEmail(saved.email);
          setAlertsEnabled(saved.alertsEnabled);
          setLoadState('synced');
      setLoadError('');

      try {
        await writeLocalSettings(saved);
      } catch (cacheError) {
        console.log(
          '[caregiver] Could not cache settings locally',
          cacheError
        );
      }

      Alert.alert(
        'Settings Saved',
        'Your caregiver settings have been saved to your account. Email alerts are sent to your caregiver when consecutive doses are missed.'
      );
    } catch (error) {
      const message = `${getCaregiverError(
        error
      )} Your changes were not saved on the server.`;

      setSaveError(message);
      Alert.alert('Save Failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAlerts = (value: boolean) => {
    setAlertsEnabled(value);
    setErrors({});
    setSaveError('');
  };

  if (!fontsLoaded) {
    return null;
  }

  const statusBanner: {
    tone: BannerTone;
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
  } = saveError
    ? {
        tone: 'error',
        icon: 'alert-circle-outline',
        text: saveError,
      }
    : loadState === 'local'
      ? {
          tone: 'warning',
          icon: 'warning-outline',
          text:
            loadError ||
            'These settings are stored on this device and have not been synced with your account. Tap Save Settings to sync them.',
        }
      : loadState === 'error'
        ? {
            tone: 'warning',
            icon: 'warning-outline',
            text:
              loadError ||
              'Could not load caregiver settings from the server. You can still edit and try saving.',
          }
        : loadState === 'empty'
          ? {
              tone: 'info',
              icon: 'information-circle-outline',
              text: 'No caregiver settings saved yet. Add details and tap Save Settings.',
            }
          : {
              tone: 'info',
              icon: 'information-circle-outline',
              text: 'Your caregiver details are saved to your account. Email alerts are sent when consecutive doses are missed.',
            };

  const bannerColor =
    statusBanner.tone === 'error'
      ? COLORS.dangerRed
      : statusBanner.tone === 'warning'
        ? '#8A6100'
          : COLORS.darkBlue;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            isMobile && styles.mobileScrollContent,
          ]}
        >
          <View style={styles.contentInner}>
            <View style={styles.header}>
              <Pressable
                onPress={goToProfile}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go back to profile"
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={COLORS.primaryBlue}
                />
              </Pressable>

              <View style={styles.headerText}>
                <Text
                  style={[
                    styles.title,
                    isMobile && styles.mobileTitle,
                  ]}
                >
                  Caregiver Settings
                </Text>

                <Text style={styles.subtitle}>
                  Add a trusted person who can be alerted when
                  you miss medicine doses.
                </Text>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primaryBlue}
                />

                <Text style={styles.loadingText}>
                  Loading caregiver settings...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.sectionTitleRow}>
              <Ionicons
                name="people-outline"
                size={20}
                color={COLORS.primaryBlue}
              />

              <Text style={styles.sectionTitle}>
                Caregiver Details
              </Text>
            </View>

            <View style={styles.card}>
              <FormField
                label="Parent/Guardian Name"
                value={name}
                placeholder="Enter parent or guardian name"
                onChangeText={(value) => {
                  setName(value);
                  clearError('name');
                }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={80}
                error={errors.name}
                editable={!isSaving}
              />

              <FormField
                label="Parent/Guardian Email"
                value={email}
                placeholder="Enter parent or guardian email"
                onChangeText={(value) => {
                  setEmail(value);
                  clearError('email');
                }}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                maxLength={254}
                error={errors.email}
                editable={!isSaving}
              />
            </View>

            <View style={styles.toggleCard}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <Ionicons
                    name="notifications-outline"
                    size={21}
                    color={COLORS.primaryGreen}
                  />
                </View>

                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>
                    Enable Caregiver Alerts
                  </Text>

                  <Text style={styles.toggleSubtitle}>
                    Email your caregiver when consecutive doses are
                    missed.
                  </Text>
                </View>

                <Switch
                  value={alertsEnabled}
                  onValueChange={toggleAlerts}
                  trackColor={{
                    false: '#C8D5D9',
                    true: COLORS.primaryGreen,
                  }}
                  thumbColor={COLORS.white}
                  disabled={isSaving}
                  accessibilityRole="switch"
                  accessibilityLabel="Enable Caregiver Alerts"
                  accessibilityState={{ checked: alertsEnabled }}
                />
              </View>
            </View>

            <View
              style={[
                styles.infoBanner,
                statusBanner.tone === 'warning' &&
                  styles.warningBanner,
                statusBanner.tone === 'error' &&
                  styles.errorBanner,
              ]}
            >
              <Ionicons
                name={statusBanner.icon}
                size={18}
                color={bannerColor}
              />

              <Text
                style={[
                  styles.infoText,
                  statusBanner.tone === 'warning' &&
                    styles.warningText,
                  statusBanner.tone === 'error' &&
                    styles.errorBannerText,
                ]}
              >
                {statusBanner.text}
              </Text>
            </View>

            <Pressable
              onPress={saveSettings}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || isSaving) && styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save caregiver settings"
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Ionicons
                  name="save-outline"
                  size={19}
                  color={COLORS.white}
                />
              )}

              <Text style={styles.saveText}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Text>
            </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  autoCapitalize,
  autoComplete,
  textContentType,
  keyboardType,
  maxLength,
  error,
  editable,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: number;
  error?: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AAAB0"
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        textContentType={textContentType}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
        style={[styles.input, error && styles.inputError]}
        accessibilityLabel={label}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    padding: 28,
    paddingBottom: 40,
  },

  mobileScrollContent: {
    padding: 16,
    paddingBottom: 28,
  },

  contentInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 26,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },

  pressed: {
    opacity: 0.75,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    color: COLORS.text,
  },

  mobileTitle: {
    fontSize: 26,
  },

  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 5,
    lineHeight: 20,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },

  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: COLORS.text,
    marginLeft: 8,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 3,
    marginBottom: 22,
  },

  loadingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 12,
  },

  field: {
    marginBottom: 15,
  },

  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 7,
  },

  input: {
    height: 50,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    color: COLORS.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },

  inputError: {
    borderColor: COLORS.dangerRed,
  },

  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.dangerRed,
    marginTop: 5,
  },

  toggleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 18,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  toggleContent: {
    flex: 1,
    paddingRight: 10,
  },

  toggleTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: COLORS.text,
  },

  toggleSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
    lineHeight: 17,
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.lightBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE6F2',
    padding: 14,
    marginBottom: 24,
  },

  infoText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.darkBlue,
    lineHeight: 18,
    marginLeft: 9,
  },

  warningBanner: {
    backgroundColor: '#FFF6E5',
    borderColor: '#F0D8A8',
  },

  errorBanner: {
    backgroundColor: '#FDEBE9',
    borderColor: '#F3C9C5',
  },

  warningText: {
    color: '#8A6100',
  },

  errorBannerText: {
    color: COLORS.dangerRed,
  },

  saveButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonPressed: {
    opacity: 0.75,
  },

  saveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    marginLeft: 8,
  },
});
