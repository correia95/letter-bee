export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EPOCH = Date.UTC(2026, 8, 7);
export function puzzleNumber(now: Date): number {
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - EPOCH) / 86400000) + 1;
}

export interface Puzzle {
  no: number;
  letters: string[]; // 7, index 0 is the centre
  centre: string;
  outer: string[];
  words: string[]; // all valid answers, sorted
  pangrams: string[];
  maxScore: number;
}

export function wordScore(w: string, all7: Set<string>): number {
  if (w.length === 4) return 1;
  let s = w.length;
  if ([...all7].every((c) => w.includes(c))) s += 7; // pangram bonus
  return s;
}

// Build the day's puzzle from the dictionary.
export function buildPuzzle(no: number, dict: string[]): Puzzle {
  const rnd = mulberry32(no * 2654435761 + 12345);
  // pangram candidates: 4+ letters, exactly 7 distinct, no 's'
  const cands: string[] = [];
  for (const w of dict) {
    if (w.length >= 6 && w.length <= 10 && !w.includes('s')) {
      if (new Set(w).size === 7) cands.push(w);
    }
  }
  // deterministic shuffle
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }

  // index dictionary words by their distinct-letter signature for speed
  const bySig = new Map<string, string[]>();
  for (const w of dict) {
    if (w.includes('s')) continue;
    const set = new Set(w);
    if (set.size > 7) continue;
    const sig = [...set].sort().join('');
    let arr = bySig.get(sig);
    if (!arr) bySig.set(sig, (arr = []));
    arr.push(w);
  }
  // for a given 7-set, all candidate words are those whose signature is a subset
  const sigs7: string[][] = [...bySig.keys()].map((s) => [...s]);

  for (const pan of cands) {
    const seven = [...new Set(pan)].sort();
    const sevenSet = new Set(seven);
    // collect every dict word using only these 7 letters
    const pool: string[] = [];
    for (let i = 0; i < sigs7.length; i++) {
      const sg = sigs7[i];
      if (sg.every((c) => sevenSet.has(c))) {
        for (const w of bySig.get(sg.join(''))!) pool.push(w);
      }
    }
    // choose a centre: the letter giving 20–55 answers, preferring ~35
    let best: { c: string; words: string[]; d: number } | null = null;
    for (const c of seven) {
      const words = pool.filter((w) => w.includes(c)).sort();
      if (words.length < 15 || words.length > 70) continue;
      const d = Math.abs(words.length - 35);
      if (!best || d < best.d) best = { c, words, d };
    }
    if (!best) continue;

    const all7 = sevenSet;
    const pangrams = best.words.filter((w) => seven.every((x) => w.includes(x)));
    if (pangrams.length === 0) continue;
    const maxScore = best.words.reduce((s, w) => s + wordScore(w, all7), 0);
    const outer = seven.filter((c) => c !== best.c);
    // shuffle outer for display
    for (let i = outer.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [outer[i], outer[j]] = [outer[j], outer[i]];
    }
    return {
      no,
      letters: [best.c, ...outer],
      centre: best.c,
      outer,
      words: best.words,
      pangrams,
      maxScore,
    };
  }
  // extremely unlikely fallback
  throw new Error('no puzzle');
}

export type Rank = { name: string; min: number };
export function ranks(maxScore: number): Rank[] {
  const pct = [0, 0.02, 0.05, 0.08, 0.15, 0.25, 0.4, 0.5, 0.7, 1];
  const names = ['Beginner', 'Good start', 'Moving up', 'Good', 'Solid', 'Nice', 'Great', 'Amazing', 'Genius', 'Queen Bee'];
  return names.map((name, i) => ({ name, min: Math.max(i === 0 ? 0 : 1, Math.round(pct[i] * maxScore)) }));
}
export function rankFor(score: number, rs: Rank[]): { current: Rank; next: Rank | null; idx: number } {
  let idx = 0;
  for (let i = 0; i < rs.length; i++) if (score >= rs[i].min) idx = i;
  return { current: rs[idx], next: rs[idx + 1] || null, idx };
}

export type CheckResult =
  | { ok: true; word: string; score: number; pangram: boolean }
  | { ok: false; reason: string };

export function check(guess: string, p: Puzzle, found: Set<string>): CheckResult {
  const w = guess.toLowerCase().trim();
  if (w.length < 4) return { ok: false, reason: 'Too short — 4 letters minimum' };
  if (!w.includes(p.centre)) return { ok: false, reason: `Must use the centre letter "${p.centre.toUpperCase()}"` };
  const set = new Set(p.letters);
  if (![...w].every((c) => set.has(c))) return { ok: false, reason: 'Uses a letter not in the hive' };
  if (found.has(w)) return { ok: false, reason: 'Already found' };
  if (!p.words.includes(w)) return { ok: false, reason: 'Not in the word list' };
  const all7 = new Set(p.letters);
  const pangram = [...all7].every((c) => w.includes(c));
  return { ok: true, word: w, score: wordScore(w, all7), pangram };
}
