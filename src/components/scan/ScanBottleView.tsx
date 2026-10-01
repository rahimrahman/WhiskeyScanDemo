import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { combineFindings } from '@/components/scan/combineFindings';
import { MatchEvidence } from '@/components/scan/MatchEvidence';
import { useBottleMatch } from '@/components/scan/useBottleMatch';
import { useScanSheet } from '@/components/scan/useScanSheet';
import { ScreenHeader } from '@/ui-components/ScreenHeader';
import { Text } from '@/ui-components/Text';
import { WhiskeyCard, type WhiskeyCardPill } from '@/ui-components/WhiskeyCard';

const candidatePills = (score: number | undefined, confident: boolean): WhiskeyCardPill[] => {
  if (score === undefined) return [];
  return confident
    ? [{ label: `${score}%`, tone: 'accent' }]
    : [
        { label: `${score}%`, tone: 'secondary' },
        { label: 'Best guess', tone: 'secondary' },
      ];
};

/** The chosen photo under the Scan Bottle header, its catalog match once found, and Retake to pick another. */
export function ScanBottleView() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();
  const retakePhoto = useScanSheet('scan', 'camera');
  const match = useBottleMatch(photoUri);
  const listed = match ? combineFindings(match.candidates, match.label.hits, match.confident) : null;

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
              {listed?.showName ? listed.cards[0].name : 'Not found'}
            </Text>
            {listed?.cards[0] ? (
              <View className="w-full">
                <WhiskeyCard
                  name={listed.cards[0].name}
                  category={listed.cards[0].category}
                  image={listed.cards[0].cardImage}
                  pills={candidatePills(listed.cards[0].score, listed.confident)}
                />
              </View>
            ) : null}
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
          onPress={retakePhoto}
          className="absolute inset-0"
        />
      </View>
    </SafeAreaView>
  );
}
