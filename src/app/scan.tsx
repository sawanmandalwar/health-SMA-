import React, { useState } from 'react';

import {
  Alert,
  Image,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';

import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';

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

import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import {
  extractPrescriptionText,
  OcrError,
  PrescriptionTextResult,
} from '@/services/ocrService';

import {
  MedicineReviewCard,
  ReviewMedicine,
} from '@/components/medicine-review-card';

import { ImageCropEditor } from '@/components/image-crop-editor';

import AppHeader from '../components/AppHeader';

import {
  EditableImage,
  FULL_IMAGE_EDIT,
  ImageEditState,
  isFullImageCrop,
  isImageEditError,
  rotateEditClockwise,
  rotateImage,
} from '@/services/imageProcessingService';

import {
  ParsedPrescriptionMedicine,
  parsePrescriptionMedicines,
} from '@/services/prescriptionParser';

import {
  createMedicine,
  fetchMedicines,
  findDuplicateMedicine,
  MedicineRecord,
} from '@/services/medicineService';

import {
  isValidMedicineTime,
  requestNotificationPermission,
  syncMedicineReminders,
} from '@/services/notificationService';


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
// BOTTOM TAB
// ====================================================

type BottomTabProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
};

function BottomTab({
  icon,
  label,
  active = false,
  onPress,
}: BottomTabProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.bottomTab, active && styles.bottomTabActive]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? COLORS.primaryBlue : COLORS.secondaryText}
      />
      <Text
        style={[styles.bottomTabText, active && styles.bottomTabTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}


// ====================================================
// IMAGE ACTION
// ====================================================

type ScanActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  wide?: boolean;
};

