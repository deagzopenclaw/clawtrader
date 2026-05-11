# Kalshi Agent Dashboard

## Purpose

A local dashboard for monitoring Kalshi Scout in research/paper-trading mode.

## Generate Data

From `C:\Users\deagz\.openclaw\workspace-kalshi`:

```powershell
node trading\scan-markets.mjs --limit=100 --status=open
node trading\estimate-market.mjs --ticker=<TICKER> --prob=0.55 --confidence=medium --notes="short evidence summary"
node dashboard\build-dashboard.mjs
```

## Files

- `watchlist.json` / `watchlist.md` — scanner output
- `estimates.json` / `estimates.md` — probability estimate output
- `state.json` — agent/dashboard status
- `index.html` — generated static dashboard

## Current Widgets

1. Agent/model status
2. Market scan counts
3. Watchlist table
4. Probability estimates table
5. Risk mode indicator

## Safety

Live trading is disabled. This dashboard is informational and paper-trading oriented only.
