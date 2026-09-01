import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

process.env.VITE_ENABLE_PRODAMUS_PAYMENTS ||= 'true';

let ycShimConfigured = false;
const configureYcShim = () => {
  if (ycShimConfigured) return;
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  ycShimConfigured = true;
  const githubEnv = process.env.GITHUB_ENV;
  if (!githubEnv) return;
  const bashEnvPath = '/tmp/annword-yc-bash-env.sh';
  const lines = [
    'yc() {',
    '  local real_yc="$HOME/yandex-cloud/bin/yc"',
    '  local args=()',
    '  while [ "$#" -gt 0 ]; do',
    '    case "$1" in',
    '      --force)',
    '        shift',
    '        ;;',
    '      --environment)',
    '        if [ "$#" -ge 2 ] && [[ "$2" == PORT=* ]]; then',
    '          shift 2',
    '        elif [ "$#" -ge 2 ]; then',
    '          args+=("$1" "$2")',
    '          shift 2',
    '        else',
    '          args+=("$1")',
    '          shift',
    '        fi',
    '        ;;',
    '      *)',
    '        args+=("$1")',
    '        shift',
    '        ;;',
    '    esac',
    '  done',
    '  if [ "${args[0]:-} ${args[1]:-} ${args[2]:-} ${args[3]:-}" = "serverless container revision deploy" ]; then',
    '    local has_network="0"',
    '    local item',
    '    for item in "${args[@]}"; do',
    '      if [ "$item" = "--network-id" ] || [ "$item" = "--network-name" ]; then',
    '        has_network="1"',
    '      fi',
    '    done',
    '    if [ "$has_network" = "0" ]; then',
    '      local network_id="${YC_NETWORK_ID:-}"',
    "      if [ -z \"$network_id\" ]; then",
    "        network_id=$(\"$real_yc\" vpc network list --format json 2>/dev/null | grep -m1 '\"id\"' | sed -E 's/.*\"id\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/' || true)",
    '      fi',
    '      if [ -n "$network_id" ]; then',
    '        echo "AnnWord YC shim: attaching container revision to network $network_id"',
    '        args+=("--network-id" "$network_id")',
    '      else',
    '        echo "AnnWord YC shim: no VPC network id found; deploying without network"',
    '      fi',
    '    fi',
    '  fi',
    '  "$real_yc" "${args[@]}"',
    '}',
    '',
  ];
  fs.writeFileSync(bashEnvPath, lines.join('\n'), { mode: 0o644 });
  fs.appendFileSync(githubEnv, `BASH_ENV=${bashEnvPath}\n`);
  console.log('Configured AnnWord YC CLI compatibility shim through BASH_ENV.');
};

const spaFallbackRoutes = [
  'practice',
  'kids',
  'teacher',
  'landing-mix',
  'profile',
  'review',
  'shop',
  'pet',
  'workspace',
  'dictionary',
  'dictionary/edit',
  'premium',
  'premium/success',
  'admin',
  'play/setup',
  'play/classic',
  'play/anagrams',
  'play/one-of-two',
  'play/sprint',
  'play/hangman',
  'play/memory',
  'play/snake',
  'onboarding/mode',
  'onboarding/character',
  'onboarding/family',
];

type StaticHtmlMetadata = {
  title: string;
  canonical: string;
  robots: 'index,follow' | 'noindex,nofollow';
};

const STATIC_PUBLIC_ENTRY_METADATA: Record<string, StaticHtmlMetadata> = {
  practice: {
    title: 'AnnWord Practice — тренировка английских слов',
    canonical: 'https://annword.ru/practice/',
    robots: 'index,follow',
  },
  kids: {
    title: 'AnnWord Kids — школьные английские слова играючи',
    canonical: 'https://annword.ru/kids/',
    robots: 'index,follow',
  },
  teacher: {
    title: 'AnnWord для преподавателей английского',
    canonical: 'https://annword.ru/teacher/',
    robots: 'index,follow',
  },
  'landing-mix': {
    title: 'AnnWord — школьные английские слова играючи',
    canonical: 'https://annword.ru/',
    robots: 'index,follow',
  },
};

const STATIC_PRIVATE_ROUTE_TITLES: Record<string, string> = {
  profile: 'Прогресс и аккаунт — AnnWord',
  review: 'Повторение слов — AnnWord',
  shop: 'Магазин — AnnWord',
  pet: 'Комната питомца — AnnWord',
  workspace: 'Рабочий кабинет — AnnWord',
  dictionary: 'Выбор словаря — AnnWord',
  'dictionary/edit': 'Редактор словаря — AnnWord',
  premium: 'AnnWord Premium',
  'premium/success': 'Premium подключён — AnnWord',
  admin: 'Админ-панель — AnnWord',
  'play/setup': 'Выбор игры и слов — AnnWord',
  'play/classic': 'Классика — AnnWord',
  'play/anagrams': 'Анаграммы — AnnWord',
  'play/one-of-two': '1 из 2 — AnnWord',
  'play/sprint': 'Спринт — AnnWord',
  'play/hangman': 'Виселица — AnnWord',
  'play/memory': 'Память — AnnWord',
  'play/snake': 'Змейка — AnnWord',
  'onboarding/mode': 'Настройка аккаунта — AnnWord',
  'onboarding/character': 'Выбор питомца — AnnWord',
  'onboarding/family': 'Настройка ребёнка — AnnWord',
};

