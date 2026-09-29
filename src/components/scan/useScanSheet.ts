import * as ImagePicker from 'expo-image-picker';
import { type Href, useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { VisionCamera } from 'react-native-vision-camera';

import {
  canUseCamera,
  navigationFor,
  pickedUri,
  SCAN_SHEET,
  type ScanOrigin,
  type SheetChoice,
  sheetChoice,
} from '@/components/scan/scanFlow';

function showSheet(onChoice: (choice: SheetChoice) => void) {
  const { title, message, options, cancelButtonIndex } = SCAN_SHEET;
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, message, options: [...options], cancelButtonIndex }, (index) =>
      onChoice(sheetChoice(index)),
    );
    return;
  }
  const [takePhoto, uploadPicture, cancel] = options;
  Alert.alert(
    title,
    message,
    [
      { text: takePhoto, onPress: () => onChoice('camera') },
      { text: uploadPicture, onPress: () => onChoice('library') },
      { text: cancel, style: 'cancel' },
    ],
    { cancelable: true },
  );
}

async function cameraGranted() {
  try {
    return await canUseCamera(VisionCamera.cameraPermissionStatus, () => VisionCamera.requestCameraPermission());
  } catch {
    return false;
  }
}

async function pickStill() {
  try {
    return pickedUri(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] }));
  } catch {
    return null;
  }
}

/** Opens the Scan bottle sheet: Take Photo goes to capture, Upload Picture straight to Scan Bottle. */
export function useScanSheet(origin: ScanOrigin) {
  const router = useRouter();
  const go = (href: Href) => (navigationFor(origin) === 'push' ? router.push(href) : router.replace(href));

  const takePhoto = async () => {
    if (await cameraGranted()) go('/capture');
    else Alert.alert('Camera access is off', 'Upload a picture instead.');
  };

  const uploadPicture = async () => {
    const photoUri = await pickStill();
    if (photoUri) go({ pathname: '/scan', params: { photoUri } });
  };

  return () =>
    showSheet((choice) => {
      if (choice === 'camera') void takePhoto();
      if (choice === 'library') void uploadPicture();
    });
}
