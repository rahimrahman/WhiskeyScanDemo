import type AppleIntelligence from '@insidepics/expo-apple-intelligence';
import { Platform } from 'react-native';

/**
 * Reads the label of a photo that `uprightCopy` already redrew: the best Vision OCR candidate of each observation.
 * Never rejects, so a failed read cannot sink the image match; empty off iOS, on failure, or when nothing was read.
 */
export async function readLabelText(uprightUri: string): Promise<string[]> {
  if (Platform.OS !== 'ios') return [];
  try {
    // Importing the package resolves the native module at once, which throws off iOS and in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vision: typeof AppleIntelligence = require('@insidepics/expo-apple-intelligence').default;
    const observations = await vision.recognizeText(uprightUri);
    return observations.map(({ candidates }) => candidates[0]?.string.trim() ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
