# Risk Policy - Kalshi Scout

## Phase 1: Research Only

- Live trading: disabled.
- Allowed actions: research, thesis generation, probability estimates, paper trades, tracking outcomes.
- Disallowed actions: placing, modifying, or canceling real-money orders.

## Phase 2: Approval-Gated Trading

Before any real-money trade, Joe must define:

- Max stake per trade
- Max daily loss
- Max open exposure
- Allowed market categories
- Minimum edge threshold
- Minimum confidence threshold
- Whether manual approval is required for every order

Recommended starting defaults:

- Max stake per trade: $5-$10
- Max daily loss: $20
- Max open exposure: $50
- Minimum estimated edge: 8 percentage points
- Manual approval: required

## Phase 3: Limited Autonomy

Only after a successful paper-trading record and explicit Joe approval.

Required protections:

- Hard exposure limits
- Kill switch
- Full logging
- Daily summary
- Automatic pause after drawdown
- No martingale / no chase-loss behavior
