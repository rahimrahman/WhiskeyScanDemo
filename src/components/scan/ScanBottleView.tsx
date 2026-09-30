import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useScanSheet } from '@/components/scan/useScanSheet';
import { ScreenHeader } from '@/ui-components/ScreenHeader';
import { Text } from '@/ui-components/Text';

/** The chosen photo under the Scan Bottle header, with Retake to pick another. */
export function ScanBottleView() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();
  const openScanSheet = useScanSheet('scan');

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-whiskey-bg">
      <ScreenHeader title="Scan Bottle" onBack={() => router.back()} />

      <ScrollView className="flex-1" contentContainerClassName="items-center px-8 py-4">
        <View testID="scan-thumbnail" className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-whiskey-surface">
          {photoUri ? (
            <Image source={{ uri: photoUri }} resizeMode="cover" className="h-full w-full rounded-xl" />
          ) : null}
        </View>
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
