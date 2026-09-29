import { render, screen } from '@testing-library/react-native';

jest.mock('../../global.css', () => ({}));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({ Stack: jest.fn(() => null) }));

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import RootLayout from '@app/_layout';

describe('RootLayout', () => {
  beforeEach(() => {
    jest.mocked(Stack).mockClear();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  it('renders nothing and keeps the splash while fonts load', () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);

    render(<RootLayout />);

    expect(screen.toJSON()).toBeNull();
    expect(Stack).not.toHaveBeenCalled();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('still shows the stack and hides the splash when a font fails to load', () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('font failed')]);

    render(<RootLayout />);

    expect(Stack).toHaveBeenCalled();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
