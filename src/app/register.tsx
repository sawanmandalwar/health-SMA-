
import { router } from 'expo-router';
import React, { useState } from 'react';
import { apiFetch, getApiErrorMessage, parseJson } from '../services/api';
import { getDeviceTimeZone } from '../services/timezoneService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // =========================
  // FORM STATES
  // =========================

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // =========================
  // REGISTER
  // =========================

  const handleRegister = async () => {
    setError('');

    // Name validation
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    // Mobile validation
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    // Email validation
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    // Password validation
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    // Confirm password
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Terms
    if (!agree) {
      setError('Please accept the Terms and Conditions.');
      return;
    }

    try {
      setLoading(true);

      console.log('Sending registration request...');

      const response = await apiFetch(`/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          phone: mobile,
          timezone: getDeviceTimeZone(),
        }),
      });

      const data = await parseJson(response);

      console.log('[register] response status:', response.status);

      if (!response.ok) {
        setError(data.message || 'Registration failed. Please try again.');
        return;
      }
      

   // Registration successful
console.log('Registration successful');

// Save login session
await AsyncStorage.setItem('authToken', data.token);
await AsyncStorage.setItem('user', JSON.stringify(data.user));

// Go to welcome screen
router.replace({
  pathname: '/welcome',
  params: {
    name: name.trim(),
  },
});
    } catch (error) {
      console.log('Registration error:', error);

      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================

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

            {/* Heading */}
            <View style={styles.heading}>
              <Text style={styles.title}>Create Account</Text>

              <Text style={styles.subtitle}>
                Join Health-Saathi and manage your health with ease.
              </Text>
            </View>

            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#71858D"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />

            {/* Mobile */}
            <Text style={styles.label}>Mobile Number</Text>

            <View style={styles.mobileRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryText}>+91</Text>
              </View>

              <TextInput
                style={styles.mobileInput}
                placeholder="Enter mobile number"
                placeholderTextColor="#71858D"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
                editable={!loading}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#71858D"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Create a password"
                placeholderTextColor="#71858D"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Text style={styles.showText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.passwordHint}>
              Minimum 8 characters
            </Text>

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor="#71858D"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />

              <Pressable
                onPress={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                disabled={loading}
              >
                <Text style={styles.showText}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            {/* Terms */}
            <Pressable
              style={styles.termsRow}
              onPress={() => setAgree(!agree)}
              disabled={loading}
            >
              <View
                style={[
                  styles.checkbox,
                  agree && styles.checkboxActive,
                ]}
              >
                {agree && <Text style={styles.check}>✓</Text>}
              </View>

              <Text style={styles.termsText}>
                I agree to the Terms and Conditions.
              </Text>
            </Pressable>

            {/* Error */}
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            {/* Register Button */}
            <Pressable
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>
                  Create Account
                </Text>
              )}
            </Pressable>

            {/* Login */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
              </Text>

              <Pressable
                onPress={() => router.replace('/')}
                disabled={loading}
              >
                <Text style={styles.loginLink}>Login</Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =========================
// STYLES
// =========================

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
    paddingTop: 25,
    paddingBottom: 35,
  },

  webScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  card: {
    width: '100%',
  },

  webCard: {
    width: 520,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 38,
    paddingVertical: 35,
    elevation: 5,
    shadowColor: '#155A8C',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  logo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E76B6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  logoIcon: {
    color: '#FFFFFF',
    fontSize: 37,
    fontWeight: '700',
  },

  appName: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: '#155A8C',
    marginTop: 9,
  },

  tagline: {
    textAlign: 'center',
    color: '#39A78D',
    fontSize: 13,
    marginTop: 4,
  },

  heading: {
    marginTop: 30,
    marginBottom: 5,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1D2B33',
  },

  subtitle: {
    color: '#71858D',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },

  label: {
    color: '#1D2B33',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 7,
  },

  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 11,
    paddingHorizontal: 15,
    color: '#1D2B33',
    fontSize: 15,
  },

  mobileRow: {
    flexDirection: 'row',
    gap: 8,
  },

  countryCode: {
    width: 60,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  countryText: {
    color: '#1D2B33',
    fontWeight: '600',
  },

  mobileInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 11,
    paddingHorizontal: 15,
    color: '#1D2B33',
    fontSize: 15,
  },

  passwordContainer: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E3E8',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 14,
  },

  passwordInput: {
    flex: 1,
    color: '#1D2B33',
    fontSize: 15,
  },

  showText: {
    color: '#1E76B6',
    fontWeight: '600',
  },

  passwordHint: {
    color: '#71858D',
    fontSize: 12,
    marginTop: 5,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },

  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 1.5,
    borderColor: '#1E76B6',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  checkboxActive: {
    backgroundColor: '#1E76B6',
  },

  check: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  termsText: {
    flex: 1,
    color: '#71858D',
    fontSize: 13,
  },

  error: {
    color: '#E2574C',
    fontSize: 13,
    marginTop: 10,
  },

  registerButton: {
    height: 53,
    backgroundColor: '#1E76B6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  registerButtonDisabled: {
    opacity: 0.7,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },

  loginText: {
    color: '#71858D',
    fontSize: 14,
  },

  loginLink: {
    color: '#1E76B6',
    fontWeight: '700',
    fontSize: 14,
  },
});