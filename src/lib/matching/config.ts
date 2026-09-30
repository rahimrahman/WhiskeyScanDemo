/** The confidence gate, in percentage points. Provisional: tune with real scans. */
export const matchConfig = { minSimilarity: 70, minMargin: 8 };

export type MatchConfig = typeof matchConfig;
