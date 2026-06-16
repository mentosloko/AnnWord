import fs from 'node:fs';
import path from 'node:path';

const DICTIONARY_DIR = path.resolve(process.cwd(), 'dictionaries/premium');
const INDEX_FILE = 'premium_dictionaries.index.json';
const WORD_PATTERN = /^[A-Z]{4,18}$/;
const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const MIN_TOTAL = 120;
const MIN_SHORT_WORDS = 60;
const SHORT_WORD_LENGTHS = new Set([4, 5, 6]);
const FORBIDDEN_ABBREVIATIONS = new Set([
  'API', 'CSS', 'HTML', 'SQL', 'URL', 'VPN', 'CPU', 'GPU',
  'USD', 'EUR', 'ETF', 'IPO', 'KYC', 'AML', 'APR', 'ROI',
  'IGE', 'IGG', 'ECG', 'COPD', 'NSAID', 'SARS', 'HIV', 'AIDS',
]);

type PremiumWord = string | { word?: unknown; level?: unknown; translation?: unknown };
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
const normalizeWord = (value: string): string => value.trim().toUpperCase().replace(/[^A-Z]/g, '');
const getWord = (item: PremiumWord): string => typeof item === 'string' ? normalizeWord(item) : normalizeWord(String(item.word || ''));
const getLevel = (item: PremiumWord): string | null => typeof item === 'string' ? null : typeof item.level === 'string' ? item.level : null;
const hasValidTranslation = (item: PremiumWord): boolean => typeof item === 'string' || item.translation === undefined || typeof item.translation === 'string';

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

  const words = dictionary.words as PremiumWord[];
  const seen = new Set<string>();
  let shortWords = 0;
  const levelCounts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };

  for (const item of words) {
    const word = getWord(item);
    const level = getLevel(item);
    if (!WORD_PATTERN.test(word)) fail(`${file}: invalid word "${word}"`);
    if (!level || !VALID_LEVELS.has(level)) fail(`${file}: invalid or missing level for "${word}"`);
    if (!hasValidTranslation(item)) fail(`${file}: invalid translation for "${word}"`);
    if (FORBIDDEN_ABBREVIATIONS.has(word)) fail(`${file}: forbidden abbreviation "${word}"`);
    if (seen.has(word)) fail(`${file}: duplicate word "${word}"`);
    seen.add(word);
    levelCounts[level] += 1;
    if (SHORT_WORD_LENGTHS.has(word.length)) shortWords += 1;
  }

  if (words.length < MIN_TOTAL) fail(`${file}: expected at least ${MIN_TOTAL} words, got ${words.length}`);
  if (shortWords < MIN_SHORT_WORDS) fail(`${file}: expected at least ${MIN_SHORT_WORDS} words of length 4-6 for Wordle-like modes, got ${shortWords}`);

  const summary = Object.entries(levelCounts).map(([level, count]) => `${level}:${count}`).join(' ');
  console.log(`✅ ${file}: ${words.length} words, ${shortWords} short (${summary})`);
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
