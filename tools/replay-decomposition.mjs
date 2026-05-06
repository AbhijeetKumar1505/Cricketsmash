#!/usr/bin/env node
import { decomposeRound, GAME_MODES } from '@cricket-crash/fairness';

function readArg(name) {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

const payout = Number(readArg('payout') ?? '1');
const betID = Number(readArg('betId') ?? Date.now());
const modeArg = (readArg('mode') ?? 'OVER').toUpperCase();
const mode = modeArg === 'POWERPLAY' ? GAME_MODES.POWERPLAY : GAME_MODES.OVER;

const out = decomposeRound({
  payoutMultiplier: payout,
  betID,
  mode,
  applyOverCap: true,
});

console.log(
  JSON.stringify(
    {
      input: { payoutMultiplier: payout, betID, mode },
      product: out.product,
      balls: out.balls.map((b) => ({
        i: b.index,
        key: b.key,
        factor: Number(b.factor.toFixed(6)),
        runs: b.runs,
        skyType: b.skyType ?? null,
        streakLength: b.streakLength ?? null,
      })),
      telemetry: out.telemetry,
    },
    null,
    2,
  ),
);

