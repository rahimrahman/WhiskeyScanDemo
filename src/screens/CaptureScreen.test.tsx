import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({ useRouter: () => ({}) }));
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  getCameraDevice: () => undefined,
  usePhotoOutput: () => ({}),
  VisionCamera: { createDeviceFactory: () => new Promise(() => {}) },
}));

import CaptureRoute from '@app/capture';
import CaptureScreen from '@/screens/CaptureScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('CaptureScreen', () => {
  it('is the capture route', () => {
    expect(CaptureRoute).toBe(CaptureScreen);
  });

  it('renders the capture view', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CaptureScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
