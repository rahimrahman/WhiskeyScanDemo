import { render, screen } from '@testing-library/react-native';

import { Text } from '@/ui-components/Text';

describe('Text', () => {
  it('defaults to white body text', () => {
    render(<Text>Neat</Text>);

    const { className } = screen.getByText('Neat').props;
    expect(className).toContain('text-whiskey-text');
    expect(className).toContain('font-body');
  });

  it.each([
    ['display', 'font-display'],
    ['body', 'font-body'],
    ['bodySemibold', 'font-body-semibold'],
  ] as const)('maps the %s variant to %s', (variant, fontClass) => {
    render(<Text variant={variant}>Neat</Text>);

    expect(screen.getByText('Neat').props.className).toContain(fontClass);
  });

  it('lets callers override the colour and forwards native props', () => {
    render(
      <Text className="text-whiskey-accent" numberOfLines={1}>
        Neat
      </Text>,
    );

    const text = screen.getByText('Neat');
    expect(text.props.className).toContain('font-body');
    expect(text.props.className).toContain('text-whiskey-accent');
    expect(text.props.className).not.toContain('text-whiskey-text');
    expect(text.props.numberOfLines).toBe(1);
  });
});
