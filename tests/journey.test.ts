import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  journeyDisplayState,
  journeyPlayed,
  journeyAdvance,
  journeyHasTarget,
  journeyNext,
  journeyReached,
  journeyStepMs,
  journeyThreshold,
  journeyTarget,
  markJourneyPlayed,
  resetJourneyPlayed,
} from '../src/components/dna/useJourneyReveal';

test('journey: step pacing is clamped and keeps the whole intro near 4s', () => {
  assert.equal(journeyStepMs(4), 750);
  assert.equal(journeyStepMs(7), 571);
  assert.equal(journeyStepMs(20), 350);
  assert.equal(journeyStepMs(0), 750);
});

test('journey: target is the last really-lit station, never a pending one', () => {
  assert.equal(journeyTarget(['pending', 'pending']), 0);
  assert.equal(journeyTarget(['done', 'current', 'pending', 'pending']), 2);
  assert.equal(journeyTarget(['done', 'returned', 'pending', 'pending']), 2);
  assert.equal(journeyTarget(['done', 'done', 'done', 'done']), 4);
  assert.equal(journeyTarget(['done', 'blocked', 'pending']), 2);
});

test('journey: during the intro only already-true stations are shown, never past the real state', () => {
  const real = ['done', 'current', 'pending', 'pending'] as const;
  for (let lit = 0; lit <= 4; lit++) {
    const shown = real.map((s, i) => journeyDisplayState(s, i, lit));
    shown.forEach((s, i) => {
      if (real[i] === 'pending') assert.equal(s, 'pending');
      else assert.equal(s, i < lit ? real[i] : 'pending');
    });
  }
  // settled (null) renders the real states
  assert.deepEqual(real.map((s, i) => journeyDisplayState(s, i, null)), [...real]);
});

test('journey: a playKey plays once (remounts of the same entity stay static)', () => {
  resetJourneyPlayed();
  assert.equal(journeyPlayed('order-1'), false);
  assert.equal(journeyPlayed(undefined), false);
  markJourneyPlayed('order-1');
  assert.equal(journeyPlayed('order-1'), true);
  assert.equal(journeyPlayed('order-2'), false);
  resetJourneyPlayed();
});

