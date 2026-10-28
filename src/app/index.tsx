import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';
import { apiFetch, getApiErrorMessage, parseJson } from '../services/api';
import { getDeviceTimeZone } from '../services/timezoneService';

function getLoginFailureMessage(
  status: number,
  serverMessage?: string,
): string {
  const message =
    typeof serverMessage === 'string' ? serverMessage.trim() : '';

  if (status === 401) {
    return message || 'Invalid email or password. Please check your credentials and try again.';
  }

  if (status === 400) {
    return message || 'Please check your email and password and try again.';
  }

  if (status === 403) {
    return message || 'This account is not allowed to sign in. Please contact support.';
  }

  if (status === 404) {
    return 'The login service could not be found. Please check the app configuration.';
  }

  if (status >= 500) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }

  return message || 'Login failed. Please try again.';
}

export default function LoginScreen() {
  const { width } = useResponsiveDimensions();
  const isLargeScreen = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    console.log('[login] handler executed');
    setError('');

    // Email validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Password validation
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    try {
      setLoading(true);

      console.log('[login] sending POST /api/auth/login');

      const response = await apiFetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          timezone: getDeviceTimeZone(),
        }),
      });

      console.log('[login] response status:', response.status);

      const data = await parseJson(response);

      if (!response.ok) {
        console.log('[login] server rejected the request:', response.status);
        setError(getLoginFailureMessage(response.status, data?.message));
        return;
      }

      if (!data?.token || !data?.user) {
        setError('The server returned an unexpected response. Please try again.');
        return;
      }

      // Save login information
      await AsyncStorage.setItem('authToken', data.token);
      
      await AsyncStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      console.log('[login] success, redirecting to /home');

      // Go to Home
      router.replace('/home');
    } catch (error) {
      console.error('[login] request failed:', error);

      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isLargeScreen && styles.webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, isLargeScreen && styles.webCard]}>

            {/* Logo */}
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>✚</Text>
            </View>

            <Text style={styles.appName}>Health-Saathi</Text>

            <Text style={styles.tagline}>
              Aapki Sehat, Hamari Zimmedari
            </Text>

            {/* Welcome */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcome}>
                Welcome Back 👋
              </Text>

              <Text style={styles.subtitle}>
                Login to manage your health with ease.
              </Text>
            </View>

            {/* Email */}
            <Text style={styles.label}>
              Email Address
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#71858D"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            {/* Password */}
            <Text style={styles.label}>
              Password
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#71858D"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            {/* Options */}
            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxActive,
                  ]}
                >
                  {rememberMe && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </View>

                <Text style={styles.rememberText}>
                  Remember Me
                </Text>
              </Pressable>

              <Pressable>
                <Text style={styles.forgotText}>
                  Forgot Password?
                </Text>
              </Pressable>
            </View>

            {/* Error */}
            {error ? (
              <Text style={styles.error}>
                {error}
              </Text>
            ) : null}

            {/* Login Button */}
            <Pressable
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>
                  Login
                </Text>
              )}
            </Pressable>

            {/* Register */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>
                Don&apos;t have an account?{' '}
              </Text>

              <Pressable
                onPress={() => router.push('/register')}
              >
                <Text style={styles.registerLink}>
                  Register
                </Text>
              </Pressable>
            </View>

            <Text style={styles.footer}>
              Your health, our priority 💙
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF3F5',
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 35,
  },

  webScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },

  card: {
    width: '100%',
  },

  webCard: {
    width: 520,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 40,
    paddingVertical: 40,
    shadowColor: '#155A8C',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 5,
  },

  logo: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#1E76B6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },

  logoIcon: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
  },

  appName: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '800',
    color: '#155A8C',
  },

  tagline: {
    textAlign: 'center',
    fontSize: 14,
    color: '#39A78D',
    marginTop: 4,
  },

  welcomeSection: {
    marginTop: 42,
    marginBottom: 12,
  },

  welcome: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1D2B33',
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 15,
    color: '#71858D',
    lineHeight: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D2B33',
    marginTop: 17,
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1D2B33',
  },

  passwordContainer: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1D2B33',
  },

  showText: {
    color: '#1E76B6',
    fontWeight: '600',
    paddingHorizontal: 15,
  },

  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 17,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#1E76B6',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxActive: {
    backgroundColor: '#1E76B6',
  },

  check: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  rememberText: {
    color: '#71858D',
    fontSize: 13,
  },

  forgotText: {
    color: '#1E76B6',
    fontSize: 13,
    fontWeight: '600',
  },

  error: {
    color: '#E2574C',
    fontSize: 13,
    marginTop: 10,
  },

  loginButton: {
    height: 55,
    backgroundColor: '#1E76B6',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },

  registerText: {
    color: '#71858D',
    fontSize: 14,
  },

  registerLink: {
    color: '#1E76B6',
    fontSize: 14,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    color: '#71858D',
    fontSize: 13,
    marginTop: 32,
  },
});