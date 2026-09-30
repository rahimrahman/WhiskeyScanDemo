import { fireEvent, render, screen } from '@testing-library/react-native';

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
};

const openEvidence = () => fireEvent.press(screen.getByRole('button', { name: 'How we found it' }));

describe('MatchEvidence', () => {
  it('starts collapsed', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    expect(screen.getByRole('button', { name: 'How we found it' }).props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId('match-evidence')).toBeNull();
    expect(screen.queryByText('412 ms')).toBeNull();
  });

  it('shows the scan beside the winning catalog photo, the top 5 scores, latency and model id when opened', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    openEvidence();

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

  it('collapses again on a second tap', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={MATCH} />);

    openEvidence();
    openEvidence();

    expect(screen.queryByTestId('match-evidence')).toBeNull();
  });

  it('shows only the scan and latency when nothing matched and the embed failed', () => {
    render(<MatchEvidence photoUri="file:///tmp/a.jpg" match={{ confident: false, candidates: [], elapsedMs: 12 }} />);

    openEvidence();

    expect(screen.getByTestId('evidence-scan-photo')).toBeTruthy();
    expect(screen.queryByTestId('evidence-catalog-photo')).toBeNull();
    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.queryByText('Model')).toBeNull();
  });
});
