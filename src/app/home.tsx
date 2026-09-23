import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Circle } from 'react-native-svg';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

const COLORS = {
  primary: '#1E76B6',
  darkBlue: '#155A8C',
  green: '#39A78D',
  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',
  red: '#E2574C',
  lightRed: '#FBE8E6',
  background: '#EAF3F5',
  text: '#1D2B33',
  secondary: '#71858D',
  white: '#FFFFFF',
  border: '#DDE9ED',
  pending: '#F2A900',
  lightPending: '#FFF1D1',
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
        ? 'Good Afternoon'
        : 'Good Evening';

  const today = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appContainer}>

        {/* ================= DESKTOP SIDEBAR ================= */}

        {isDesktop && (
          <View style={styles.sidebar}>

            <View style={styles.brandArea}>
              <View style={styles.logo}>
                <Ionicons
                  name="heart"
                  size={25}
                  color={COLORS.white}
                />
              </View>

              <View>
                <Text style={styles.brandName}>
                  Health-Saathi
                </Text>

                <Text style={styles.brandTagline}>
                  Aapki Sehat, Hamari Zimmedari
                </Text>
              </View>
            </View>

            <SidebarItem
              icon="home-outline"
              label="Home"
              active
              onPress={() => {}}
            />

            <SidebarItem
              icon="medical-outline"
              label="Medicines"
              onPress={() => router.push('/medicines')}
            />

            <SidebarItem
              icon="calendar-outline"
              label="Appointments"
              onPress={() => router.push('/appointments')}
            />

            <SidebarItem
              icon="business-outline"
              label="Hospitals"
              onPress={() => router.push('/hospitals')}
            />

            <SidebarItem
              icon="person-outline"
              label="Profile"
              onPress={() => router.push('/profile')}
            />

            <Text style={styles.toolsTitle}>
              HEALTH TOOLS
            </Text>

            <SidebarItem
              icon="scan-outline"
              label="Scan Prescription"
              onPress={() => router.push('/scan')}
            />

            <SidebarItem
              icon="time-outline"
              label="Medicine History"
              onPress={() => {}}
            />

          </View>
        )}

        {/* ================= MAIN AREA ================= */}

        <View style={styles.mainArea}>

          {/* TOP HEADER */}

          <View style={styles.topHeader}>

            <Text style={styles.headerWelcome}>
              Welcome back, sawan
            </Text>

            <View style={styles.headerRight}>

              <Ionicons
                name="notifications-outline"
                size={23}
                color={COLORS.text}
              />

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  S
                </Text>
              </View>

            </View>

          </View>

          {/* CONTENT */}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              isDesktop && styles.desktopScrollContent,
            ]}
          >

            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >

              {/* PAGE HEADING */}

              <View style={styles.pageHeading}>

                <Text style={styles.pageTitle}>
                  {greeting}, sawan 👋
                </Text>

                <Text style={styles.pageDate}>
                  {today}
                </Text>

              </View>


              {/* ================= STAT CARDS ================= */}

              <View style={styles.statsGrid}>

                <StatCard
                  icon="medical-outline"
                  value="3"
                  label="Medicines today"
                  iconColor={COLORS.primary}
                  iconBackground={COLORS.lightBlue}
                />

                <StatCard
                  icon="checkmark-circle-outline"
                  value="18"
                  label="Taken this week"
                  iconColor={COLORS.green}
                  iconBackground={COLORS.lightGreen}
                />

                <StatCard
                  icon="warning-outline"
                  value="3"
                  label="Missed this week"
                  iconColor={COLORS.red}
                  iconBackground={COLORS.lightRed}
                />

                <StatCard
                  icon="calendar-outline"
                  value="1"
                  label="Upcoming visit"
                  iconColor={COLORS.primary}
                  iconBackground={COLORS.lightBlue}
                />

              </View>


              {/* ================= MAIN TWO COLUMN ================= */}

              <View
                style={[
                  styles.mainGrid,
                  isDesktop && styles.desktopMainGrid,
                ]}
              >

                {/* TODAY'S MEDICINES */}

                <View style={styles.medicineCard}>

                  <View style={styles.sectionHeader}>

                    <Text style={styles.sectionTitle}>
                      Today's Medicines
                    </Text>

                    <Pressable
                      onPress={() => router.push('/medicines')}
                    >
                      <Text style={styles.viewAll}>
                        View All
                      </Text>
                    </Pressable>

                  </View>

                  <MedicineRow
                    name="Metformin"
                    dose="500mg"
                    time="8:00 AM · After Breakfast"
                    status="Taken"
                    taken
                  />

                  <MedicineRow
                    name="Amlodipine"
                    dose="5mg"
                    time="2:00 PM · After Lunch"
                    status="Pending"
                  />

                  <MedicineRow
                    name="Atorvastatin"
                    dose="10mg"
                    time="9:00 PM · Before Sleep"
                    status="Pending"
                  />

                </View>


                {/* RIGHT COLUMN */}

                <View
                  style={[
                    styles.rightColumn,
                    !isDesktop && styles.mobileRightColumn,
                  ]}
                >

                  {/* ADHERENCE */}

                  <View style={styles.adherenceCard}>

                    <View style={styles.adherenceHeader}>

                      <Text style={styles.adherenceTitle}>
                        This Week's Adherence
                      </Text>

                      <View style={styles.goodProgress}>
                        <Text style={styles.goodProgressText}>
                          Good progress
                        </Text>
                      </View>

                    </View>

                    <View style={styles.adherenceBody}>

                      <AdherenceCircle />

                      <View style={styles.adherenceInfo}>

                        <Text style={styles.takenNumber}>
                          18 Taken
                        </Text>

                        <Text style={styles.missedNumber}>
                          3 Missed
                        </Text>

                        <Text style={styles.keepText}>
                          Keep following your routine.
                        </Text>

                      </View>

                    </View>

                  </View>


                  {/* APPOINTMENT */}

                  <View style={styles.appointmentCard}>

                    <Text style={styles.sectionTitle}>
                      Upcoming Appointment
                    </Text>

                    <View style={styles.appointmentBody}>

                      <View style={styles.calendarBox}>
                        <Ionicons
                          name="calendar-outline"
                          size={25}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.appointmentDetails}>

                        <Text style={styles.doctorName}>
                          Dr. Rajesh Mehta
                        </Text>

                        <Text style={styles.doctorDetails}>
                          Cardiologist · City Care Hospital
                        </Text>

                        <Text style={styles.appointmentDate}>
                          Friday, 12 September · 11:30 AM
                        </Text>

                        <Text style={styles.opd}>
                          OPD-3
                        </Text>

                      </View>

                      <View style={styles.upcomingBadge}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={COLORS.primary}
                        />

                        <Text style={styles.upcomingText}>
                          Upcoming
                        </Text>
                      </View>

                    </View>

                  </View>

                </View>

              </View>


              {/* ================= QUICK ACTIONS ================= */}

              <Text style={styles.quickTitle}>
                Quick Actions
              </Text>

              <View style={styles.quickGrid}>

                <QuickAction
                  icon="add"
                  label="Add Medicine"
                  onPress={() => router.push('/medicines')}
                />

                <QuickAction
                  icon="scan-outline"
                  label="Scan Prescription"
                  onPress={() => router.push('/scan')}
                />

                <QuickAction
                  icon="calendar-outline"
                  label="Appointments"
                  onPress={() => router.push('/appointments')}
                />

                <QuickAction
                  icon="business-outline"
                  label="Find Hospital"
                  onPress={() => router.push('/hospitals')}
                />

              </View>

            </Animated.View>

          </ScrollView>


          {/* ================= MOBILE NAV ================= */}

          {!isDesktop && (
            <View style={styles.mobileNav}>

              <MobileNavItem
                icon="home"
                label="Home"
                active
              />

              <MobileNavItem
                icon="medical-outline"
                label="Medicines"
                onPress={() => router.push('/medicines')}
              />

              <MobileNavItem
                icon="calendar-outline"
                label="Appointments"
                onPress={() => router.push('/appointments')}
              />

              <MobileNavItem
                icon="person-outline"
                label="Profile"
                onPress={() => router.push('/profile')}
              />

            </View>
          )}

        </View>

      </View>
    </SafeAreaView>
  );
}


