import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import type { BottleMatch, LabelEvidence } from '@/components/scan/useBottleMatch';
import { cn } from '@/ui-components/cn';
import { Icon } from '@/ui-components/Icon';
import { Text } from '@/ui-components/Text';

const TOP_SCORES = 5;

export type MatchEvidenceProps = { photoUri: string; match: BottleMatch };

function Detail({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-whiskey-textSecondary">{label}</Text>
      <Text className={cn('flex-1 text-right text-sm', valueClassName)}>{value}</Text>
    </View>
  );
}

/** The lines read off the label, then each label-ranked whiskey with its matched words in accent. */
function LabelText({ label: { lines, hits } }: { label: LabelEvidence }) {
  return (
    <View testID="label-evidence" className="gap-2">
      <Text variant="bodySemibold" className="text-sm">
        Label text
      </Text>
      {lines.length === 0 ? <Text className="text-sm text-whiskey-textSecondary">No label text read</Text> : null}
      {lines.map((line, index) => (
        <Text key={index} className="text-sm">
          {line}
        </Text>
      ))}
      {lines.length > 0 && hits.length === 0 ? (
        <Text className="text-sm text-whiskey-textSecondary">No catalog words matched</Text>
      ) : null}
      {hits.map(({ bottleId, name, words }) => (
        <Detail key={bottleId} label={name} value={words.join(' ')} valueClassName="text-whiskey-accent" />
      ))}
    </View>
  );
}

/** "How we found it", open for the demo: the scan beside the winning catalog photo, top scores, label text, latency and model id. */
export function MatchEvidence({ photoUri, match }: MatchEvidenceProps) {
  const [open, setOpen] = useState(true);

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
          <LabelText label={match.label} />
          <Detail label="Time" value={`${match.elapsedMs} ms`} />
          {match.modelId ? <Detail label="Model" value={match.modelId} /> : null}
        </View>
      ) : null}
    </View>
  );
}
