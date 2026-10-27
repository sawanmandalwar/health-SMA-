import { Image as ReactNativeImage } from 'react-native';

import type {
  Action,
  ImageResult,
} from 'expo-image-manipulator';

export type EditableImage = {
  uri: string;
  width: number;
  height: number;
};

export type NormalizedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageEditState = {
  rotation: number;
  crop: NormalizedCrop;
};

export const FULL_IMAGE_CROP: NormalizedCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const FULL_IMAGE_EDIT: ImageEditState = {
  rotation: 0,
  crop: FULL_IMAGE_CROP,
};

export class ImageEditError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ImageEditError';

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export const isImageEditError = (
  error: unknown
): error is ImageEditError =>
  error instanceof ImageEditError ||
  (error instanceof Error &&
    error.name === 'ImageEditError' &&
    typeof error.message === 'string');

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const normalizeRotation = (rotation: number) => {
  const rounded = Math.round(rotation / 90) * 90;
  return ((rounded % 360) + 360) % 360;
};

export const getRotatedSize = (
  image: Pick<EditableImage, 'width' | 'height'>,
  rotation: number
) => {
  const safeRotation = normalizeRotation(rotation);

  return safeRotation % 180 === 0
    ? { width: image.width, height: image.height }
    : { width: image.height, height: image.width };
};

export const normalizeCrop = (crop: NormalizedCrop): NormalizedCrop => {
  const width = clamp(Number.isFinite(crop.width) ? crop.width : 1, 0.01, 1);
  const height = clamp(Number.isFinite(crop.height) ? crop.height : 1, 0.01, 1);

  return {
    x: clamp(Number.isFinite(crop.x) ? crop.x : 0, 0, 1 - width),
    y: clamp(Number.isFinite(crop.y) ? crop.y : 0, 0, 1 - height),
    width,
    height,
  };
};

export const rotateCropClockwise = (
  crop: NormalizedCrop
): NormalizedCrop => {
  const safeCrop = normalizeCrop(crop);

  return normalizeCrop({
    x: 1 - safeCrop.y - safeCrop.height,
    y: safeCrop.x,
    width: safeCrop.height,
    height: safeCrop.width,
  });
};

export const rotateCropCounterClockwise = (
  crop: NormalizedCrop
): NormalizedCrop => {
  const safeCrop = normalizeCrop(crop);

  return normalizeCrop({
    x: safeCrop.y,
    y: 1 - safeCrop.x - safeCrop.width,
    width: safeCrop.height,
    height: safeCrop.width,
  });
};

export const rotateEditClockwise = (
  edit: ImageEditState
): ImageEditState => ({
  rotation: normalizeRotation(edit.rotation + 90),
  crop: rotateCropClockwise(edit.crop),
});

export const isFullImageCrop = (crop: NormalizedCrop) => {
  const safeCrop = normalizeCrop(crop);

  return (
    safeCrop.x <= 0.0001 &&
    safeCrop.y <= 0.0001 &&
    safeCrop.width >= 0.9999 &&
    safeCrop.height >= 0.9999
  );
};

export const getCropPixels = (
  image: EditableImage,
  rotation: number,
  crop: NormalizedCrop
) => {
  const rotatedSize = getRotatedSize(image, rotation);
  const safeCrop = normalizeCrop(crop);

  const epsilon = 0.000001;

  const originX = clamp(
    Math.floor(safeCrop.x * rotatedSize.width + epsilon),
    0,
    Math.max(0, rotatedSize.width - 1)
  );
  const originY = clamp(
    Math.floor(safeCrop.y * rotatedSize.height + epsilon),
    0,
    Math.max(0, rotatedSize.height - 1)
  );
  const right = clamp(
    Math.ceil(
      (safeCrop.x + safeCrop.width) * rotatedSize.width - epsilon
    ),
    originX + 1,
    rotatedSize.width
  );
  const bottom = clamp(
    Math.ceil(
      (safeCrop.y + safeCrop.height) * rotatedSize.height - epsilon
    ),
    originY + 1,
    rotatedSize.height
  );

  return {
    originX,
    originY,
    width: right - originX,
    height: bottom - originY,
  };
};

const SOURCE_URI_PATTERN =
  /^(file|content|data|ph|assets-library):/i;

const SOURCE_CHECK_TIMEOUT_MS = 15000;

const getErrorDetail = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return String(error);
  } catch {
    return 'Unknown image-processing error';
  }
};

const isMemoryError = (error: unknown) =>
  /outofmemory|out of memory|failed to allocate|bitmap size/i.test(
    getErrorDetail(error)
  );