const replaceHeadTag = (html: string, pattern: RegExp, replacement: string): string =>
  pattern.test(html) ? html.replace(pattern, replacement) : html;

export const rewriteStaticHtmlMetadata = (html: string, metadata: StaticHtmlMetadata): string => {
  let next = html;
  next = replaceHeadTag(next, /<title>[^<]*<\/title>/i, `<title>${metadata.title}</title>`);
  next = replaceHeadTag(next, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${metadata.canonical}" />`);
  next = replaceHeadTag(next, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${metadata.title}" />`);
  next = replaceHeadTag(next, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${metadata.canonical}" />`);
  next = replaceHeadTag(next, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${metadata.title}" />`);
  next = replaceHeadTag(next, /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${metadata.robots}" />`);
  return next;
};

export const staticMetadataForRoute = (route: string): StaticHtmlMetadata =>
  STATIC_PUBLIC_ENTRY_METADATA[route] || {
    title: STATIC_PRIVATE_ROUTE_TITLES[route] || 'AnnWord',
    canonical: 'https://annword.ru/',
    robots: 'noindex,nofollow',
  };

const yandexSpaFallbackPlugin = () => ({
  name: 'annword-yandex-spa-fallbacks',
  closeBundle() {
    const outDir = path.resolve(__dirname, 'dist');
    const indexPath = path.join(outDir, 'index.html');
    if (!fs.existsSync(indexPath)) return;
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    fs.writeFileSync(path.join(outDir, '404.html'), rewriteStaticHtmlMetadata(indexHtml, {
      title: 'Страница не найдена — AnnWord',
      canonical: 'https://annword.ru/',
      robots: 'noindex,nofollow',
    }));
    for (const route of spaFallbackRoutes) {
      const routeDir = path.join(outDir, route);
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, 'index.html'), rewriteStaticHtmlMetadata(indexHtml, staticMetadataForRoute(route)));
    }
  },
});

const localApiOrigin = (apiUrl: string): string | null => {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'http:') return null;
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
};

const contentSecurityPolicyPlugin = (apiUrl: string) => {
  const e2eOrigin = localApiOrigin(apiUrl);
  const ocrScriptOrigin = 'https://cdn.jsdelivr.net';
  const ocrLanguageOrigin = 'https://tessdata.projectnaptha.com';
  const metrikaScriptOrigins = ['https://mc.yandex.ru', 'https://mc.yandex.com', 'https://yastatic.net'];
  const metrikaFrameOrigins = ['https://mc.yandex.ru', 'https://mc.webvisor.com', 'https://mc.webvisor.org'];
  const connectSources = ["'self'", 'https:', 'wss:', ocrScriptOrigin, ocrLanguageOrigin, ...(e2eOrigin ? [e2eOrigin] : [])];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' 'wasm-unsafe-eval' ${ocrScriptOrigin} ${metrikaScriptOrigins.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    `worker-src 'self' blob: ${ocrScriptOrigin}`,
    `child-src 'self' blob: ${metrikaFrameOrigins.join(' ')}`,
    'frame-src https: blob:',
    "form-action 'self' https:",
    ...(e2eOrigin ? [] : ['upgrade-insecure-requests']),
  ];
  return {
    name: 'annword-content-security-policy',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: directives.join('; '),
        },
        injectTo: 'head' as const,
      }];
    },
  };
};

const safeChunkName = (filename: string): string => filename
  .replace(/\.(json|ts|tsx)$/i, '')
  .replace(/^premium_/, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const manualChunk = (id: string): string | undefined => {
  const normalized = id.replace(/\\/g, '/');
  if (normalized.includes('/dictionaries/premium/')) {
    return `dictionary-premium-${safeChunkName(path.basename(normalized))}`;
  }
  if (
    normalized.endsWith('/dictionaries/englishBase.ts')
    || normalized.endsWith('/dictionaries/mainEnglish.ts')
    || normalized.endsWith('/dictionaries/english.ts')
  ) return 'dictionary-general';
  if (!normalized.includes('/node_modules/')) return undefined;
  if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/scheduler/')) return 'vendor-react';
  if (normalized.includes('/@supabase/')) return 'vendor-supabase';
  return undefined;
};

export default defineConfig(({ mode }) => {
  configureYcShim();
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), contentSecurityPolicyPlugin(env.VITE_API_URL || ''), yandexSpaFallbackPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: manualChunk,
        },
      },
    },
  };
});
