import { Image } from 'react-native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const params = useLocalSearchParams<{ name?: string }>();
  const userName = params.name || 'User';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/home');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.container,
          isLargeScreen && styles.webContainer,
        ]}
      >
        <Animated.View
          style={[
            styles.content,
            isLargeScreen && styles.webContent,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>✚</Text>
          </View>

          {/* App Name */}
          <Text style={styles.appName}>Health-Saathi</Text>

          <Text style={styles.tagline}>
            Aapki Sehat, Hamari Zimmedari
          </Text>

          {/* Doctor Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.circleBackground}>
            <Image
  source={require('../../assets/doctor-welcome.png')}
  style={styles.doctorImage}
  resizeMode="contain"
/>
            </View>

            <View style={styles.medicalBadge}>
              <Text style={styles.badgeText}>+</Text>
            </View>
          </View>

          {/* Welcome Text */}
          <Text style={styles.welcomeTitle}>
            Welcome to Health-Saathi
          </Text>

          <Text style={styles.userGreeting}>
            Good to see you, {userName} 👋
          </Text>

          <Text style={styles.description}>
            Your personal healthcare companion is ready to
            help you manage your medicines, appointments
            and health records.
          </Text>

          {/* Loading indicator */}
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDot} />
            <Text style={styles.loadingText}>
              Preparing your health dashboard...
            </Text>
          </View>
        </Animated.View>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  doctorImage: {
  width: 160,
  height: 160,
},

  webContainer: {
    paddingVertical: 50,
  },

  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  webContent: {
    maxWidth: 650,
  },

  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E76B6',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#155A8C',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,

    elevation: 6,
  },

  logoIcon: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },

  appName: {
    marginTop: 15,
    fontSize: 30,
    fontWeight: '800',
    color: '#155A8C',
    textAlign: 'center',
  },

  tagline: {
    marginTop: 5,
    fontSize: 14,
    color: '#39A78D',
    textAlign: 'center',
  },

  illustrationContainer: {
    marginTop: 42,
    marginBottom: 32,
    position: 'relative',
  },

  circleBackground: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#E7F2FA',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#1E76B6',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 15,

    elevation: 5,
  },

  doctorEmoji: {
    fontSize: 100,
  },

  medicalBadge: {
    position: 'absolute',
    right: -5,
    bottom: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#39A78D',
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 4,
    borderColor: '#EAF3F5',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  welcomeTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1D2B33',
    textAlign: 'center',
  },

  userGreeting: {
    marginTop: 10,
    fontSize: 19,
    fontWeight: '600',
    color: '#1E76B6',
    textAlign: 'center',
  },

  description: {
    maxWidth: 540,
    marginTop: 15,
    color: '#71858D',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },

  loadingContainer: {
    marginTop: 30,
    alignItems: 'center',
  },

  loadingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#39A78D',
    marginBottom: 8,
  },

  loadingText: {
    color: '#71858D',
    fontSize: 12,
  },
});