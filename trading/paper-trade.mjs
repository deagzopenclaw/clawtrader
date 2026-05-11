#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DASHBOARD_DIR = path.resolve('dashboard');
const TRADES_JSON = path.join(DASHBOARD_DIR, 'paper-trades.json');
const TRADES_MD = path.join(DASHBOARD_DIR, 'paper-trades.md');
const LEDGER_MD = path.resolve('trading', 'ledger.md');

function arg(name, fallback = '') {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  if (hit === `--${name}`) return 'true';
  return hit.slice(name.length + 3);
}

function num(name, fallback = null) {
  const v = arg(name, '');
  if (v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid --${name}: ${v}`);
  return n;
}

function safeText(text = '') {
  return String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

function toMarkdown(book) {
  const rows = book.trades.map(t => `| ${t.createdAt} | ${t.status} | ${t.ticker} | ${t.side.toUpperCase()} | ${t.entryPriceCents} | ${t.estimatedProbCents ?? ''} | ${t.edgeCents ?? ''} | ${t.paperStakeDollars.toFixed(2)} | ${safeText(t.thesis)} | ${t.result ?? ''} |`).join('\n');
  return `# Paper Trades\n\nMode: research/paper only. No live trading.\n\n| Time | Status | Ticker | Side | Entry ¢ | Est. ¢ | Edge ¢ | Stake $ | Thesis | Result |\n|---|---|---|---:|---:|---:|---:|---:|---|---|\n${rows || '| - | - | - | - | - | - | - | - | No paper trades yet | - |'}\n`;
}

async function main() {
  const ticker = arg('ticker').toUpperCase();
  const side = arg('side', 'yes').toLowerCase();
  const entryPriceCents = num('price');
  const estimatedProbCents = num('prob');
  const paperStakeDollars = num('stake', 10);
  const confidence = arg('confidence', 'medium');
  const thesis = arg('thesis', arg('notes', 'Paper trade thesis not provided.'));
  const source = arg('source', 'manual');

  if (!ticker || entryPriceCents === null) {
    throw new Error('Usage: node trading\\paper-trade.mjs --ticker=TICKER --side=yes --price=42 --prob=55 --stake=10 --thesis="why"');
  }
  if (!['yes', 'no'].includes(side)) throw new Error('--side must be yes or no');
  if (entryPriceCents < 1 || entryPriceCents > 99) throw new Error('--price must be 1-99 cents');
  if (estimatedProbCents !== null && (estimatedProbCents < 0 || estimatedProbCents > 100)) throw new Error('--prob must be 0-100');

  await fs.mkdir(DASHBOARD_DIR, { recursive: true });
  const edgeCents = estimatedProbCents === null ? null : estimatedProbCents - entryPriceCents;
  const trade = {
    id: `${Date.now()}-${ticker}`,
    createdAt: new Date().toISOString(),
    mode: 'paper',
    status: 'open',
    ticker,
    side,
    entryPriceCents,
    estimatedProbCents,
    edgeCents,
    paperStakeDollars,
    confidence,
    thesis,
    source,
    result: null,
    lesson: null,
  };

  const book = await readJson(TRADES_JSON, { generatedAt: null, trades: [] });
  book.generatedAt = new Date().toISOString();
  book.trades = [trade, ...(Array.isArray(book.trades) ? book.trades : [])].slice(0, 250);
  await fs.writeFile(TRADES_JSON, JSON.stringify(book, null, 2) + '\n');
  await fs.writeFile(TRADES_MD, toMarkdown(book));

  const ledgerLine = `| ${trade.createdAt} | ${trade.ticker} | ${trade.side.toUpperCase()} | paper-open | ${trade.entryPriceCents} | ${trade.estimatedProbCents ?? ''} | ${trade.edgeCents ?? ''} | ${trade.paperStakeDollars.toFixed(2)} | open | ${safeText(trade.thesis)} |\n`;
  try { await fs.appendFile(LEDGER_MD, ledgerLine); } catch {}

  console.log(`paper-open: ${trade.ticker} ${trade.side.toUpperCase()} price=${trade.entryPriceCents}c est=${trade.estimatedProbCents ?? '?'}c edge=${trade.edgeCents ?? '?'}c stake=$${trade.paperStakeDollars.toFixed(2)}`);
}

main().catch(err => { console.error(err?.stack || err); process.exitCode = 1; });
