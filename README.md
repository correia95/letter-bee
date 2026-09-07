# letter-bee

A daily seven-letter word puzzle. Make words (4+ letters) from the hive, always
using the centre letter; letters repeat; all-seven words are pangrams (+7). Ranks
from Beginner to Queen Bee, spoiler-free share, progress saved per day in the
browser. Same hive for everyone, new at midnight UTC.

**Live:** https://letter-bee.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker
- Dictionary: public-domain ENABLE list, filtered to 4+ letters with <=7 distinct
  letters (~98k words), served as `/words.txt` (~816 KB, ~250 KB gzipped)

## Engine

[`src/bee.ts`](src/bee.ts): `buildPuzzle(no, dict)` — seeded (`mulberry32`) pick of
a 7-distinct-letter, S-free pangram word, then a centre letter yielding 15-70
answers nearest 35; indexes the dictionary by distinct-letter signature for a
fast subset scan. `wordScore` (4=1, else length, +7 pangram), `ranks` /
`rankFor`, `check` (length, centre, hive letters, dictionary).

Verified in Node: days 1-5 build in <=126 ms, 36-67 words, 1-4 pangrams,
deterministic; `check` accepts pangrams (+bonus) and rejects short / off-hive /
non-dictionary words.

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