function ScanActionButton({
  icon,
  label,
  onPress,
  disabled = false,
  primary = false,
  wide = false,
}: ScanActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.scanActionButton,
        wide && styles.scanActionButtonWide,
        primary && styles.scanActionButtonPrimary,
        pressed && styles.scanActionButtonPressed,
        disabled && styles.scanActionButtonDisabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={primary ? COLORS.white : COLORS.primaryBlue}
      />
      <Text
        style={[
          styles.scanActionText,
          primary && styles.scanActionTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}


function resolvePickedImage(
  asset: ImagePicker.ImagePickerAsset
): Promise<EditableImage> {
  if (asset.width > 0 && asset.height > 0) {
    return Promise.resolve({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  }

  return new Promise((resolve, reject) => {
    Image.getSize(
      asset.uri,
      (width, height) => {
        resolve({
          uri: asset.uri,
          width,
          height,
        });
      },
      () => {
        reject(new Error('Image dimensions could not be read.'));
      }
    );
  });
}


// ====================================================
// SCREEN
// ====================================================

export default function ScanScreen() {

  const router = useRouter();

  const { width } =
    useResponsiveDimensions();

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

  const [imageDimensions, setImageDimensions] =
    useState({ width: 0, height: 0 });

  const [imageEdit, setImageEdit] =
    useState<ImageEditState>(FULL_IMAGE_EDIT);

  const [previewLayout, setPreviewLayout] =
    useState({ width: 0, height: 0 });

  const [originalImage, setOriginalImage] =
    useState<EditableImage | null>(null);

  const [cropEditorVisible, setCropEditorVisible] =
    useState(false);

  const [imageProcessing, setImageProcessing] =
    useState(false);

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

  const [recognizing, setRecognizing] =
    useState(false);

  const [ocrResult, setOcrResult] =
    useState<PrescriptionTextResult | null>(
      null
    );

  const [reviewMedicines, setReviewMedicines] =
    useState<ReviewMedicine[]>([]);

  const [existingMedicines, setExistingMedicines] =
    useState<MedicineRecord[]>([]);

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


  const clearRecognition = () => {

    setOcrResult(null);

    setReviewMedicines([]);

    setErrorMessage(null);

  };


  const applySelectedImage = (
    image: EditableImage,
    source: 'camera' | 'library'
  ) => {

    setOriginalImage(image);

    setImageUri(image.uri);

    setImageDimensions({
      width: image.width,
      height: image.height,
    });

    setImageEdit(FULL_IMAGE_EDIT);

    setImageSource(source);

    clearRecognition();

  };


  const handleCropConfirm = (
    image: EditableImage,
    rotation: number,
    crop: ImageEditState['crop']
  ) => {

    setImageUri(image.uri);

    setImageDimensions({
      width: image.width,
      height: image.height,
    });

    setImageEdit({
      rotation,
      crop,
    });

    setCropEditorVisible(false);

    clearRecognition();

    showToast(
      'Crop applied. Extract the text when ready.'
    );

  };


  const handleUseOriginal = () => {

    if (!originalImage) {
      return;
    }

    const alreadyOriginal =
      originalImage.uri === imageUri &&
      imageEdit.rotation === 0 &&
      isFullImageCrop(imageEdit.crop);

    if (alreadyOriginal) {
      return;
    }

    setImageUri(originalImage.uri);

    setImageDimensions({
      width: originalImage.width,
      height: originalImage.height,
    });

    setImageEdit(FULL_IMAGE_EDIT);

    clearRecognition();

    showToast(
      'Original image restored'
    );

  };


  const handleQuickRotate = async () => {

    if (
      !originalImage ||
      !imageUri ||
      imageProcessing ||
      recognizing ||
      originalImage.width <= 0 ||
      originalImage.height <= 0
    ) {
      return;
    }

    setImageProcessing(true);
    setErrorMessage(null);

    try {

      const nextEdit =
        rotateEditClockwise(imageEdit);

      const rotated =
        await rotateImage(
          originalImage,
          nextEdit.rotation,
          nextEdit.crop
        );

      setImageEdit(nextEdit);

      setImageUri(rotated.uri);

      setImageDimensions({
        width: rotated.width,
        height: rotated.height,
      });

      clearRecognition();

      showToast(
        'Image rotated 90Ãƒâ€šÃ‚Â°'
      );

    } catch (error) {

      if (__DEV__) {
        console.error(
          '[scan] Rotation failed',
          {
            uri: originalImage.uri,
            width: originalImage.width,
            height: originalImage.height,
            edit: imageEdit,
            error,
          }
        );
      }

      setErrorMessage(
        isImageEditError(error)
          ? error.message
          : 'Unable to rotate the image. Please try again.'
      );

    } finally {

      setImageProcessing(false);

    }

  };


  const buildReviewMedicines = (
    parsed: ParsedPrescriptionMedicine[],
    existing: MedicineRecord[]
  ): ReviewMedicine[] =>
    parsed.map(
      (
        medicine,
        index
      ): ReviewMedicine => {
        const duplicate =
          findDuplicateMedicine(
            existing,
            medicine
          );

        return {
          id: `review-${Date.now()}-${index}`,
          name: medicine.name,
          dosage: medicine.dosage,
          timing: medicine.timing,
          frequency: medicine.frequency,
          startDate: medicine.startDate,
          endDate: medicine.endDate,
          schedules:
            medicine.schedules.map(
              (schedule, scheduleIndex) => ({
                id: `schedule-${Date.now()}-${index}-${scheduleIndex}`,
                time: schedule.time,
                quantity: schedule.quantity,
              })
            ),
          warnings: medicine.warnings,
          duplicateOf: duplicate
            ? duplicate.name
            : null,
        };
      }
    );


  const analyzePrescription = async (
    uri: string
  ) => {

    setRecognizing(true);

    setOcrResult(null);

    setReviewMedicines([]);

    try {

      const result =
        await extractPrescriptionText(uri);

      setOcrResult(result);

      const combinedText =
        result.combinedText ||
        [result.englishText, result.hindiText]
          .filter(Boolean)
          .join('\n');

      let currentMedicines: MedicineRecord[] =
        [];

      try {

        currentMedicines =
          await fetchMedicines();

        setExistingMedicines(
          currentMedicines
        );

      } catch (error) {

        console.log(
          'Unable to load existing medicines for duplicate check:',
          error
        );

      }

      setReviewMedicines(
        buildReviewMedicines(
          parsePrescriptionMedicines(
            combinedText
          ),
          currentMedicines
        )
      );

    } catch (error) {

      if (__DEV__) {
        console.error(
          '[scan] Prescription recognition failed',
          {
            code:
              error instanceof OcrError
                ? error.code
                : undefined,
            message:
              error instanceof Error
                ? error.message
                : String(error),
          }
        );
      }

      setOcrResult(null);

      setErrorMessage(
        error instanceof OcrError
          ? error.message
          : 'The prescription text could not be read. Please try again.'
      );

    } finally {

      setRecognizing(false);

    }

  };


  const handleExtractText = () => {

    if (
      !imageUri ||
      recognizing ||
      imageProcessing
    ) {
      return;
    }

    void analyzePrescription(imageUri);

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

      let image: EditableImage;

      try {

        image =
          await resolvePickedImage(asset);

      } catch (error) {

        if (__DEV__) {
          console.error(
            '[scan] Captured image could not be resolved',
            error
          );
        }

        setErrorMessage(
          'The captured image could not be loaded. Please try again.'
        );

        return;

      }

      applySelectedImage(
        image,
        'camera'
      );

      showToast(
        'Prescription image captured. Crop it or extract the text.'
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

      let image: EditableImage;

      try {

        image =
          await resolvePickedImage(asset);

      } catch (error) {

        if (__DEV__) {
          console.error(
            '[scan] Selected image could not be resolved',
            error
          );
        }

        setErrorMessage(
          'The selected image could not be loaded. Please try again.'
        );

        return;

      }

      applySelectedImage(
        image,
        'library'
      );

      showToast(
        'Prescription image selected. Crop it or extract the text.'
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
  // REVIEW & SAVE MEDICINES
  // ==================================================

  const updateReviewMedicine = (
    id: string,
    next: ReviewMedicine
  ) => {

    const warnings =
      next.warnings.filter((warning) => {

        if (
          warning.startsWith(
            'Dosage not found'
          )
        ) {

          return !next.dosage.trim();

        }

        if (
          warning.startsWith(
            'Food timing was not found'
          )
        ) {

          return !next.timing.trim();

        }

        if (
          warning.startsWith(
            'Frequency was not found'
          )
        ) {

          return !next.frequency.trim();

        }

        if (
          warning.startsWith(
            'Dose time was not found'
          )
        ) {

          return !next.schedules.some(
            (schedule) =>
              isValidMedicineTime(
                schedule.time
              )
          );

        }

        if (
          warning.includes(
            'Start date was not found'
          )
        ) {

          return !next.startDate.trim();

        }

        return true;

      });

    const duplicate =
      findDuplicateMedicine(
        existingMedicines,
        next
      );

    setReviewMedicines((current) =>
      current.map((medicine) =>
        medicine.id === id
          ? {
              ...next,
              warnings,
              duplicateOf: duplicate
                ? duplicate.name
                : null,
            }
          : medicine
      )
    );

  };


  const removeReviewMedicine = (
    id: string
  ) => {

    setReviewMedicines((current) =>
      current.filter(
        (medicine) =>
          medicine.id !== id
      )
    );

  };


  const validateReviewMedicines = (
    medicines: ReviewMedicine[]
  ): string[] => {

    const problems: string[] = [];

    medicines.forEach(
      (medicine, index) => {

        const label =
          medicine.name.trim() ||
          `Medicine ${index + 1}`;

        if (!medicine.name.trim()) {

          problems.push(
            `${label}: medicine name is missing.`
          );

        }

        if (!medicine.dosage.trim()) {

          problems.push(
            `${label}: dosage is missing.`
          );

        }

        if (!medicine.timing.trim()) {

          problems.push(
            `${label}: timing is missing.`
          );

        }

        if (
          medicine.schedules.length === 0
        ) {

          problems.push(
            `${label}: add at least one dose time.`
          );

        }

        const invalidTime =
          medicine.schedules.find(
            (schedule) =>
              !isValidMedicineTime(
                schedule.time
              )
          );

        if (invalidTime) {

          problems.push(
            `${label}: "${invalidTime.time}" is not a valid time.`
          );

        }

      }
    );

    return problems;

  };


  const persistReviewMedicines = async (
    medicines: ReviewMedicine[]
  ) => {

    setSaving(true);

    let remindersAllowed = false;

    try {

      remindersAllowed =
        await requestNotificationPermission();

    } catch (error) {

      console.log(
        'Unable to request notification permission:',
        error
      );

    }

    const saved: {
      medicine: ReviewMedicine;
      created: Awaited<
        ReturnType<typeof createMedicine>
      >;
    }[] = [];

    const failed: ReviewMedicine[] = [];

    let firstError = '';

    for (const medicine of medicines) {

      try {

        const created =
          await createMedicine({
            name: medicine.name,
            dosage: medicine.dosage,
            timing: medicine.timing,
            frequency:
              medicine.frequency,
            startDate:
              medicine.startDate,
            endDate:
              medicine.endDate,
            schedules:
              medicine.schedules.map(
                (schedule) => ({
                  time: schedule.time,
                  quantity:
                    schedule.quantity,
                })
              ),
          });

        saved.push({
          medicine,
          created,
        });

      } catch (error) {

        failed.push(medicine);

        if (!firstError) {

          firstError =
            error instanceof Error
              ? error.message
              : 'Unable to save medicine.';

        }

        console.error(
          'Failed to save scanned medicine:',
          error
        );

      }

    }

    if (saved.length > 0) {

      try {

        await syncMedicineReminders(
          saved.map(({ medicine, created }) => ({
            _id:
              created.id ||
              medicine.id,
            name: created.name,
            dosage: created.dosage,
            timing: created.timing,
            time: created.time,
            frequency:
              created.frequency,
            startDate:
              created.startDate,
            endDate:
              created.endDate,
            schedules:
              created.schedules.length > 0
                ? created.schedules
                : medicine.schedules,
          })),
          { partial: true }
        );

      } catch (error) {

        console.log(
          'Unable to schedule scanned medicine reminders:',
          error
        );

      }

    }

    setSaving(false);

    if (failed.length > 0) {

      setReviewMedicines(failed);

      Alert.alert(
        saved.length > 0
          ? 'Some Medicines Were Added'
          : 'Unable to Add Medicines',
        saved.length > 0
          ? `${saved.length} medicine${
              saved.length === 1 ? '' : 's'
            } added. ${failed.length} could not be saved. ${firstError}`
          : firstError ||
              'Please check your connection and try again.'
      );

      return;

    }

    setReviewMedicines([]);

    showToast(
      `${saved.length} medicine${
        saved.length === 1 ? '' : 's'
      } added to Medicines`
    );

    if (!remindersAllowed) {

      Alert.alert(
        'Reminders Are Off',
        'Notifications are disabled for Health Saathi, so medicine reminders will not appear. Enable notifications in your device settings to receive them.'
      );

    }

    setTimeout(() => {

      router.replace('/medicines');

    }, 800);

  };


  const confirmReminder = async () => {

    if (reviewMedicines.length === 0) {

      Alert.alert(
        'No Medicines Found',
        'No medicine details were recognized. Edit the prescription or try a clearer image.'
      );

      return;

    }

    const problems =
      validateReviewMedicines(
        reviewMedicines
      );

    if (problems.length > 0) {

      Alert.alert(
        'Check Medicine Details',
        problems
          .slice(0, 5)
          .join('\n') +
          (problems.length > 5
            ? `\n...and ${
                problems.length - 5
              } more.`
            : '')
      );

      return;

    }

    let currentMedicines =
      existingMedicines;

    try {

      currentMedicines =
        await fetchMedicines();

      setExistingMedicines(
        currentMedicines
      );

    } catch (error) {

      console.log(
        'Unable to refresh medicines before duplicate check:',
        error
      );

    }

    const duplicates =
      reviewMedicines.filter(
        (medicine, index) =>
          Boolean(
            findDuplicateMedicine(
              currentMedicines,
              medicine
            )
          ) ||
          reviewMedicines.some(
            (other, otherIndex) =>
              otherIndex !== index &&
              other.name
                .trim()
                .toLowerCase() ===
                medicine.name
                  .trim()
                  .toLowerCase() &&
              other.dosage
                .replace(/\s+/g, '')
                .toLowerCase() ===
                medicine.dosage
                  .replace(/\s+/g, '')
                  .toLowerCase()
          )
      );

    if (duplicates.length > 0) {

      Alert.alert(
        'Possible Duplicate',
        `${duplicates
          .map((medicine) => medicine.name)
          .join(', ')} may already exist with the same dosage. Add anyway?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Add Anyway',
            onPress: () => {
              void persistReviewMedicines(
                reviewMedicines
              );
            },
          },
        ]
      );

      return;

    }

    await persistReviewMedicines(
      reviewMedicines
    );

  };


  // ==================================================
  // FONT CHECK
  // ==================================================

  if (!fontsLoaded) {
    return null;
  }


  const pixelRatio = PixelRatio.get();

  const previewSourceWidth =
    imageDimensions.width / pixelRatio;

  const previewSourceHeight =
    imageDimensions.height / pixelRatio;

  const previewScale =
    previewSourceWidth > 0 &&
    previewSourceHeight > 0 &&
    previewLayout.width > 0 &&
    previewLayout.height > 0
      ? Math.min(
          1,
          previewLayout.width / previewSourceWidth,
          previewLayout.height / previewSourceHeight
        )
      : 0;

  const previewImageWidth =
    Math.floor(
      previewSourceWidth * previewScale * pixelRatio
    ) / pixelRatio;

  const previewImageHeight =
    Math.floor(
      previewSourceHeight * previewScale * pixelRatio
    ) / pixelRatio;


  // ==================================================
  // RETURN
  // ==================================================

  return (

    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >

      {/* ============================================ */}
      {/* HEADER (shared across all screens) */}
      {/* ============================================ */}

      <AppHeader />


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
            Capture or upload a prescription,
            then crop it before extracting the
            text.
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
              onLayout={(event) => {
                setPreviewLayout({
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                });
              }}
            >

              {previewImageWidth > 0 &&
                previewImageHeight > 0 && (
                  <Image
                    source={{
                      uri: imageUri,
                    }}
                    style={{
                      width: previewImageWidth,
                      height: previewImageHeight,
                    }}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                )}

              {imageDimensions.width > 0 &&
                imageDimensions.height > 0 && (
                  <View
                    pointerEvents="none"
                    style={styles.previewDimensionBadge}
                  >
                    <Text
                      style={styles.previewDimensionText}
                    >
                      {imageDimensions.width} ÃƒÆ’Ã¢â‚¬â€{' '}
                      {imageDimensions.height} px
                    </Text>
                  </View>
                )}

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
                ? 'Crop or rotate the image, then extract the prescription text.'
                : 'Choose a clear photo of your prescription to preview it here.'}
          </Text>


          {!scanning && !recognizing && !imageProcessing && (
            imageUri ? (

              <View style={styles.imageActions}>
                <View style={styles.imageTools}>
                  <ScanActionButton
                    icon="crop-outline"
                    label="Crop Image"
                    onPress={() => setCropEditorVisible(true)}
                    disabled={
                      imageDimensions.width <= 0 ||
                      imageDimensions.height <= 0
                    }
                  />

                  <ScanActionButton
                    icon="refresh-outline"
                    label="Rotate Image"
                    onPress={handleQuickRotate}
                    disabled={
                      imageDimensions.width <= 0 ||
                      imageDimensions.height <= 0
                    }
                  />

                  <ScanActionButton
                    icon="image-outline"
                    label="Use Original Image"
                    onPress={handleUseOriginal}
                    disabled={
                      !originalImage ||
                      (imageEdit.rotation === 0 &&
                        isFullImageCrop(imageEdit.crop) &&
                        originalImage.uri === imageUri)
                    }
                  />
                </View>

                <View style={styles.imageTools}>
                  <ScanActionButton
                    icon="camera-outline"
                    label="Retake Image"
                    onPress={handleCapture}
                  />

                  <ScanActionButton
                    icon="images-outline"
                    label="Choose Another Image"
                    onPress={handleUpload}
                  />
                </View>

                <ScanActionButton
                  wide
                  primary
                  icon="scan-outline"
                  label={
                    ocrResult
                      ? 'Scan Prescription Again'
                      : 'Extract Prescription Text'
                  }
                  onPress={handleExtractText}
                />
              </View>

            ) : (

              <View
                style={[
                  styles.scanButtons,

                  isMobile &&
                    styles.scanButtonsMobile,
                ]}
              >

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

            )
          )}


          {(scanning || recognizing || imageProcessing) && (

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
                {imageProcessing
                  ? 'Preparing the edited image...'
                  : recognizing
                    ? 'Reading the prescription...'
                    : activeSource === 'camera'
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
                  {ocrResult
                    ? 'RECOGNIZED TEXT'
                    : 'SELECTED IMAGE'}
                </Text>


                <Text
                  style={[
                    styles.resultTitle,

                    isMobile &&
                      styles.resultTitleMobile,
                  ]}
                >
                  {ocrResult
                    ? 'Prescription text'
                    : 'Prescription preview'}
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


            {ocrResult ? (

              <View
                style={
                  styles.ocrResult
                }
              >

                <View
                  style={
                    styles.ocrSection
                  }
                >

                  <Text
                    style={
                      styles.ocrLanguage
                    }
                  >
                    ENGLISH
                  </Text>

                  <Text
                    selectable
                    style={
                      styles.ocrText
                    }
                  >
                    {ocrResult.englishText ||
                      'No English text was recognized.'}
                  </Text>

                </View>


                <View
                  style={
                    styles.ocrSection
                  }
                >

                  <Text
                    style={
                      styles.ocrLanguage
                    }
                  >
                    HINDI
                  </Text>

                  <Text
                    selectable
                    style={
                      styles.ocrTextHindi
                    }
                  >
                    {ocrResult.hindiText ||
                      'No Hindi text was recognized.'}
                  </Text>

                </View>

              </View>

            ) : (

              <View
                style={
                  styles.reviewNotice
                }
              >

                <Ionicons
                  name={
                    recognizing
                      ? 'hourglass-outline'
                      : 'information-circle-outline'
                  }
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
                  {recognizing
                    ? 'Reading the prescription. The first scan may take longer while the recognition model is prepared.'
                    : 'No recognized text yet. Choose a clear prescription image to read it.'}
                </Text>

              </View>

            )}

          </View>

        )}


        {/* ========================================== */}
        {/* MEDICINE REVIEW */}
        {/* ========================================== */}

        {ocrResult && (

          <View
            style={[
              styles.reviewSection,

              isMobile &&
                styles.reviewSectionMobile,
            ]}
          >

            <View
              style={styles.reviewSectionHeader}
            >

              <View
                style={styles.reviewIcon}
              >

                <Ionicons
                  name="medkit-outline"
                  size={21}
                  color={
                    COLORS.primaryBlue
                  }
                />

              </View>

              <View
                style={{
                  flex: 1,
                }}
              >

                <Text
                  style={
                    styles.extractedLabel
                  }
                >
                  MEDICINES FOUND
                </Text>

                <Text
                  style={[
                    styles.resultTitle,

                    isMobile &&
                      styles.resultTitleMobile,
                  ]}
                >
                  {reviewMedicines.length}{' '}
                  {reviewMedicines.length ===
                  1
                    ? 'medicine'
                    : 'medicines'}{' '}
                  to review
                </Text>

              </View>

            </View>


            <Text
              style={styles.reviewHelp}
            >
              Check every field. Missing or
              uncertain details are left
              blank on purpose, so edit them
              before adding.
            </Text>


            {reviewMedicines.length === 0 ? (

              <View
                style={
                  styles.reviewNotice
                }
              >

                <Ionicons
                  name="search-outline"
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
                  No medicine details were
                  identified in the recognized
                  text. Try a clearer image or
                  add the medicine from the
                  Medicines screen.
                </Text>

              </View>

            ) : (

              <View
                style={{
                  marginTop: 14,
                }}
              >

                {reviewMedicines.map(
                  (medicine, index) => (

                    <MedicineReviewCard
                      key={medicine.id}
                      medicine={medicine}
                      index={index}
                      disabled={saving}
                      onChange={(next) =>
                        updateReviewMedicine(
                          medicine.id,
                          next
                        )
                      }
                      onRemove={() =>
                        removeReviewMedicine(
                          medicine.id
                        )
                      }
                    />

                  )
                )}


                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={
                    confirmReminder
                  }
                  style={[
                    styles.addMedicinesButton,

                    saving &&
                      styles.addMedicinesButtonDisabled,
                  ]}
                >

                  <Ionicons
                    name={
                      saving
                        ? 'hourglass-outline'
                        : 'add-circle-outline'
                    }
                    size={20}
                    color={
                      COLORS.white
                    }
                  />

                  <Text
                    style={
                      styles.addMedicinesText
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : `Add ${
                          reviewMedicines.length
                        } ${
                          reviewMedicines.length ===
                          1
                            ? 'medicine'
                            : 'medicines'
                        } to Medicines`}
                  </Text>

                </Pressable>

              </View>

            )}

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

          !isMobile &&
            styles.bottomNavDesktop,
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


      {originalImage && cropEditorVisible && (
        <ImageCropEditor
          key={originalImage.uri}
          visible
          image={originalImage}
          initialRotation={imageEdit.rotation}
          initialCrop={imageEdit.crop}
          onCancel={() => setCropEditorVisible(false)}
          onConfirm={handleCropConfirm}
        />
      )}


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

    </SafeAreaView>
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

    alignItems: 'center',

    justifyContent: 'center',
  },


  previewFrameMobile: {
    height: 210,
  },


  previewDimensionBadge: {
    position: 'absolute',

    right: 8,

    bottom: 8,

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 6,

    backgroundColor:
      'rgba(13, 35, 45, 0.72)',
  },


  previewDimensionText: {
    fontFamily: 'Inter_500Medium',

    fontSize: 10,

    color: COLORS.white,
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


  imageActions: {
    width: '100%',

    maxWidth: 620,

    gap: 10,
  },


  imageTools: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent: 'center',

    gap: 10,
  },


  scanActionButton: {
    minHeight: 50,

    minWidth: 120,

    flexBasis: 140,

    flexGrow: 1,

    paddingHorizontal: 12,

    borderRadius: 10,

    borderWidth: 1,

    borderColor: '#C9E1E6',

    backgroundColor: '#EEF8FA',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,
  },


  scanActionButtonWide: {
    width: '100%',

    flexBasis: 'auto',

    flexGrow: 0,
  },


  scanActionButtonPrimary: {
    borderColor: COLORS.primaryGreen,

    backgroundColor: COLORS.primaryGreen,

    elevation: 2,
  },


  scanActionButtonPressed: {
    opacity: 0.82,
  },


  scanActionButtonDisabled: {
    opacity: 0.42,
  },


  scanActionText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 12,

    color: COLORS.primaryBlue,

    flexShrink: 1,
  },


  scanActionTextPrimary: {
    color: COLORS.white,
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


  ocrResult: {
    gap: 12,
  },


  ocrSection: {
    backgroundColor:
      COLORS.lightBlue,

    borderRadius: 9,

    paddingHorizontal: 15,

    paddingVertical: 13,
  },


  ocrLanguage: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 12,

    letterSpacing: 0.4,

    color:
      COLORS.primaryBlue,

    marginBottom: 7,
  },


  ocrText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    lineHeight: 23,

    color:
      COLORS.mainText,
  },


  ocrTextHindi: {
    fontSize: 16,

    lineHeight: 25,

    color:
      COLORS.mainText,
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


  bottomNavDesktop: {
    width: '100%',

    maxWidth: 720,

    alignSelf: 'center',

    height: 64,

    marginTop: 10,

    marginBottom: 14,

    paddingHorizontal: 12,

    borderTopWidth: 0,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 16,
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


  // MEDICINE REVIEW

  reviewSection: {
    backgroundColor: '#F5FAFB',

    borderRadius: 20,

    borderWidth: 1,

    borderColor: COLORS.border,

    padding: 16,

    marginTop: -2,
  },

  reviewSectionMobile: {
    padding: 13,
  },

  reviewSectionHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
  },

  reviewIcon: {
    width: 38,

    height: 38,

    borderRadius: 19,

    backgroundColor: COLORS.lightBlue,

    alignItems: 'center',

    justifyContent: 'center',
  },

  reviewHelp: {
    fontFamily: 'Inter_400Regular',

    fontSize: 12,

    lineHeight: 18,

    color: COLORS.secondaryText,

    marginTop: 8,
  },

  addMedicinesButton: {
    minHeight: 50,

    borderRadius: 14,

    backgroundColor: COLORS.primaryGreen,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    paddingHorizontal: 16,

    marginTop: 4,
  },

  addMedicinesButtonDisabled: {
    opacity: 0.6,
  },

  addMedicinesText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.white,
  },

});