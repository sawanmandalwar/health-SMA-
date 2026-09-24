import React, { useMemo, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Linking,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useFonts } from 'expo-font';

import { useRouter } from 'expo-router';


// ====================================================
// COLORS
// ====================================================

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',

  primaryGreen: '#39A78D',

  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',

  dangerRed: '#E2574C',

  background: '#EAF3F5',

  white: '#FFFFFF',

  mainText: '#1D2B33',
  secondaryText: '#71858D',

  border: '#D2E3E8',

  mapBackground: '#CDEBFA',
};


// ====================================================
// HOSPITAL DATA
// ====================================================

type Hospital = {
  id: string;
  name: string;
  distance: string;
  specialty: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
};


const HOSPITALS: Hospital[] = [
  {
    id: '1',
    name: 'City Care Hospital',
    distance: '1.2 km',
    specialty: 'Cardiology · Multi-specialty',
    address: 'MG Road, Indore',
    phone: '0731-4001000',
    latitude: 28,
    longitude: 18,
  },

  {
    id: '2',
    name: 'Apollo Clinic',
    distance: '2.5 km',
    specialty: 'General Medicine',
    address: 'Vijay Nagar, Indore',
    phone: '0731-4002000',
    latitude: 42,
    longitude: 57,
  },

  {
    id: '3',
    name: "Sunrise Children's Hospital",
    distance: '3.1 km',
    specialty: 'Pediatrics',
    address: 'Bhawarkuan, Indore',
    phone: '0731-4003000',
    latitude: 75,
    longitude: 42,
  },
];


// ====================================================
// SCREEN
// ====================================================

