import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: jest.fn() }));
jest.mock('react-native-vision-camera', () => ({
  VisionCamera: { cameraPermissionStatus: 'authorized', requestCameraPermission: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/components/scan/useBottleMatch', () => ({ useBottleMatch: jest.fn() }));

import { useLocalSearchParams } from 'expo-router';
import { VisionCamera } from 'react-native-vision-camera';

import { ScanBottleView } from '@/components/scan/ScanBottleView';
import { type BottleMatch, type MatchCandidate, useBottleMatch } from '@/components/scan/useBottleMatch';
import { WhiskeyCard } from '@/ui-components/WhiskeyCard';

const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderScan = (params: { photoUri?: string }) => {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ScanBottleView />
    </SafeAreaProvider>,
  );
};

const retake = () =>
  act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  });

const thumbnailImage = () => screen.getByTestId('scan-thumbnail').findByType(Image);

const candidate = (bottleId: string, score: number): MatchCandidate => ({
  bottleId,
  name: `Whiskey ${bottleId}`,
  category: 'Bourbon',
  score,
  cardImage: Number(bottleId),
});

const match = (confident: boolean, candidates: MatchCandidate[]): BottleMatch => ({
  confident,
  candidates,
  winningPhoto: candidates.length > 0 ? 101 : undefined,
  elapsedMs: 412,
  modelId: 'apple-vision-feature-print:float:768',
  label: { lines: [], hits: [] },
});

/** The label of every pill on each rendered card, category first. */
const cardPills = () =>
  screen.UNSAFE_getAllByType(WhiskeyCard).map((card) => [
    card.props.category,
    ...card.props.pills.map(({ label }: { label: string }) => label),
  ]);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBottleMatch).mockReturnValue(null);
});

describe('ScanBottleView', () => {
  it('shows the header, the photo as a rounded thumbnail, and Retake', () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByRole('header', { name: 'Scan Bottle' })).toBeTruthy();
    const image = thumbnailImage();
    expect(image.props.source).toEqual({ uri: 'file:///tmp/a.jpg' });
    expect(image.props.className).toContain('rounded-xl');
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
    expect(screen.queryByText('Retake photo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Test match' })).toBeNull();
    expect(useBottleMatch).toHaveBeenCalledWith('file:///tmp/a.jpg');
  });

  it('shows no match UI while the attempt is running', () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.queryByTestId('match-name')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(WhiskeyCard)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'How we found it' })).toBeNull();
  });

  it('names a confident match, shows only that card, and starts How we found it expanded', () => {
    jest
      .mocked(useBottleMatch)
      .mockReturnValue(match(true, [candidate('1', 91), candidate('2', 70), candidate('3', 64), candidate('4', 50)]));

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Whiskey 1');
    expect(cardPills()).toEqual([['Bourbon', '91%']]);
    const cards = screen.UNSAFE_getAllByType(WhiskeyCard);
    expect(cards.map((card) => card.props.image)).toEqual([1]);
    expect(cards[0].props.pills).toEqual([{ label: '91%', tone: 'accent' }]);
    expect(screen.queryByText('Best guess')).toBeNull();
    expect(screen.getByRole('button', { name: 'How we found it' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByTestId('match-evidence')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
  });

  it('keeps the first card on the image match and lists a label-only whiskey under How we found it', () => {
    jest.mocked(useBottleMatch).mockReturnValue({
      ...match(true, [candidate('1', 91), candidate('2', 80), candidate('3', 74)]),
      label: {
        lines: ['Label line'],
        hits: [{ bottleId: '9', name: 'Label Whiskey', words: ['label'], category: 'Scotch' }],
      },
    });

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Whiskey 1');
    expect(screen.UNSAFE_getAllByType(WhiskeyCard).map((card) => card.props.name)).toEqual(['Whiskey 1']);
    expect(screen.getByText('Label Whiskey')).toBeTruthy();
  });

  it('moves a whiskey both methods found to the name line', () => {
    jest.mocked(useBottleMatch).mockReturnValue({
      ...match(true, [candidate('1', 88), candidate('2', 78)]),
      label: {
        lines: ['Whiskey 2'],
        hits: [{ bottleId: '2', name: 'Whiskey 2', words: ['whiskey'], category: 'Bourbon' }],
      },
    });

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Whiskey 2');
    expect(screen.UNSAFE_getAllByType(WhiskeyCard).map((card) => card.props.name)).toEqual(['Whiskey 2']);
  });

  it('names the whiskey both methods found instead of saying Not found', () => {
    jest.mocked(useBottleMatch).mockReturnValue({
      ...match(false, [candidate('1', 66), candidate('2', 60)]),
      label: {
        lines: ['Whiskey 2'],
        hits: [{ bottleId: '2', name: 'Whiskey 2', words: ['whiskey'], category: 'Bourbon' }],
      },
    });

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Whiskey 2');
    expect(screen.queryByText('Not found')).toBeNull();
    expect(cardPills()[0]).toEqual(['Bourbon', '60%', 'Best guess']);
  });

  it('says Not found and marks every card Best guess with a muted percentage', () => {
    jest.mocked(useBottleMatch).mockReturnValue(match(false, [candidate('1', 80), candidate('2', 74)]));

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Not found');
    expect(cardPills()).toEqual([['Bourbon', '80%', 'Best guess']]);
    expect(screen.UNSAFE_getAllByType(WhiskeyCard)[0].props.pills).toEqual([
      { label: '80%', tone: 'secondary' },
      { label: 'Best guess', tone: 'secondary' },
    ]);
  });

  it('says Not found with no cards when nothing could be matched', () => {
    jest.mocked(useBottleMatch).mockReturnValue(match(false, []));

    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    expect(screen.getByTestId('match-name')).toHaveTextContent('Not found');
    expect(screen.UNSAFE_queryAllByType(WhiskeyCard)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'How we found it' })).toBeTruthy();
  });

  it('renders the header, Retake, and an empty thumbnail without a photoUri', () => {
    jest.mocked(useBottleMatch).mockReturnValue(match(true, [candidate('1', 91)]));

    renderScan({});

    expect(screen.getByRole('header', { name: 'Scan Bottle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeTruthy();
    expect(screen.getByTestId('scan-thumbnail').children).toHaveLength(0);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(screen.queryByTestId('match-name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'How we found it' })).toBeNull();
  });

  it('goes back to Search from the header', () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('opens the camera without the upload chooser', async () => {
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    await retake();

    expect(showActionSheet).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/capture');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('keeps the photo when the camera is unavailable', async () => {
    const status = jest.replaceProperty(VisionCamera, 'cameraPermissionStatus', 'denied');
    renderScan({ photoUri: 'file:///tmp/a.jpg' });

    await retake();

    expect(showActionSheet).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Camera access is off', 'Upload a picture instead.');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(thumbnailImage().props.source).toEqual({ uri: 'file:///tmp/a.jpg' });
    status.restore();
  });
});
