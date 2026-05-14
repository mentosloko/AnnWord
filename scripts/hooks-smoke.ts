import { useAuthProfile } from '../hooks/useAuthProfile';
import { useClassicGameController } from '../hooks/useClassicGameController';
import { useDictionaryPools } from '../hooks/useDictionaryPools';
import { useProfileEconomy } from '../hooks/useProfileEconomy';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Hooks smoke test failed: ${message}`);
};

assert(typeof useAuthProfile === 'function', 'useAuthProfile must be importable');
assert(typeof useClassicGameController === 'function', 'useClassicGameController must be importable');
assert(typeof useDictionaryPools === 'function', 'useDictionaryPools must be importable');
assert(typeof useProfileEconomy === 'function', 'useProfileEconomy must be importable');

console.log(JSON.stringify({ ok: true, checked: 'hooks' }, null, 2));
