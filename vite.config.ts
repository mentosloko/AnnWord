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
    '  if [ "${args[0]} ${args[1]} ${args[2]} ${args[3]}" = "serverless container revision deploy" ]; then',
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

const yandexSpaFallbackPlugin = () => ({
  name: 'annword-yandex-spa-fallbacks',
  closeBundle() {
    const outDir = path.resolve(__dirname, 'dist');
    const indexPath = path.join(outDir, 'index.html');
    if (!fs.existsSync(indexPath)) return;
    const indexHtml = fs.readFileSync(indexPath);
    fs.writeFileSync(path.join(outDir, '404.html'), indexHtml);
    for (const route of spaFallbackRoutes) {
      const routeDir = path.join(outDir, route);
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);
    }
  },
});

const manualChunk = (id: string): string | undefined => {
  const normalized = id.replace(/\\/g, '/');
  if (normalized.includes('/dictionaries/')) return 'dictionaries';
  if (!normalized.includes('/node_modules/')) return undefined;
  if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/scheduler/')) return 'vendor-react';
  if (normalized.includes('/motion/')) return 'vendor-motion';
  if (normalized.includes('/@supabase/')) return 'vendor-supabase';
  if (normalized.includes('/firebase/')) return 'vendor-firebase';
  return 'vendor';
};

export default defineConfig(({ mode }) => {
  configureYcShim();
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), yandexSpaFallbackPlugin()],
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
