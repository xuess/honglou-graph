#!/usr/bin/env node
/**
 * 从人物关键回目和 scene/entrance 知识条目生成统一出场索引。
 *
 * 只收“人物回目档案”和“名场面/人物出场”两类明确来源；
 * 不从主题、人物专题、典故、诗词、建筑等跨回目条目反推出场。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const characters = JSON.parse(readFileSync(resolve(root, 'data/characters.json'), 'utf8'));
const knowledge = JSON.parse(readFileSync(resolve(root, 'data/knowledge.json'), 'utf8'));
const records = new Map();

const chapterId = (characterId, chapter) => `${characterId}|${chapter}`;

function ensureRecord(characterId, chapter) {
  const key = chapterId(characterId, chapter);
  if (!records.has(key)) {
    records.set(key, {
      characterId,
      chapter,
      roles: [],
      sources: [],
      title: '',
      summary: '',
      version: chapter > 80 ? 'continuation' : 'original'
    });
  }
  return records.get(key);
}

function addRole(record, role) {
  if (!record.roles.includes(role)) record.roles.push(role);
}

function shortText(value, limit = 100) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

for (const character of characters) {
  for (const entry of character.chapters || []) {
    const chapter = Number(entry.chapter);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 120) continue;
    const record = ensureRecord(character.id, chapter);
    addRole(record, 'key');
    if (!record.sources.includes('character-chapter')) record.sources.push('character-chapter');
    record.title = entry.title || record.title;
    record.summary = entry.summary || record.summary;
    record.version = entry.version || record.version;
  }
}

for (const item of knowledge) {
  if (!['scene', 'entrance'].includes(item.type)) continue;
  const chapter = Number(item.chapter);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 120) continue;
  const role = item.type === 'entrance' ? 'entrance' : 'scene';
  const version = item.sourceNote === '后四十回续书' || chapter > 80 ? 'continuation' : 'original';
  for (const characterId of item.relatedCharacters || []) {
    const record = ensureRecord(characterId, chapter);
    addRole(record, role);
    const source = `knowledge:${role}`;
    if (!record.sources.includes(source)) record.sources.push(source);
    if (!record.title) record.title = item.title || '';
    if (!record.summary) record.summary = shortText(item.analysis || item.content || item.title || '');
    if (version === 'continuation') record.version = 'continuation';
  }
}

const output = {
  schemaVersion: 1,
  generatedFrom: 'characters.chapters + knowledge scene/entrance',
  records: [...records.values()].sort((a, b) =>
    a.characterId.localeCompare(b.characterId) || a.chapter - b.chapter)
};

writeFileSync(resolve(root, 'data/appearances.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`✓ 出场索引：${output.records.length} 条（${characters.length} 人物）`);
