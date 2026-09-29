import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SearchView } from '@/components/catalog/SearchView';
import type { BundledWhiskey } from '@/lib/catalog/loadBundledCatalog';

const whiskey = (id: string, name: string, category: string, imageSource?: number): BundledWhiskey => ({
  id,
  name,
  producer: 'Producer',
  expression: 'Expression',
  age: 'NAS',
  category,
  note: 'Note',
  image: `photos/${id}/1-front.jpg`,
  photos: [`photos/${id}/1-front.jpg`],
  imageSource,
});

const buffalo = whiskey('1', 'Buffalo Trace', 'Bourbon', 11);
const sazerac = whiskey('2', 'Sazerac Rye', 'Rye', 12);
const blantons = whiskey('3', "Blanton's", 'Bourbon', 13);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderSearch = (whiskeys: BundledWhiskey[]) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchView loadCatalog={() => whiskeys} />
    </SafeAreaProvider>,
  );

const chipLabels = () =>
  within(screen.getByTestId('category-chips'))
    .getAllByText(/.+/)
    .map((node) => node.props.children);

describe('SearchView', () => {
  it('lists every whiskey in catalog order with its category pill', () => {
    renderSearch([buffalo, sazerac]);

    const names = screen.getAllByText(/Buffalo Trace|Sazerac Rye/).map((node) => node.props.children);
    expect(names).toEqual(['Buffalo Trace', 'Sazerac Rye']);
    expect(screen.getAllByText('Bourbon')).toHaveLength(2);
    expect(screen.getAllByText('Rye')).toHaveLength(2);
  });

  it('shows a filled All chip, then each category once in first-seen order', () => {
    renderSearch([buffalo, sazerac, blantons]);

    expect(chipLabels()).toEqual(['All', 'Bourbon', 'Rye']);
    const allLabel = within(screen.getByTestId('category-chips')).getByText('All');
    expect(allLabel.props.className).toContain('text-whiskey-bg');
  });

  it('underlines Whiskeys among five visual-only tabs that announce no tab role', () => {
    renderSearch([buffalo]);

    const tabs = screen.getAllByTestId(/^search-tab-/);
    expect(tabs.map((tab) => within(tab).getByText(/.+/).props.children)).toEqual([
      'Whiskeys',
      'People',
      'Clubs',
      'Places',
      'Brands',
    ]);
    expect(tabs[0].props.className).toContain('border-b-2 border-whiskey-accent');
    tabs.slice(1).forEach((tab) => expect(tab.props.className).not.toContain('border-whiskey-accent'));
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('passes each imageSource to its card image', () => {
    renderSearch([buffalo, sazerac]);

    const tiles = screen.getAllByTestId('whiskey-card-image-tile');
    expect(tiles.map((tile) => tile.findByType(Image).props.source)).toEqual([11, 12]);
  });

  it('pads the end of the list past the bottom safe-area inset', () => {
    renderSearch([buffalo]);

    expect(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle).toEqual({ paddingBottom: 34 + 32 });
  });

  it('keeps every whiskey listed while typing and after clearing the field', () => {
    renderSearch([buffalo, sazerac]);
    const field = screen.getByPlaceholderText('Search by name, brand, etc');

    fireEvent.changeText(field, 'rye');
    expect(field.props.value).toBe('rye');
    expect(screen.getByText('Buffalo Trace')).toBeTruthy();
    expect(screen.getByText('Sazerac Rye')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(field.props.value).toBe('');
    expect(screen.getByText('Buffalo Trace')).toBeTruthy();
    expect(screen.getByText('Sazerac Rye')).toBeTruthy();
  });

  it('shows the Scan bottle row without a press target', () => {
    renderSearch([buffalo]);

    expect(screen.getByText('Scan bottle')).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      'Clear search',
    ]);
  });

  it('still shows the name and category when the image is missing', () => {
    renderSearch([whiskey('4', 'Mystery Malt', 'Scotch')]);

    expect(screen.getByText('Mystery Malt')).toBeTruthy();
    expect(screen.getAllByText('Scotch')).toHaveLength(2);
    expect(screen.getByTestId('whiskey-card-image-tile').children).toHaveLength(0);
  });
});
