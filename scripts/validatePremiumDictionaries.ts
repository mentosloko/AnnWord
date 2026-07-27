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


const SPOTLIGHT_DIR = path.join(DICTIONARY_DIR, 'spotlight');
const SPOTLIGHT_CATALOG_FILE = path.join(SPOTLIGHT_DIR, 'spotlight_catalog.json');
const SPOTLIGHT_WORD_PATTERN = /^[A-Z]{1,18}$/;

type SpotlightCatalog = {
  grades?: Array<{
    grade?: number;
    wordCount?: number;
    modules?: Array<{ id?: string; wordCount?: number }>;
    supplements?: Array<{ id?: string; wordCount?: number }>;
  }>;
};
type SpotlightRuntime = {
  grade?: number;
  words?: Array<[unknown, unknown]>;
  sections?: Array<{ id?: string; kind?: string; label?: string; title?: string; wordIndexes?: unknown[] }>;
};

if (!fs.existsSync(SPOTLIGHT_CATALOG_FILE)) fail('Spotlight catalog not found');
const spotlightCatalog = readJson<SpotlightCatalog>(SPOTLIGHT_CATALOG_FILE);
const spotlightGrades = spotlightCatalog.grades || [];
const expectedGrades = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
if (spotlightGrades.map(item => item.grade).join(',') !== expectedGrades.join(',')) fail('Spotlight grades must be 2–11');

for (const gradeMeta of spotlightGrades) {
  const grade = Number(gradeMeta.grade);
  const runtimePath = path.join(SPOTLIGHT_DIR, `spotlight_grade_${grade}.json`);
  if (!fs.existsSync(runtimePath)) fail(`Spotlight grade ${grade} file not found`);
  const runtime = readJson<SpotlightRuntime>(runtimePath);
  if (runtime.grade !== grade) fail(`Spotlight grade ${grade}: mismatched grade`);
  if (!Array.isArray(runtime.words) || runtime.words.length !== gradeMeta.wordCount) fail(`Spotlight grade ${grade}: word count mismatch`);
  const seenWords = new Set<string>();
  runtime.words.forEach((item, index) => {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || !SPOTLIGHT_WORD_PATTERN.test(item[0])) fail(`Spotlight grade ${grade}: invalid word at ${index}`);
    if (typeof item[1] !== 'string' || !item[1].trim()) fail(`Spotlight grade ${grade}: missing translation for ${item[0]}`);
    if (seenWords.has(item[0])) fail(`Spotlight grade ${grade}: duplicate word ${item[0]}`);
    seenWords.add(item[0]);
  });
  const sections = runtime.sections || [];
  const sectionById = new Map(sections.map(section => [section.id, section]));
  const expectedSections = [...(gradeMeta.modules || []), ...(gradeMeta.supplements || [])];
  if (sections.length !== expectedSections.length) fail(`Spotlight grade ${grade}: section count mismatch`);
  for (const meta of expectedSections) {
    const section = sectionById.get(meta.id);
    if (!section || !Array.isArray(section.wordIndexes)) fail(`Spotlight grade ${grade}: missing section ${meta.id}`);
    const uniqueIndexes = new Set<number>();
    for (const rawIndex of section.wordIndexes) {
      const wordIndex = Number(rawIndex);
      if (!Number.isInteger(wordIndex) || wordIndex < 0 || wordIndex >= runtime.words.length) fail(`Spotlight grade ${grade}: invalid word index in ${meta.id}`);
      if (uniqueIndexes.has(wordIndex)) fail(`Spotlight grade ${grade}: duplicate word index in ${meta.id}`);
      uniqueIndexes.add(wordIndex);
    }
    if (uniqueIndexes.size !== meta.wordCount) fail(`Spotlight grade ${grade}: word count mismatch in ${meta.id}`);
  }
  console.log(`✅ Spotlight ${grade}: ${runtime.words.length} words, ${sections.length} sections`);
}

console.log(`✅ Premium dictionaries validation passed: ${files.length} flat files plus Spotlight 2–11.`);
