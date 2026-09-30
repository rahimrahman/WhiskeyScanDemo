import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockEmbedPhoto = jest.fn();

jest.mock('@/lib/embedding/embedPhoto', () => ({ embedPhoto: (uri: string) => mockEmbedPhoto(uri) }));
jest.mock('expo-asset', () => ({
  Asset: { fromModule: (id: number) => ({ downloadAsync: async () => ({ localUri: `file:///asset/${id}.jpg` }) }) },
}));
jest.mock(
  '../../../assets/catalog/catalog.json',
  () => ({
    whiskeys: [
      { name: 'Toki', photos: ['photos/35/1-front.jpg'] },
      { name: 'Old Forester Rye', photos: ['photos/21/1-front.jpg'] },
    ],
  }),
  { virtual: true },
);
jest.mock(
  '../../../assets/catalog/image-map.js',
  () => ({ 'photos/35/1-front.jpg': 35, 'photos/21/1-front.jpg': 21 }),
  { virtual: true },
);

import { MatchDebugPanel } from '@/components/scan/MatchDebugPanel';

const vectors: Record<string, number[]> = {
  'file:///asset/35.jpg': [1, 0],
  'file:///asset/21.jpg': [0, 1],
  'file:///photo.jpg': [0.99, 0.1],
};

describe('MatchDebugPanel', () => {
  it('ranks catalog whiskeys against the photo and shows a match verdict', async () => {
    mockEmbedPhoto.mockImplementation(async (uri: string) => ({ vector: vectors[uri], modelId: 'test:float:2' }));
    render(<MatchDebugPanel photoUri="file:///photo.jpg" />);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Test match' })));

    expect(screen.getByText(/^Match: Toki at 99\.5%/)).toBeTruthy();
    expect(screen.getByText(/Closest catalog photo: Toki/)).toBeTruthy();
  });

  it('shows the error when embedding fails', async () => {
    mockEmbedPhoto.mockRejectedValue(new Error('ERR_VISION: boom'));
    render(<MatchDebugPanel photoUri="file:///photo.jpg" />);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Test match' })));

    expect(screen.getByText('ERR_VISION: boom')).toBeTruthy();
  });
});
