const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ══ CONFIG — clés via variables d'environnement UNIQUEMENT ══
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const TWELVE_KEY = process.env.TWELVE_API_KEY;
const ADMIN_PIN = process.env.ADMIN_PIN || '2408';

if (!ANTHROPIC_KEY) {
  console.error('❌ ANTHROPIC_API_KEY manquante ! Vérifiez votre fichier .env ou variables d\'environnement.');
  process.exit(1);
}

// ══ ALGORITHME DE POISSON ══
function poisson(lambda, k) {
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) result *= lambda / i;
  return result;
}

function predictScore(xgHome, xgAway) {
  let bestScore = [0, 0];
  let bestProb = 0;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const prob = poisson(xgHome, i) * poisson(xgAway, j);
      if (prob > bestProb) { bestProb = prob; bestScore = [i, j]; }
    }
  }
  return { score: bestScore, prob: bestProb };
}

function calcProbabilities(xgHome, xgAway) {
  let homeWin = 0, draw = 0, awayWin = 0, btts = 0, over25 = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = poisson(xgHome, i) * poisson(xgAway, j);
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
      if (i > 0 && j > 0) btts += p;
      if (i + j > 2) over25 += p;
    }
  }
  return {
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(draw * 100),
    awayWin: Math.round(awayWin * 100),
    btts: Math.round(btts * 100),
    over25: Math.round(over25 * 100)
  };
}

