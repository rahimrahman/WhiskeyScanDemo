import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { MatchEvidence } from '@/components/scan/MatchEvidence';
import type { BottleMatch, MatchCandidate } from '@/components/scan/useBottleMatch';

const candidate = (bottleId: string, score: number): MatchCandidate => ({
  bottleId,
  name: `Whiskey ${bottleId}`,
  category: 'Bourbon',
  score,
});

const MATCH: BottleMatch = {
  confident: true,
  candidates: [91, 70, 64, 50, 41, 30].map((score, index) => candidate(String(index + 1), score)),
  winningPhoto: 101,
  elapsedMs: 412,
  modelId: 'apple-vision-feature-print:float:768',
  label: {
    lines: ['Eagle Rare', '10 Years'],
    hits: [
      { bottleId: '7', name: 'Eagle Rare 10 Year', words: ['eagle', 'rare', '10'], category: 'Bourbon' },
      { bottleId: '10', name: 'Laphroaig 10 Year Old', words: ['10'], category: 'Scotch' },
    ],
  },
};

const NO_LABEL = { lines: [], hits: [] };

const openEvidence = () => fireEvent.press(screen.getByRole('button', { name: 'How we found it' }));

describe('MatchEvidence', () => {
  it('starts expanded', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    expect(screen.getByRole('button', { name: 'How we found it' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByTestId('match-evidence')).toBeTruthy();
    expect(screen.getByText('412 ms')).toBeTruthy();
    expect(screen.getByText('Eagle Rare')).toBeTruthy();
  });

  it('lists the label lines, then each label-ranked whiskey with its matched words in accent', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    const label = within(screen.getByTestId('label-evidence'));
    expect(label.getByText('Eagle Rare')).toBeTruthy();
    expect(label.getByText('10 Years')).toBeTruthy();
    expect(label.getByText('Eagle Rare 10 Year')).toBeTruthy();
    const words = label.getByText('eagle rare 10');
    expect(words.props.className).toContain('text-whiskey-accent');
    expect(label.getByText('Laphroaig 10 Year Old')).toBeTruthy();
    expect(label.getByText('10').props.className).toContain('text-whiskey-accent');
    expect(label.queryByText('No catalog words matched')).toBeNull();
    expect(label.queryByText('No label text read')).toBeNull();
  });

  it('says No catalog words matched under the lines when no whiskey matched them', () => {
    render(
      <MatchEvidence photoUri="file:///tmp/a.jpg" match={{ ...MATCH, label: { lines: ['Straight Bourbon'], hits: [] } }} />,
    );

    const label = within(screen.getByTestId('label-evidence'));
    expect(label.getByText('Straight Bourbon')).toBeTruthy();
    expect(label.getByText('No catalog words matched')).toBeTruthy();
    expect(label.queryByText('No label text read')).toBeNull();
  });

  it('says No label text read when OCR read nothing, keeping the image scores', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={{ ...MATCH, label: NO_LABEL }} />);

    const label = within(screen.getByTestId('label-evidence'));
    expect(label.getByText('No label text read')).toBeTruthy();
    expect(label.queryByText('No catalog words matched')).toBeNull();
    expect(screen.getByText('91%')).toBeTruthy();
  });

  it('shows the scan beside the winning catalog photo, the top 5 scores, latency and model id', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    expect(screen.getByRole('button', { name: 'How we found it' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByTestId('evidence-scan-photo').props.source).toEqual({ uri: 'file:///tmp/a.jpg' });
    expect(screen.getByTestId('evidence-catalog-photo').props.source).toBe(101);
    for (const [name, percent] of [
      ['Whiskey 1', '91%'],
      ['Whiskey 2', '70%'],
      ['Whiskey 3', '64%'],
      ['Whiskey 4', '50%'],
      ['Whiskey 5', '41%'],
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByText(percent)).toBeTruthy();
    }
    expect(screen.queryByText('Whiskey 6')).toBeNull();
    expect(screen.getByText('412 ms')).toBeTruthy();
    expect(screen.getByText('apple-vision-feature-print:float:768')).toBeTruthy();
  });

  it('collapses on tap', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    openEvidence();

    expect(screen.queryByTestId('match-evidence')).toBeNull();
  });

  it('shows only the scan and latency when nothing matched and the embed failed', () => {
    render(
      <MatchEvidence
        photoUri="file:///tmp/a.jpg"
        match={{ confident: false, candidates: [], elapsedMs: 12, label: NO_LABEL }}
      />,
    );

    expect(screen.getByTestId('evidence-scan-photo')).toBeTruthy();
    expect(screen.queryByTestId('evidence-catalog-photo')).toBeNull();
    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.queryByText('Model')).toBeNull();
  });
});
