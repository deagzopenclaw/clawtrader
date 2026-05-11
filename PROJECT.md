# Project: Kalshi Trading Agent + Dashboard

## Goal

Build a Kalshi-focused agent that researches prediction markets, identifies possible positive ROI opportunities, paper trades first, learns from mistakes, and eventually supports approval-gated real-money trading.

## Build Phases

### Phase 1 - Safe Research Agent

- Create agent workspace
- Define risk policy
- Define recommendation format
- Track paper trades and mistakes
- Manually inspect Kalshi markets

### Phase 2 - Market Data Integration

- Connect Kalshi market data API
- Pull markets, prices, order book/spread, volume
- Build candidate scanner
- Store watchlist

### Phase 3 - Scoring Engine

- Probability estimator
- Evidence collector
- EV calculator
- Confidence scoring
- Recommendation generator

### Phase 4 - Dashboard

- Local dashboard showing watchlist, trades, ROI, mistakes, risk
- Eventually embed into OpenClaw Control UI if useful

### Phase 5 - Approval-Gated Trading

- Add Kalshi order API wrapper
- Require Joe approval for every trade
- Enforce stake/exposure/loss limits

### Phase 6 - Limited Autonomy

Only after proven paper-trading performance and explicit approval.

## Current Status

Phase 1 started. No live trading enabled.
