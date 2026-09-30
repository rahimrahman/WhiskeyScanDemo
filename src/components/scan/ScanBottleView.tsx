import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchEvidence } from '@/components/scan/MatchEvidence';
import { useBottleMatch } from '@/components/scan/useBottleMatch';
import { useScanSheet } from '@/components/scan/useScanSheet';
import { ScreenHeader } from '@/ui-components/ScreenHeader';
import { Text } from '@/ui-components/Text';
import { WhiskeyCard, type WhiskeyCardPill } from '@/ui-components/WhiskeyCard';

const MAX_CARDS = 3;

const candidatePills = (score: number, confident: boolean): WhiskeyCardPill[] =>
  confident
    ? [{ label: `${score}%`, tone: 'accent' }]
    : [
        { label: `${score}%`, tone: 'secondary' },
        { label: 'Best guess', tone: 'secondary' },
      ];

/** The chosen photo under the Scan Bottle header, its catalog match once found, and Retake to pick another. */
export function ScanBottleView() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();
  const openScanSheet = useScanSheet('scan');
  const match = useBottleMatch(photoUri);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-whiskey-bg">
      <ScreenHeader title="Scan Bottle" onBack={() => router.back()} />

      <ScrollView className="flex-1" contentContainerClassName="items-center gap-4 px-8 py-4">
        <View testID="scan-thumbnail" className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-whiskey-surface">
          {photoUri ? (
            <Image source={{ uri: photoUri }} resizeMode="cover" className="h-full w-full rounded-xl" />
          ) : null}
        </View>

        {photoUri && match ? (
          <>
            <Text testID="match-name" variant="display" className="text-center text-2xl">
              {match.confident ? match.candidates[0].name : 'Not found'}
            </Text>
            {match.candidates.slice(0, MAX_CARDS).map(({ bottleId, name, category, score, cardImage }) => (
              <View key={bottleId} className="w-full">
                <WhiskeyCard
                  name={name}
                  category={category}
                  image={cardImage}
                  pills={candidatePills(score, match.confident)}
                />
              </View>
            ))}
            <MatchEvidence photoUri={photoUri} match={match} />
          </>
        ) : null}
      </ScrollView>

      <View className="mx-4 mb-4 h-12 items-center justify-center rounded-full border border-whiskey-accent">
        <Text variant="bodySemibold" aria-hidden>
          Retake photo
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retake photo"
          onPress={openScanSheet}
          className="absolute inset-0"
        />
      </View>
    </SafeAreaView>
  );
}
