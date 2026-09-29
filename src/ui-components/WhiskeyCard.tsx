import { Image, type ImageSourcePropType, View } from 'react-native';

import { Pill } from '@/ui-components/Pill';
import { Text } from '@/ui-components/Text';

export type WhiskeyCardProps = { name: string; category: string; image?: ImageSourcePropType };

/** Slate card: bottle on a white tile, semibold name, outlined category pill. */
export function WhiskeyCard({ name, category, image }: WhiskeyCardProps) {
  return (
    <View className="min-h-32 flex-row overflow-hidden rounded-xl bg-whiskey-surface">
      <View testID="whiskey-card-image-tile" className="w-32 bg-white">
        {image ? <Image source={image} resizeMode="contain" className="absolute inset-0 h-full w-full" /> : null}
      </View>
      <View className="flex-1 justify-between gap-3 p-4">
        <Text variant="bodySemibold" className="text-base">
          {name}
        </Text>
        <Pill label={category} />
      </View>
    </View>
  );
}
