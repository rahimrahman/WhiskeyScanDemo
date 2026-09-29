import { useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScanSheet } from '@/components/scan/useScanSheet';
import type { BundledWhiskey } from '@/lib/catalog/loadBundledCatalog';
import { cn } from '@/ui-components/cn';
import { Icon } from '@/ui-components/Icon';
import { Pill } from '@/ui-components/Pill';
import { Text } from '@/ui-components/Text';
import { WhiskeyCard } from '@/ui-components/WhiskeyCard';

const TABS = ['Whiskeys', 'People', 'Clubs', 'Places', 'Brands'];
const ACTIVE_TAB = 'Whiskeys';

export type SearchViewProps = { loadCatalog: () => BundledWhiskey[] };

/** Catalog list under visual-only search chrome: nothing filters or switches tabs; Scan bottle opens the photo sheet. */
export function SearchView({ loadCatalog }: SearchViewProps) {
  const [whiskeys] = useState(loadCatalog);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const openScanSheet = useScanSheet('search');
  const categories = [...new Set(whiskeys.map((whiskey) => whiskey.category))];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-whiskey-bg">
      <View className="flex-row items-center gap-2 px-4 pt-2">
        <Icon name="chevron.left" size={24} />
        <View className="h-12 flex-1 flex-row items-center gap-2 rounded-full border border-whiskey-accent bg-whiskey-field pl-4 pr-2">
          <Icon name="magnifyingglass" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, brand, etc"
            accessibilityLabel="Search"
            className="flex-1 font-body text-sm text-whiskey-bg"
            placeholderClassName="text-whiskey-textSecondary"
          />
          <View className="h-9 w-9 items-center justify-center">
            <Icon name="xmark" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              className="absolute inset-0"
            />
          </View>
        </View>
      </View>

      <View className="flex-row justify-between px-4 pt-5">
        {TABS.map((tab) => (
          <View
            key={tab}
            testID={`search-tab-${tab}`}
            className={cn('pb-1', tab === ACTIVE_TAB && 'border-b-2 border-whiskey-accent')}
          >
            <Text variant="bodySemibold" className="text-sm">
              {tab}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-2 px-4 pt-4">
        <Icon name="camera" size={20} />
        <Text aria-hidden className="text-sm text-whiskey-textSecondary">
          Scan bottle
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan bottle"
          onPress={openScanSheet}
          className="absolute inset-0"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="category-chips"
        className="shrink-0 grow-0"
        contentContainerClassName="gap-2 px-4 py-4"
      >
        <Pill label="All" variant="filled" />
        {categories.map((category) => (
          <Pill key={category} label={category} />
        ))}
      </ScrollView>

      <FlatList
        data={whiskeys}
        keyExtractor={(whiskey) => whiskey.id}
        contentContainerClassName="gap-3 px-4"
        // Device inset: the last card must clear the home indicator.
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        renderItem={({ item }) => (
          <WhiskeyCard name={item.name} category={item.category} image={item.imageSource} />
        )}
      />
    </SafeAreaView>
  );
}
