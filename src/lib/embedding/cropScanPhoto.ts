import type AppleIntelligence from '@insidepics/expo-apple-intelligence';
import type { RectangleObservation, SaliencyRegion, SaliencyResult } from '@insidepics/expo-apple-intelligence';
import { Platform } from 'react-native';
import type * as NitroImage from 'react-native-nitro-image';

import { uprightCopy } from '@/lib/embedding/embedPhoto';

export type NormBox = { x: number; y: number; width: number; height: number };

export type PixelCrop = { startX: number; startY: number; endX: number; endY: number };

const MIN_SIDE = 0.05;
const PAD = 0.08;
/** Tilts smaller than this are left alone. Nitro's positive degrees turn the image clockwise. */
const MIN_TURN = 2;
/**
 * Steeper than this, the rectangle's "top" is a side of the label. Turning it would lay the bottle
 * on its side after the camera orientation is already applied.
 */
const MAX_TURN = 35;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The objectness box Vision is most sure about, or the attention box when no object was found. */
export function bottleBox(saliency: SaliencyResult | null): NormBox | null {
  const objectness = saliency?.objectnessRegions ?? [];
  const regions = objectness.length > 0 ? objectness : (saliency?.attentionRegions ?? []);
  const best = regions.reduce<SaliencyRegion | null>(
    (winner, region) => (!winner || region.confidence > winner.confidence ? region : winner),
    null,
  );
  return best?.boundingBox ?? null;
}

/** The label rectangle that covers the most of the photo. */
export function labelRectangle(rectangles: RectangleObservation[] | null): RectangleObservation | null {
  if (!rectangles?.length) return null;
  return rectangles.reduce((best, rect) => {
    const area = rect.boundingBox.width * rect.boundingBox.height * rect.confidence;
    const bestArea = best.boundingBox.width * best.boundingBox.height * best.confidence;
    return area > bestArea ? rect : best;
  });
}

/**
 * Clockwise degrees that level a slightly tilted label. Vision's top edge stays the top,
 * so the bottle is not flipped. Already-upright labels, and turns steep enough to lay the bottle
 * on its side, return null.
 */
export function uprightTurn(rect: RectangleObservation | null): number | null {
  if (!rect) return null;
  const bottomX = (rect.bottomLeft.x + rect.bottomRight.x) / 2;
  const bottomY = (rect.bottomLeft.y + rect.bottomRight.y) / 2;
  const topX = (rect.topLeft.x + rect.topRight.x) / 2;
  const topY = (rect.topLeft.y + rect.topRight.y) / 2;
  const dx = topX - bottomX;
  const dy = topY - bottomY;
  if (!Number.isFinite(dx + dy) || dx * dx + dy * dy < 1e-8) return null;
  const turn = (-Math.atan2(dx, dy) * 180) / Math.PI;
  if (Math.abs(turn) < MIN_TURN || Math.abs(turn) > MAX_TURN) return null;
  return turn;
}

/**
 * Vision boxes start at the bottom-left. Nitro crops from the top-left.
 * A little padding stays inside the photo so the label is not clipped.
 */
export function cropPixels(box: NormBox, imageWidth: number, imageHeight: number): PixelCrop | null {
  const numbers = [box.x, box.y, box.width, box.height, imageWidth, imageHeight];
  if (numbers.some((value) => !Number.isFinite(value)) || imageWidth < 2 || imageHeight < 2) return null;
  if (box.width < MIN_SIDE || box.height < MIN_SIDE) return null;

  const left = clamp(box.x - box.width * PAD, 0, 1);
  const right = clamp(box.x + box.width * (1 + PAD), 0, 1);
  const bottom = clamp(box.y - box.height * PAD, 0, 1);
  const top = clamp(box.y + box.height * (1 + PAD), 0, 1);
  const startX = Math.round(left * imageWidth);
  const endX = Math.round(right * imageWidth);
  const startY = Math.round((1 - top) * imageHeight);
  const endY = Math.round((1 - bottom) * imageHeight);
  if (endX - startX < 2 || endY - startY < 2) return null;
  return { startX, startY, endX, endY };
}

const filePath = (uri: string) => uri.replace(/^file:\/\//, '');

/** Crops to the bottle. A miss or a failure keeps the photo as it was passed in. */
async function cropToBottle(
  uri: string,
  vision: typeof AppleIntelligence,
  Images: typeof NitroImage.Images,
): Promise<string> {
  try {
    const box = bottleBox(await vision.detectSaliency(uri));
    if (!box) return uri;
    const image = await Images.loadFromFileAsync(filePath(uri));
    const pixels = cropPixels(box, image.width, image.height);
    if (!pixels) return uri;
    const cropped = await image.cropAsync(pixels.startX, pixels.startY, pixels.endX, pixels.endY);
    return `file://${await cropped.saveToTemporaryFileAsync('jpg', 90)}`;
  } catch {
    return uri;
  }
}

/** Stands a tilted label upright. A failure keeps the photo as it was passed in. */
async function standUpright(
  uri: string,
  vision: typeof AppleIntelligence,
  Images: typeof NitroImage.Images,
): Promise<string> {
  try {
    const turn = uprightTurn(labelRectangle(await vision.detectRectangles(uri)));
    if (turn == null) return uri;
    const image = await Images.loadFromFileAsync(filePath(uri));
    const turned = await image.rotateAsync(turn, false);
    return `file://${await turned.saveToTemporaryFileAsync('jpg', 90)}`;
  } catch {
    return uri;
  }
}

/** Crops a captured or uploaded photo to an upright bottle. Catalog photos never come through here. */
export async function cropScanPhoto(photoUri: string): Promise<string> {
  if (Platform.OS !== 'ios') return photoUri;
  const original = photoUri.trim();
  let prepared = original;
  try {
    prepared = await uprightCopy(original);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vision: typeof AppleIntelligence = require('@insidepics/expo-apple-intelligence').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Images }: typeof NitroImage = require('react-native-nitro-image');
    // Crop first, while the bottle is still the salient object. Rotating the whole
    // photo first makes the salient box the entire frame, so the crop never happens.
    prepared = await cropToBottle(prepared, vision, Images);
    prepared = await standUpright(prepared, vision, Images);
    return await cropToBottle(prepared, vision, Images);
  } catch {
    return prepared;
  }
}
