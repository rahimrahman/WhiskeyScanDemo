import { Pressable, View } from 'react-native';

import { Icon } from '@/ui-components/Icon';
import { Text } from '@/ui-components/Text';

export type ScreenHeaderProps = { title: string; onBack: () => void };

/** Accent back chevron plus a centred accent serif title. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <View className="h-12 flex-row items-center justify-center px-4">
      <View className="absolute left-2 h-11 w-11 items-center justify-center">
        <Icon name="chevron.left" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          className="absolute inset-0"
        />
      </View>
      <Text variant="display" accessibilityRole="header" className="text-xl text-whiskey-accent">
        {title}
      </Text>
    </View>
  );
}
