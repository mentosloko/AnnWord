import fs from 'node:fs/promises';

const targetId = String(process.env.YC_SERVERLESS_CONTAINER_ID || '').trim();
const resourcesPath = process.env.YANDEX_LOG_RESOURCES_FILE || '/tmp/yandex-log-resources.json';
const outputPath = process.env.YANDEX_LOG_FILTERED_FILE || '/tmp/yandex-performance-logs.json';
const inputPaths = (process.env.YANDEX_LOG_INPUT_FILES || '').split(':').map(value => value.trim()).filter(Boolean);

if (!targetId) throw new Error('YC_SERVERLESS_CONTAINER_ID is required.');
if (!inputPaths.length) throw new Error('YANDEX_LOG_INPUT_FILES is required.');

const readJson = async (path, fallback) => {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
};
const flatten = value => Array.isArray(value) ? value : Array.isArray(value?.entries) ? value.entries : Array.isArray(value?.messages) ? value.messages : Array.isArray(value?.items) ? value.items : [];
const text = value => JSON.stringify(value);
const isContainerText = value => /serverless[._ -]?container/i.test(text(value)) || /container/i.test(text(value));

const resourcePayload = await readJson(resourcesPath, []);
const resources = flatten(resourcePayload);
const containerResources = resources.filter(isContainerText);
const exactResourceMatches = resources.filter(resource => text(resource).includes(targetId));

const allRecords = [];
for (const path of inputPaths) allRecords.push(...flatten(await readJson(path, [])));

const deduped = Array.from(new Map(allRecords.map(record => [text(record), record])).values());
const exactRecords = deduped.filter(record => text(record).includes(targetId));
let selected = exactRecords;
let strategy = 'exact-resource-id';

if (!selected.length) {
  if (containerResources.length !== 1) {
    throw new Error(`Unable to safely infer AnnWord container logs: exactRecords=0, containerResources=${containerResources.length}.`);
  }
  selected = deduped.filter(isContainerText);
  strategy = 'single-container-resource-type';
}

if (!selected.length) throw new Error('No AnnWord Serverless Container log records found in requested evidence windows.');

await fs.writeFile(outputPath, JSON.stringify(selected));
console.log(`Yandex evidence logs: raw=${deduped.length}; selected=${selected.length}; resources=${resources.length}; containerResources=${containerResources.length}; exactResourceMatches=${exactResourceMatches.length}; strategy=${strategy}`);
