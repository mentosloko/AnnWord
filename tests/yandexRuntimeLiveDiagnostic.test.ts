import { describe, it } from 'vitest';

describe('one-time Yandex weekly report diagnostic', () => {
  it('prints the exact live weekly-report runtime response', async () => {
    const response = await fetch('https://api.annword.ru/api/reports/weekly/status');
    const body = await response.text();
    throw new Error(`YANDEX_WEEKLY_RUNTIME_BEGIN\nHTTP ${response.status}\n${body}\nYANDEX_WEEKLY_RUNTIME_END`);
  }, 30_000);
});
