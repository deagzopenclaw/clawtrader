#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.KALSHI_BASE_URL || 'https://external-api.kalshi.com/trade-api/v2';
const DASHBOARD_DIR = path.resolve('dashboard');
const ESTIMATES_JSON = path.join(DASHBOARD_DIR, 'estimates.json');
const ESTIMATES_MD = path.join(DASHBOARD_DIR, 'estimates.md');

function arg(name, fallback = '') {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  if (hit === `--${name}`) return 'true';
  return hit.slice(name.length + 3);
}

const TICKER = arg('ticker').toUpperCase();
const SIDE = arg('side', 'yes').toLowerCase();
const ESTIMATE = arg('prob', arg('estimate', ''));
const CONFIDENCE = arg('confidence', 'low').toLowerCase();
const NOTES = arg('notes', 'Manual estimate placeholder; add evidence before paper trading.');
const ACTION_OVERRIDE = arg('action', '');

function dollarsToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseProbability(value) {
  if (value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid probability: ${value}`);
  if (n > 1) return Math.round(n);
  return Math.round(n * 100);
}

function sidePrice(market, side) {
  if (side === 'no') {
    const noAsk = dollarsToCents(market.no_ask_dollars);
    const noBid = dollarsToCents(market.no_bid_dollars);
    return { bid: noBid, ask: noAsk, mid: noBid !== null && noAsk !== null ? Math.round((noBid + noAsk) / 2) : null };
  }
  const yesAsk = dollarsToCents(market.yes_ask_dollars);
  const yesBid = dollarsToCents(market.yes_bid_dollars);
  return { bid: yesBid, ask: yesAsk, mid: yesBid !== null && yesAsk !== null ? Math.round((yesBid + yesAsk) / 2) : null };
}

function classify(edgeCents, confidence) {
  if (edgeCents === null) return 'needs-estimate';
  if (edgeCents < 3) return 'pass';
  if (edgeCents < 8) return 'watch';
  if (confidence === 'low') return 'watch-evidence-needed';
  if (edgeCents < 15) return 'paper-trade';
  return 'high-priority-review';
}

function safeText(text = '') {
  return String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function fetchMarket(ticker) {
  const url = `${BASE_URL}/markets/${encodeURIComponent(ticker)}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kalshi market request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return { url, market: data.market || data };
}

function toMarkdown(estimates) {
  const rows = estimates.items.map(e => `| ${e.createdAt} | ${e.action} | ${e.ticker} | ${safeText(e.title)} | ${e.side.toUpperCase()} | ${e.marketMidCents ?? '?'} | ${e.estimatedProbCents ?? '?'} | ${e.edgeCents ?? '?'} | ${e.confidence} |`).join('\n');
  return `# Kalshi Probability Estimates\n\nGenerated: ${new Date().toISOString()}\n\nMode: **paper/research only**. No live trading.\n\n| Time | Action | Ticker | Title | Side | Market Mid ¢ | Est. Prob ¢ | Edge ¢ | Confidence |\n|---|---|---|---|---:|---:|---:|---:|---|\n${rows || '| - | - | - | No estimates yet | - | - | - | - | - |'}\n`;
}

async function main() {
  if (!TICKER) throw new Error('Usage: node trading\\estimate-market.mjs --ticker=<MARKET_TICKER> --prob=0.55 --confidence=medium --notes="evidence"');
  await fs.mkdir(DASHBOARD_DIR, { recursive: true });
  const { url, market } = await fetchMarket(TICKER);
  const price = sidePrice(market, SIDE);
  const estimatedProbCents = parseProbability(ESTIMATE);
  const referencePrice = price.mid ?? price.ask ?? price.bid;
  const edgeCents = estimatedProbCents !== null && referencePrice !== null ? estimatedProbCents - referencePrice : null;
  const action = ACTION_OVERRIDE || classify(edgeCents, CONFIDENCE);

  const estimate = {
    createdAt: new Date().toISOString(),
    mode: 'research-paper-only',
    ticker: market.ticker || TICKER,
    eventTicker: market.event_ticker || null,
    title: market.title || market.yes_sub_title || TICKER,
    side: SIDE === 'no' ? 'no' : 'yes',
    marketBidCents: price.bid,
    marketAskCents: price.ask,
    marketMidCents: price.mid,
    estimatedProbCents,
    edgeCents,
    confidence: CONFIDENCE,
    action,
    notes: NOTES,
    closeTime: market.close_time || null,
    rulesPrimary: market.rules_primary || '',
    rulesSecondary: market.rules_secondary || '',
    sourceUrl: url,
    biggestRisk: 'Manual estimate may be wrong; verify evidence and resolution rules before any paper/live trade.'
  };

  const estimates = await readJson(ESTIMATES_JSON, { generatedAt: null, mode: 'research-paper-only', items: [] });
  estimates.generatedAt = new Date().toISOString();
  estimates.items = [estimate, ...(Array.isArray(estimates.items) ? estimates.items : [])].slice(0, 100);
  await fs.writeFile(ESTIMATES_JSON, JSON.stringify(estimates, null, 2) + '\n');
  await fs.writeFile(ESTIMATES_MD, toMarkdown(estimates));
  console.log(`${estimate.action}: ${estimate.ticker} ${estimate.side.toUpperCase()} market=${estimate.marketMidCents ?? '?'}¢ estimate=${estimate.estimatedProbCents ?? '?'}¢ edge=${estimate.edgeCents ?? '?'}¢`);
  console.log(ESTIMATES_MD);
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});
