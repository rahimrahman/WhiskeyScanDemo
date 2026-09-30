import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/embedding/cropScanPhoto', () => ({
  cropScanPhoto: jest.fn((uri: string) => Promise.resolve(uri)),
}));
jest.mock('react-native-vision-camera', () => ({
  Camera: jest.fn(() => null),
  getCameraDevice: jest.fn(),
  usePhotoOutput: jest.fn(),
  VisionCamera: { createDeviceFactory: jest.fn() },
}));

import {
  Camera,
  type CameraDevice,
  type CameraDeviceFactory,
  getCameraDevice,
  usePhotoOutput,
  VisionCamera,
} from 'react-native-vision-camera';

import { CaptureView } from '@/components/scan/CaptureView';
import { cropScanPhoto } from '@/lib/embedding/cropScanPhoto';

const backCamera = { id: 'back-wide' } as CameraDevice;
const deviceFactory = {} as CameraDeviceFactory;
const capturePhotoToFile = jest.fn();
const photoOutput = { capturePhotoToFile } as unknown as ReturnType<typeof usePhotoOutput>;
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const flush = () => act(() => new Promise<void>((resolve) => setImmediate(resolve)));

/** Renders capture and lets the device factory settle. */
const renderCapture = async () => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CaptureView />
    </SafeAreaProvider>,
  );
  await flush();
};

const pressShutter = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
  await flush();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(VisionCamera.createDeviceFactory).mockResolvedValue(deviceFactory);
  jest.mocked(getCameraDevice).mockReturnValue(backCamera);
  jest.mocked(usePhotoOutput).mockReturnValue(photoOutput);
});

describe('CaptureView', () => {
  it('previews the back camera into the photo output with close and shutter', async () => {
    await renderCapture();

    expect(getCameraDevice).toHaveBeenCalledWith(deviceFactory, 'back');
    expect(jest.mocked(Camera).mock.calls[0][0]).toMatchObject({
      device: backCamera,
      isActive: true,
      outputs: [photoOutput],
    });
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      'Close',
      'Take photo',
    ]);
  });

  it('shows only Close, without No camera, while the device factory loads', async () => {
    jest.mocked(VisionCamera.createDeviceFactory).mockReturnValue(new Promise(() => {}));
    await renderCapture();

    expect(screen.queryByText('No camera')).toBeNull();
    expect(Camera).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual(['Close']);
  });

  it('closes back to Search without a scan', async () => {
    await renderCapture();

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows No camera with only a close button once loaded without a back camera', async () => {
    jest.mocked(getCameraDevice).mockReturnValue(undefined);
    await renderCapture();

    expect(screen.getByText('No camera')).toBeTruthy();
    expect(Camera).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('shows No camera when the device factory fails', async () => {
    jest.mocked(VisionCamera.createDeviceFactory).mockRejectedValue(new Error('native'));
    await renderCapture();

    expect(screen.getByText('No camera')).toBeTruthy();
  });

  it('replaces capture with Scan Bottle, turning the bare path into a file URI', async () => {
    capturePhotoToFile.mockResolvedValue({ filePath: '/tmp/a.jpg' });
    await renderCapture();

    await pressShutter();

    expect(cropScanPhoto).toHaveBeenCalledWith('file:///tmp/a.jpg');
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/scan', params: { photoUri: 'file:///tmp/a.jpg' } });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens Scan Bottle on the cropped bottle photo', async () => {
    capturePhotoToFile.mockResolvedValue({ filePath: '/tmp/a.jpg' });
    jest.mocked(cropScanPhoto).mockResolvedValueOnce('file:///tmp/bottle.jpg');
    await renderCapture();

    await pressShutter();

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/scan',
      params: { photoUri: 'file:///tmp/bottle.jpg' },
    });
  });

  it('ignores shutter presses while a capture is in flight', async () => {
    let finish: (file: { filePath: string }) => void = () => {};
    capturePhotoToFile.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderCapture();

    await pressShutter();
    await pressShutter();
    expect(capturePhotoToFile).toHaveBeenCalledTimes(1);

    await act(async () => finish({ filePath: '/tmp/a.jpg' }));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('stays on capture, alerts, and allows another try when the shutter fails', async () => {
    capturePhotoToFile.mockRejectedValue(new Error('capture failed'));
    await renderCapture();

    await pressShutter();

    expect(alert).toHaveBeenCalledWith("Couldn't take the photo.");
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await pressShutter();
    expect(capturePhotoToFile).toHaveBeenCalledTimes(2);
  });
});
