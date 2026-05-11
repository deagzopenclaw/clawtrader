# Strategy - Kalshi Scout

## Goal

Find markets where the agent's estimated probability differs meaningfully from market price, with enough evidence to justify a paper trade or approval request.

## Core Signal

Expected value edge:

```text
edge = estimated_probability - market_price_probability
```

Example:

- Contract price: 42¢ → market implies ~42%
- Agent estimate: 55%
- Edge: +13 percentage points

## Candidate Filters

Prefer markets with:

- Clear resolution criteria
- Reliable data sources
- Time-sensitive mispricing
- Low ambiguity
- Reasonable liquidity/spread

Avoid markets with:

- Vague resolution rules
- Insider-heavy information
- Very wide spreads
- Pure vibes / no measurable evidence
- Binary outcomes dominated by one unknown decision-maker

## Recommendation Thresholds

- Edge < 3pp: pass
- 3-7pp: watch
- 8-14pp: paper trade / request approval
- 15pp+: high-priority review, still verify liquidity and risk

## Review Loop

Every recommendation should later be labeled:

- Good thesis, good result
- Good thesis, bad result
- Bad thesis, lucky result
- Bad thesis, bad result

Lessons go into `mistakes.md` and `rules.md`.
