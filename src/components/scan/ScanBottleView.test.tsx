import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: jest.fn() }));
jest.mock('react-native-vision-camera', () => ({
  VisionCamera: { cameraPermissionStatus: 'authorized', requestCameraPermission: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';

import { ScanBottleView } from '@/components/scan/ScanBottleView';

const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderScan = (params: { photoUri?: string }) => {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ScanBottleView />
    </SafeAreaProvider>,
  );
};

/** Taps Retake, then the sheet button at `index`. */
const retakeAndChoose = async (index: number) => {
  fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  const onChoice = showActionSheet.mock.calls.at(-1)![1];
  await act(async () => onChoice(index));
};

beforeEach(() => jest.clearAllMocks());

describe('ScanBottleView', () => {
  it('shows the header, the photo as a rounded thumbnail, and Retake', () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByRole('header', { name: 'Scan Bottle' })).toBeTruthy();
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'file:///tmp/a.jpg' });
    expect(image.props.className).toContain('rounded-xl');
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
    expect(screen.queryByText('Retake photo')).toBeNull();
  });

  it('renders the header, Retake, and an empty thumbnail without a photoUri', () => {
    renderScan({});

    expect(screen.getByRole('header', { name: 'Scan Bottle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
    expect(screen.getByTestId('scan-thumbnail').children).toHaveLength(0);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('goes back to Search from the header', () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('keeps the photo when Retake is canceled', async () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    await retakeAndChoose(2);

    expect(showActionSheet).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///tmp/a.jpg' });
  });

  it('replaces itself with the new upload so Back still lands on Search', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///library/b.jpg', width: 1, height: 1 }],
    });
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    await retakeAndChoose(1);

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/scan',
      params: { photoUri: 'file:///library/b.jpg' },
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('replaces itself with capture on Take Photo', async () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    await retakeAndChoose(0);

    expect(mockRouter.replace).toHaveBeenCalledWith('/capture');
  });
});
