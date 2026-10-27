import { Platform } from 'react-native';

import type {
  RecognitionOptions,
  TextRecognitionScript,
} from '@zhanziyang/expo-text-extractor';

export type OcrErrorCode =
  | 'UNSUPPORTED_PLATFORM'
  | 'INVALID_IMAGE_URI'
  | 'MODULE_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'EMPTY_RESULT'
  | 'RECOGNITION_FAILED';

export class OcrError extends Error {
  readonly code: OcrErrorCode;

  constructor(code: OcrErrorCode, message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}

export interface PrescriptionTextResult {
  englishText: string;
  hindiText: string;
  combinedText: string;
}

const RECOGNITION_TIMEOUT_MS = 60_000;

const SCRIPT_OPTIONS: Record<'english' | 'hindi', RecognitionOptions> = {
  english: {
    script: 'latin' as TextRecognitionScript,
  },
  hindi: {
    script: 'devanagari' as TextRecognitionScript,
  },
};

const normalizeBlocks = (blocks: string[]): string =>
  blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return '';
};

export async function extractPrescriptionText(
  imageUri: string
): Promise<PrescriptionTextResult> {
  if (Platform.OS !== 'android') {
    throw new OcrError(
      'UNSUPPORTED_PLATFORM',
      'Text recognition is currently available on Android only.'
    );
  }

  const uri = imageUri?.trim();

  if (
    !uri ||
    (!uri.startsWith('file://') && !uri.startsWith('content://'))
  ) {
    throw new OcrError(
      'INVALID_IMAGE_URI',
      'The selected prescription image could not be accessed. Please choose it again.'
    );
  }

  let textExtractor: typeof import('@zhanziyang/expo-text-extractor');

  try {
    textExtractor = await import('@zhanziyang/expo-text-extractor');
  } catch (error) {
    if (__DEV__) {
      console.error(
        '[ocr] ExpoTextExtractor could not be loaded. A development build that includes @zhanziyang/expo-text-extractor is required.',
        error
      );
    }

    throw new OcrError(
      'MODULE_UNAVAILABLE',
      'Text recognition is not available in this app build. Install a new development build and try again.'
    );
  }

  if (!textExtractor.isSupported) {
    throw new OcrError(
      'UNSUPPORTED_PLATFORM',
      'Text recognition is not supported on this device.'
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const recognition = Promise.allSettled([
      textExtractor.extractTextFromImage(uri, SCRIPT_OPTIONS.english),
      textExtractor.extractTextFromImage(uri, SCRIPT_OPTIONS.hindi),
    ]);

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new OcrError(
            'MODEL_UNAVAILABLE',
            'The prescription is taking too long to read. Check your internet connection and try again.'
          )
        );
      }, RECOGNITION_TIMEOUT_MS);
    });

    const [englishResult, hindiResult] = await Promise.race([
      recognition,
      timeout,
    ]);

    if (
      englishResult.status === 'rejected' &&
      hindiResult.status === 'rejected'
    ) {
      throw (
        englishResult.reason ??
        hindiResult.reason ??
        new Error('Text recognition failed.')
      );
    }

    if (__DEV__ && englishResult.status === 'rejected') {
      console.warn(
        '[ocr] English text recognition failed',
        getErrorMessage(englishResult.reason)
      );
    }

    if (__DEV__ && hindiResult.status === 'rejected') {
      console.warn(
        '[ocr] Hindi text recognition failed',
        getErrorMessage(hindiResult.reason)
      );
    }

    const englishBlocks =
      englishResult.status === 'fulfilled' ? englishResult.value : [];
    const hindiBlocks =
      hindiResult.status === 'fulfilled' ? hindiResult.value : [];

    const englishText = normalizeBlocks(englishBlocks);
    const hindiText = normalizeBlocks(hindiBlocks);
    const combinedText = [englishText, hindiText]
      .filter(Boolean)
      .join('\n\n');

    if (!combinedText) {
      throw new OcrError(
        'EMPTY_RESULT',
        'No readable text was found in this prescription image. Try a clearer photo.'
      );
    }

    return {
      englishText,
      hindiText,
      combinedText,
    };
  } catch (error) {
    if (error instanceof OcrError) {
      throw error;
    }

    const message = getErrorMessage(error);

    if (/file not found|no such file|cannot find the file/i.test(message)) {
      throw new OcrError(
        'INVALID_IMAGE_URI',
        'The selected prescription image could not be accessed. Please choose it again.'
      );
    }

    if (/download|model|not installed|not ready|waiting/i.test(message)) {
      throw new OcrError(
        'MODEL_UNAVAILABLE',
        'The prescription recognition model is not ready. Connect to the internet and try again.'
      );
    }

    throw new OcrError(
      'RECOGNITION_FAILED',
      'The prescription text could not be read. Please try again.'
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