/* ========================================================= */
/* STAT CARD */
/* ========================================================= */

function StatCard({
  icon,
  value,
  label,
  iconColor,
  iconBackground,
}: {
  icon: any;
  value: string;
  label: string;
  iconColor: string;
  iconBackground: string;
}) {
  return (
    <View style={styles.statCard}>

      <View
        style={[
          styles.statIcon,
          { backgroundColor: iconBackground },
        ]}
      >
        <Ionicons
          name={icon}
          size={23}
          color={iconColor}
        />
      </View>

      <View style={styles.statTextArea}>

        <Text style={styles.statValue}>
          {value}
        </Text>

        <Text style={styles.statLabel}>
          {label}
        </Text>

      </View>

    </View>
  );
}


/* ========================================================= */
/* MEDICINE ROW */
/* ========================================================= */

function MedicineRow({
  name,
  dose,
  time,
  status,
  taken = false,
}: {
  name: string;
  dose: string;
  time: string;
  status: string;
  taken?: boolean;
}) {
  return (
    <View style={styles.medicineRow}>

      <View style={styles.medicineIcon}>
        <Ionicons
          name="medical-outline"
          size={24}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.medicineInfo}>

        <Text style={styles.medicineName}>
          {name}{' '}
          <Text style={styles.medicineDose}>
            {dose}
          </Text>
        </Text>

        <Text style={styles.medicineTime}>
          {time}
        </Text>

      </View>

      <View
        style={[
          styles.medicineStatus,
          taken
            ? styles.takenStatus
            : styles.pendingStatus,
        ]}
      >

        <Ionicons
          name={taken ? 'checkmark' : 'time-outline'}
          size={13}
          color={taken ? COLORS.green : COLORS.pending}
        />

        <Text
          style={[
            styles.statusText,
            {
              color: taken
                ? COLORS.green
                : COLORS.pending,
            },
          ]}
        >
          {status}
        </Text>

      </View>

    </View>
  );
}


