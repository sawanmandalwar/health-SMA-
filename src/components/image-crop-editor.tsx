import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EditableImage,
  FULL_IMAGE_CROP,
  NormalizedCrop,
  cropImage,
  getRotatedSize,
  isFullImageCrop,
  isImageEditError,
  normalizeCrop,
  normalizeRotation,
  rotateCropClockwise,
  rotateCropCounterClockwise,
} from '@/services/imageProcessingService';

import type { CropFrame } from '@/utils/crop-pan-responders';
import { createCropPanResponders } from '@/utils/crop-pan-responders';

type ImageCropEditorProps = {
  visible: boolean;
  image: EditableImage | null;
  initialRotation?: number;
  initialCrop?: NormalizedCrop;
  onCancel: () => void;
  onConfirm: (
    image: EditableImage,
    rotation: number,
    crop: NormalizedCrop
  ) => void;
};

type Size = {
  width: number;
  height: number;
};

const COLORS = {
  background: '#0B1A21',
  panel: '#132A33',
  border: '#2B4A55',
  white: '#FFFFFF',
  muted: '#9DB5BE',
  success: '#39A78D',
};

const fitSize = (
  image: Size,
  rotation: number,
  available: Size
): CropFrame | null => {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    available.width <= 0 ||
    available.height <= 0
  ) {
    return null;
  }

  const rotated = getRotatedSize(image, rotation);
  const scale = Math.min(
    available.width / rotated.width,
    available.height / rotated.height
  );

  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const width = rotated.width * scale;
  const height = rotated.height * scale;

  return {
    x: (available.width - width) / 2,
    y: (available.height - height) / 2,
    width,
    height,
  };
};

