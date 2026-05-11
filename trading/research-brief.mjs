#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.KALSHI_BASE_URL || 'https://external-api.kalshi.com/trade-api/v2';
const DASHBOARD_DIR = path.resolve('dashboard');
const RESEARCH_DIR = path.join(DASHBOARD_DIR, 'research');
const INDEX_JSON = path.join(DASHBOARD_DIR, 'research-briefs.json');
const INDEX_MD = path.join(DASHBOARD_DIR, 'research-briefs.md');

function arg(name, fallback = '') {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  if (hit === `--${name}`) return 'true';
  return hit.slice(name.length + 3);
}

const TICKER = arg('ticker').toUpperCase();
const NOTES = arg('notes', 'Initial research brief generated from Kalshi public market data.');

function dollarsToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function safeFile(value) {
  return String(value).replace(/[^a-z0-9_.-]/gi, '_');
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchMarket(ticker) {
  const url = `${BASE_URL}/markets/${encodeURIComponent(ticker)}`;
  const data = await fetchJson(url);
  return { url, market: data.market || data };
}

async function fetchEvent(eventTicker) {
  if (!eventTicker) return null;
  try {
    const url = `${BASE_URL}/events/${encodeURIComponent(eventTicker)}`;
    const data = await fetchJson(url);
    return { url, event: data.event || data };
  } catch {
    return null;
  }
}

function buildSearchQueries(market, event) {
  const title = market.title || market.yes_sub_title || market.ticker;
  const eventTitle = event?.title || market.event_ticker || '';
  const rules = market.rules_primary || '';
  return [
    `${title} Kalshi market probability`,
    `${eventTitle} latest news`,
    `${title} stats forecast`,
    `${rules.slice(0, 120)} data source`,
  ].filter(Boolean);
}

function briefMarkdown(brief) {
  return `# Research Brief: ${brief.ticker}\n\nGenerated: ${brief.generatedAt}\n\n## Market\n\n- **Title:** ${brief.title}\n- **Event:** ${brief.eventTicker}\n- **Status:** ${brief.status}\n- **Close:** ${brief.closeTime || 'unknown'}\n- **Kalshi URL:** ${brief.kalshiUrl}\n\n## Prices\n\n- YES bid/ask: ${brief.prices.yesBidCents ?? '?'} / ${brief.prices.yesAskCents ?? '?'} cents\n- NO bid/ask: ${brief.prices.noBidCents ?? '?'} / ${brief.prices.noAskCents ?? '?'} cents\n- Last price: ${brief.prices.lastPriceCents ?? '?'} cents\n- Spread: ${brief.prices.yesSpreadCents ?? '?'} cents\n\n## Resolution Rules\n\n### Primary\n\n${brief.rules.primary || 'No primary rules provided.'}\n\n### Secondary\n\n${brief.rules.secondary || 'No secondary rules provided.'}\n\n## Research Checklist\n\n- [ ] Verify resolution rules and edge cases\n- [ ] Find base rate / historical frequency\n- [ ] Find current news or data source\n- [ ] Estimate true probability\n- [ ] Compare probability to market price\n- [ ] Record pass/watch/paper-trade decision\n\n## Suggested Search Queries\n\n${brief.searchQueries.map(q => `- ${q}`).join('\n')}\n\n## Notes\n\n${brief.notes}\n\n## Next Command\n\n\`node trading\\estimate-market.mjs --ticker=${brief.ticker} --prob=0.55 --confidence=medium --notes="evidence summary"\`\n`;
}

function indexMarkdown(index) {
  const rows = index.items.map(b => `| ${b.generatedAt} | ${b.ticker} | ${String(b.title || '').replaceAll('|', '\\|')} | ${b.status} | ${b.closeTime || ''} |`).join('\n');
  return `# Research Briefs\n\n| Time | Ticker | Title | Status | Close |\n|---|---|---|---|---|\n${rows || '| - | - | No briefs yet | - | - |'}\n`;
}

async function main() {
  if (!TICKER) throw new Error('Usage: node trading\\research-brief.mjs --ticker=<MARKET_TICKER>');
  await fs.mkdir(RESEARCH_DIR, { recursive: true });
  const { url, market } = await fetchMarket(TICKER);
  const eventData = await fetchEvent(market.event_ticker);
  const event = eventData?.event || null;

  const yesBid = dollarsToCents(market.yes_bid_dollars);
  const yesAsk = dollarsToCents(market.yes_ask_dollars);
  const noBid = dollarsToCents(market.no_bid_dollars);
  const noAsk = dollarsToCents(market.no_ask_dollars);
  const brief = {
    generatedAt: new Date().toISOString(),
    ticker: market.ticker || TICKER,
    eventTicker: market.event_ticker || null,
    title: market.title || market.yes_sub_title || TICKER,
    status: market.status || null,
    closeTime: market.close_time || null,
    kalshiUrl: `https://kalshi.com/markets/${String(market.event_ticker || market.ticker).toLowerCase()}`,
    apiUrl: url,
    eventApiUrl: eventData?.url || null,
    prices: {
      yesBidCents: yesBid,
      yesAskCents: yesAsk,
      noBidCents: noBid,
      noAskCents: noAsk,
      lastPriceCents: dollarsToCents(market.last_price_dollars),
      yesSpreadCents: yesBid !== null && yesAsk !== null ? yesAsk - yesBid : null,
    },
    rules: {
      primary: market.rules_primary || '',
      secondary: market.rules_secondary || '',
    },
    searchQueries: buildSearchQueries(market, event),
    notes: NOTES,
  };

  const base = safeFile(brief.ticker);
  const jsonPath = path.join(RESEARCH_DIR, `${base}.json`);
  const mdPath = path.join(RESEARCH_DIR, `${base}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(brief, null, 2) + '\n');
  await fs.writeFile(mdPath, briefMarkdown(brief));

  const index = await readJson(INDEX_JSON, { generatedAt: null, items: [] });
  index.generatedAt = new Date().toISOString();
  index.items = [brief, ...(Array.isArray(index.items) ? index.items.filter(x => x.ticker !== brief.ticker) : [])].slice(0, 100);
  await fs.writeFile(INDEX_JSON, JSON.stringify(index, null, 2) + '\n');
  await fs.writeFile(INDEX_MD, indexMarkdown(index));
  console.log(`Research brief created: ${mdPath}`);
}

main().catch(err => { console.error(err?.stack || err); process.exitCode = 1; });