test('journey: stylesheet fills the connector in the reading direction and never loops in reveal mode', async () => {
  const css = await readFile(new URL('../src/components/dna/dna.css', import.meta.url), 'utf8');
  assert.match(css, /transform-origin: left center/);
  assert.match(css, /\[dir='rtl'\] \.dna-steps\[data-journey\][^{]*::after \{ transform-origin: right center/);
  assert.match(css, /dna-journey-halo 1\.4s var\(--dna-ease\) 1 both/);
  assert.match(css, /\.dna-steps\[data-reveal\] \.dna-stepi\[data-state='current'\] \.dna-node \{ animation: none; \}/);
  assert.match(css, /--journey-fill: var\(--accent\)/);
});

test('journey: threshold is always attainable (tall element in a short viewport still fires)', () => {
  assert.equal(journeyThreshold(0.4, 300, 800), 0.4);
  // 1000px tall flow in a 500px viewport can never be 40% visible: 0.9*500/1000 = 0.45 -> still 0.4
  assert.equal(journeyThreshold(0.5, 1000, 500), 0.45);
  const t = journeyThreshold(0.5, 2000, 500);
  assert.ok(t <= (0.9 * 500) / 2000 + 1e-9 && t >= 0.05);
  assert.equal(journeyThreshold(0.5, 100000, 500), 0.05);
  assert.equal(journeyThreshold(0.5, 0, 500), 0.5);
});

test('journey: the intro arms when stations arrive later (async data), not only on first render', () => {
  assert.equal(journeyHasTarget(journeyTarget(['pending', 'pending'])), false);
  assert.equal(journeyHasTarget(journeyTarget(['done', 'current', 'pending'])), true);
});

test('journey: reveal mode never leaves the base infinite halo running (no second halo after settle)', async () => {
  const css = await readFile(new URL('../src/components/dna/dna.css', import.meta.url), 'utf8');
  assert.match(css, /\.dna-steps\[data-reveal\] \.dna-stepi\[data-state='current'\] \.dna-node \{ animation: none; \}/);
  // the gold pulse exists only for journey steppers WITHOUT reveal
  assert.match(css, /\.dna-steps\[data-journey\]:not\(\[data-reveal\]\) \.dna-stepi\[data-state='current'\] \.dna-node \{ animation-name: dna-journey-pulse; \}/);
});

test('journey: the ticker converges to the (possibly growing) real target and then settles', () => {
  // GradingSteps mounts at submitted (target 1), then the status moves to grading (target 2) mid-intro
  let lit = 1;
  let target = 1;
  assert.equal(journeyAdvance(lit, target), 1);
  target = 2;
  let guard = 0;
  while (lit < target && guard++ < 10) lit = journeyAdvance(lit, target);
  assert.equal(lit, 2); // caught up, the effect then schedules the settle (never parked behind the real state)
  assert.equal(journeyAdvance(5, 3), 3);
  assert.equal(journeyAdvance(0, 0), 0);
});

test('journey: a 1px sliver does not start the intro; the attainable threshold does', () => {
  assert.equal(journeyReached(0.01, 0.4), false);
  assert.equal(journeyReached(0.4, 0.4), true);
  const eff = journeyThreshold(0.4, 1000, 500); // tall mobile flow on a short viewport
  assert.equal(journeyReached(0.01, eff), false);
  assert.equal(journeyReached(eff, eff), true);
});

test('journey: remembered/settled reveal steppers render a static ring (halo only on the station the hook just lit)', async () => {
  const css = await readFile(new URL('../src/components/dna/dna.css', import.meta.url), 'utf8');
  const kit = await readFile(new URL('../src/components/dna/DnaKit.tsx', import.meta.url), 'utf8');
  // the one-shot halo keyframe is referenced only from the data-just rule
  const uses = css.split('\n').filter((l) => l.includes('animation: dna-journey-halo'));
  assert.equal(uses.length, 1);
  assert.match(css, /\[data-just\] \.dna-node::after \{[^}]*animation: dna-journey-halo/s);
  // reveal and externally-driven steppers always carry data-reveal (also when settled/remembered),
  // so the base halo is off and the infinite journey pulse (":not([data-reveal])") never applies to them
  assert.match(kit, /data-reveal=\{journeyMode && \(reveal \|\| controlled\) \? \(lit \?\? 'done'\) : undefined\}/);
  assert.match(kit, /data-just=\{lit !== null && i === lit - 1/);
});

test('journey: re-arming is keyed on playKey (old observer/timer/lit are torn down when the entity changes)', async () => {
  const src = await readFile(new URL('../src/components/dna/useJourneyReveal.ts', import.meta.url), 'utf8');
  assert.match(src, /\}, \[enabled, playKey, hasTarget\]\);/);
  const cleanup = src.slice(src.indexOf('return () => {\n      io.disconnect();'), src.indexOf('// Armed once per entity'));
  assert.match(cleanup, /io\.disconnect\(\)/);
  assert.match(cleanup, /setStarted\(false\)/);
  assert.match(cleanup, /setLit\(null\)/);
  // the played key is recorded by the observer that belongs to the current effect run only
  assert.match(src, /markJourneyPlayed\(playKey\);\n\s+setStarted\(true\)/);
});

test('journey: survives a StrictMode setup -> cleanup -> setup cycle (played is marked only when playback starts)', async () => {
  const src = await readFile(new URL('../src/components/dna/useJourneyReveal.ts', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(main, /<StrictMode>/);
  // exactly one mark, inside the observer callback (after the ratio check), never in setup/cleanup
  assert.equal(src.split('markJourneyPlayed(playKey)').length - 1, 1);
  const setup = src.slice(src.indexOf('useIsoLayoutEffect(() => {'), src.indexOf('const io = new IntersectionObserver'));
  assert.doesNotMatch(setup, /markJourneyPlayed|armed/);
  assert.doesNotMatch(src, /armed\.current/);
});

test('journey: ticker plan (advance until the real target, then settle, hold parks, idle before start/after settle)', () => {
  assert.equal(journeyNext(false, 0, 3, false), 'idle');
  assert.equal(journeyNext(true, null, 3, false), 'idle');
  assert.equal(journeyNext(true, 1, 3, false), 'advance');
  assert.equal(journeyNext(true, 3, 3, false), 'settle');
  assert.equal(journeyNext(true, 3, 3, true), 'park');
  // the target grows mid-intro: it advances again instead of settling behind the real state
  assert.equal(journeyNext(true, 2, 4, false), 'advance');
});

test('journey: no deliverables yet means no target, so the intro is not spent on an empty grid', () => {
  assert.equal(journeyHasTarget(0), false);
  assert.equal(journeyHasTarget(1), true);
});

test('estimated flow wording exists in all 8 locales, is never "completed", and differs from the live wording', async () => {
  const src = await readFile(new URL('../src/lib/i18n-messages.ts', import.meta.url), 'utf8');
  for (const key of ['ui.stepEstDone', 'ui.stepEstCurrent', 'ui.stepEstPending']) {
    const line = src.split('\n').find((l) => l.includes(`"${key}"`));
    assert.ok(line, key);
    const args = [...line!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).slice(1);
    assert.equal(args.length, 8, `${key} has 8 locale strings`);
    assert.equal(new Set(args).size, 8, `${key} strings are all different`);
    args.forEach((a) => assert.ok(a.length > 3, `${key}: ${a}`));
  }
  const done = src.split('\n').find((l) => l.includes('"ui.stepEstDone"'))!;
  const live = src.split('\n').find((l) => l.includes('"ui.stepDone"'))!;
  assert.notEqual(done, live);
  const writer = await readFile(new URL('../src/components/project/ProjectWriterStudio.tsx', import.meta.url), 'utf8');
  assert.match(writer, /useDnaEstimatedStepStateText\(\)/);
  assert.match(writer, /<DnaStepper journey estimated /);
});

test('journey: landing and Learn Studio walkthroughs are remembered per session (SPA remounts do not replay)', async () => {
  const home = await readFile(new URL('../src/pages/PublicHome.tsx', import.meta.url), 'utf8');
  const learn = await readFile(new URL('../src/pages/LearnStudio.tsx', import.meta.url), 'utf8');
  assert.match(home, /<JourneyFlow className="mt-12" playKey="landing:how"/);
  assert.match(learn, /<JourneyFlow [^>]*playKey="learn:flow"/);
});

test('journey: deliverables intro targets the furthest really reached station and arms only once cards exist', async () => {
  const ws = await readFile(new URL('../src/pages/ProjectWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(ws, /const target = project\.deliverables\.reduce\(/);
  assert.match(ws, /useJourneyReveal<HTMLDivElement>\(\{ target, count: DELIVERABLE_FLOW\.length/);
});

// Runtime (server render): the no-JS / first-paint output is the complete, truthful final state.
test('runtime: DnaStepper reveal and JourneyFlow render the complete real state on first (server) render', async () => {
  const { register } = await import('node:module');
  register(new URL('./helpers/css-stub-loader.mjs', import.meta.url));
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DnaStepper } = await import('../src/components/dna/DnaKit');
  const { JourneyFlow } = await import('../src/components/dna/JourneyFlow');
  const steps = [
    { key: 'a', label: 'A', state: 'done' as const, introIcon: React.createElement('i', { 'data-intro': 'a' }) },
    { key: 'b', label: 'B', state: 'current' as const },
    { key: 'c', label: 'C', state: 'pending' as const },
  ];
  const html = renderToStaticMarkup(React.createElement(DnaStepper, { steps, reveal: true, playKey: 'ssr-1', stateText: { done: 'DONE', current: 'CUR', pending: 'PEND' } }));
  assert.match(html, /data-reveal="done"/);
  assert.equal((html.match(/data-state="done"/g) ?? []).length, 1);
  assert.equal((html.match(/data-state="pending"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-just/);
  assert.match(html, /DONE/);
  assert.match(html, /CUR/);
  // estimated flow: no completed check glyph for a passed station
  const est = renderToStaticMarkup(React.createElement(DnaStepper, { steps, journey: true, estimated: true, stateText: { done: 'EST-PASSED', current: 'EST-CUR', pending: 'EST-NEXT' } }));
  assert.match(est, /data-estimated/);
  assert.doesNotMatch(est, /<svg/);
  assert.match(est, /EST-PASSED/);
  assert.doesNotMatch(est, /DONE/);
  const flow = renderToStaticMarkup(React.createElement(JourneyFlow, { items: [1, 2, 3].map((n) => ({ key: String(n), icon: () => null, title: 'T' + n })) }));
  assert.match(flow, /data-reveal="done"/);
  assert.equal((flow.match(/data-lit/g) ?? []).length, 3);
});
