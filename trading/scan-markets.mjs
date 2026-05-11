#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.KALSHI_BASE_URL || 'https://external-api.kalshi.com/trade-api/v2';
const LIMIT = Number(process.env.KALSHI_SCAN_LIMIT || process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || 100);
const STATUS = process.env.KALSHI_SCAN_STATUS || process.argv.find(a => a.startsWith('--status='))?.split('=')[1] || 'open';
const SERIES = process.env.KALSHI_SERIES || process.argv.find(a => a.startsWith('--series='))?.split('=')[1] || '';
const MIN_LIQUIDITY = Number(process.env.KALSHI_MIN_LIQUIDITY || process.argv.find(a => a.startsWith('--min-liquidity='))?.split('=')[1] || 0);
const OUT_DIR = path.resolve('dashboard');

function dollarsToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function marketUrl(market) {
  if (!market?.ticker) return null;
  return `https://kalshi.com/markets/${String(market.event_ticker || market.ticker).toLowerCase()}`;
}

function summarizeMarket(m) {
  const yesBid = dollarsToCents(m.yes_bid_dollars);
  const yesAsk = dollarsToCents(m.yes_ask_dollars);
  const last = dollarsToCents(m.last_price_dollars);
  const spread = yesBid !== null && yesAsk !== null ? yesAsk - yesBid : null;
  const mid = yesBid !== null && yesAsk !== null ? Math.round((yesBid + yesAsk) / 2) : last;
  const liquidity = numberOrZero(m.liquidity_dollars);
  const volume24h = numberOrZero(m.volume_24h_fp);
  const openInterest = numberOrZero(m.open_interest_fp);

  // This is not an ROI score yet. It is a triage score for markets worth researching.
  let researchScore = 0;
  if (m.status === 'open') researchScore += 20;
  if (spread !== null) researchScore += Math.max(0, 25 - spread * 3);
  if (liquidity > 0) researchScore += Math.min(20, Math.log10(liquidity + 1) * 5);
  if (volume24h > 0) researchScore += Math.min(20, Math.log10(volume24h + 1) * 4);
  if (openInterest > 0) researchScore += Math.min(10, Math.log10(openInterest + 1) * 2);
  if (m.rules_primary) researchScore += 5;
  researchScore = Math.round(researchScore);

  let status = 'research';
  if (spread === null || spread > 12) status = 'skip-wide-spread';
  else if (liquidity < MIN_LIQUIDITY) status = 'skip-low-liquidity';
  else if (researchScore >= 55) status = 'watch-priority';
  else if (researchScore >= 40) status = 'watch';

  return {
    ticker: m.ticker,
    eventTicker: m.event_ticker,
    title: m.title || m.yes_sub_title || m.ticker,
    yesSubTitle: m.yes_sub_title,
    noSubTitle: m.no_sub_title,
    status: m.status,
    closeTime: m.close_time,
    yesBidCents: yesBid,
    yesAskCents: yesAsk,
    lastPriceCents: last,
    midCents: mid,
    spreadCents: spread,
    liquidityDollars: liquidity,
    volume24h,
    openInterest,
    researchScore,
    scannerStatus: status,
    url: marketUrl(m),
    biggestUnknown: 'True probability not estimated yet; requires evidence collection.',
    suggestedNextStep: status.startsWith('watch') ? 'Research probability estimate and resolution rules.' : 'Skip unless Joe specifically asks.'
  };
}

async function fetchMarkets() {
  const url = new URL(`${BASE_URL}/markets`);
  url.searchParams.set('limit', String(Math.min(Math.max(LIMIT, 1), 1000)));
  if (STATUS) url.searchParams.set('status', STATUS);
  if (SERIES) url.searchParams.set('series_ticker', SERIES);
  url.searchParams.set('mve_filter', 'exclude');

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kalshi markets request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return { url: url.toString(), markets: Array.isArray(data.markets) ? data.markets : [], cursor: data.cursor || '' };
}

function toMarkdown(report) {
  const rows = report.markets.slice(0, 25).map(m => {
    return `| ${m.scannerStatus} | ${m.researchScore} | ${m.ticker} | ${m.title?.replaceAll('|', '\\|') || ''} | ${m.yesBidCents ?? '?'} / ${m.yesAskCents ?? '?'} | ${m.spreadCents ?? '?'} | ${m.liquidityDollars.toFixed(2)} | ${m.closeTime || ''} |`;
  }).join('\n');

  return `# Kalshi Watchlist\n\nGenerated: ${report.generatedAt}\n\nMode: **read-only scanner**. This is not financial advice and not a trade command.\n\nSource: ${report.sourceUrl}\n\n## Top Markets\n\n| Status | Score | Ticker | Title | Bid/Ask ¢ | Spread ¢ | Liquidity $ | Close |\n|---|---:|---|---|---:|---:|---:|---|\n${rows || '| - | - | - | No markets found | - | - | - | - |'}\n\n## Next Step\n\nFor any \`watch-priority\` market, Kalshi Scout should estimate true probability from evidence, compare against market price, and record a paper trade only if edge clears the risk policy.\n`;
}

async function main() {
  const fetched = await fetchMarkets();
  const markets = fetched.markets
    .map(summarizeMarket)
    .sort((a, b) => b.researchScore - a.researchScore);

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'kalshi-public-api',
    sourceUrl: fetched.url,
    mode: 'read-only',
    filters: { status: STATUS, limit: LIMIT, series: SERIES || null, minLiquidity: MIN_LIQUIDITY },
    counts: {
      fetched: fetched.markets.length,
      watchPriority: markets.filter(m => m.scannerStatus === 'watch-priority').length,
      watch: markets.filter(m => m.scannerStatus === 'watch').length,
      skipped: markets.filter(m => m.scannerStatus.startsWith('skip')).length
    },
    markets
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'watchlist.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(OUT_DIR, 'watchlist.md'), toMarkdown(report));
  console.log(`Scanned ${report.counts.fetched} markets. watch-priority=${report.counts.watchPriority}, watch=${report.counts.watch}`);
  console.log(path.join(OUT_DIR, 'watchlist.md'));
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});
