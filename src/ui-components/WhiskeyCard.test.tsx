import { render, screen } from '@testing-library/react-native';
import { Image, View } from 'react-native';

import { Pill } from '@/ui-components/Pill';
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

  it('shows only the category pill when no extra pills are passed', () => {
    render(<WhiskeyCard name="Buffalo Trace" category="Bourbon" image={42} />);

    expect(screen.UNSAFE_getAllByType(Pill)).toHaveLength(1);
  });

  it('adds an accent similarity pill after the category', () => {
    render(<WhiskeyCard name="Buffalo Trace" category="Bourbon" pills={[{ label: '82%', tone: 'accent' }]} />);

    const pills = screen.UNSAFE_getAllByType(Pill);
    expect(pills.map((pill) => pill.props.label)).toEqual(['Bourbon', '82%']);
    expect(pillOutline('82%')).toContain('border-whiskey-accent');
  });

  it('adds muted pills, such as a low similarity and Best guess', () => {
    render(
      <WhiskeyCard
        name="Buffalo Trace"
        category="Bourbon"
        pills={[
          { label: '40%', tone: 'secondary' },
          { label: 'Best guess', tone: 'secondary' },
        ]}
      />,
    );

    for (const label of ['40%', 'Best guess']) {
      expect(pillOutline(label)).toContain('border-whiskey-textSecondary');
      expect(pillOutline(label)).not.toContain('border-whiskey-accent');
    }
    expect(pillOutline('Bourbon')).toContain('border-whiskey-accent');
  });
});

/** The class list on the outlined `View` around the pill labelled `label`. */
function pillOutline(label: string): string {
  const pill = screen.UNSAFE_getAllByType(Pill).find((instance) => instance.props.label === label)!;
  return pill.findByType(View).props.className;
}
