# Kalshi API Notes

## Public Market Data

Base URL:

```text
https://external-api.kalshi.com/trade-api/v2
```

Public endpoints can be used without authentication for market data.

## Useful Endpoints

```text
GET /markets?status=open&limit=100
GET /markets?series_ticker=<SERIES>&status=open
GET /markets/<ticker>
GET /markets/<ticker>/orderbook
GET /events/<event_ticker>
```

## Market Fields to Use First

- `ticker`
- `event_ticker`
- `title`
- `yes_sub_title`
- `no_sub_title`
- `status`
- `close_time`
- `yes_bid_dollars`
- `yes_ask_dollars`
- `no_bid_dollars`
- `no_ask_dollars`
- `last_price_dollars`
- `volume_fp`
- `volume_24h_fp`
- `liquidity_dollars`
- `open_interest_fp`
- `rules_primary`
- `rules_secondary`

## Authenticated Trading Later

Kalshi trading/auth uses API key id + RSA-PSS request signing. Do not wire order placement until Joe approves risk limits and live trading mode.