export function ImageCropEditor({
  visible,
  image,
  initialRotation = 0,
  initialCrop = FULL_IMAGE_CROP,
  onCancel,
  onConfirm,
}: ImageCropEditorProps) {
  const [rotation, setRotation] = useState(() =>
    normalizeRotation(initialRotation)
  );
  const [crop, setCrop] = useState<NormalizedCrop>(() =>
    normalizeCrop(initialCrop)
  );
  const [imageSize, setImageSize] = useState<Size>(() => ({
    width: image?.width ?? 0,
    height: image?.height ?? 0,
  }));
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!visible || !image || image.width > 0) {
      return;
    }

    let active = true;

    Image.getSize(
      image.uri,
      (width, height) => {
        if (active) {
          setImageSize({ width, height });
        }
      },
      () => {
        if (active) {
          setLoadError('This image could not be opened. Choose another image.');
        }
      }
    );

    return () => {
      active = false;
    };
  }, [visible, image]);

  const frame = useMemo(() => {
    const available = {
      width: Math.max(1, canvasSize.width - 24),
      height: Math.max(1, canvasSize.height - 24),
    };
    const fitted = fitSize(imageSize, rotation, available);

    if (!fitted) {
      return null;
    }

    return {
      ...fitted,
      x: fitted.x + 12,
      y: fitted.y + 12,
    };
  }, [canvasSize.height, canvasSize.width, imageSize, rotation]);

  const cropRect = useMemo(() => {
    if (!frame) {
      return null;
    }

    return {
      x: frame.x + crop.x * frame.width,
      y: frame.y + crop.y * frame.height,
      width: crop.width * frame.width,
      height: crop.height * frame.height,
    };
  }, [crop, frame]);

  const responders = useMemo(
    () => createCropPanResponders(frame, setCrop),
    [frame]
  );

  const rotate = (degrees: number) => {
    if (processing) {
      return;
    }

    setRotation((current) => normalizeRotation(current + degrees));
    setCrop((current) =>
      degrees >= 0
        ? rotateCropClockwise(current)
        : rotateCropCounterClockwise(current)
    );
  };

  const reset = () => {
    if (processing) {
      return;
    }

    setRotation(0);
    setCrop(FULL_IMAGE_CROP);
    setLoadError(null);
  };

  const applyCrop = async () => {
    if (!image || !frame || processing) {
      return;
    }

    setProcessing(true);

    try {
      const editedImage = await cropImage(
        {
          uri: image.uri,
          width: imageSize.width,
          height: imageSize.height,
        },
        rotation,
        crop
      );

      onConfirm(editedImage, rotation, crop);
    } catch (error) {
      if (__DEV__) {
        console.error('[imageCropEditor] Crop failed', {
          uri: image.uri,
          width: imageSize.width,
          height: imageSize.height,
          rotation,
          crop,
          error,
        });
      }

      Alert.alert(
        'Crop failed',
        isImageEditError(error)
          ? error.message
          : 'The crop could not be applied. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  };

  if (!image) {
    return null;
  }

  const rotated = getRotatedSize(imageSize, rotation);
  const scale =
    frame && rotated.width > 0 && rotated.height > 0
      ? frame.width / rotated.width
      : 0;
  const imageWidth = imageSize.width * scale;
  const imageHeight = imageSize.height * scale;
  const isReset = rotation === 0 && isFullImageCrop(crop);
  const frameAvailable = Boolean(frame && cropRect);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!processing) {
          onCancel();
        }
      }}
      statusBarTranslucent
    >
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close crop editor"
              disabled={processing}
              onPress={onCancel}
              hitSlop={10}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={24}
                color={COLORS.white}
              />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.title}>Adjust Prescription</Text>
              <Text style={styles.subtitle}>
                Crop the area with the medicine details.
              </Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View
            style={styles.canvas}
            onLayout={(event) => {
              setCanvasSize({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              });
            }}
          >
            {loadError ? (
              <View style={styles.errorState}>
                <Ionicons
                  name="image-outline"
                  size={42}
                  color={COLORS.muted}
                />
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : frame && cropRect ? (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.imageFrame,
                    {
                      left: frame.x,
                      top: frame.y,
                      width: frame.width,
                      height: frame.height,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: image.uri }}
                    resizeMode="contain"
                    style={{
                      position: 'absolute',
                      left: (frame.width - imageWidth) / 2,
                      top: (frame.height - imageHeight) / 2,
                      width: imageWidth,
                      height: imageHeight,
                      transform: [{ rotate: `${rotation}deg` }],
                    }}
                  />
                </View>

                <View
                  pointerEvents="none"
                  style={[
                    styles.shade,
                    {
                      left: frame.x,
                      top: frame.y,
                      width: frame.width,
                      height: cropRect.y - frame.y,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.shade,
                    {
                      left: frame.x,
                      top: cropRect.y + cropRect.height,
                      width: frame.width,
                      height:
                        frame.y + frame.height - cropRect.y - cropRect.height,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.shade,
                    {
                      left: frame.x,
                      top: cropRect.y,
                      width: cropRect.x - frame.x,
                      height: cropRect.height,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.shade,
                    {
                      left: cropRect.x + cropRect.width,
                      top: cropRect.y,
                      width:
                        frame.x + frame.width - cropRect.x - cropRect.width,
                      height: cropRect.height,
                    },
                  ]}
                />

                <View
                  {...responders.move.panHandlers}
                  style={[
                    styles.cropBody,
                    {
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    },
                  ]}
                >
                  <View pointerEvents="none" style={styles.grid}>
                    <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
                    <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
                    <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
                    <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
                  </View>
                </View>

                <View
                  pointerEvents="none"
                  style={[
                    styles.cropBorder,
                    {
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    },
                  ]}
                />

                <View
                  {...responders.topLeft.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: cropRect.x - 15,
                      top: cropRect.y - 15,
                    },
                  ]}
                >
                  <View style={styles.cornerHandle} />
                </View>

                <View
                  {...responders.topRight.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: cropRect.x + cropRect.width - 15,
                      top: cropRect.y - 15,
                    },
                  ]}
                >
                  <View style={styles.cornerHandle} />
                </View>

                <View
                  {...responders.bottomLeft.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: cropRect.x - 15,
                      top: cropRect.y + cropRect.height - 15,
                    },
                  ]}
                >
                  <View style={styles.cornerHandle} />
                </View>

                <View
                  {...responders.bottomRight.panHandlers}
                  style={[
                    styles.handle,
                    {
                      left: cropRect.x + cropRect.width - 15,
                      top: cropRect.y + cropRect.height - 15,
                    },
                  ]}
                >
                  <View style={styles.cornerHandle} />
                </View>

                <View
                  {...responders.top.panHandlers}
                  style={[
                    styles.edgeHandle,
                    {
                      left: cropRect.x + cropRect.width / 2 - 15,
                      top: cropRect.y - 15,
                    },
                  ]}
                >
                  <View style={styles.horizontalEdge} />
                </View>

                <View
                  {...responders.bottom.panHandlers}
                  style={[
                    styles.edgeHandle,
                    {
                      left: cropRect.x + cropRect.width / 2 - 15,
                      top: cropRect.y + cropRect.height - 15,
                    },
                  ]}
                >
                  <View style={styles.horizontalEdge} />
                </View>

                <View
                  {...responders.left.panHandlers}
                  style={[
                    styles.edgeHandle,
                    {
                      left: cropRect.x - 15,
                      top: cropRect.y + cropRect.height / 2 - 15,
                    },
                  ]}
                >
                  <View style={styles.verticalEdge} />
                </View>

                <View
                  {...responders.right.panHandlers}
                  style={[
                    styles.edgeHandle,
                    {
                      left: cropRect.x + cropRect.width - 15,
                      top: cropRect.y + cropRect.height / 2 - 15,
                    },
                  ]}
                >
                  <View style={styles.verticalEdge} />
                </View>
              </>
            ) : (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={COLORS.white} />
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.helpText}>
              Drag the corners or edges to resize. Drag inside the box to move
              the crop.
            </Text>

            <View style={styles.rotateRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rotate image left"
                disabled={processing || !frameAvailable}
                onPress={() => rotate(-90)}
                style={({ pressed }) => [
                  styles.toolButton,
                  pressed && styles.toolButtonPressed,
                  (processing || !frameAvailable) && styles.toolButtonDisabled,
                ]}
              >
                <Ionicons
                  name="arrow-undo-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.toolButtonText}>Rotate left</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rotate image right"
                disabled={processing || !frameAvailable}
                onPress={() => rotate(90)}
                style={({ pressed }) => [
                  styles.toolButton,
                  pressed && styles.toolButtonPressed,
                  (processing || !frameAvailable) && styles.toolButtonDisabled,
                ]}
              >
                <Ionicons
                  name="arrow-redo-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.toolButtonText}>Rotate right</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset crop"
                disabled={processing || isReset || !frameAvailable}
                onPress={reset}
                style={({ pressed }) => [
                  styles.toolButton,
                  pressed && styles.toolButtonPressed,
                  (processing || isReset || !frameAvailable) &&
                    styles.toolButtonDisabled,
                ]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.toolButtonText}>Reset</Text>
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                disabled={processing}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use cropped image"
                disabled={processing || !frameAvailable || Boolean(loadError)}
                onPress={applyCrop}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.confirmButtonPressed,
                  (processing || !frameAvailable || Boolean(loadError)) &&
                    styles.confirmButtonDisabled,
                ]}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={21}
                    color={COLORS.white}
                  />
                )}
                <Text style={styles.confirmButtonText}>
                  {processing ? 'Applying...' : 'Use Cropped Image'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  safeArea: {
    flex: 1,
  },

  header: {
    minHeight: 74,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.panel,
  },

  headerText: {
    flex: 1,
  },

  headerSpacer: {
    width: 42,
  },

  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 19,
    color: COLORS.white,
  },

  subtitle: {
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.muted,
  },

  canvas: {
    flex: 1,
    marginHorizontal: 12,
    minHeight: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#061116',
  },

  imageFrame: {
    position: 'absolute',
    overflow: 'hidden',
  },

  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(1, 8, 11, 0.62)',
  },

  cropBody: {
    position: 'absolute',
  },

  cropBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  grid: {
    flex: 1,
  },

  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },

  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },

  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cornerHandle: {
    width: 15,
    height: 15,
    borderRadius: 3,
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  edgeHandle: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  horizontalEdge: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },

  verticalEdge: {
    width: 6,
    height: 22,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },

  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  errorText: {
    maxWidth: 320,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.muted,
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },

  helpText: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },

  rotateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },

  toolButton: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  toolButtonPressed: {
    backgroundColor: '#1B3843',
  },

  toolButtonDisabled: {
    opacity: 0.38,
  },

  toolButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: COLORS.white,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },

  cancelButton: {
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonPressed: {
    backgroundColor: '#1B3843',
  },

  cancelButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },

  confirmButton: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  confirmButtonPressed: {
    opacity: 0.88,
  },

  confirmButtonDisabled: {
    opacity: 0.55,
  },

  confirmButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
});
