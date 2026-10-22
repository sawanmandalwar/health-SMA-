import React, { useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';

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

  const [imageUri, setImageUri] =
    useState<string | null>(null);

  const [imageSource, setImageSource] =
    useState<'camera' | 'library' | null>(
      null
    );

  const [activeSource, setActiveSource] =
    useState<'camera' | 'library' | null>(
      null
    );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [scanning, setScanning] =
    useState(false);

  const [, setSaving] =
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
  // CAPTURE
  // ==================================================

  const handleCapture = async () => {

    setErrorMessage(null);

    setActiveSource('camera');

    setScanning(true);

    try {

      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permission.granted) {

        setErrorMessage(
          permission.canAskAgain
            ? 'Camera access is required to capture a prescription.'
            : 'Camera access is blocked. Enable it in your device settings to capture a prescription.'
        );

        return;

      }

      const pickerResult =
        await ImagePicker
          .launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
          });

      if (pickerResult.canceled) {
        return;
      }

      const asset =
        pickerResult.assets?.[0];

      if (!asset?.uri) {

        setErrorMessage(
          'The captured image could not be loaded. Please try again.'
        );

        return;

      }

      setImageUri(asset.uri);

      setImageSource('camera');

      showToast(
        'Prescription image captured'
      );

    } catch (error) {

      console.error(
        'Failed to capture prescription:',
        error
      );

      setErrorMessage(
        'Unable to open the camera. Please try again.'
      );

    } finally {

      setScanning(false);

      setActiveSource(null);

    }

  };


  // ==================================================
  // UPLOAD
  // ==================================================

  const handleUpload = async () => {

    setErrorMessage(null);

    setActiveSource('library');

    setScanning(true);

    try {

      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {

        setErrorMessage(
          permission.canAskAgain
            ? 'Photo library access is required to upload a prescription.'
            : 'Photo library access is blocked. Enable it in your device settings to upload a prescription.'
        );

        return;

      }

      const pickerResult =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
          });

      if (pickerResult.canceled) {
        return;
      }

      const asset =
        pickerResult.assets?.[0];

      if (!asset?.uri) {

        setErrorMessage(
          'The selected image could not be loaded. Please try again.'
        );

        return;

      }

      setImageUri(asset.uri);

      setImageSource('library');

      showToast(
        'Prescription image selected'
      );

    } catch (error) {

      console.error(
        'Failed to upload prescription:',
        error
      );

      setErrorMessage(
        'Unable to open the photo library. Please try again.'
      );

    } finally {

      setScanning(false);

      setActiveSource(null);

    }

  };


  // ==================================================
  // CONFIRM & SAVE REMINDER
  // ==================================================

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/exhaustive-deps
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
            to preview the image.
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

          {imageUri ? (

            <View
              style={[
                styles.previewFrame,

                isMobile &&
                  styles.previewFrameMobile,
              ]}
            >

              <Image
                source={{
                  uri: imageUri,
                }}
                style={styles.previewImage}
                resizeMode="contain"
              />

            </View>

          ) : (

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

          )}


          <Text
            style={[
              styles.scanTitle,

              isMobile &&
                styles.scanTitleMobile,
            ]}
          >
            {scanning
              ? activeSource === 'camera'
                ? 'Opening camera...'
                : 'Opening photo library...'
              : imageUri
                ? 'Prescription image selected'
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
              ? 'Waiting for you to choose a prescription image.'
              : imageUri
                ? 'You can capture a new image or choose a different one.'
                : 'Choose a clear photo of your prescription to preview it here.'}
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
                {activeSource === 'camera'
                  ? 'Waiting for the camera...'
                  : 'Waiting for your selection...'}
              </Text>

            </View>

          )}

        </View>


        {/* ========================================== */}
        {/* ERROR */}
        {/* ========================================== */}

        {errorMessage && (

          <View
            style={[
              styles.errorBox,

              isMobile &&
                styles.errorBoxMobile,
            ]}
          >

            <Ionicons
              name="alert-circle-outline"
              size={23}
              color={
                COLORS.dangerRed
              }
            />

            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>

          </View>

        )}


        {/* ========================================== */}
        {/* SELECTED IMAGE */}
        {/* ========================================== */}

        {imageUri && (

          <View
            style={[
              styles.resultCard,

              isMobile &&
                styles.resultCardMobile,
            ]}
          >

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
                  SELECTED IMAGE
                </Text>


                <Text
                  style={[
                    styles.resultTitle,

                    isMobile &&
                      styles.resultTitleMobile,
                  ]}
                >
                  Prescription preview
                </Text>

              </View>


              <View
                style={[
                  styles.sourceBadge,

                  isMobile &&
                    styles.sourceBadgeMobile,
                ]}
              >

                <Ionicons
                  name={
                    imageSource === 'camera'
                      ? 'camera-outline'
                      : 'images-outline'
                  }
                  size={16}
                  color={
                    COLORS.primaryBlue
                  }
                />

                <Text
                  style={
                    styles.sourceBadgeText
                  }
                >
                  {imageSource === 'camera'
                    ? 'Camera'
                    : 'Gallery'}
                </Text>

              </View>

            </View>


            <View
              style={
                styles.reviewNotice
              }
            >

              <Ionicons
                name="information-circle-outline"
                size={23}
                color={
                  COLORS.primaryBlue
                }
              />

              <Text
                style={
                  styles.reviewNoticeText
                }
              >
                Prescription reading is not
                connected yet. This image has
                not been analyzed, and no
                medicine or reminder has been
                saved.
              </Text>

            </View>

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


  previewFrame: {
    width: '100%',

    maxWidth: 460,

    height: 260,

    borderRadius: 9,

    overflow: 'hidden',

    backgroundColor:
      '#E8F5F8',

    marginBottom: 25,
  },


  previewFrameMobile: {
    height: 210,
  },


  previewImage: {
    width: '100%',

    height: '100%',
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


  sourceBadge: {
    backgroundColor:
      COLORS.lightBlue,

    borderRadius: 20,

    paddingVertical: 8,

    paddingHorizontal: 15,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,
  },


  sourceBadgeMobile: {
    alignSelf: 'flex-start',

    marginTop: 2,
  },


  sourceBadgeText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 14,

    color:
      COLORS.primaryBlue,
  },


  reviewNotice: {
    minHeight: 64,

    backgroundColor:
      COLORS.lightBlue,

    borderRadius: 9,

    paddingHorizontal: 15,

    paddingVertical: 12,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
  },


  reviewNoticeText: {
    flex: 1,

    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.primaryBlue,
  },


  errorBox: {
    width: '58%',

    maxWidth: 920,

    alignSelf: 'center',

    minHeight: 64,

    backgroundColor:
      '#FDECEA',

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      '#F3C1BC',

    paddingHorizontal: 15,

    paddingVertical: 12,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    marginBottom: 20,
  },


  errorBoxMobile: {
    width: '100%',
  },


  errorText: {
    flex: 1,

    fontFamily:
      'Inter_500Medium',

    fontSize: 15,

    color:
      COLORS.dangerRed,
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