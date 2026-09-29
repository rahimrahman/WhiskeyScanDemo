import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@/lib/catalog/loadBundledCatalog', () => ({
  loadBundledCatalog: () => [
    {
      id: '1',
      name: 'Loader Whiskey',
      producer: '',
      expression: '',
      age: '',
      category: 'Bourbon',
      note: '',
      image: '',
      photos: [],
    },
  ],
}));
jest.mock('expo-router', () => ({ useRouter: () => ({}) }));
jest.mock('react-native-vision-camera', () => ({ VisionCamera: {} }));
jest.mock('expo-image-picker', () => ({}));

import IndexRoute from '@app/index';
import SearchScreen from '@/screens/SearchScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('SearchScreen', () => {
  it('is the index route', () => {
    expect(IndexRoute).toBe(SearchScreen);
  });

  it('lists the whiskeys from the bundled catalog loader', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <SearchScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Loader Whiskey')).toBeTruthy();
  });
});
