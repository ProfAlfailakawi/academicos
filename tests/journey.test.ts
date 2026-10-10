import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  journeyDisplayState,
  journeyPlayed,
  journeyStepMs,
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
