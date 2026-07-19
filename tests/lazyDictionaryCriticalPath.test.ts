import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('lazy dictionary critical path', () => {
  it('keeps dictionary contents behind dynamic imports', () => {
    const runtime = read('services/dictionaryRuntime.ts');
    const catalog = read('services/premiumDictionaryCatalog.ts');
    const pools = read('hooks/useDictionaryPools.ts');
    const engine = read('services/dictionaryEngine.ts');
    const gameSessions = read('services/gameSessionEngine.ts');
    const classicController = read('hooks/useClassicGameController.ts');

    expect(runtime).toContain("import('../dictionaries/mainEnglish')");
    expect(runtime).toContain("import('../dictionaries/premium/premium_business_english.json')");
    expect(catalog).not.toContain('premium_dictionaries.index.json');
    expect(catalog).not.toContain("from '../dictionaries/");
    expect(pools).not.toContain("from '../dictionaries/");
    expect(engine).not.toContain("from '../dictionaries/");
    expect(gameSessions).not.toContain("from '../dictionaries/");
    expect(classicController).not.toContain("from '../dictionaries/");
  });

  it('loads the runtime only on game and setup routes', () => {
    const pools = read('hooks/useDictionaryPools.ts');
    const setup = read('components/screens/SetupScreenSafe.tsx');

    expect(pools).toContain('DICTIONARY_ROUTE_PATTERN');
    expect(pools).toContain('enabled ?? shouldLoadForCurrentRoute()');
    expect(setup).toContain('await dictionaryRuntime.ensureReady()');
    expect(setup).toContain('Загружаю словарь…');
  });
});
