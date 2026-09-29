import { render } from '@testing-library/react-native';

jest.mock('expo-symbols', () => ({ SymbolView: jest.fn(() => null) }));

import { SymbolView } from 'expo-symbols';

import { Icon } from '@/ui-components/Icon';

const lastSymbolProps = () => jest.mocked(SymbolView).mock.lastCall?.[0];

describe('Icon', () => {
  it.each([
    ['chevron.left', 'arrow_back_ios_new'],
    ['magnifyingglass', 'search'],
    ['xmark', 'close'],
    ['camera', 'photo_camera'],
  ] as const)('draws %s on iOS and %s on Android, in accent', (name, android) => {
    render(<Icon name={name} />);

    expect(lastSymbolProps()).toEqual({ name: { ios: name, android }, size: 22, tintColor: '#8C885E' });
  });

  it('passes a size override through', () => {
    render(<Icon name="camera" size={30} />);

    expect(lastSymbolProps()?.size).toBe(30);
  });
});
