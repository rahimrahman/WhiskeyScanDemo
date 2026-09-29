import { act, renderHook } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, type AlertButton, Platform } from 'react-native';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-vision-camera', () => ({
  VisionCamera: { cameraPermissionStatus: 'authorized', requestCameraPermission: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

import * as ImagePicker from 'expo-image-picker';
import { VisionCamera } from 'react-native-vision-camera';

import type { ScanOrigin } from '@/components/scan/scanFlow';
import { useScanSheet } from '@/components/scan/useScanSheet';

const launchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync);
const requestCamera = jest.mocked(VisionCamera.requestCameraPermission);
const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const flush = () => act(() => new Promise<void>((resolve) => setImmediate(resolve)));

/** Opens the sheet from `origin`, then taps the iOS sheet button at `index`. */
async function chooseOnIOS(origin: ScanOrigin, index: number) {
  const { result } = renderHook(() => useScanSheet(origin));
  act(() => result.current());
  const onChoice = showActionSheet.mock.calls.at(-1)![1];
  onChoice(index);
  await flush();
}

const picked = (uri: string) =>
  ({ canceled: false, assets: [{ uri, width: 1, height: 1 }] }) as ImagePicker.ImagePickerResult;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', 'authorized');
});

describe('useScanSheet on iOS', () => {
  it('shows the Scan bottle action sheet', async () => {
    await chooseOnIOS('search', 2);

    expect(showActionSheet).toHaveBeenCalledWith(
      {
        title: 'Scan bottle',
        message: 'Use a photo of the bottle label.',
        options: ['Take Photo', 'Upload Picture', 'Cancel'],
        cancelButtonIndex: 2,
      },
      expect.any(Function),
    );
  });

  it('does nothing on Cancel', async () => {
    await chooseOnIOS('search', 2);

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(launchLibrary).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('pushes capture from Search when the camera is authorized', async () => {
    await chooseOnIOS('search', 0);

    expect(requestCamera).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/capture');
  });

  it('asks for an undecided camera and replaces Scan Bottle with capture once granted', async () => {
    jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', 'not-determined');
    requestCamera.mockResolvedValue(true);

    await chooseOnIOS('scan', 0);

    expect(requestCamera).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/capture');
  });

  it.each(['denied', 'restricted'] as const)('stays and alerts when the camera is %s', async (status) => {
    jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', status);

    await chooseOnIOS('search', 0);

    expect(requestCamera).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Camera access is off', 'Upload a picture instead.');
  });

  it('alerts when the permission request is refused or fails', async () => {
    jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', 'not-determined');
    requestCamera.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('native'));

    await chooseOnIOS('search', 0);
    await chooseOnIOS('search', 0);

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('still uploads after the camera is denied', async () => {
    jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', 'denied');
    launchLibrary.mockResolvedValue(picked('file:///library/a.jpg'));

    await chooseOnIOS('search', 0);
    await chooseOnIOS('search', 1);

    expect(launchLibrary).toHaveBeenCalledWith({ mediaTypes: ['images'] });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/scan', params: { photoUri: 'file:///library/a.jpg' } });
  });

  it('replaces Scan Bottle with the newly uploaded photo', async () => {
    launchLibrary.mockResolvedValue(picked('file:///library/b.jpg'));

    await chooseOnIOS('scan', 1);

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/scan',
      params: { photoUri: 'file:///library/b.jpg' },
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('stays put when the library is canceled, empty, or fails', async () => {
    launchLibrary
      .mockResolvedValueOnce({ canceled: true, assets: null })
      .mockResolvedValueOnce({ canceled: false, assets: [] })
      .mockRejectedValueOnce(new Error('denied'));

    await chooseOnIOS('search', 1);
    await chooseOnIOS('search', 1);
    await chooseOnIOS('search', 1);

    expect(launchLibrary).toHaveBeenCalledTimes(3);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('useScanSheet on Android', () => {
  let platform: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  const openAlertSheet = () => {
    const { result } = renderHook(() => useScanSheet('search'));
    act(() => result.current());
    return alert.mock.calls.at(-1)!;
  };

  it('shows the same copy in an alert with a cancel button', () => {
    const [title, message, buttons, options] = openAlertSheet();

    expect(showActionSheet).not.toHaveBeenCalled();
    expect(title).toBe('Scan bottle');
    expect(message).toBe('Use a photo of the bottle label.');
    expect(buttons?.map((button) => button.text)).toEqual(['Take Photo', 'Upload Picture', 'Cancel']);
    expect(buttons?.[2].style).toBe('cancel');
    expect(options).toEqual({ cancelable: true });
  });

  it('routes the Take Photo and Upload Picture buttons', async () => {
    launchLibrary.mockResolvedValue(picked('content://media/1'));
    const buttons = openAlertSheet()[2] as AlertButton[];

    buttons[0].onPress?.();
    await flush();
    buttons[1].onPress?.();
    await flush();

    expect(mockRouter.push).toHaveBeenNthCalledWith(1, '/capture');
    expect(mockRouter.push).toHaveBeenNthCalledWith(2, { pathname: '/scan', params: { photoUri: 'content://media/1' } });
  });
});