// ══ BASE DE DONNÉES MATCHS ══
function getTodayMatches() {
  const matches = [
    { league: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', home: 'Arsenal', away: 'Chelsea', xgHome: 2.1, xgAway: 0.9 },
    { league: '🇫🇷 Ligue 1', home: 'PSG', away: 'Marseille', xgHome: 2.8, xgAway: 0.7 },
    { league: '🇪🇸 La Liga', home: 'Real Madrid', away: 'Barcelona', xgHome: 1.6, xgAway: 1.5 },
    { league: '🇩🇪 Bundesliga', home: 'Bayern Munich', away: 'Dortmund', xgHome: 2.4, xgAway: 1.1 },
    { league: '🌍 CAF Champions League', home: 'Al Ahly', away: 'Wydad', xgHome: 1.8, xgAway: 0.8 },
    { league: '🇮🇹 Serie A', home: 'Inter Milan', away: 'Juventus', xgHome: 1.7, xgAway: 1.2 },
    { league: '🌍 CHAN Afrique', home: 'Congo 🇨🇬', away: 'RDC 🇨🇩', xgHome: 1.2, xgAway: 1.0 },
  ];

  return matches.map(m => {
    const pred = predictScore(m.xgHome, m.xgAway);
    const probs = calcProbabilities(m.xgHome, m.xgAway);
    const score = pred.score;

    let analysis = '';
    if (probs.homeWin > 55) analysis = `${m.home} favori solide à domicile. `;
    else if (probs.awayWin > 45) analysis = `${m.away} en forme, attention à la surprise. `;
    else analysis = `Match très équilibré, résultat incertain. `;
    if (probs.over25 > 60) analysis += `Over 2.5 probable (${probs.over25}%). `;
    if (probs.btts > 55) analysis += `BTTS (${probs.btts}%). `;

    let valueBet = '';
    if (probs.homeWin > 60) valueBet = `🎯 Value Bet: ${m.home} gagne`;
    else if (probs.awayWin > 50) valueBet = `🎯 Value Bet: ${m.away} gagne`;
    else if (probs.draw > 30) valueBet = `🎯 Value Bet: Nul ou BTTS`;
    else valueBet = `🎯 Value Bet: Over 2.5 buts`;

    return {
      league: m.league,
      home: m.home,
      away: m.away,
      predictedScore: `${score[0]}-${score[1]}`,
      xgHome: m.xgHome,
      xgAway: m.xgAway,
      homeWin: probs.homeWin,
      draw: probs.draw,
      awayWin: probs.awayWin,
      btts: probs.btts,
      over25: probs.over25,
      analysis,
      valueBet,
      confidence: Math.round((Math.max(probs.homeWin, probs.awayWin) / 100) * 85 + 15)
    };
  });
}

// ══ ROUTE: CHAT IA ══
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, lang = 'fr' } = req.body;

    let cryptoContext = '';
    try {
      const cRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron&vs_currencies=usd&include_24hr_change=true');
      const cData = await cRes.json();
      cryptoContext = `BTC: $${cData.bitcoin?.usd?.toLocaleString()} (${cData.bitcoin?.usd_24h_change?.toFixed(2)}%), ETH: $${cData.ethereum?.usd?.toLocaleString()}, TRX: $${cData.tron?.usd}`;
    } catch(e) { cryptoContext = 'Données crypto temporairement indisponibles.'; }

    const systemPrompt = `Tu es BANI-AI WORLD V2 ULTRA, l'agent IA #1 mondial de Baniakissa Corporation, créé par Steve Resnick Baniakissa, entrepreneur digital basé à Brazzaville, Congo 🇨🇬.

LANGUE: Réponds en ${lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : lang === 'ln' ? 'lingala' : lang === 'ar' ? 'arabe' : 'français'}. Adapte-toi toujours à la langue du message reçu.

DONNÉES CRYPTO EN DIRECT: ${cryptoContext}

TU ES EXPERT EN:
- Crypto/Trading/DeFi/Yield Farming (Bitcoin, Ethereum, Altcoins, signaux)
- Football/Paris sportifs (analyses statistiques, Poisson, xG, value bets)
- Coaching amour & relations amoureuses (empathie, conseils pratiques)
- Développement personnel & mindset de millionnaire
- Business en Afrique & entrepreneuriat digital
- Forex, Or (XAU/USD), indices boursiers

OFFRES VIP:
- Starter: 5 000 FCFA (~8$)
- Bronze: 15 000 FCFA (~24$)
- Silver: 30 000 FCFA (~48$)
- Gold: 50 000 FCFA (~81$)
- Platinum: 100 000 FCFA (~162$)
- Elite: 200 000 FCFA (~325$)

PAIEMENTS RÉELS:
- ❤️ Airtel Money Congo: *128# → +242 056 614 112
- 💛 MTN MoMo Congo: *105# → +242 068 805 017
- 🔷 USDT TRC20: TAuPSLyuwSmEkd6c5S4YEvUydyNLwmxtLg
- 🔶 USDT BEP20: 0x0a3f2c66FE523108bc3AaE7966B0574407aEC500
- 💬 WhatsApp Steve: +242 068 805 017

INSTRUCTIONS:
- Sois chaleureux, dynamique, motivant, professionnel
- Utilise des emojis pour dynamiser
- Donne des réponses précises et actionables
- Pour crypto: analyses RSI, MACD, tendances réalistes
- Pour football: probabilités mathématiques Poisson + xG
- Pour coaching: conseils pratiques et empathiques
- Encourage toujours à contacter Steve sur WhatsApp ou passer VIP
- © Baniakissa Corporation · Steve Resnick Baniakissa`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.slice(-10)
      })
    });

    const data = await response.json();
    if (data.content && data.content[0]) {
      res.json({ success: true, reply: data.content[0].text });
    } else {
      res.json({ success: false, error: data.error?.message || 'Erreur API' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══ ROUTE: FOOTBALL ══
app.get('/api/football', (req, res) => {
  try {
    res.json({ success: true, matches: getTodayMatches() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══ ROUTE: CRYPTO LIVE ══
app.get('/api/crypto', async (req, res) => {
  try {
    const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,cardano,tron,dogecoin';
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`);
    const data = await response.json();
    res.json({ success: true, coins: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══ ROUTE: FOREX + OR ══
app.get('/api/forex', async (req, res) => {
  try {
    if (!TWELVE_KEY) return res.json({ success: false, error: 'TWELVE_API_KEY manquante' });
    const symbols = 'EUR/USD,GBP/USD,XAU/USD,USD/JPY,USD/XAF';
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbols}&apikey=${TWELVE_KEY}`);
    const data = await response.json();

    const pairs = [
      { symbol: 'EUR/USD', name: 'Euro / Dollar', ico: '💶', type: 'forex' },
      { symbol: 'GBP/USD', name: 'Livre / Dollar', ico: '💷', type: 'forex' },
      { symbol: 'XAU/USD', name: 'Or / Dollar', ico: '🥇', type: 'commodity' },
      { symbol: 'USD/JPY', name: 'Dollar / Yen', ico: '🇯🇵', type: 'forex' },
      { symbol: 'USD/XAF', name: 'Dollar / FCFA', ico: '🇨🇬', type: 'forex' },
    ];

    const forexData = [];
    pairs.forEach(p => {
      const price = parseFloat(data[p.symbol]?.price || 0);
      if (price > 0) {
        let signal = 'HOLD', analysis = '';
        if (p.symbol === 'XAU/USD') {
          if (price > 2300) { signal = 'SELL'; analysis = 'Or suracheté. Résistance forte.'; }
          else if (price < 2000) { signal = 'BUY'; analysis = 'Or en zone de support. Accumulation recommandée.'; }
          else { signal = 'HOLD'; analysis = 'Or en range. Surveiller cassure des 2300$.'; }
        } else if (p.symbol === 'EUR/USD') {
          if (price > 1.10) { signal = 'SELL'; analysis = 'EUR/USD résistance 1.10. Short possible.'; }
          else if (price < 1.05) { signal = 'BUY'; analysis = 'EUR/USD support fort. Long recommandé.'; }
          else { signal = 'HOLD'; analysis = 'Range neutre. Attendre signal clair.'; }
        } else if (p.symbol === 'GBP/USD') {
          signal = price > 1.28 ? 'SELL' : price < 1.22 ? 'BUY' : 'HOLD';
          analysis = `GBP/USD à ${price.toFixed(4)}. ${signal === 'BUY' ? 'Zone achat.' : signal === 'SELL' ? 'Zone vente.' : 'Neutre.'}`;
        } else {
          analysis = `${p.name} — Surveiller les niveaux clés.`;
        }
        forexData.push({
          symbol: p.symbol, name: p.name, ico: p.ico,
          price: price.toFixed(p.symbol.includes('JPY') ? 2 : p.symbol.includes('XAF') ? 0 : 4),
          signal, analysis, type: p.type
        });
      }
    });
    res.json({ success: true, forex: forexData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══ ROUTE: ADMIN PIN ══
app.post('/api/admin/verify', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true, token: Buffer.from(`admin_${Date.now()}`).toString('base64') });
  } else {
    res.json({ success: false, error: 'PIN incorrect' });
  }
});

// ══ ROUTE: VIP CODES ══
app.post('/api/vip/verify', (req, res) => {
  const { code } = req.body;
  const vipCodes = {
    'STARTER2025': 'starter',
    'BRONZE2025': 'bronze',
    'SILVER2025': 'silver',
    'GOLD2025': 'gold',
    'PLAT2025': 'platinum',
    'ELITE2025': 'elite',
  };
  const level = vipCodes[code?.toUpperCase()];
  if (level) {
    res.json({ success: true, level });
  } else {
    res.json({ success: false, error: 'Code VIP invalide' });
  }
});

// ══ HEALTH CHECK ══
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BANI-AI WORLD V2 ULTRA', time: new Date().toISOString() });
});

// ══ PORT ══
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Baniakissa Corporation V2 ULTRA actif sur port ${PORT}`);
  console.log(`✅ Chat IA · Crypto Live · Football Poisson · Forex/Or · VIP System`);
  console.log(`🌍 Steve Resnick Baniakissa · Brazzaville, Congo 🇨🇬`);
});
