// ════════════════════════════════════════════════════════════
//  BANIAKISSA PROXY V5 — Railway Backend
//  © 2025 Baniakissa Corporation · Steve Resnick Baniakissa
// ════════════════════════════════════════════════════════════
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// ── Bot HTML ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BaniakissaV5', v: '5.0', ts: Date.now() });
});

// ── Chat proxy Anthropic avec streaming ──
app.post('/api/chat', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        ...req.body,
        max_tokens: req.body.max_tokens || 1500
      })
    });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Crypto CoinGecko ──
app.get('/crypto/prices', async (req, res) => {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana,cardano,ripple,dogecoin,toncoin,polkadot,chainlink,avalanche-2&vs_currencies=usd,eur&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await r.json();
    res.json({ success: true, data, ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Football — Football-data.org (gratuit illimité) ──
app.get('/football/today', async (req, res) => {
  const key = process.env.FOOTBALL_DATA_KEY || 'c23a893e98a845c28596d198fdba35f5';
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`,
      { headers: { 'X-Auth-Token': key } }
    );
    const data = await r.json();
    res.json({ success: true, data, source: 'football-data.org', ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Football — Sportmonks (analyses avancées) ──
app.get('/football/fixtures', async (req, res) => {
  const key = process.env.SPORTMONKS_KEY;
  if (!key) return res.json({ success: false, noKey: true });
  try {
    const r = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/date/${new Date().toISOString().split('T')[0]}?api_token=${key}&include=scores,statistics,odds`,
    );
    const data = await r.json();
    res.json({ success: true, data, source: 'sportmonks', ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Cotes bookmakers — The Odds API ──
app.get('/football/odds', async (req, res) => {
  const key = process.env.ODDS_API_KEY;
  if (!key) return res.json({ success: false, noKey: true });
  try {
    const r = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${key}&regions=eu&markets=h2h,totals&oddsFormat=decimal`
    );
    const data = await r.json();
    res.json({ success: true, data, ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── MTN Mobile Money Sandbox ──
app.post('/payment/mtn/init', async (req, res) => {
  const { amount, phone, reference } = req.body;
  const key = process.env.MTN_API_KEY;
  if (!key) return res.json({ success: false, message: 'MTN API non configurée' });
  // Sandbox MTN MoMo
  try {
    res.json({
      success: true,
      message: 'Paiement MTN initié',
      reference,
      amount,
      phone,
      status: 'PENDING'
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Baniakissa V5 actif sur port ${PORT}`);
  console.log(`✅ Chat IA · Crypto · Football · Cotes · Paiements`);
});
