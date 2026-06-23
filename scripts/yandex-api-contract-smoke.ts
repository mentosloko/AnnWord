const url = process.env.API_URL || process.env.YC_API_PUBLIC_URL;

if (!url) {
  console.log('skip yandex api contract smoke');
  process.exit(0);
}

const base = url.replace(/\/+$/, '');
const response = await fetch(`${base}/api/health`);
if (!response.ok) {
  throw new Error(`health endpoint returned ${response.status}`);
}

const payload = await response.json() as { status?: string };
if (payload.status !== 'ok') {
  throw new Error('unexpected health response');
}

console.log('Yandex API contract smoke passed.');
