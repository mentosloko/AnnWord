import http from 'node:http';

const port = Number(process.env.PORT || 4174);
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:4173';
let registeredPayload = null;

const json = (res, status, body, extraHeaders = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-AnnWord-Session',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    ...extraHeaders,
  });
  res.end(payload);
};

const createProfile = (id, email, name) => ({
  id,
  username: name,
  role: 'user',
  accountMode: null,
  subscriptionTier: 'free',
  premiumExpiresAt: undefined,
  featureFlags: {},
  dictionaryCollections: [],
  weeklyReportEmail: null,
  childDisplayName: null,
  childShareCode: null,
  childSlotsLimit: 1,
  customDictionaryEn: [],
  assignedWords: [],
  stats: {
    gamesPlayed: 0,
    gamesWon: 0,
    wordsGuessed: {},
    wordsToReview: {},
    wordPerformance: {},
    wordLearningHistory: {},
  },
  pet: {
    name: 'Щенок',
    type: 'Puppy',
    level: 1,
    mood: 'happy',
    xp: 0,
    moodScore: 60,
    stage: 'stage_1',
    characterOnboarded: false,
    hunger: 60,
    energy: 60,
    equippedAccessories: [],
  },
  coins: 0,
  inventory: [],
  email,
});

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, X-AnnWord-Session',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, { status: 'ok', runtime: 'benchmark-mock' });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/email/account') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const input = raw ? JSON.parse(raw) : {};
      const id = 'benchmark-user-id';
      const email = String(input.email || 'benchmark@yandex.ru');
      const name = String(input.name || 'Production benchmark');
      registeredPayload = {
        access_token: 'benchmark-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        cookie_synced: true,
        user: { id, email, name, passwordResetRequired: false },
        profile: createProfile(id, email, name),
        quest: null,
      };
      json(res, 201, registeredPayload, { 'Server-Timing': 'registration_total;dur=4' });
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/profile/bootstrap') {
    if (!registeredPayload) {
      json(res, 401, { error: 'Unauthorized' }, { 'Server-Timing': 'bootstrap_total;dur=2' });
      return;
    }
    json(res, 200, registeredPayload, { 'Server-Timing': 'bootstrap_total;dur=8' });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/analytics/events') {
    json(res, 200, { accepted: 1 });
    return;
  }

  json(res, 404, { error: 'Not found', path: url.pathname });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`First-load mock API listening on http://127.0.0.1:${port}`);
});