/* ========================================================= */
/* ADHERENCE CIRCLE */
/* ========================================================= */

function AdherenceCircle() {
  const size = 125;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = 0.85;
  const dashOffset =
    circumference * (1 - progress);

  return (
    <View style={styles.circleContainer}>

      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.green}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />

      </Svg>

      <View style={styles.circleText}>
        <Text style={styles.percentText}>
          85%
        </Text>
      </View>

    </View>
  );
}


/* ========================================================= */
/* QUICK ACTION */
/* ========================================================= */

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.pressed,
      ]}
    >

      <View style={styles.quickIcon}>
        <Ionicons
          name={icon}
          size={24}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.quickLabel}>
        {label}
      </Text>

    </Pressable>
  );
}


/* ========================================================= */
/* SIDEBAR ITEM */
/* ========================================================= */

function SidebarItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.sidebarItem,
        active && styles.sidebarActive,
      ]}
    >

      <Ionicons
        name={icon}
        size={22}
        color={
          active
            ? COLORS.primary
            : COLORS.secondary
        }
      />

      <Text
        style={[
          styles.sidebarText,
          active && styles.sidebarActiveText,
        ]}
      >
        {label}
      </Text>

    </Pressable>
  );
}


/* ========================================================= */
/* MOBILE NAV ITEM */
/* ========================================================= */

function MobileNavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.mobileNavItem}
    >

      <Ionicons
        name={icon}
        size={22}
        color={
          active
            ? COLORS.primary
            : COLORS.secondary
        }
      />

      <Text
        style={[
          styles.mobileNavText,
          active && styles.mobileNavActiveText,
        ]}
      >
        {label}
      </Text>

    </Pressable>
  );
}


