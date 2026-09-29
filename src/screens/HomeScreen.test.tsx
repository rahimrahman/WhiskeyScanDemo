import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/screens/HomeScreen';

describe('HomeScreen', () => {
  it('renders the home shell', () => {
    render(<HomeScreen />);

    expect(screen.getByText('Whiskey Social')).toBeTruthy();
  });
});
