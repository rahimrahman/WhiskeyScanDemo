export const SCAN_SHEET = {
  title: 'Scan bottle',
  message: 'Use a photo of the bottle label.',
  options: ['Take Photo', 'Upload Picture', 'Cancel'],
  cancelButtonIndex: 2,
} as const;

export type SheetChoice = 'camera' | 'library' | 'cancel';

/** Sheet button index → what to do; anything but the first two buttons cancels. */
export function sheetChoice(index: number): SheetChoice {
  if (index === 0) return 'camera';
  if (index === 1) return 'library';
  return 'cancel';
}

/** Mirrors vision-camera's `PermissionStatus` without importing the native module. */
export type CameraPermission = 'not-determined' | 'authorized' | 'denied' | 'restricted';

/** Only an undecided permission can be asked for; denied and restricted stay closed. */
export async function canUseCamera(status: CameraPermission, request: () => Promise<boolean>): Promise<boolean> {
  if (status === 'authorized') return true;
  if (status === 'not-determined') return request();
  return false;
}

/** Vision-camera returns bare filesystem paths; `Image` needs a URI. */
export function toImageUri(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `file://${path}`;
}

export type PickerResult = { canceled: boolean; assets: { uri: string }[] | null };

/** The picked still's URI, or null when the picker was canceled or returned nothing. */
export function pickedUri(result: PickerResult): string | null {
  if (result.canceled) return null;
  return result.assets?.[0]?.uri || null;
}

/** Where the sheet was opened from. */
export type ScanOrigin = 'search' | 'scan';

/** Search stacks the next screen; Scan Bottle swaps itself out so Back still lands on Search. */
export function navigationFor(origin: ScanOrigin): 'push' | 'replace' {
  return origin === 'search' ? 'push' : 'replace';
}
