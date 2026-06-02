# Cricket Crash — Game Rules

## Objective

Place a stake before each delivery and watch the multiplier accumulate over the over. Collect your reward at any time — but if the wicket falls, the multiplier resets to zero for that delivery.

## Game Format

One delivery per round. Place a stake, watch the delivery, collect the result.

- **Payout** = stake × delivery multiplier
- **Wicket** = 0× payout (stake lost)
- **Autobet** repeats the same stake automatically until stopped

## Delivery Outcomes

| Outcome | Display | Effect on multiplier |
|---|---|---|
| Six | Ball clears boundary | ×2.00 (Standard) / ×2.25 (Powerplay) |
| Four | Ball reaches boundary | ×1.75 / ×1.85 |
| Triple | 3 runs | ×1.36 / ×1.40 |
| Double | 2 runs | ×1.16 / ×1.18 |
| Single | 1 run | ×1.08 / ×1.08 |
| Dot ball | Ball blocked | ×0.90 / ×0.90 |
| Good fielding | Batsman run out | ×0.70 / ×0.70 |
| Wicket | Caught / bowled | ×0 (session ends) |

## Sky Objects

During flight, a sky object may appear (airplane, jetpack). If the ball hits the sky object, the delivery multiplier is boosted:

- **Jetpack** — 10× multiplier for that delivery (75% of sky events)
- **Small Plane** — 10× multiplier (22% of sky events)
- **Big Plane** — 100× multiplier (3% of sky events)

Sky spawn rate: 2% per delivery in Standard mode; 12% in Powerplay mode.

## Boundary Streak Bonus

Consecutive boundary deliveries (fours and sixes) trigger an escalating bonus on the last delivery of the streak:

| Streak | Minimum multiplier on last delivery |
|---|---|
| 3 consecutive boundaries | 3× |
| 4 consecutive boundaries | 4× |
| 5 consecutive boundaries | 5× |
| 6 consecutive boundaries | 8× |

A non-boundary delivery resets the streak counter.

## Multiplier Caps

- No single delivery can contribute more than **100×** to the product
- Planning cap for a full over: **200×** (server payout is always honoured in full at settlement)

## Cashout

Players may collect their accumulated multiplier at any point during the over (after the first delivery starts). Collecting locks in the current accumulated multiplier × stake amount.

## Autoplay

Autoplay repeats the same stake automatically. Configurable limits:
- Maximum rounds
- Maximum cumulative loss
- Maximum cumulative gain
- Stop when multiplier reaches a target

## Return to Player (RTP)

| Mode | RTP |
|---|---|
| Standard (Over) | ~94.97% |
| Powerplay (Bonus Buy) | Higher (greater boundary weights and sky chance) |

RTP is computed as the expected value of the outcome distribution weighted by multipliers. Independent verification is possible using the provably fair system (see `docs/PROVABLY_FAIR.md`).

## Volatility

**Standard mode**: Medium–High volatility. Most rounds produce small multipliers (0.7–1.08×). Wickets (15% probability) return 0×. Large multipliers (>5×) require either a sky event or sustained boundary streak.

**Powerplay mode**: High volatility. Single-delivery format with higher sky frequency amplifies both wins and losses relative to stake size.

## Fairness

All outcomes are determined by a provably fair HMAC-SHA256 algorithm. The server seed hash is published before the round, and the full seed is revealed after settlement. See `docs/PROVABLY_FAIR.md` for the full verification procedure.