/* ========================================================= */
/* STYLES */
/* ========================================================= */

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  appContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.background,
  },

  /* SIDEBAR */

  sidebar: {
    width: 270,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: 28,
    paddingHorizontal: 14,
  },

  brandArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 28,
  },

  logo: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  brandName: {
    color: COLORS.text,
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
  },

  brandTagline: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginTop: 2,
  },

  sidebarItem: {
    height: 50,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 4,
  },

  sidebarActive: {
    backgroundColor: '#D8EEFC',
  },

  sidebarText: {
    color: COLORS.secondary,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginLeft: 15,
  },

  sidebarActiveText: {
    color: COLORS.primary,
    fontFamily: 'Inter_600SemiBold',
  },

  toolsTitle: {
    color: COLORS.secondary,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 23,
    marginBottom: 9,
    paddingHorizontal: 15,
  },

  /* MAIN */

  mainArea: {
    flex: 1,
    minWidth: 0,
  },

  topHeader: {
    height: 82,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },

  headerWelcome: {
    color: COLORS.secondary,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.white,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
  },

  /* SCROLL */

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 35,
  },

  desktopScrollContent: {
    paddingHorizontal: 32,
    paddingTop: 28,
  },

  /* HEADING */

  pageHeading: {
    marginBottom: 25,
  },

  pageTitle: {
    color: COLORS.text,
    fontFamily: 'Poppins_700Bold',
    fontSize: 34,
    lineHeight: 43,
  },

  pageDate: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    marginTop: 3,
  },

  /* STATS */

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  statCard: {
    width: '48.7%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  statIcon: {
    width: 51,
    height: 51,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  statTextArea: {
    flex: 1,
  },

  statValue: {
    color: COLORS.text,
    fontFamily: 'Poppins_700Bold',
    fontSize: 23,
  },

  statLabel: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 1,
  },

  /* MAIN GRID */

  mainGrid: {
    width: '100%',
  },

  desktopMainGrid: {
    flexDirection: 'row',
    gap: 27,
    alignItems: 'flex-start',
  },

  /* MEDICINE */

  medicineCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 25,
    marginBottom: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionTitle: {
    color: COLORS.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 21,
  },

  viewAll: {
    color: COLORS.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },

  medicineRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  medicineIcon: {
    width: 51,
    height: 51,
    borderRadius: 9,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  medicineInfo: {
    flex: 1,
  },

  medicineName: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },

  medicineDose: {
    color: COLORS.secondary,
    fontFamily: 'Inter_500Medium',
  },

  medicineTime: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 4,
  },

  medicineStatus: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  takenStatus: {
    backgroundColor: COLORS.lightGreen,
  },

  pendingStatus: {
    backgroundColor: COLORS.lightPending,
  },

  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },

  /* RIGHT */

  rightColumn: {
    flex: 0.85,
  },

  mobileRightColumn: {
    width: '100%',
  },

  /* ADHERENCE */

  adherenceCard: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 22,
  },

  adherenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  adherenceTitle: {
    color: COLORS.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  goodProgress: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },

  goodProgressText: {
    color: COLORS.white,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },

  adherenceBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  circleContainer: {
    width: 125,
    height: 125,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },

  circleText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  percentText: {
    color: COLORS.white,
    fontFamily: 'Poppins_700Bold',
    fontSize: 25,
  },

  adherenceInfo: {
    flex: 1,
  },

  takenNumber: {
    color: COLORS.white,
    fontFamily: 'Poppins_700Bold',
    fontSize: 25,
  },

  missedNumber: {
    color: COLORS.white,
    opacity: 0.85,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginTop: 2,
  },

  keepText: {
    color: COLORS.white,
    opacity: 0.85,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 12,
  },

  /* APPOINTMENT */

  appointmentCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 22,
    marginBottom: 20,
  },

  appointmentBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
  },

  calendarBox: {
    width: 51,
    height: 51,
    borderRadius: 9,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  appointmentDetails: {
    flex: 1,
  },

  doctorName: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },

  doctorDetails: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
  },

  appointmentDate: {
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 13,
  },

  opd: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 3,
  },

  upcomingBadge: {
    backgroundColor: COLORS.lightBlue,
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  upcomingText: {
    color: COLORS.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },

  /* QUICK ACTIONS */

  quickTitle: {
    color: COLORS.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 21,
    marginTop: 4,
    marginBottom: 14,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  quickAction: {
    width: '48.7%',
    minHeight: 80,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  quickIcon: {
    width: 51,
    height: 51,
    borderRadius: 9,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  quickLabel: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  /* MOBILE NAV */

  mobileNav: {
    height: 70,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
  },

  mobileNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },

  mobileNavText: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginTop: 3,
  },

  mobileNavActiveText: {
    color: COLORS.primary,
    fontFamily: 'Inter_600SemiBold',
  },
});