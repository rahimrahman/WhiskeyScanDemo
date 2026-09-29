import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenHeader } from '@/ui-components/ScreenHeader';

describe('ScreenHeader', () => {
  it('shows the title as an accent serif header', () => {
    render(<ScreenHeader title="Scan Bottle" onBack={jest.fn()} />);

    const title = screen.getByRole('header', { name: 'Scan Bottle' });
    expect(title.props.className).toContain('font-display');
    expect(title.props.className).toContain('text-whiskey-accent');
  });

  it('calls onBack when the chevron is pressed', () => {
    const onBack = jest.fn();
    render(<ScreenHeader title="Scan Bottle" onBack={onBack} />);

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
