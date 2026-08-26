import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const flattenLogEntries = value => Array.isArray(value)
  ? value
  : Array.isArray(value?.entries) ? value.entries
    : Array.isArray(value?.messages) ? value.messages
      : Array.isArray(value?.items) ? value.items
        : [];

export const flattenLogResources = value => Array.isArray(value)
  ? value
  : Array.isArray(value?.resources) ? value.resources
    : [];

const resourceIdOf = record => String(
  record?.resource?.id
  ?? record?.resource_id
  ?? record?.resourceId
  ?? '',
).trim();

const resourceTypeOf = record => String(
  record?.resource?.type
  ?? record?.resource_type
  ?? record?.resourceType
  ?? '',
).trim();

export const selectTargetContainerLogs = ({ resources, records, targetId }) => {
  const normalizedResources = flattenLogResources(resources)
    .map(resource => ({
      type: String(resource?.type || '').trim(),
      ids: Array.isArray(resource?.ids) ? resource.ids.map(id => String(id).trim()).filter(Boolean) : [],
    }))
    .filter(resource => resource.type && resource.ids.length);

  const targetGroups = normalizedResources.filter(resource => resource.ids.includes(targetId));
  if (!targetGroups.length) {
    throw new Error('Configured Serverless Container ID is not present in the selected Cloud Logging group.');
  }

  const targetTypes = new Set(targetGroups.map(resource => resource.type));
  const exactRecords = records.filter(record => resourceIdOf(record) === targetId);
  if (exactRecords.length) {
    return { selected: exactRecords, strategy: 'exact-resource-id', targetTypes: [...targetTypes] };
  }

  const safeFallbackTypes = new Set(
    targetGroups
      .filter(resource => resource.ids.length === 1 && resource.ids[0] === targetId)
      .map(resource => resource.type),
  );
  if (!safeFallbackTypes.size) {
    throw new Error('Log entries omit resource IDs and the target resource type contains multiple IDs; refusing ambiguous evidence.');
  }

  const selected = records.filter(record => {
    const id = resourceIdOf(record);
    if (id) return false;
    return safeFallbackTypes.has(resourceTypeOf(record));
  });
  if (!selected.length) {
    throw new Error('No AnnWord Serverless Container log records found in requested evidence windows.');
  }
  return { selected, strategy: 'unique-target-resource-type', targetTypes: [...targetTypes] };
};

const run = async () => {
  const targetId = String(process.env.YC_SERVERLESS_CONTAINER_ID || '').trim();
  const resourcesPath = process.env.YANDEX_LOG_RESOURCES_FILE || '/tmp/yandex-log-resources.json';
  const outputPath = process.env.YANDEX_LOG_FILTERED_FILE || '/tmp/yandex-performance-logs.json';
  const inputPaths = (process.env.YANDEX_LOG_INPUT_FILES || '').split(':').map(value => value.trim()).filter(Boolean);

  if (!targetId) throw new Error('YC_SERVERLESS_CONTAINER_ID is required.');
  if (!inputPaths.length) throw new Error('YANDEX_LOG_INPUT_FILES is required.');

  const readJson = async (path, fallback) => {
    try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
  };

  const resourcePayload = await readJson(resourcesPath, { resources: [] });
  const allRecords = [];
  for (const path of inputPaths) allRecords.push(...flattenLogEntries(await readJson(path, [])));
  const deduped = Array.from(new Map(allRecords.map(record => [JSON.stringify(record), record])).values());
  const { selected, strategy, targetTypes } = selectTargetContainerLogs({ resources: resourcePayload, records: deduped, targetId });

  await fs.writeFile(outputPath, JSON.stringify(selected));
  console.log(`Yandex evidence logs: raw=${deduped.length}; selected=${selected.length}; resourceGroups=${flattenLogResources(resourcePayload).length}; targetTypes=${targetTypes.join(',')}; strategy=${strategy}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
