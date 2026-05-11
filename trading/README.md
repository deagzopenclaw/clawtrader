# Kalshi Trading Tools

## Market Scanner

Run from the Kalshi workspace:

```powershell
node trading\scan-markets.mjs --limit=100 --status=open
```

Optional filters:

```powershell
node trading\scan-markets.mjs --series=KXHIGHNY --status=open
node trading\scan-markets.mjs --limit=250 --status=open --min-liquidity=10
```

Outputs:

- `dashboard/watchlist.json`
- `dashboard/watchlist.md`

## Current Scanner Limits

This first scanner is a triage tool, not a probability model. It ranks markets by basic research-worthiness:

- open status
- bid/ask spread
- liquidity if available
- 24h volume if available
- open interest if available
- presence of resolution rules

Next step is a probability-estimation module that looks up external evidence and estimates true odds.
