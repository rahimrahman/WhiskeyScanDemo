import { render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import { WhiskeyCard } from '@/ui-components/WhiskeyCard';

describe('WhiskeyCard', () => {
  it('shows the bottle photo, a semibold name and an outlined category pill', () => {
    render(<WhiskeyCard name="Buffalo Trace" category="Bourbon" image={42} />);

    expect(screen.getByText('Buffalo Trace').props.className).toContain('font-body-semibold');
    expect(screen.getByText('Bourbon')).toBeTruthy();
    const tile = screen.getByTestId('whiskey-card-image-tile');
    expect(tile.props.className).toContain('bg-white');
    expect(tile.findByType(Image).props.source).toBe(42);
  });

  it('keeps an empty white tile when the image is missing', () => {
    render(<WhiskeyCard name="Buffalo Trace" category="Bourbon" />);

    expect(screen.getByText('Buffalo Trace')).toBeTruthy();
    expect(screen.getByText('Bourbon')).toBeTruthy();
    expect(screen.getByTestId('whiskey-card-image-tile').children).toHaveLength(0);
  });
});
