// ════════════════════════════════════════════════════════════
//  BANIAKISSA PROXY + BOT SERVER — Railway
//  © 2025 Baniakissa Corporation · Steve Resnick Baniakissa
//  Sert le bot HTML + proxy Anthropic API
// ════════════════════════════════════════════════════════════
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── Sert le fichier index.html (le bot) ──
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BaniakissaProxy', v: '4.0', ts: Date.now() });
});

// ── Chat proxy Anthropic ──
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
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Crypto prix CoinGecko ──
app.get('/crypto/prices', async (req, res) => {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana,cardano,ripple,dogecoin,toncoin,polkadot&vs_currencies=usd&include_24hr_change=true&include_market_cap=true',
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await r.json();
    res.json({ success: true, data, ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Football today ──
app.get('/football/today', async (req, res) => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return res.json({ success: false, noKey: true });
  const today = new Date().toISOString().split('T')[0];
  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'v3.football.api-sports.io' }
    });
    res.json({ success: true, data: await r.json(), ts: Date.now() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Baniakissa Bot + Proxy actif sur port ${PORT}`);
  console.log(`🌍 Bot accessible sur https://steve1-production.up.railway.app`);
  console.log(`✅ POST /api/chat`);
  console.log(`✅ GET  /crypto/prices`);
  console.log(`✅ GET  /football/today`);
  console.log(`✅ GET  /health`);
});
