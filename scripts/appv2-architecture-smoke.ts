import { existsSync, readFileSync } from 'node:fs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`AppV2 architecture smoke failed: ${message}`);
};

const read = (path: string) => readFileSync(path, 'utf8');

const indexSource = read('index.tsx');
assert(indexSource.includes("import App from './AppV2'"), 'index.tsx must mount AppV2');
assert(!indexSource.includes("import App from './App'"), 'index.tsx must not mount legacy App.tsx');

const removedLegacyFiles = [
  'App.tsx',
  'components/AppProviders.tsx',
  'components/LegacyAppBridge.tsx',
  'providers/AuthProvider.tsx',
  'providers/ProfileProvider.tsx',
  'providers/NavigationProvider.tsx',
  'utils/navigationBridge.ts',
];

for (const path of removedLegacyFiles) {
  assert(!existsSync(path), `${path} should stay removed after AppV2 migration`);
}

const authProfileSource = read('hooks/useAuthProfile.ts');
assert(
  authProfileSource.includes("../constants/profileDefaults"),
  'useAuthProfile should depend on neutral profile defaults, not legacy ProfileProvider',
);
assert(
  !authProfileSource.includes('../providers/ProfileProvider'),
  'useAuthProfile must not depend on legacy ProfileProvider',
);

console.log(JSON.stringify({ ok: true, checked: 'appv2-architecture' }, null, 2));
