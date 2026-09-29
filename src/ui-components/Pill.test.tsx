import { render, screen } from '@testing-library/react-native';

import { Pill } from '@/ui-components/Pill';

describe('Pill', () => {
  it('renders an accent outline with a white label by default', () => {
    render(<Pill label="Bourbon" />);

    expect(screen.getByText('Bourbon').props.className).toContain('text-whiskey-text');
    expect(screen.root.props.className).toContain('border-whiskey-accent');
    expect(screen.root.props.className).not.toContain('bg-whiskey-accent');
  });

  it('renders an accent fill with a navy label when filled', () => {
    render(<Pill label="All" variant="filled" />);

    const label = screen.getByText('All');
    expect(label.props.className).toContain('text-whiskey-bg');
    expect(label.props.className).not.toContain('text-whiskey-text');
    expect(screen.root.props.className).toContain('bg-whiskey-accent');
  });
});
