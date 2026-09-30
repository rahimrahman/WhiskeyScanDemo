import { Asset } from 'expo-asset';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import type { Catalog } from '@/lib/catalog/catalog';
import { embedPhoto } from '@/lib/embedding/embedPhoto';
import { Text } from '@/ui-components/Text';

/** Provisional guesses, not calibrated: tune from real photos before story 7 fixes them in config. */
const MIN_SIMILARITY = 0.85;
const MIN_MARGIN = 0.03;

type CatalogVector = { name: string; photo: string; imageSource: number; vector: number[] };
type Match = { name: string; photo: string; imageSource: number; similarity: number };
type Verdict = { kind: 'match' | 'unsure' | 'none'; label: string };
type Run = { label: string; ms: number; matches: Match[]; verdict: Verdict };
type Result = { modelId: string; length: number; runs: Run[] };
type State =
  | { kind: 'idle' }
  | { kind: 'running'; label: string }
  | { kind: 'done'; result: Result }
  | { kind: 'error'; message: string };

let catalogVectors: CatalogVector[] | null = null;

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
}

const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

async function embedCatalog(onProgress: (done: number, total: number) => void): Promise<CatalogVector[]> {
  if (catalogVectors) return catalogVectors;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const catalog: Catalog = require('../../../assets/catalog/catalog.json');
  const images: Record<string, number> = require('../../../assets/catalog/image-map.js');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const entries = catalog.whiskeys.flatMap((whiskey) => whiskey.photos.map((photo) => ({ whiskey, photo })));
  const vectors: CatalogVector[] = [];
  for (const [index, { whiskey, photo }] of entries.entries()) {
    const imageSource = images[photo];
    const asset = await Asset.fromModule(imageSource).downloadAsync();
    const { vector } = await embedPhoto(asset.localUri ?? asset.uri);
    vectors.push({ name: whiskey.name, photo, imageSource, vector: normalize(vector) });
    onProgress(index + 1, entries.length);
  }
  catalogVectors = vectors;
  return vectors;
}

function topWhiskeys(query: number[], catalog: CatalogVector[], count: number): Match[] {
  const best = new Map<string, Match>();
  for (const { name, photo, imageSource, vector } of catalog) {
    const similarity = dot(query, vector);
    if ((best.get(name)?.similarity ?? -Infinity) < similarity) {
      best.set(name, { name, photo, imageSource, similarity });
    }
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, count);
}

function verdictFor([first, second]: Match[]): Verdict {
  if (!first) return { kind: 'none', label: 'No match: the catalog is empty.' };
  const margin = first.similarity - (second?.similarity ?? 0);
  const gap = `${(margin * 100).toFixed(1)} points ahead of #2`;
  if (first.similarity < MIN_SIMILARITY) {
    return { kind: 'none', label: `No match. Closest is ${first.name} at ${percent(first.similarity)}.` };
  }
  if (margin < MIN_MARGIN) {
    return { kind: 'unsure', label: `Not sure. Best guess ${first.name} at ${percent(first.similarity)}, only ${gap}.` };
  }
  return { kind: 'match', label: `Match: ${first.name} at ${percent(first.similarity)}, ${gap}.` };
}

async function embedAndRank(label: string, uri: string, catalog: CatalogVector[]) {
  const started = Date.now();
  const embedding = await embedPhoto(uri);
  const matches = topWhiskeys(normalize(embedding.vector), catalog, 5);
  return { embedding, run: { label, ms: Date.now() - started, matches, verdict: verdictFor(matches) } };
}

const verdictColor = { match: 'text-green-400', unsure: 'text-yellow-300', none: 'text-red-400' } as const;

function RunResult({ run }: { run: Run }) {
  const best = run.matches[0];
  return (
    <View className="gap-1 rounded-lg border border-whiskey-accent/40 p-3">
      <Text className="text-xs opacity-60">
        {run.label} · {run.ms} ms
      </Text>
      <Text variant="bodySemibold" className={`text-base ${verdictColor[run.verdict.kind]}`}>
        {run.verdict.label}
      </Text>
      {best ? (
        <View className="flex-row items-center gap-3">
          <Image source={best.imageSource} resizeMode="cover" className="h-24 w-20 rounded-lg" />
          <Text className="flex-1 text-sm">
            Closest catalog photo: {best.name} ({best.photo.split('/').pop()})
          </Text>
        </View>
      ) : null}
      {run.matches.map((match, index) => (
        <Text key={match.name} className="text-sm">
          {index + 1}. {percent(match.similarity)} {match.name}
        </Text>
      ))}
    </View>
  );
}

/** Temporary on-device check until stories 6 and 7: embeds the photo and ranks catalog whiskeys by cosine similarity. */
export function MatchDebugPanel({ photoUri }: { photoUri: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = async () => {
    try {
      setState({ kind: 'running', label: 'Embedding catalog…' });
      const catalog = await embedCatalog((done, total) =>
        setState({ kind: 'running', label: `Embedding catalog ${done}/${total}…` }),
      );
      setState({ kind: 'running', label: 'Embedding photo…' });
      const { embedding, run: photoRun } = await embedAndRank('Your photo', photoUri, catalog);
      setState({
        kind: 'done',
        result: { modelId: embedding.modelId, length: embedding.vector.length, runs: [photoRun] },
      });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <View className="mt-4 w-full gap-2">
      <View className="h-11 items-center justify-center rounded-full border border-whiskey-accent">
        <Text variant="bodySemibold" aria-hidden>
          {state.kind === 'running' ? state.label : 'Test match'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test match"
          disabled={state.kind === 'running'}
          onPress={run}
          className="absolute inset-0"
        />
      </View>

      {state.kind === 'error' ? <Text className="text-sm">{state.message}</Text> : null}

      {state.kind === 'done' ? (
        <View className="gap-2">
          {state.result.runs.map((result) => (
            <RunResult key={result.label} run={result} />
          ))}
          <Text className="text-xs opacity-60">
            {state.result.length} values · {state.result.modelId} · match needs ≥{percent(MIN_SIMILARITY)} and{' '}
            {(MIN_MARGIN * 100).toFixed(0)} points over #2 (provisional)
          </Text>
        </View>
      ) : null}
    </View>
  );
}
