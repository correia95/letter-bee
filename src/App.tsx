import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puzzle, buildPuzzle, check, puzzleNumber, rankFor, ranks } from './bee';

const NOW = new Date();
const NO = puzzleNumber(NOW);
const KEY = `letter-bee:${NO}`;

interface Saved {
  found: string[];
  score: number;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j.found)) return { found: j.found, score: j.score || 0 };
    }
  } catch {
    /* ignore */
  }
  return { found: [], score: 0 };
}

export default function App() {
  const [dict, setDict] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const [guess, setGuessState] = useState('');
  const guessRef = useRef('');
  const setGuess = useCallback((v: string | ((g: string) => string)) => {
    setGuessState((prev) => {
      const next = typeof v === 'function' ? (v as (g: string) => string)(prev) : v;
      guessRef.current = next;
      return next;
    });
  }, []);
  const [found, setFound] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'bad' | 'pan' } | null>(null);
  const [outerOrder, setOuterOrder] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [showList, setShowList] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<number>();

  useEffect(() => {
    fetch('/words.txt')
      .then((r) => r.text())
      .then((t) => setDict(t.split('\n').map((w) => w.trim()).filter(Boolean)))
      .catch(() => setErr(true));
  }, []);

  const puzzle: Puzzle | null = useMemo(() => (dict ? buildPuzzle(NO, dict) : null), [dict]);

  useEffect(() => {
    if (!puzzle) return;
    const s = load();
    setFound(s.found);
    setScore(s.score);
  }, [puzzle]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ found, score }));
    } catch {
      /* ignore */
    }
  }, [found, score]);

  const rs = useMemo(() => (puzzle ? ranks(puzzle.maxScore) : []), [puzzle]);
  const rankInfo = useMemo(() => (rs.length ? rankFor(score, rs) : null), [rs, score]);

  const flash = (text: string, kind: 'ok' | 'bad' | 'pan') => {
    setToast({ text, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  };

  const foundRef = useRef<string[]>([]);
  foundRef.current = found;

  const submit = useCallback(() => {
    if (!puzzle) return;
    const g = guessRef.current;
    const r = check(g, puzzle, new Set(foundRef.current));
    if (!r.ok) {
      flash(r.reason, 'bad');
      setGuess('');
      return;
    }
    setFound((f) => [r.word, ...f]);
    setScore((s) => s + r.score);
    flash(r.pangram ? `Pangram! +${r.score}` : `+${r.score}`, r.pangram ? 'pan' : 'ok');
    setGuess('');
  }, [puzzle, setGuess]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!puzzle) return;
      if (e.key === 'Enter') submit();
      else if (e.key === 'Backspace') setGuess((g) => g.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) {
        const c = e.key.toLowerCase();
        if (puzzle.letters.includes(c)) setGuess((g) => (g.length < 19 ? g + c : g));
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shuffle = () => {
    setOuterOrder((o) => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  };

  const tap = (c: string) => setGuess((g) => (g.length < 19 ? g + c : g));

  const share = async () => {
    if (!puzzle || !rankInfo) return;
    const pangrams = found.filter((w) => new Set(puzzle.letters).size === new Set(w).size && [...new Set(puzzle.letters)].every((c) => w.includes(c)));
    const line = `Letter Bee #${NO}\n${found.length} words · ${score} pts · ${rankInfo.current.name}${pangrams.length ? ` · ${pangrams.length}🐝` : ''}\n${window.location.origin}`;
    try {
      if ('share' in navigator && navigator.share) {
        await navigator.share({ text: line });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  if (err) return <div className="app"><p className="hint">Couldn't load the word list. Reload the page.</p></div>;
  if (!puzzle || !rankInfo) return <div className="app"><p className="hint">Loading today's hive…</p></div>;

  const nextRank = rankInfo.next;
  const prevMin = rankInfo.current.min;
  const barPct = nextRank ? Math.min(100, ((score - prevMin) / (nextRank.min - prevMin)) * 100) : 100;
  const outer = outerOrder.map((i) => puzzle.outer[i]);

  return (
    <div className="app">
      <header>
        <h1>Letter Bee</h1>
        <p className="meta">
          Puzzle #{NO} · {NOW.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · new hive at midnight UTC
        </p>
      </header>

      <div className="rankbar">
        <span className="rk">{rankInfo.current.name}</span>
        <div className="track"><div className="fill" style={{ width: `${barPct}%` }} /></div>
        <span className="sc">{score}{nextRank ? ` / ${nextRank.min}` : ''}</span>
      </div>

      <div className="guessline">
        {guess === '' ? (
          <span className="ph">Tap letters or type</span>
        ) : (
          [...guess].map((c, i) => (
            <span key={i} className={c === puzzle.centre ? 'gc centre' : puzzle.letters.includes(c) ? 'gc' : 'gc off'}>
              {c.toUpperCase()}
            </span>
          ))
        )}
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      <div className="hive">
        <div className="hcol">
          <button className="cell" onClick={() => tap(outer[0])}>{outer[0].toUpperCase()}</button>
          <button className="cell" onClick={() => tap(outer[1])}>{outer[1].toUpperCase()}</button>
        </div>
        <div className="hcol mid">
          <button className="cell" onClick={() => tap(outer[2])}>{outer[2].toUpperCase()}</button>
          <button className="cell centre" onClick={() => tap(puzzle.centre)}>{puzzle.centre.toUpperCase()}</button>
          <button className="cell" onClick={() => tap(outer[3])}>{outer[3].toUpperCase()}</button>
        </div>
        <div className="hcol">
          <button className="cell" onClick={() => tap(outer[4])}>{outer[4].toUpperCase()}</button>
          <button className="cell" onClick={() => tap(outer[5])}>{outer[5].toUpperCase()}</button>
        </div>
      </div>

      <div className="actions">
        <button onClick={() => setGuess((g) => g.slice(0, -1))}>Delete</button>
        <button className="shuf" onClick={shuffle} aria-label="Shuffle letters">⟳</button>
        <button className="enter" onClick={submit}>Enter</button>
      </div>

      <div className="foundbox">
        <button className="foundhead" onClick={() => setShowList((v) => !v)}>
          {found.length} word{found.length === 1 ? '' : 's'} found
          <i>{showList ? 'hide' : 'show'}</i>
        </button>
        {showList && (
          <div className="foundwords">
            {found.length === 0 ? <span className="none">Nothing yet.</span> :
              [...found].sort().map((w) => (
                <span key={w} className={[...new Set(puzzle.letters)].every((c) => w.includes(c)) ? 'fw pan' : 'fw'}>{w}</span>
              ))}
          </div>
        )}
      </div>

      <button className="share" onClick={share}>
        {copied ? 'Copied' : 'share' in navigator ? 'Share progress' : 'Copy progress'}
      </button>

      <section className="explainer">
        <h2>How to play</h2>
        <p>
          Make as many words as you can from the seven letters. Every word must be at least four
          letters long and must use the centre letter. Letters can be used more than once. A word
          that uses all seven letters is a <strong>pangram</strong> — worth a seven-point bonus.
        </p>
        <h3>Scoring and ranks</h3>
        <p>
          Four-letter words score one point. Longer words score one point per letter, plus the
          pangram bonus. As your score climbs you move up the ranks from Beginner to Queen Bee
          (every word found). The same hive is set for everyone each day and resets at midnight UTC;
          your progress is saved in this browser.
        </p>
        <h3>The word list</h3>
        <p>
          Answers come from the public-domain ENABLE word list. It leaves out proper nouns and words
          with an "S" (to avoid easy plurals), and it isn't identical to any official Scrabble
          dictionary, so a valid-looking word is occasionally not accepted.
        </p>
        <h3>Is anything sent to a server?</h3>
        <p>No. The word list loads once, then everything — the puzzle, your words, your score — stays in your browser.</p>
        <footer>Letter Bee · free · no sign-up · a new hive every day</footer>
      </section>
    </div>
  );
}
