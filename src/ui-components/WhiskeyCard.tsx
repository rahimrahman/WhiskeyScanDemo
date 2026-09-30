import { Image, type ImageSourcePropType, View } from 'react-native';

import { Pill } from '@/ui-components/Pill';
import { Text } from '@/ui-components/Text';

/** An extra pill beside the category: `accent` outline by default, or a muted `secondary` outline. */
export type WhiskeyCardPill = { label: string; tone?: 'accent' | 'secondary' };

export type WhiskeyCardProps = {
  name: string;
  category: string;
  image?: ImageSourcePropType;
  pills?: WhiskeyCardPill[];
};

/** Slate card: bottle on a white tile, semibold name, outlined category pill and any extra pills. */
export function WhiskeyCard({ name, category, image, pills = [] }: WhiskeyCardProps) {
  return (
    <View className="min-h-32 flex-row overflow-hidden rounded-xl bg-whiskey-surface">
      <View testID="whiskey-card-image-tile" className="w-32 bg-white">
        {image ? <Image source={image} resizeMode="contain" className="absolute inset-0 h-full w-full" /> : null}
      </View>
      <View className="flex-1 justify-between gap-3 p-4">
        <Text variant="bodySemibold" className="text-base">
          {name}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Pill label={category} />
          {pills.map(({ label, tone }) => (
            <Pill
              key={label}
              label={label}
              className={tone === 'secondary' ? 'border-whiskey-textSecondary' : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
