import React, { useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

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

  warningBg: '#FFF0D2',
  warningText: '#D99800',
};


// ====================================================
// STORAGE KEY
// ====================================================

const MEDICINES_STORAGE_KEY =
  '@health_saathi_medicines';


// ====================================================
// SCREEN
// ====================================================

export default function ScanScreen() {

  const router = useRouter();

  const { width } =
    useWindowDimensions();

  const isMobile =
    width < 600;

  const isTablet =
    width >= 600 &&
    width < 900;


  // ==================================================
  // FONTS
  // ==================================================

  const [fontsLoaded] =
    useFonts({

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
  // STATES
  // ==================================================

  const [result, setResult] =
    useState(false);

  const [scanning, setScanning] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [toastVisible, setToastVisible] =
    useState(false);

  const [toastMessage, setToastMessage] =
    useState('');


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
    }, 3000);

  };


  // ==================================================
  // PROCESS PRESCRIPTION
  // ==================================================

  const processPrescription = () => {

    setScanning(true);

    setResult(false);

    setTimeout(() => {

      setScanning(false);

      setResult(true);

      showToast(
        'Prescription details extracted'
      );

    }, 1000);

  };


  // ==================================================
  // CAPTURE
  // ==================================================

  const handleCapture = () => {

    processPrescription();

  };


  // ==================================================
  // UPLOAD
  // ==================================================

  const handleUpload = () => {

    processPrescription();

  };


  // ==================================================
  // CONFIRM & SAVE REMINDER
  // ==================================================

  const confirmReminder =
    async () => {

      try {

        setSaving(true);


        // --------------------------------------------
        // Medicine extracted from prescription
        // --------------------------------------------

        const newMedicine = {

          id:
            `scan-${Date.now()}`,

          name:
            'Azithromycin',

          dosage:
            '500mg',

          time:
            '8:00 AM',

          timing:
            'After Breakfast',

          frequency:
            'Once Daily',

          startDate:
            new Date()
              .toISOString()
              .split('T')[0],

          endDate:
            new Date(
              Date.now() +
              5 * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .split('T')[0],

          status:
            'Pending',

        };


        // --------------------------------------------
        // Get existing medicines
        // --------------------------------------------

        const existingData =
          await AsyncStorage.getItem(
            MEDICINES_STORAGE_KEY
          );


        let existingMedicines: any[] =
          [];


        if (existingData) {

          try {

            existingMedicines =
              JSON.parse(
                existingData
              );

            if (
              !Array.isArray(
                existingMedicines
              )
            ) {
              existingMedicines = [];
            }

          } catch {

            existingMedicines = [];

          }

        }


        // --------------------------------------------
        // Add scanned medicine
        // --------------------------------------------

        const updatedMedicines = [

          newMedicine,

          ...existingMedicines,

        ];


        // --------------------------------------------
        // Save medicines
        // --------------------------------------------

        await AsyncStorage.setItem(

          MEDICINES_STORAGE_KEY,

          JSON.stringify(
            updatedMedicines
          )

        );


        // --------------------------------------------
        // Success
        // --------------------------------------------

        setSaving(false);

        showToast(
          'Medicine reminder created successfully'
        );


        // --------------------------------------------
        // Navigate to Medicines
        // --------------------------------------------

        setTimeout(() => {

          router.replace(
            '/medicines'
          );

        }, 1000);

      } catch (error) {

        console.error(
          'Failed to save medicine:',
          error
        );

        setSaving(false);

        showToast(
          'Unable to save medicine reminder'
        );

      }

    };


  // ==================================================
  // FONT CHECK
  // ==================================================

  if (!fontsLoaded) {
    return null;
  }


  // ==================================================
  // BOTTOM TAB
  // ==================================================

  const BottomTab = ({
    icon,
    label,
    active = false,
    onPress,
  }: {
    icon:
      keyof typeof Ionicons.glyphMap;

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
  // DETAIL BOX
  // ==================================================

  const DetailBox = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => {

    return (

      <View
        style={[
          styles.detailBox,

          isMobile &&
            styles.detailBoxMobile,
        ]}
      >

        <Text
          style={
            styles.detailLabel
          }
        >
          {label}
        </Text>


        <Text
          style={
            styles.detailValue
          }
        >
          {value}
        </Text>

      </View>

    );

  };


  // ==================================================
  // RETURN
  // ==================================================

  return (

    <View
      style={styles.screen}
    >

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}

      <View
        style={styles.topHeader}
      >

        <Text
          style={
            styles.welcomeText
          }
        >
          Welcome back, sawan
        </Text>


        <View
          style={
            styles.headerRight
          }
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
              style={
                styles.avatarText
              }
            >
              S
            </Text>

          </View>

        </View>

      </View>


      {/* ============================================ */}
      {/* MAIN */}
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
        {/* PAGE HEADER */}
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
            Scan Prescription
          </Text>


          <Text
            style={[
              styles.pageSubtitle,

              isMobile &&
                styles.pageSubtitleMobile,
            ]}
          >
            Capture or upload a prescription
            to preview extracted details.
          </Text>

        </View>


        {/* ========================================== */}
        {/* SCAN BOX */}
        {/* ========================================== */}

        <View
          style={[
            styles.scanBox,

            isMobile &&
              styles.scanBoxMobile,

            isTablet &&
              styles.scanBoxTablet,
          ]}
        >

          <View
            style={
              styles.documentCircle
            }
          >

            <Ionicons
              name="document-text-outline"
              size={42}
              color={
                COLORS.primaryBlue
              }
            />

          </View>


          <Text
            style={[
              styles.scanTitle,

              isMobile &&
                styles.scanTitleMobile,
            ]}
          >
            {scanning
              ? 'Processing prescription...'
              : 'Tap to capture or upload prescription'}
          </Text>


          <Text
            style={[
              styles.scanDescription,

              isMobile &&
                styles.scanDescriptionMobile,
            ]}
          >
            {scanning
              ? 'Reading prescription details...'
              : 'This demonstration uses a prepared sample result.'}
          </Text>


          {!scanning && (

            <View
              style={[
                styles.scanButtons,

                isMobile &&
                  styles.scanButtonsMobile,
              ]}
            >

              {/* CAPTURE */}

              <Pressable
                onPress={
                  handleCapture
                }

                style={[
                  styles.captureButton,

                  isMobile &&
                    styles.scanButtonMobile,
                ]}
              >

                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={
                    COLORS.white
                  }
                />

                <Text
                  style={
                    styles.captureButtonText
                  }
                >
                  Capture
                </Text>

              </Pressable>


              {/* UPLOAD */}

              <Pressable
                onPress={
                  handleUpload
                }

                style={[
                  styles.uploadButton,

                  isMobile &&
                    styles.scanButtonMobile,
                ]}
              >

                <Ionicons
                  name="cloud-upload-outline"
                  size={20}
                  color={
                    COLORS.mainText
                  }
                />

                <Text
                  style={
                    styles.uploadButtonText
                  }
                >
                  Upload
                </Text>

              </Pressable>

            </View>

          )}


          {scanning && (

            <View
              style={
                styles.loadingContainer
              }
            >

              <View
                style={
                  styles.loadingDot
                }
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Extracting medicine
                information...
              </Text>

            </View>

          )}

        </View>


        {/* ========================================== */}
        {/* EXTRACTED RESULT */}
        {/* ========================================== */}

        {result && (

          <View
            style={[
              styles.resultCard,

              isMobile &&
                styles.resultCardMobile,
            ]}
          >

            {/* RESULT HEADER */}

            <View
              style={[
                styles.resultHeader,

                isMobile &&
                  styles.resultHeaderMobile,
              ]}
            >

              <View>

                <Text
                  style={
                    styles.extractedLabel
                  }
                >
                  EXTRACTED DETAILS
                </Text>


                <Text
                  style={[
                    styles.resultTitle,

                    isMobile &&
                      styles.resultTitleMobile,
                  ]}
                >
                  Prescription result
                </Text>

              </View>


              <View
                style={[
                  styles.matchBadge,

                  isMobile &&
                    styles.matchBadgeMobile,
                ]}
              >

                <Text
                  style={
                    styles.matchText
                  }
                >
                  98% match
                </Text>

              </View>

            </View>


            {/* DETAILS */}

            <View
              style={[
                styles.detailsGrid,

                isMobile &&
                  styles.detailsGridMobile,
              ]}
            >

              <DetailBox
                label="Medicine Name"
                value="Azithromycin"
              />

              <DetailBox
                label="Dosage"
                value="500mg"
              />

              <DetailBox
                label="Frequency"
                value="Once Daily"
              />

              <DetailBox
                label="Timing"
                value="After Breakfast"
              />

              <DetailBox
                label="Duration"
                value="5 Days"
              />

            </View>


            {/* WARNING */}

            <View
              style={
                styles.warningBox
              }
            >

              <Ionicons
                name="warning-outline"
                size={23}
                color={
                  COLORS.warningText
                }
              />

              <Text
                style={
                  styles.warningText
                }
              >
                Please review the extracted
                details before confirming.
              </Text>

            </View>


            {/* CONFIRM */}

            <Pressable
              onPress={
                confirmReminder
              }

              disabled={saving}

              style={[
                styles.confirmButton,

                saving &&
                  styles.confirmButtonDisabled,
              ]}
            >

              <Ionicons
                name={
                  saving
                    ? 'sync-outline'
                    : 'checkmark-circle-outline'
                }

                size={21}

                color={
                  COLORS.white
                }
              />

              <Text
                style={
                  styles.confirmButtonText
                }
              >
                {saving
                  ? 'Saving Reminder...'
                  : 'Confirm & Set Reminder'}
              </Text>

            </Pressable>

          </View>

        )}


        <View
          style={{
            height: 100,
          }}
        />

      </ScrollView>


      {/* ============================================ */}
      {/* BOTTOM NAVIGATION */}
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


  // HEADER

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


  // PAGE HEADER

  pageHeader: {
    marginBottom: 30,
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


  // SCAN BOX

  scanBox: {
    width: '58%',

    maxWidth: 920,

    minHeight: 407,

    alignSelf: 'center',

    backgroundColor:
      COLORS.white,

    borderWidth: 2,

    borderStyle: 'dashed',

    borderColor:
      '#A7D6F0',

    borderRadius: 9,

    alignItems: 'center',

    justifyContent:
      'center',

    padding: 35,

    marginBottom: 28,

    elevation: 2,
  },


  scanBoxTablet: {
    width: '78%',
  },


  scanBoxMobile: {
    width: '100%',

    minHeight: 360,

    padding: 22,
  },


  documentCircle: {
    width: 96,

    height: 96,

    borderRadius: 48,

    backgroundColor:
      '#D5EFFB',

    alignItems: 'center',

    justifyContent:
      'center',

    marginBottom: 25,
  },


  scanTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 23,

    color:
      COLORS.mainText,

    textAlign: 'center',

    marginBottom: 7,
  },


  scanTitleMobile: {
    fontSize: 18,
  },


  scanDescription: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 16,

    color:
      COLORS.secondaryText,

    textAlign: 'center',

    marginBottom: 28,
  },


  scanDescriptionMobile: {
    fontSize: 14,

    maxWidth: 300,
  },


  // BUTTONS

  scanButtons: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 14,
  },


  scanButtonsMobile: {
    flexDirection: 'column',

    width: '100%',

    gap: 10,
  },


  captureButton: {
    minWidth: 132,

    height: 53,

    paddingHorizontal: 18,

    borderRadius: 7,

    backgroundColor:
      COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 8,

    elevation: 3,
  },


  uploadButton: {
    minWidth: 126,

    height: 53,

    paddingHorizontal: 18,

    borderRadius: 7,

    backgroundColor:
      '#E5F3F6',

    borderWidth: 1,

    borderColor:
      '#C9E1E6',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 8,
  },


  scanButtonMobile: {
    width: '100%',
  },


  captureButtonText: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  uploadButtonText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  // LOADING

  loadingContainer: {
    alignItems: 'center',

    justifyContent:
      'center',

    marginTop: 10,
  },


  loadingDot: {
    width: 30,

    height: 30,

    borderRadius: 15,

    borderWidth: 4,

    borderColor:
      '#CBE7F5',

    borderTopColor:
      COLORS.primaryBlue,

    marginBottom: 12,
  },


  loadingText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 14,

    color:
      COLORS.secondaryText,
  },


  // RESULT

  resultCard: {
    width: '58%',

    maxWidth: 920,

    alignSelf: 'center',

    backgroundColor:
      COLORS.white,

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    padding: 22,

    elevation: 2,
  },


  resultCardMobile: {
    width: '100%',

    padding: 17,
  },


  resultHeader: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent:
      'space-between',

    marginBottom: 22,
  },


  resultHeaderMobile: {
    flexDirection: 'column',

    gap: 10,

    marginBottom: 18,
  },


  extractedLabel: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 13,

    color:
      COLORS.primaryBlue,

    marginBottom: 5,
  },


  resultTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 23,

    color:
      COLORS.mainText,
  },


  resultTitleMobile: {
    fontSize: 21,
  },


  matchBadge: {
    backgroundColor:
      '#DDF7EC',

    borderRadius: 20,

    paddingVertical: 8,

    paddingHorizontal: 15,
  },


  matchBadgeMobile: {
    alignSelf: 'flex-start',

    marginTop: 2,
  },


  matchText: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 14,

    color:
      COLORS.primaryGreen,
  },


  // DETAILS

  detailsGrid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent:
      'space-between',

    gap: 13,

    marginBottom: 17,
  },


  detailsGridMobile: {
    flexDirection: 'column',

    gap: 10,

    width: '100%',
  },


  detailBox: {
    width: '48%',

    minHeight: 78,

    backgroundColor:
      '#E8F5F8',

    borderRadius: 9,

    paddingHorizontal: 14,

    paddingVertical: 12,

    justifyContent:
      'center',
  },


  detailBoxMobile: {
    width: '100%',

    minHeight: 82,

    paddingHorizontal: 16,

    paddingVertical: 14,
  },


  detailLabel: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 13,

    color:
      COLORS.secondaryText,

    marginBottom: 5,
  },


  detailValue: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 18,

    color:
      COLORS.mainText,
  },


  // WARNING

  warningBox: {
    minHeight: 64,

    backgroundColor:
      COLORS.warningBg,

    borderRadius: 9,

    paddingHorizontal: 15,

    paddingVertical: 12,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    marginBottom: 20,
  },


  warningText: {
    flex: 1,

    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.warningText,
  },


  // CONFIRM BUTTON

  confirmButton: {
    width: '100%',

    minHeight: 51,

    borderRadius: 7,

    backgroundColor:
      COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 8,

    elevation: 3,
  },


  confirmButtonDisabled: {
    opacity: 0.7,
  },


  confirmButtonText: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  // BOTTOM NAV

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


  // TOAST

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