#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dashboard');
const OUT = path.join(ROOT, 'index.html');

async function readJson(name, fallback) {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, name), 'utf8')); }
  catch { return fallback; }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtCents(v) { return v === null || v === undefined ? '-' : `${v}c`; }
function fmtDate(v) { return v ? new Date(v).toLocaleString() : '-'; }
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

function marketRows(markets = []) {
  return markets.slice(0, 30).map((m, i) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td><span class="pill ${esc(m.scannerStatus)}">${esc(m.scannerStatus)}</span></td>
      <td class="num score">${esc(m.researchScore)}</td>
      <td><a href="${esc(m.url)}" target="_blank" rel="noreferrer">${esc(m.ticker)}</a><div class="tiny">${esc(m.eventTicker || '')}</div></td>
      <td>${esc(m.title)}</td>
      <td class="num">${fmtCents(m.yesBidCents)} / ${fmtCents(m.yesAskCents)}</td>
      <td class="num">${fmtCents(m.spreadCents)}</td>
      <td class="num">$${Number(m.liquidityDollars || 0).toFixed(2)}</td>
      <td>${fmtDate(m.closeTime)}</td>
    </tr>`).join('');
}

function estimateRows(items = []) {
  return items.slice(0, 20).map(e => `
    <tr>
      <td><span class="pill ${esc(e.action)}">${esc(e.action)}</span></td>
      <td>${esc(e.ticker)}</td>
      <td>${esc(e.title)}</td>
      <td class="num">${esc(String(e.side || '').toUpperCase())}</td>
      <td class="num">${fmtCents(e.marketMidCents)}</td>
      <td class="num">${fmtCents(e.estimatedProbCents)}</td>
      <td class="num ${Number(e.edgeCents || 0) >= 8 ? 'good' : Number(e.edgeCents || 0) < 0 ? 'bad' : ''}">${fmtCents(e.edgeCents)}</td>
      <td>${esc(e.confidence)}</td>
      <td>${esc(e.notes)}</td>
    </tr>`).join('');
}

async function main() {
  const watchlist = await readJson('watchlist.json', { counts: {}, markets: [] });
  const estimates = await readJson('estimates.json', { items: [] });
  const state = await readJson('state.json', {});
  const markets = watchlist.markets || [];
  const priority = markets.filter(m => m.scannerStatus === 'watch-priority').length;
  const watch = markets.filter(m => m.scannerStatus === 'watch').length;
  const research = markets.filter(m => m.scannerStatus === 'research').length;
  const skipped = markets.filter(m => String(m.scannerStatus || '').startsWith('skip')).length;
  const paper = (estimates.items || []).filter(e => ['paper-trade', 'high-priority-review'].includes(e.action)).length;
  const fetched = Number(watchlist.counts?.fetched || markets.length || 0);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kalshi Scout Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#06080d; --panel:#101722; --panel2:#0c111b; --line:#223044;
      --text:#edf4ff; --muted:#8fa1b8; --faint:#62748b;
      --good:#39d98a; --warn:#ffd166; --bad:#ff5c7a; --blue:#63b3ff; --purple:#b794f4;
      --shadow: 0 20px 60px rgba(0,0,0,.35);
    }
    * { box-sizing: border-box; }
    body {
      margin:0; font-family: Inter, Segoe UI, Arial, sans-serif; color:var(--text);
      background:
        radial-gradient(circle at 12% -10%, rgba(99,179,255,.28), transparent 28%),
        radial-gradient(circle at 85% 0%, rgba(183,148,244,.22), transparent 24%),
        linear-gradient(180deg, #07101d 0%, var(--bg) 44%, #05070b 100%);
      min-height:100vh;
    }
    header { padding:30px 34px 16px; }
    .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
    h1 { margin:0; font-size:38px; letter-spacing:-.055em; line-height:1; }
    .sub { color:var(--muted); margin-top:10px; font-size:15px; }
    .badge { border:1px solid rgba(57,217,138,.35); color:var(--good); background:rgba(57,217,138,.1); padding:8px 12px; border-radius:999px; font-weight:700; white-space:nowrap; }
    .grid { display:grid; gap:16px; padding:10px 34px 34px; grid-template-columns: repeat(12, 1fr); }
    .card {
      background:linear-gradient(180deg, rgba(16,23,34,.94), rgba(12,17,27,.94));
      border:1px solid rgba(143,161,184,.18); border-radius:20px; padding:18px;
      box-shadow:var(--shadow); overflow:auto; backdrop-filter: blur(10px);
    }
    .span3 { grid-column:span 3; } .span4 { grid-column:span 4; } .span8 { grid-column:span 8; } .span12 { grid-column:span 12; }
    .metric { font-size:34px; font-weight:850; letter-spacing:-.05em; }
    .metric.good { color:var(--good); } .metric.warn { color:var(--warn); }
    .label { color:var(--muted); font-size:13px; margin-top:4px; }
    h2 { margin:0 0 14px; font-size:18px; letter-spacing:-.02em; }
    p { line-height:1.45; }
    .status-list { display:grid; gap:10px; }
    .status-row { display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(143,161,184,.12); padding-bottom:9px; }
    .status-row span:first-child { color:var(--muted); }
    .bar { height:10px; background:#07101d; border:1px solid var(--line); border-radius:999px; overflow:hidden; margin-top:10px; }
    .bar > div { height:100%; background:linear-gradient(90deg, var(--blue), var(--purple)); border-radius:999px; }
    table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
    th,td { padding:11px 9px; border-bottom:1px solid rgba(143,161,184,.12); vertical-align:top; }
    th { color:var(--muted); text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    tr:hover td { background:rgba(99,179,255,.045); }
    .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .rank { color:var(--faint); width:34px; }
    .score { color:var(--blue); font-weight:800; }
    a { color:var(--blue); text-decoration:none; font-weight:650; }
    a:hover { text-decoration:underline; }
    .tiny { color:var(--faint); font-size:11px; margin-top:3px; }
    .pill { display:inline-block; padding:4px 9px; border-radius:999px; background:#1b2433; font-size:12px; white-space:nowrap; font-weight:700; }
    .watch-priority,.high-priority-review { background:rgba(57,217,138,.14); color:var(--good); border:1px solid rgba(57,217,138,.22); }
    .watch,.paper-trade { background:rgba(255,209,102,.13); color:var(--warn); border:1px solid rgba(255,209,102,.22); }
    .skip-wide-spread,.skip-low-liquidity,.pass { background:rgba(255,92,122,.12); color:var(--bad); border:1px solid rgba(255,92,122,.2); }
    .research { background:rgba(99,179,255,.12); color:var(--blue); border:1px solid rgba(99,179,255,.2); }
    .good { color:var(--good); } .bad { color:var(--bad); } .muted { color:var(--muted); }
    code { background:#07101d; border:1px solid var(--line); border-radius:8px; padding:2px 6px; color:#c8e1ff; }
    .footer-note { color:var(--faint); font-size:12px; padding:0 34px 28px; }
    @media (max-width: 1000px) { .span3,.span4,.span8,.span12 { grid-column:span 12; } .grid, header { padding-left:14px; padding-right:14px; } .hero { flex-direction:column; } h1 { font-size:32px; } }
  </style>
</head>
<body>
<header>
  <div class="hero">
    <div>
      <h1>Kalshi Scout</h1>
      <div class="sub">Prediction-market research, paper trading, and learning dashboard.</div>
    </div>
    <div class="badge">LIVE TRADING DISABLED</div>
  </div>
</header>
<main class="grid">
  <section class="card span3"><div class="metric">${esc(state.model || 'gpt-5.5')}</div><div class="label">Active model</div></section>
  <section class="card span3"><div class="metric">${fetched}</div><div class="label">Markets scanned</div></section>
  <section class="card span3"><div class="metric ${priority + watch ? 'warn' : ''}">${priority + watch}</div><div class="label">Watch candidates</div></section>
  <section class="card span3"><div class="metric ${paper ? 'good' : ''}">${paper}</div><div class="label">Paper/high-priority estimates</div></section>

  <section class="card span4">
    <h2>System Status</h2>
    <div class="status-list">
      <div class="status-row"><span>Mode</span><b>${esc(state.mode || 'research-and-paper-trading')}</b></div>
      <div class="status-row"><span>Live trading</span><span class="pill pass">${state.liveTradingEnabled ? 'enabled' : 'disabled'}</span></div>
      <div class="status-row"><span>Last scan</span><b>${fmtDate(state.lastScanAt || watchlist.generatedAt)}</b></div>
      <div class="status-row"><span>Research bucket</span><b>${research} markets</b></div>
      <div class="status-row"><span>Skipped</span><b>${skipped} markets</b></div>
    </div>
    <div class="bar"><div style="width:${Math.max(4, pct(research + watch + priority, fetched))}%"></div></div>
    <p class="muted">Next: choose a market and run <code>node trading\\estimate-market.mjs --ticker=TICKER --prob=0.55</code></p>
  </section>

  <section class="card span8">
    <h2>Latest Probability Estimates</h2>
    <table><thead><tr><th>Action</th><th>Ticker</th><th>Title</th><th>Side</th><th>Market</th><th>Est.</th><th>Edge</th><th>Conf.</th><th>Notes</th></tr></thead><tbody>
      ${estimateRows(estimates.items) || '<tr><td colspan="9" class="muted">No estimates yet.</td></tr>'}
    </tbody></table>
  </section>

  <section class="card span12">
    <h2>Market Watchlist</h2>
    <table><thead><tr><th>#</th><th>Status</th><th>Score</th><th>Ticker</th><th>Title</th><th>Bid/Ask</th><th>Spread</th><th>Liquidity</th><th>Close</th></tr></thead><tbody>
      ${marketRows(markets) || '<tr><td colspan="9" class="muted">No markets scanned yet.</td></tr>'}
    </tbody></table>
  </section>
</main>
<div class="footer-note">Kalshi Scout is currently research-only. Nothing here is financial advice or a live trade instruction.</div>
</body>
</html>`;

  await fs.writeFile(OUT, html, 'utf8');
  console.log(OUT);
}

main().catch(err => { console.error(err?.stack || err); process.exitCode = 1; });
