import fs from 'node:fs';
import path from 'node:path';

const DICTIONARY_DIR = path.resolve(process.cwd(), 'dictionaries/premium');
const INDEX_FILE = 'premium_dictionaries.index.json';
const WORD_PATTERN = /^[A-Z]{4,6}$/;
const MIN_TOTAL = 300;
const MIN_BY_LENGTH: Record<number, number> = { 4: 70, 5: 100, 6: 100 };
const FORBIDDEN_ABBREVIATIONS = new Set([
  'API', 'CSS', 'HTML', 'SQL', 'URL', 'VPN', 'CPU', 'GPU',
  'USD', 'EUR', 'ETF', 'IPO', 'KYC', 'AML', 'APR', 'ROI',
  'IGE', 'IGG', 'ECG', 'COPD', 'NSAID', 'SARS', 'HIV', 'AIDS',
]);

type PremiumDictionary = {
  title?: unknown;
  source?: unknown;
  theme?: unknown;
  words?: unknown;
};

const fail = (message: string): never => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

if (!fs.existsSync(DICTIONARY_DIR)) {
  fail(`Directory not found: ${DICTIONARY_DIR}`);
}

const files = fs.readdirSync(DICTIONARY_DIR)
  .filter(file => file.endsWith('.json') && file !== INDEX_FILE)
  .sort();

if (!files.length) {
  fail('No premium dictionary JSON files found.');
}

for (const file of files) {
  const dictionary = readJson<PremiumDictionary>(path.join(DICTIONARY_DIR, file));
  if (typeof dictionary.title !== 'string' || !dictionary.title.trim()) fail(`${file}: missing title`);
  if (dictionary.source !== 'topic') fail(`${file}: source must be "topic"`);
  if (typeof dictionary.theme !== 'string' || !dictionary.theme.trim()) fail(`${file}: missing theme`);
  if (!Array.isArray(dictionary.words)) fail(`${file}: words must be an array`);

  const words = dictionary.words;
  const seen = new Set<string>();
  const byLength: Record<number, number> = { 4: 0, 5: 0, 6: 0 };

  for (const word of words) {
    if (typeof word !== 'string') fail(`${file}: every word must be a string`);
    if (!WORD_PATTERN.test(word)) fail(`${file}: invalid word "${word}"`);
    if (FORBIDDEN_ABBREVIATIONS.has(word)) fail(`${file}: forbidden abbreviation "${word}"`);
    if (seen.has(word)) fail(`${file}: duplicate word "${word}"`);
    seen.add(word);
    byLength[word.length] += 1;
  }

  if (words.length < MIN_TOTAL) fail(`${file}: expected at least ${MIN_TOTAL} words, got ${words.length}`);
  for (const [length, minimum] of Object.entries(MIN_BY_LENGTH)) {
    const actual = byLength[Number(length)] || 0;
    if (actual < minimum) fail(`${file}: expected at least ${minimum} words of length ${length}, got ${actual}`);
  }

  console.log(`✅ ${file}: ${words.length} words (${byLength[4]}/${byLength[5]}/${byLength[6]})`);
}

const indexPath = path.join(DICTIONARY_DIR, INDEX_FILE);
if (!fs.existsSync(indexPath)) {
  fail(`${INDEX_FILE} not found`);
}

const index = readJson<{ dictionaries?: Array<{ file?: string }> }>(indexPath);
const indexedFiles = new Set((index.dictionaries || []).map(item => item.file).filter(Boolean));
for (const file of files) {
  if (!indexedFiles.has(file)) fail(`${file}: not listed in ${INDEX_FILE}`);
}

console.log(`✅ Premium dictionaries validation passed: ${files.length} files.`);
