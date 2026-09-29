import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({
  useRouter: () => ({}),
  useLocalSearchParams: () => ({ photoUri: 'file:///tmp/a.jpg' }),
}));
jest.mock('react-native-vision-camera', () => ({ VisionCamera: {} }));
jest.mock('expo-image-picker', () => ({}));

import ScanRoute from '@app/scan';
import ScanBottleScreen from '@/screens/ScanBottleScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('ScanBottleScreen', () => {
  it('is the scan route', () => {
    expect(ScanRoute).toBe(ScanBottleScreen);
  });

  it('renders the Scan Bottle view', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ScanBottleScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('header', { name: 'Scan Bottle' })).toBeTruthy();
  });
});
