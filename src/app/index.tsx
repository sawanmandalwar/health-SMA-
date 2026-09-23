import React, { useState } from 'react';
import {
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
import { router } from 'expo-router';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    console.log('Login successful');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            <View style={styles.logo}>
              <Text style={styles.logoIcon}>✚</Text>
            </View>

            <Text style={styles.appName}>Health-Saathi</Text>

            <Text style={styles.tagline}>
              Aapki Sehat, Hamari Zimmedari
            </Text>

            <View style={styles.welcomeSection}>
              <Text style={styles.welcome}>Welcome Back 👋</Text>

              <Text style={styles.subtitle}>
                Login to manage your health with ease.
              </Text>
            </View>

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
            />

            <Text style={styles.label}>Password</Text>

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

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              style={styles.loginButton}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>
                Don't have an account?{' '}
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