import type AppleIntelligence from '@insidepics/expo-apple-intelligence';
import type { FeaturePrintResult } from '@insidepics/expo-apple-intelligence';
import { Platform } from 'react-native';
import type * as NitroImage from 'react-native-nitro-image';

import { MAX_LONG_EDGE } from '@/lib/catalog/catalog';

export type PhotoEmbedding = { vector: number[]; modelId: string };

/** The package does not expose the Vision request revision, so the id is derived from the vector shape. */
export function featurePrintModelId({ elementType, elementCount }: FeaturePrintResult): string {
  return `apple-vision-feature-print:${elementType}:${elementCount}`;
}

/**
 * Redraws the photo with its EXIF orientation applied and a long edge of at most `MAX_LONG_EDGE`.
 * Vision reads raw pixels and ignores the orientation tag, so camera photos would otherwise embed sideways.
 */
export async function uprightCopy(uri: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Images }: typeof NitroImage = require('react-native-nitro-image');
  const image = await Images.loadFromFileAsync(uri.replace(/^file:\/\//, ''));
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(image.width, image.height));
  const resized = await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale));
  return `file://${await resized.saveToTemporaryFileAsync('jpg', 90)}`;
}

function assertIOS(caller: string): void {
  if (Platform.OS !== 'ios') {
    throw new Error(`${caller} requires iOS (running on ${Platform.OS}).`);
  }
}

/** Embeds a photo that `uprightCopy` already redrew, so a scan resizes once for both the print and OCR. */
export async function embedUprightPhoto(uprightUri: string): Promise<PhotoEmbedding> {
  assertIOS('embedUprightPhoto');
  // Importing the package resolves the native module at once, which throws off iOS and in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vision: typeof AppleIntelligence = require('@insidepics/expo-apple-intelligence').default;
  const print = await vision.generateFeaturePrint(uprightUri);
  if (!print) {
    throw new Error(`Vision returned no feature print for ${uprightUri}.`);
  }
  return { vector: print.data, modelId: featurePrintModelId(print) };
}

/** Embeds a photo (`file://` URI or plain path) with an Apple Vision feature print of its upright copy. */
export async function embedPhoto(photoUri: string): Promise<PhotoEmbedding> {
  assertIOS('embedPhoto');
  const uri = photoUri.trim();
  if (!uri) {
    throw new Error('embedPhoto requires a photo URI.');
  }
  return embedUprightPhoto(await uprightCopy(uri));
}
