#!/usr/bin/env node
/**
 * 从 knowledge.json 的 relatedEvents / relatedPlaces 自由文本生成稳定的事件、地点索引。
 * 已知同义写法归并到同一 ID；其余用内容哈希生成稳定 ID。
 * 同时给每条知识写回 eventIds / placeIds，供后续筛选和交叉引用。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knowledgePath = resolve(root, 'data/knowledge.json');
const knowledge = JSON.parse(readFileSync(knowledgePath, 'utf8'));

const hashId = (prefix, text) => `${prefix}_${createHash('sha1').update(text).digest('hex').slice(0, 8)}`;

const eventGroups = [
  ['event_yuanfei_shengqin', '元妃省亲', ['元妃省亲', '元春省亲']],
  ['event_taixu', '神游太虚幻境', ['神游太虚幻境', '太虚幻境']],
  ['event_haitang_shishe', '海棠诗社', ['海棠诗社', '海棠诗社成立', '结海棠社']],
  ['event_juhua_shishe', '菊花诗社', ['菊花诗社', '菊花诗会', '咏菊']],
  ['event_shishe', '大观园诗社', ['诗社']],
  ['event_luxuean_lianju', '芦雪庵联句', ['芦雪庵诗社', '芦雪庵联句']],
  ['event_huaigu_shi', '怀古诗', ['怀古诗']],
  ['event_baoyu_chujia', '宝玉出家', ['宝玉出家', '悬崖撒手']],
  ['event_daiyu_fengao', '黛玉焚稿', ['黛玉焚稿', '焚稿断痴情']],
  ['event_daiyu_zhi_si', '黛玉之死', ['黛玉之死']],
  ['event_baoyu_chenghun', '宝玉成婚', ['宝玉成婚']],
  ['event_chaojian', '抄检大观园', ['抄检大观园']],
  ['event_yuanxiao_dengmi', '元宵制灯谜', ['元宵制灯谜', '元宵家宴']],
  ['event_zhongqiu', '中秋夜宴', ['中秋赏月', '中秋吟诗', '中秋夜宴']]
];

const placeGroups = [
  ['place_tubi', '凸碧山庄', ['凸碧山庄', '凸碧堂']],
  ['place_aojing', '凹晶馆', ['凹晶溪馆', '凹晶馆']],
  ['place_jiamu_shangfang', '贾母上房', ['贾母上房', '上房']],
  ['place_rongguofu', '荣国府', ['荣国府']],
  ['place_daguanyuan', '大观园', ['大观园']],
  ['place_ningguofu', '宁国府', ['宁国府']],
  ['place_xiaoxiangguan', '潇湘馆', ['潇湘馆']],
  ['place_yihongyuan', '怡红院', ['怡红院']],
  ['place_hengwuyuan', '蘅芜苑', ['蘅芜苑']],
  ['place_longcui-an', '栊翠庵', ['栊翠庵']],
  ['place_daoxiangcun', '稻香村', ['稻香村']],
  ['place_qiushuangzhai', '秋爽斋', ['秋爽斋']],
  ['place_ouxiangxie', '藕香榭', ['藕香榭']],
  ['place_zipengzhou', '紫菱洲', ['紫菱洲']],
  ['place_lixiangyuan', '梨香院', ['梨香院']]
];

function makeLookup(groups, prefix) {
  const byAlias = new Map();
  const byId = new Map();
  for (const [id, title, aliases] of groups) {
    byId.set(id, { id, title, aliases: [...new Set([title, ...aliases])] });
    for (const alias of aliases) byAlias.set(alias, id);
    byAlias.set(title, id);
  }
  return {
    resolve(text) {
      const value = String(text || '').trim();
      if (!value) return null;
      const id = byAlias.get(value) || hashId(prefix, value);
      if (!byId.has(id)) byId.set(id, { id, title: value, aliases: [value] });
      return byId.get(id);
    },
    all: () => [...byId.values()]
  };
}

const events = makeLookup(eventGroups, 'event');
const places = makeLookup(placeGroups, 'place');
const eventKnowledge = new Map();
const placeKnowledge = new Map();
const eventCharacters = new Map();
const placeCharacters = new Map();
const eventChapters = new Map();
const placeChapters = new Map();

function pushSet(map, id, value) {
  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(value);
}

for (const item of knowledge) {
  const eventIds = [];
  for (const text of item.relatedEvents || []) {
    const entry = events.resolve(text);
    if (!entry) continue;
    if (!eventIds.includes(entry.id)) eventIds.push(entry.id);
    pushSet(eventKnowledge, entry.id, item.id);
    if (item.chapter) pushSet(eventChapters, entry.id, item.chapter);
    for (const characterId of item.relatedCharacters || []) pushSet(eventCharacters, entry.id, characterId);
  }
  const placeIds = [];
  for (const text of item.relatedPlaces || []) {
    const entry = places.resolve(text);
    if (!entry) continue;
    if (!placeIds.includes(entry.id)) placeIds.push(entry.id);
    pushSet(placeKnowledge, entry.id, item.id);
    if (item.chapter) pushSet(placeChapters, entry.id, item.chapter);
    for (const characterId of item.relatedCharacters || []) pushSet(placeCharacters, entry.id, characterId);
  }
  if (eventIds.length) item.eventIds = eventIds;
  else delete item.eventIds;
  if (placeIds.length) item.placeIds = placeIds;
  else delete item.placeIds;
}

function recordsFor(lookup, knowledgeMap, chapterMap, characterMap) {
  return lookup.all()
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      aliases: entry.aliases.filter((alias) => alias !== entry.title),
      chapters: [...(chapterMap.get(entry.id) || [])].sort((a, b) => a - b),
      knowledgeIds: [...(knowledgeMap.get(entry.id) || [])],
      characterIds: [...(characterMap.get(entry.id) || [])]
    }))
    .filter((entry) => entry.knowledgeIds.length)
    .sort((a, b) => b.knowledgeIds.length - a.knowledgeIds.length || a.title.localeCompare(b.title, 'zh-Hans-CN'));
}

const outputEvents = {
  schemaVersion: 1,
  generatedFrom: 'knowledge.relatedEvents',
  events: recordsFor(events, eventKnowledge, eventChapters, eventCharacters)
};
const outputPlaces = {
  schemaVersion: 1,
  generatedFrom: 'knowledge.relatedPlaces',
  places: recordsFor(places, placeKnowledge, placeChapters, placeCharacters)
};

writeFileSync(resolve(root, 'data/events.json'), JSON.stringify(outputEvents, null, 2) + '\n');
writeFileSync(resolve(root, 'data/places.json'), JSON.stringify(outputPlaces, null, 2) + '\n');
writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2) + '\n');
console.log(`✓ 事件 ${outputEvents.events.length} 个，地点 ${outputPlaces.places.length} 个`);
