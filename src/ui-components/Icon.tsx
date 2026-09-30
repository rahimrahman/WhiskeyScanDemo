import { SymbolView } from 'expo-symbols';

const ACCENT = '#8C885E';

/** SF Symbol name → Material Symbol, so Android draws the same icon. */
const materialNames = {
  'chevron.left': 'arrow_back_ios_new',
  'chevron.down': 'keyboard_arrow_down',
  'chevron.up': 'keyboard_arrow_up',
  magnifyingglass: 'search',
  xmark: 'close',
  camera: 'photo_camera',
} as const;

export type IconName = keyof typeof materialNames;

export type IconProps = { name: IconName; size?: number };

/** Thin outline icon in the brand accent. */
export function Icon({ name, size = 22 }: IconProps) {
  return <SymbolView name={{ ios: name, android: materialNames[name] }} size={size} tintColor={ACCENT} />;
}