const assertValidSourceImage = (image: EditableImage) => {
  if (
    !image ||
    typeof image.uri !== 'string' ||
    image.uri.trim().length === 0
  ) {
    throw new ImageEditError(
      'The selected image file is no longer available. Retake or choose another image.'
    );
  }

  if (
    !SOURCE_URI_PATTERN.test(image.uri) &&
    !image.uri.startsWith('/')
  ) {
    throw new ImageEditError(
      'This image source is not supported. Retake or choose another image.'
    );
  }

  if (
    !Number.isFinite(image.width) ||
    !Number.isFinite(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    throw new ImageEditError(
      'The selected image dimensions are invalid. Retake or choose another image.'
    );
  }
};

const verifyReadableSource = async (image: EditableImage) => {
  if (
    image.uri.startsWith('data:') ||
    image.uri.startsWith('ph:') ||
    image.uri.startsWith('assets-library:')
  ) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      if (error) {
        reject(
          new ImageEditError(
            'The selected image file could not be read. Retake or choose another image.',
            error
          )
        );
        return;
      }

      resolve();
    };

    timer = setTimeout(() => {
      finish(
        new Error(
          `Reading the image timed out after ${SOURCE_CHECK_TIMEOUT_MS}ms`
        )
      );
    }, SOURCE_CHECK_TIMEOUT_MS);

    ReactNativeImage.getSize(
      image.uri,
      () => finish(),
      (error) => finish(error)
    );
  });
};

type ImageManipulatorModule = typeof import('expo-image-manipulator');

interface LoadedImageManipulator {
  manipulateAsync: ImageManipulatorModule['manipulateAsync'];
  SaveFormat: ImageManipulatorModule['SaveFormat'];
}

const loadImageManipulator = async (): Promise<LoadedImageManipulator> => {
  try {
    const module = await import('expo-image-manipulator');
    const fallback = (
      module as ImageManipulatorModule & {
        default?: ImageManipulatorModule;
      }
    ).default;

    const manipulateAsync =
      module.manipulateAsync ?? fallback?.manipulateAsync;
    const SaveFormat = module.SaveFormat ?? fallback?.SaveFormat;

    if (typeof manipulateAsync !== 'function' || !SaveFormat) {
      throw new Error(
        'The installed expo-image-manipulator module does not expose manipulateAsync/SaveFormat.'
      );
    }

    return { manipulateAsync, SaveFormat };
  } catch (error) {
    if (__DEV__) {
      console.error(
        '[imageProcessing] expo-image-manipulator could not be loaded. A development build that includes expo-image-manipulator is required.',
        error
      );
    }

    throw new ImageEditError(
      'Image editing is not available in this app build. Install the latest development build and try again.',
      error
    );
  }
};

const logImageEditFailure = (
  operation: 'rotate' | 'crop',
  image: EditableImage,
  rotation: number,
  crop: NormalizedCrop,
  error: unknown
) => {
  if (!__DEV__) {
    return;
  }

  const cause =
    error instanceof Error
      ? (error as Error & { cause?: unknown }).cause
      : undefined;

  console.error(
    `[imageProcessing] ${operation} failed`,
    {
      uri: image.uri,
      width: image.width,
      height: image.height,
      rotation,
      crop,
      error,
      cause,
      detail: getErrorDetail(error),
    }
  );
};

const getProcessingErrorMessage = (
  operation: 'rotate' | 'crop',
  error: unknown
) => {
  if (isMemoryError(error)) {
    return 'This image is too large to process on this device. Try a smaller photo or crop it first.';
  }

  return operation === 'rotate'
    ? 'The image could not be rotated. Please try again or choose another image.'
    : 'The image could not be cropped. Please try again or choose another image.';
};

const saveEditedImage = async (
  image: EditableImage,
  rotation: number,
  crop: NormalizedCrop
): Promise<EditableImage> => {
  assertValidSourceImage(image);

  const safeRotation = normalizeRotation(rotation);
  const safeCrop = normalizeCrop(crop);

  if (safeRotation === 0 && isFullImageCrop(safeCrop)) {
    return image;
  }

  const { manipulateAsync, SaveFormat } =
    await loadImageManipulator();

  await verifyReadableSource(image);

  const actions: Action[] = [];

  if (safeRotation !== 0) {
    actions.push({ rotate: safeRotation });
  }

  if (!isFullImageCrop(safeCrop)) {
    actions.push({
      crop: getCropPixels(image, safeRotation, safeCrop),
    });
  }

  const result: ImageResult = await manipulateAsync(
    image.uri,
    actions,
    {
      // JPEG keeps large camera photos small (PNG inflated 5-10x and caused
      // memory pressure on Android OCR). Quality 0.95 stays OCR-friendly.
      format: SaveFormat.JPEG,
      compress: 0.95,
    }
  );

  if (
    !result.uri ||
    !Number.isFinite(result.width) ||
    !Number.isFinite(result.height) ||
    result.width <= 0 ||
    result.height <= 0
  ) {
    throw new ImageEditError(
      'The edited image could not be prepared. Please try again.'
    );
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
};

const runImageEdit = async (
  operation: 'rotate' | 'crop',
  image: EditableImage,
  rotation: number,
  crop: NormalizedCrop
) => {
  try {
    return await saveEditedImage(image, rotation, crop);
  } catch (error) {
    logImageEditFailure(
      operation,
      image,
      rotation,
      crop,
      error
    );

    if (isImageEditError(error)) {
      throw error;
    }

    throw new ImageEditError(
      getProcessingErrorMessage(operation, error),
      error
    );
  }
};

export const cropImage = async (
  image: EditableImage,
  rotation: number,
  crop: NormalizedCrop
) => runImageEdit('crop', image, rotation, crop);

export const rotateImage = async (
  image: EditableImage,
  rotation = 90,
  crop: NormalizedCrop = FULL_IMAGE_CROP
) => runImageEdit('rotate', image, rotation, crop);
