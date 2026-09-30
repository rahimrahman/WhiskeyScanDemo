import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import type { BottleMatch } from '@/components/scan/useBottleMatch';
import { Icon } from '@/ui-components/Icon';
import { Text } from '@/ui-components/Text';

const TOP_SCORES = 5;

export type MatchEvidenceProps = { photoUri: string; match: BottleMatch };

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-whiskey-textSecondary">{label}</Text>
      <Text className="flex-1 text-right text-sm">{value}</Text>
    </View>
  );
}

/** Collapsed "How we found it": the scan beside the winning catalog photo, top scores, latency and model id. */
export function MatchEvidence({ photoUri, match }: MatchEvidenceProps) {
  const [open, setOpen] = useState(false);

  return (
    <View className="w-full gap-3">
      <View className="h-11 flex-row items-center justify-between">
        <Text variant="bodySemibold" aria-hidden>
          How we found it
        </Text>
        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={18} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How we found it"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((wasOpen) => !wasOpen)}
          className="absolute inset-0"
        />
      </View>

      {open ? (
        <View testID="match-evidence" className="gap-3">
          <View className="flex-row gap-3">
            <View className="aspect-[3/4] flex-1 overflow-hidden rounded-xl bg-whiskey-surface">
              <Image
                testID="evidence-scan-photo"
                source={{ uri: photoUri }}
                resizeMode="cover"
                className="h-full w-full"
              />
            </View>
            {match.winningPhoto !== undefined ? (
              <View className="aspect-[3/4] flex-1 overflow-hidden rounded-xl bg-white">
                <Image
                  testID="evidence-catalog-photo"
                  source={match.winningPhoto}
                  resizeMode="contain"
                  className="h-full w-full"
                />
              </View>
            ) : null}
          </View>

          {match.candidates.slice(0, TOP_SCORES).map(({ bottleId, name, score }) => (
            <Detail key={bottleId} label={name} value={`${score}%`} />
          ))}
          <Detail label="Time" value={`${match.elapsedMs} ms`} />
          {match.modelId ? <Detail label="Model" value={match.modelId} /> : null}
        </View>
      ) : null}
    </View>
  );
}