export default function HospitalsScreen() {
  const router = useRouter();

  const { width } = useWindowDimensions();

  const isMobile = width < 600;

  const isTablet =
    width >= 600 && width < 900;

  const isDesktop = width >= 900;


  // ==================================================
  // FONTS
  // ==================================================

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,

    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });


  // ==================================================
  // SEARCH
  // ==================================================

  const [query, setQuery] =
    useState('');


  // ==================================================
  // TOAST
  // ==================================================

  const [toastVisible, setToastVisible] =
    useState(false);

  const [toastMessage, setToastMessage] =
    useState('');


  // ==================================================
  // FILTER HOSPITALS
  // ==================================================

  const filteredHospitals =
    useMemo(() => {
      const search =
        query.trim().toLowerCase();

      if (!search) {
        return HOSPITALS;
      }

      return HOSPITALS.filter(
        hospital =>
          hospital.name
            .toLowerCase()
            .includes(search) ||
          hospital.specialty
            .toLowerCase()
            .includes(search) ||
          hospital.address
            .toLowerCase()
            .includes(search)
      );
    }, [query]);


  // ==================================================
  // TOAST
  // ==================================================

  const showToast = (
    message: string
  ) => {
    setToastMessage(message);

    setToastVisible(true);

    setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  };


  // ==================================================
  // CALL
  // ==================================================

  const callHospital = (
    hospital: Hospital
  ) => {
    Linking.openURL(
      `tel:${hospital.phone}`
    ).catch(() => {
      showToast(
        `Calling ${hospital.name}`
      );
    });
  };


  // ==================================================
  // DIRECTIONS
  // ==================================================

  const openDirections = (
    hospital: Hospital
  ) => {
    const encodedAddress =
      encodeURIComponent(
        `${hospital.name}, ${hospital.address}`
      );

    const url =
      `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    Linking.openURL(url).catch(() => {
      showToast(
        'Unable to open directions'
      );
    });
  };


  // ==================================================
  // FONT CHECK
  // ==================================================

  if (!fontsLoaded) {
    return null;
  }


  // ==================================================
  // HOSPITAL CARD
  // ==================================================

  const renderHospital = (
    hospital: Hospital
  ) => {
    return (
      <View
        key={hospital.id}
        style={[
          styles.hospitalCard,

          isMobile &&
            styles.hospitalCardMobile,
        ]}
      >

        {/* ------------------------------------------ */}
        {/* HOSPITAL HEADER */}
        {/* ------------------------------------------ */}

        <View
          style={styles.hospitalHeader}
        >

          <View
            style={styles.hospitalIcon}
          >
            <Ionicons
              name="business-outline"
              size={28}
              color={
                COLORS.primaryGreen
              }
            />
          </View>


          <View
            style={styles.hospitalTitleArea}
          >

            <Text
              style={[
                styles.hospitalName,

                isMobile &&
                  styles.hospitalNameMobile,
              ]}
              numberOfLines={2}
            >
              {hospital.name}
            </Text>


            <Text
              style={
                styles.distance
              }
            >
              {hospital.distance}
            </Text>

          </View>

        </View>


        {/* ------------------------------------------ */}
        {/* SPECIALTY */}
        {/* ------------------------------------------ */}

        <Text
          style={[
            styles.specialty,

            isMobile &&
              styles.specialtyMobile,
          ]}
        >
          {hospital.specialty}
        </Text>


        {/* ------------------------------------------ */}
        {/* ADDRESS */}
        {/* ------------------------------------------ */}

        <View
          style={styles.addressRow}
        >

          <Ionicons
            name="location-outline"
            size={18}
            color={
              COLORS.secondaryText
            }
          />

          <Text
            style={
              styles.addressText
            }
          >
            {hospital.address}
          </Text>

        </View>


        {/* ------------------------------------------ */}
        {/* ACTIONS */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.cardActions,

            isMobile &&
              styles.cardActionsMobile,
          ]}
        >

          {/* CALL */}

          <Pressable
            onPress={() =>
              callHospital(
                hospital
              )
            }

            style={[
              styles.callButton,

              isMobile &&
                styles.actionButtonMobile,
            ]}
          >

            <Ionicons
              name="call-outline"
              size={19}
              color={
                COLORS.mainText
              }
            />

            <Text
              style={
                styles.callButtonText
              }
            >
              Call
            </Text>

          </Pressable>


          {/* DIRECTIONS */}

          <Pressable
            onPress={() =>
              openDirections(
                hospital
              )
            }

            style={[
              styles.directionButton,

              isMobile &&
                styles.actionButtonMobile,
            ]}
          >

            <Ionicons
              name="navigate-outline"
              size={19}
              color={
                COLORS.white
              }
            />

            <Text
              style={
                styles.directionButtonText
              }
            >
              Directions
            </Text>

          </Pressable>

        </View>

      </View>
    );
  };


  // ==================================================
  // MAP MARKER
  // ==================================================

  const MapMarker = ({
    hospital,
    index,
  }: {
    hospital: Hospital;
    index: number;
  }) => {
    return (
      <View
        style={[
          styles.mapMarker,

          {
            left: `${hospital.latitude}%`,
            top: `${hospital.longitude}%`,
          },

          index === 1 &&
            styles.mapMarkerGreen,
        ]}
      >

        <Ionicons
          name="business-outline"
          size={22}
          color={
            COLORS.white
          }
        />

      </View>
    );
  };


  // ==================================================
  // BOTTOM TAB
  // ==================================================

  const BottomTab = ({
    icon,
    label,
    active,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;

    label: string;

    active?: boolean;

    onPress: () => void;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.bottomTab,

          active &&
            styles.bottomTabActive,
        ]}
      >

        <Ionicons
          name={icon}
          size={22}
          color={
            active
              ? COLORS.primaryBlue
              : COLORS.secondaryText
          }
        />

        <Text
          style={[
            styles.bottomTabText,

            active &&
              styles.bottomTabTextActive,
          ]}
        >
          {label}
        </Text>

      </Pressable>
    );
  };


  // ==================================================
  // RETURN
  // ==================================================

  return (
    <View style={styles.screen}>

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}

      <View
        style={styles.topHeader}
      >

        <Text
          style={styles.welcomeText}
        >
          Welcome back, sawan
        </Text>


        <View
          style={styles.headerRight}
        >

          <View
            style={
              styles.notificationIcon
            }
          >

            <Ionicons
              name="notifications-outline"
              size={24}
              color={
                COLORS.mainText
              }
            />

            <View
              style={
                styles.notificationDot
              }
            />

          </View>


          <View
            style={styles.avatar}
          >

            <Text
              style={styles.avatarText}
            >
              S
            </Text>

          </View>

        </View>

      </View>


      {/* ============================================ */}
      {/* MAIN SCROLL */}
      {/* ============================================ */}

      <ScrollView
        style={styles.scrollView}

        contentContainerStyle={[
          styles.scrollContent,

          isMobile &&
            styles.scrollContentMobile,
        ]}

        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ========================================== */}
        {/* PAGE TITLE */}
        {/* ========================================== */}

        <View
          style={styles.pageHeader}
        >

          <Text
            style={[
              styles.pageTitle,

              isMobile &&
                styles.pageTitleMobile,
            ]}
          >
            Nearby Hospitals
          </Text>


          <Text
            style={[
              styles.pageSubtitle,

              isMobile &&
                styles.pageSubtitleMobile,
            ]}
          >
            Indore, Madhya Pradesh
          </Text>

        </View>


        {/* ========================================== */}
        {/* SEARCH */}
        {/* ========================================== */}

        <View
          style={[
            styles.searchContainer,

            isMobile &&
              styles.searchContainerMobile,
          ]}
        >

          <Ionicons
            name="search-outline"
            size={25}
            color={
              COLORS.secondaryText
            }
          />


          <TextInput
            value={query}
            onChangeText={setQuery}

            placeholder="Search hospitals, clinics..."

            placeholderTextColor={
              COLORS.secondaryText
            }

            style={
              styles.searchInput
            }

            returnKeyType="search"
          />


          {query.length > 0 && (
            <Pressable
              onPress={() =>
                setQuery('')
              }
            >

              <Ionicons
                name="close-circle"
                size={22}
                color={
                  COLORS.secondaryText
                }
              />

            </Pressable>
          )}

        </View>


        {/* ========================================== */}
        {/* MAP */}
        {/* ========================================== */}

        <View
          style={[
            styles.map,

            isMobile &&
              styles.mapMobile,
          ]}
        >

          {/* MAP PATTERN */}

          <View
            style={
              styles.mapPattern
            }
          >

            {Array.from({
              length: 30,
            }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.mapLine,

                  {
                    left:
                      (index % 10) *
                      12 -
                      12,

                    top:
                      Math.floor(
                        index / 10
                      ) *
                        90 -
                      30,
                  },
                ]}
              />
            ))}

          </View>


          {/* MARKERS */}

          {HOSPITALS.map(
            (hospital, index) => (
              <MapMarker
                key={hospital.id}
                hospital={hospital}
                index={index}
              />
            )
          )}


          {/* LOCATION */}

          <View
            style={
              styles.locationBadge
            }
          >

            <Ionicons
              name="location-outline"
              size={19}
              color={
                COLORS.primaryBlue
              }
            />

            <Text
              style={
                styles.locationText
              }
            >
              Indore
            </Text>

          </View>

        </View>


        {/* ========================================== */}
        {/* HOSPITAL CARDS */}
        {/* ========================================== */}

        {filteredHospitals.length >
        0 ? (

          <View
            style={[
              styles.hospitalGrid,

              isMobile &&
                styles.hospitalGridMobile,

              isTablet &&
                styles.hospitalGridTablet,
            ]}
          >

            {filteredHospitals.map(
              renderHospital
            )}

          </View>

        ) : (

          /* NO RESULTS */

          <View
            style={
              styles.noResults
            }
          >

            <Ionicons
              name="search-outline"
              size={50}
              color={
                COLORS.secondaryText
              }
            />

            <Text
              style={
                styles.noResultsTitle
              }
            >
              No hospitals found
            </Text>

            <Text
              style={
                styles.noResultsText
              }
            >
              Try searching for another
              hospital or clinic.
            </Text>

          </View>

        )}


        <View
          style={{
            height: 100,
          }}
        />

      </ScrollView>


      {/* ============================================ */}
      {/* BOTTOM NAV */}
      {/* ============================================ */}

      <View
        style={[
          styles.bottomNav,

          isMobile &&
            styles.bottomNavMobile,
        ]}
      >

        <BottomTab
          icon="home-outline"
          label="Home"
          onPress={() =>
            router.push('/home')
          }
        />


        <BottomTab
          icon="medical-outline"
          label="Medicines"
          onPress={() =>
            router.push('/medicines')
          }
        />


        <BottomTab
          icon="calendar-outline"
          label="Appointments"
          onPress={() =>
            router.push(
              '/appointments'
            )
          }
        />


        <BottomTab
          icon="person-outline"
          label="Profile"
          onPress={() =>
            router.push('/profile')
          }
        />

      </View>


      {/* ============================================ */}
      {/* TOAST */}
      {/* ============================================ */}

      {toastVisible && (
        <View
          style={[
            styles.toast,

            isMobile &&
              styles.toastMobile,
          ]}
        >

          <View
            style={
              styles.toastIcon
            }
          >

            <Ionicons
              name="checkmark"
              size={15}
              color={
                COLORS.white
              }
            />

          </View>


          <Text
            style={
              styles.toastText
            }
          >
            {toastMessage}
          </Text>

        </View>
      )}

    </View>
  );
}


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  // ==================================================
  // SCREEN
  // ==================================================

  screen: {
    flex: 1,

    backgroundColor:
      COLORS.background,
  },


  scrollView: {
    flex: 1,
  },


  scrollContent: {
    paddingHorizontal: 34,

    paddingTop: 30,
  },


  scrollContentMobile: {
    paddingHorizontal: 16,

    paddingTop: 22,
  },


  // ==================================================
  // HEADER
  // ==================================================

  topHeader: {
    height: 84,

    backgroundColor:
      COLORS.white,

    borderBottomWidth: 1,

    borderBottomColor:
      COLORS.border,

    paddingHorizontal: 32,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',
  },


  welcomeText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 17,

    color:
      COLORS.secondaryText,
  },


  headerRight: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 22,
  },


  notificationIcon: {
    position: 'relative',
  },


  notificationDot: {
    position: 'absolute',

    right: 1,

    top: 0,

    width: 7,

    height: 7,

    borderRadius: 4,

    backgroundColor:
      COLORS.dangerRed,
  },


  avatar: {
    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor:
      COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  avatarText: {
    color:
      COLORS.white,

    fontFamily:
      'Poppins_700Bold',

    fontSize: 17,
  },


  // ==================================================
  // PAGE HEADER
  // ==================================================

  pageHeader: {
    marginBottom: 28,
  },


  pageTitle: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 36,

    color:
      COLORS.mainText,
  },


  pageTitleMobile: {
    fontSize: 29,
  },


  pageSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 18,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  pageSubtitleMobile: {
    fontSize: 15,
  },


  // ==================================================
  // SEARCH
  // ==================================================

  searchContainer: {
    height: 57,

    backgroundColor:
      COLORS.white,

    borderRadius: 7,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 15,

    marginBottom: 23,

    elevation: 2,
  },


  searchContainerMobile: {
    height: 52,
  },


  searchInput: {
    flex: 1,

    marginLeft: 11,

    fontFamily:
      'Inter_400Regular',

    fontSize: 16,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // MAP
  // ==================================================

  map: {
    height: 338,

    width: '100%',

    backgroundColor:
      COLORS.mapBackground,

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      '#C4DFEA',

    overflow: 'hidden',

    position: 'relative',

    marginBottom: 28,
  },


  mapMobile: {
    height: 270,
  },

  mapPattern: {
    ...StyleSheet.absoluteFillObject,

    opacity: 0.65,
  },


  mapLine: {
    position: 'absolute',

    width: 135,

    height: 3,

    backgroundColor:
      'rgba(255,255,255,0.85)',

    transform: [
      {
        rotate: '30deg',
      },
    ],
  },


  // ==================================================
  // MAP MARKER
  // ==================================================

  mapMarker: {
    position: 'absolute',

    width: 52,

    height: 52,

    borderRadius: 26,

    backgroundColor:
      COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent:
      'center',

    transform: [
      {
        translateX: -26,
      },
      {
        translateY: -26,
      },
    ],

    elevation: 7,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.18,

    shadowRadius: 6,
  },


  mapMarkerGreen: {
    backgroundColor:
      COLORS.primaryGreen,
  },


  // ==================================================
  // LOCATION BADGE
  // ==================================================

  locationBadge: {
    position: 'absolute',

    bottom: 18,

    left: 18,

    backgroundColor:
      COLORS.white,

    borderRadius: 9,

    paddingVertical: 10,

    paddingHorizontal: 15,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    elevation: 4,
  },


  locationText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // HOSPITAL GRID
  // ==================================================

  hospitalGrid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 20,
  },


  hospitalGridMobile: {
    flexDirection: 'column',

    gap: 16,
  },


  hospitalGridTablet: {
    gap: 14,
  },


  // ==================================================
  // HOSPITAL CARD
  // ==================================================

  hospitalCard: {
    flex: 1,

    minWidth: 290,

    backgroundColor:
      COLORS.white,

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    padding: 24,

    elevation: 2,
  },


  hospitalCardMobile: {
    width: '100%',

    minWidth: 0,

    padding: 18,
  },


  // ==================================================
  // HOSPITAL HEADER
  // ==================================================

  hospitalHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 17,
  },


  hospitalIcon: {
    width: 58,

    height: 58,

    borderRadius: 9,

    backgroundColor:
      COLORS.lightGreen,

    alignItems: 'center',

    justifyContent:
      'center',

    marginRight: 14,
  },


  hospitalTitleArea: {
    flex: 1,
  },


  hospitalName: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 19,

    color:
      COLORS.mainText,

    marginBottom: 3,
  },


  hospitalNameMobile: {
    fontSize: 17,
  },


  distance: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.primaryBlue,
  },


  // ==================================================
  // SPECIALTY
  // ==================================================

  specialty: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 16,

    color:
      COLORS.mainText,

    marginBottom: 7,
  },


  specialtyMobile: {
    fontSize: 14,
  },


  // ==================================================
  // ADDRESS
  // ==================================================

  addressRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    marginBottom: 21,
  },


  addressText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.secondaryText,

    flex: 1,
  },


  // ==================================================
  // ACTIONS
  // ==================================================

  cardActions: {
    flexDirection: 'row',

    gap: 10,
  },


  cardActionsMobile: {
    gap: 9,
  },


  callButton: {
    flex: 1,

    height: 52,

    borderRadius: 7,

    backgroundColor:
      '#E1F2F6',

    borderWidth: 1,

    borderColor:
      '#CDE3E8',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 8,
  },


  directionButton: {
    flex: 1,

    height: 52,

    borderRadius: 7,

    backgroundColor:
      COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 8,

    elevation: 2,
  },


  actionButtonMobile: {
    height: 48,
  },


  callButtonText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  directionButtonText: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  // ==================================================
  // NO RESULTS
  // ==================================================

  noResults: {
    backgroundColor:
      COLORS.white,

    borderRadius: 10,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    paddingVertical: 70,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  noResultsTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 20,

    color:
      COLORS.mainText,

    marginTop: 12,
  },


  noResultsText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 14,

    color:
      COLORS.secondaryText,

    marginTop: 5,
  },


  // ==================================================
  // BOTTOM NAV
  // ==================================================

  bottomNav: {
    height: 72,

    backgroundColor:
      COLORS.white,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-around',

    paddingHorizontal: 25,
  },


  bottomNavMobile: {
    height: 68,

    paddingHorizontal: 8,
  },


  bottomTab: {
    minWidth: 80,

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 3,

    paddingVertical: 5,
  },


  bottomTabActive: {
    backgroundColor:
      '#E5F2F9',

    borderRadius: 10,
  },


  bottomTabText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 11,

    color:
      COLORS.secondaryText,
  },


  bottomTabTextActive: {
    fontFamily:
      'Inter_700Bold',

    color:
      COLORS.primaryBlue,
  },


  // ==================================================
  // TOAST
  // ==================================================

  toast: {
    position: 'absolute',

    top: 28,

    alignSelf: 'center',

    backgroundColor:
      COLORS.white,

    borderRadius: 11,

    paddingVertical: 15,

    paddingHorizontal: 21,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.15,

    shadowRadius: 10,

    elevation: 10,

    zIndex: 9999,
  },


  toastMobile: {
    top: 15,

    left: 16,

    right: 16,

    alignSelf: 'auto',
  },


  toastIcon: {
    width: 23,

    height: 23,

    borderRadius: 12,

    backgroundColor:
      '#1D1D1D',

    alignItems: 'center',

    justifyContent:
      'center',
  },


  toastText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 14,

    color:
      COLORS.mainText,
  },
});