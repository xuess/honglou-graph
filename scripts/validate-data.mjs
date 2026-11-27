import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const dataUrl = (fileName) => new URL(`data/${fileName}`, rootUrl);
const sourceUrl = (fileName) => new URL(fileName, rootUrl);
const allowedRelationTypes = new Set(['blood', 'marriage', 'master_servant', 'romance', 'social', 'rivalry']);
const continuationPattern = /后四十回|高鹗|续书|第(?:8[1-9]|9[0-9]|1[01][0-9]|120)回/;
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (error) {
    fail(`${fileURLToPath(url)} 无法解析：${error.message}`);
    return null;
  }
}

function validateSourceRef(ref, context, catalog, baseEditions, maxChapter) {
  if (!ref || typeof ref !== 'object') {
    fail(`${context} 的来源不是对象`);
    return;
  }

  const source = catalog.get(ref.sourceId);
  if (!source) {
    fail(`${context} 引用了不存在的 sourceId “${ref.sourceId || ''}”`);
    return;
  }
  if ((source.role || 'base') !== 'base') {
    fail(`${context} 引用了非底本来源“${source.id}”（role=${source.role || '未声明'}）`);
  }
  if (!baseEditions.has(ref.edition)) {
    fail(`${context} 的版本“${ref.edition || ''}”不在甲戌本／庚辰本底本范围内`);
  }
  if (ref.edition !== source.edition) {
    fail(`${context} 的版本“${ref.edition || ''}”与来源目录“${source.id}”不一致`);
  }
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1 || ref.chapter > maxChapter) {
    fail(`${context} 的回目必须为第 1–${maxChapter} 回之间的整数`);
  }
  if (!String(ref.locator || '').trim()) {
    fail(`${context} 缺少原文定位 locator`);
  }
  // 来源目录可以声明自己实际收录了哪些回；引用未收录的回目等于凭空造来源。
  if (Array.isArray(source.coveredChapters) && !source.coveredChapters.includes(ref.chapter)) {
    fail(`${context} 引用了来源“${source.id}”未收录的第 ${ref.chapter} 回`);
  }
}

/**
 * 与展示层共用同一条“可称为经典语录”的判定：
 * 必须是底本来源、版本一致、回目在来源覆盖范围内，且有定位。
 */
function isValidBaseRef(ref, catalog, baseEditions, maxChapter) {
  if (!ref || typeof ref !== 'object') return false;
  const source = catalog.get(ref.sourceId);
  if (!source || (source.role || 'base') !== 'base') return false;
  if (!baseEditions.has(ref.edition) || ref.edition !== source.edition) return false;
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1 || ref.chapter > maxChapter) return false;
  if (!String(ref.locator || '').trim()) return false;
  if (Array.isArray(source.coveredChapters) && !source.coveredChapters.includes(ref.chapter)) return false;
  return true;
}

function validateComparisonRef(ref, context, catalog) {
  if (!ref || typeof ref !== 'object') {
    fail(`${context} 的来源不是对象`);
    return;
  }
  const source = catalog.get(ref.sourceId);
  if (!source) {
    fail(`${context} 引用了不存在的对照来源 sourceId “${ref.sourceId || ''}”`);
    return;
  }
  if ((source.role || 'base') !== 'comparison') {
    fail(`${context} 引用的来源“${source.id}”不是 comparison 角色`);
  }
  if (ref.edition !== source.edition) {
    fail(`${context} 的版本“${ref.edition || ''}”与对照目录“${source.id}”不一致`);
  }
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1 || ref.chapter > 120) {
    fail(`${context} 的回目必须为第 1–120 回之间的整数`);
  }
  if (!String(ref.locator || '').trim()) {
    fail(`${context} 缺少对照定位 locator`);
  }
}

function findDuplicateIds(records) {
  const seen = new Set();
  return records.map((record) => record.id).filter((id) => {
    if (!id || seen.has(id)) return true;
    seen.add(id);
    return false;
  });
}

function hasCompleteQuoteSources(character) {
  const quotes = character.quotes || [];
  const quoteSources = character.quoteSources || [];
  return quotes.length === quoteSources.length && quotes.length > 0;
}

function containsContinuationContent(character) {
  // 续书内容既可能以“后四十回/续书”等文字出现，也可能只体现在结构化的章回号里。
  if (continuationPattern.test(JSON.stringify(character))) return true;
  return (character.chapters || []).some((chapter) => Number(chapter.chapter) > 80);
}

const [characters, relationships, knowledge, provenance, appearances, eventsData, placesData, textMentions, quoteCrosscheck] = await Promise.all([
  readJson(dataUrl('characters.json')),
  readJson(dataUrl('relationships.json')),
  readJson(dataUrl('knowledge.json')),
  readJson(dataUrl('provenance.json')),
  readJson(dataUrl('appearances.json')),
  readJson(dataUrl('events.json')),
  readJson(dataUrl('places.json')),
  readJson(dataUrl('text-mentions.json')),
  readJson(dataUrl('quote-crosscheck.json')),
]);

if (characters && relationships && knowledge && provenance) {
  const characterIds = new Set(characters.map((character) => character.id));
  const duplicateIds = findDuplicateIds(characters);
  duplicateIds.forEach((id) => fail(`人物 ID 重复或为空：“${id || '(empty)'}”`));

  const policy = provenance.policy || {};
  const baseEditions = new Set(policy.baseEditions || []);
  const maxChapter = policy.factScope?.maxChapter;
  if (!baseEditions.has('甲戌本') || !baseEditions.has('庚辰本')) {
    fail('来源策略必须同时声明甲戌本与庚辰本为底本');
  }
  if (!Number.isInteger(maxChapter) || maxChapter !== 80) {
    fail('来源策略的事实范围必须明确限定至第 80 回');
  }

  const catalogRecords = provenance.sourceCatalog || [];
  const catalog = new Map(catalogRecords.map((source) => [source.id, source]));
  findDuplicateIds(catalogRecords).forEach((id) => fail(`来源目录 ID 重复或为空：“${id || '(empty)'}”`));
  catalogRecords.forEach((source) => {
    const role = source.role || 'base';
    if (!['base', 'comparison', 'pending', 'reference'].includes(role)) {
      fail(`来源目录“${source.id || ''}”的 role“${role}”无效`);
      return;
    }
    if (role === 'base') {
      if (!baseEditions.has(source.edition)) {
        fail(`底本来源目录“${source.id || ''}”不属于甲戌本／庚辰本底本`);
      }
      if (!Array.isArray(source.coveredChapters) || source.coveredChapters.length === 0) {
        fail(`底本来源目录“${source.id || ''}”必须声明 coveredChapters`);
      }
    }
  });

  characters.forEach((character) => {
    ['parentIds', 'childrenIds', 'spouseIds'].forEach((field) => {
      if (!Array.isArray(character[field])) {
        fail(`人物“${character.id}”的 ${field} 必须是数组`);
        return;
      }
      character[field].forEach((id) => {
        if (!characterIds.has(id)) {
          fail(`人物“${character.id}”的 ${field} 引用了不存在的人物“${id}”`);
        }
      });
    });

    (character.sourceRefs || []).forEach((ref, index) => {
      validateSourceRef(ref, `人物“${character.id}”的 sourceRefs[${index}]`, catalog, baseEditions, maxChapter);
      if (!String(ref.claim || '').trim()) {
        fail(`人物“${character.id}”的 sourceRefs[${index}] 缺少 claim`);
      }
    });
    (character.quoteSources || []).forEach((ref, index) => {
      validateSourceRef(ref, `人物“${character.id}”的 quoteSources[${index}]`, catalog, baseEditions, maxChapter);
    });
    (character.outcomeSources || []).forEach((ref, index) => {
      validateSourceRef(ref, `人物“${character.id}”的 outcomeSources[${index}]`, catalog, baseEditions, maxChapter);
    });
    (character.quoteComparisons || []).forEach((item, index) => {
      if (!String(item?.text || '').trim()) {
        fail(`人物“${character.id}”的 quoteComparisons[${index}] 缺少 text`);
      }
      validateComparisonRef(item?.source, `人物“${character.id}”的 quoteComparisons[${index}].source`, catalog);
    });
    if (character.quoteSources && character.quoteSources.length !== (character.quotes || []).length) {
      fail(`人物“${character.id}”的 quoteSources 必须与 quotes 一一对应`);
    }
    if (character.outcomeSources && !character.outcome) {
      fail(`人物“${character.id}”有 outcomeSources 但没有 outcome`);
    }
    if (!Array.isArray(character.keyEventVersions)
        || character.keyEventVersions.length !== (character.keyEvents || []).length) {
      fail(`人物“${character.id}”的 keyEventVersions 必须与 keyEvents 一一对应`);
    } else {
      character.keyEventVersions.forEach((version, index) => {
        if (!['original', 'continuation'].includes(version)) {
          fail(`人物“${character.id}”的 keyEventVersions[${index}] 必须是 original 或 continuation`);
        }
      });
    }
    (character.chapters || []).forEach((chapter, index) => {
      if (!['original', 'continuation'].includes(chapter.version)) {
        fail(`人物“${character.id}”的 chapters[${index}] 缺少合法 version`);
      } else if (Number(chapter.chapter) > 80 && chapter.version !== 'continuation') {
        fail(`人物“${character.id}”的 chapters[${index}] 第 ${chapter.chapter} 回应标记 continuation`);
      } else if (Number(chapter.chapter) <= 80 && chapter.version !== 'original') {
        fail(`人物“${character.id}”的 chapters[${index}] 第 ${chapter.chapter} 回应标记 original`);
      }
    });
  });

  const appearanceRecords = appearances?.records;
  if (!Array.isArray(appearanceRecords)) {
    fail('data/appearances.json 缺少 records 数组');
  } else {
    const seenAppearanceKeys = new Set();
    const allowedRoles = new Set(['key', 'scene', 'entrance', 'text']);
    appearanceRecords.forEach((record, index) => {
      const context = `出场索引[${index}]`;
      if (!characterIds.has(record.characterId)) {
        fail(`${context} 引用了不存在的人物“${record.characterId || ''}”`);
      }
      if (!Number.isInteger(record.chapter) || record.chapter < 1 || record.chapter > 120) {
        fail(`${context} 的 chapter 必须为第 1–120 回之间的整数`);
      }
      if (!Array.isArray(record.roles) || !record.roles.length
          || record.roles.some((role) => !allowedRoles.has(role))) {
        fail(`${context} 的 roles 必须是 key/scene/entrance/text 的非空子集`);
      }
      if (!['original', 'continuation'].includes(record.version)) {
        fail(`${context} 的 version 必须为 original 或 continuation`);
      } else if (Number(record.chapter) > 80 && record.version !== 'continuation') {
        fail(`${context} 的第 ${record.chapter} 回应标记 continuation`);
      } else if (Number(record.chapter) <= 80 && record.version !== 'original') {
        fail(`${context} 的第 ${record.chapter} 回应标记 original`);
      }
      const key = `${record.characterId}|${record.chapter}`;
      if (seenAppearanceKeys.has(key)) fail(`${context} 与同一人物回目重复：${key}`);
      seenAppearanceKeys.add(key);
    });
  }

  if (!textMentions || !Array.isArray(textMentions.records)) {
    fail('data/text-mentions.json 缺少 records 数组');
  } else {
    const source = catalog.get(textMentions.sourceId);
    if (!source || source.role !== 'reference') {
      fail(`文本提及来源“${textMentions.sourceId || ''}”必须是 role=reference`);
    }
    const seenTextRecords = new Set();
    textMentions.records.forEach((record, index) => {
      const context = `文本提及[${index}]`;
      if (!characterIds.has(record.characterId)) {
        fail(`${context} 引用了不存在的人物“${record.characterId || ''}”`);
      }
      if (!Number.isInteger(record.chapter) || record.chapter < 1 || record.chapter > 80) {
        fail(`${context} 的 chapter 必须为第 1–80 回之间的整数`);
      }
      if (!Number.isInteger(record.count) || record.count < 1) {
        fail(`${context} 的 count 必须为正整数`);
      }
      const key = `${record.characterId}|${record.chapter}`;
      if (seenTextRecords.has(key)) fail(`${context} 与同一人物回目重复：${key}`);
      seenTextRecords.add(key);
    });
  }

  if (!quoteCrosscheck || !Array.isArray(quoteCrosscheck.records)) {
    fail('data/quote-crosscheck.json 缺少 records 数组');
  } else {
    const source = catalog.get(quoteCrosscheck.sourceId);
    if (!source || source.role !== 'comparison') {
      fail(`引语候选来源“${quoteCrosscheck.sourceId || ''}”必须是 role=comparison`);
    }
    const seenQuotes = new Set();
    quoteCrosscheck.records.forEach((record, index) => {
      const context = `引语候选[${index}]`;
      if (!characterIds.has(record.characterId)) {
        fail(`${context} 引用了不存在的人物“${record.characterId || ''}”`);
      }
      if (!String(record.text || '').trim()) fail(`${context} 缺少 text`);
      if (!['match', 'not-found'].includes(record.status)) {
        fail(`${context} 的 status 必须为 match 或 not-found`);
      }
      (record.chapters || []).forEach((chapter) => {
        if (!Number.isInteger(chapter) || chapter < 1 || chapter > 80) {
          fail(`${context} 的 chapter 必须为第 1–80 回之间的整数`);
        }
      });
      if (record.status === 'match' && !(record.chapters || []).length) {
        fail(`${context} 标记 match 时必须至少有一个 chapter`);
      }
      const key = `${record.characterId}|${record.text}`;
      if (seenQuotes.has(key)) fail(`${context} 与同一人物引语重复：${key}`);
      seenQuotes.add(key);
    });
    if (quoteCrosscheck.summary?.total !== quoteCrosscheck.records.length) {
      fail('引语候选 summary.total 与 records 数量不一致');
    }
    if (quoteCrosscheck.summary?.matches !== quoteCrosscheck.records.filter((item) => item.status === 'match').length) {
      fail('引语候选 summary.matches 与记录不一致');
    }
  }

  const knowledgeIds = new Set(knowledge.map((item) => item.id));
  const eventRecords = eventsData?.events;
  const placeRecords = placesData?.places;
  for (const [label, records, prefix] of [
    ['事件索引', eventRecords, 'events'],
    ['地点索引', placeRecords, 'places']
  ]) {
    if (!Array.isArray(records)) {
      fail(`data/${prefix}.json 缺少 ${prefix} 数组`);
      continue;
    }
    const seenIds = new Set();
    records.forEach((record, index) => {
      const context = `${label}[${index}]`;
      if (!record.id || seenIds.has(record.id)) fail(`${context} 的 id 为空或重复：“${record.id || ''}”`);
      seenIds.add(record.id);
      (record.knowledgeIds || []).forEach((id) => {
        if (!knowledgeIds.has(id)) fail(`${context} 引用了不存在的知识条目“${id}”`);
      });
      (record.characterIds || []).forEach((id) => {
        if (!characterIds.has(id)) fail(`${context} 引用了不存在的人物“${id}”`);
      });
      (record.chapters || []).forEach((chapter) => {
        if (!Number.isInteger(chapter) || chapter < 1 || chapter > 120) {
          fail(`${context} 的 chapter 必须为第 1–120 回之间的整数`);
        }
      });
    });
  }
  const eventIds = new Set((eventRecords || []).map((item) => item.id));
  const placeIds = new Set((placeRecords || []).map((item) => item.id));
  knowledge.forEach((item, index) => {
    (item.eventIds || []).forEach((id) => {
      if (!eventIds.has(id)) fail(`知识条目“${item.id || index}”引用了不存在的事件“${id}”`);
    });
    (item.placeIds || []).forEach((id) => {
      if (!placeIds.has(id)) fail(`知识条目“${item.id || index}”引用了不存在的地点“${id}”`);
    });
  });

  // 血缘/婚姻边的方向约定：长辈→晚辈、配偶之间按「男→女」、同辈按出生先后。
  // 这条不变量以前没有人检查，导致出现「史湘云→史鼐/叔侄」这种长辈在后端的反向边。
  const ELDER_TO_YOUNGER = new Set(['母子', '母女', '父子', '父女', '姑侄', '叔侄', '舅甥', '嫡母庶女', '祖孙', '外祖母']);
  const YOUNGER_TO_ELDER = new Set(['侄孙女']);
  const byId = new Map(characters.map((character) => [character.id, character]));

  relationships.forEach((relationship, index) => {
    const context = `关系[${index}]`;
    if (!characterIds.has(relationship.source) || !characterIds.has(relationship.target)) {
      fail(`${context} 存在悬空端点：${relationship.source || ''} → ${relationship.target || ''}`);
      return;
    }
    if (!allowedRelationTypes.has(relationship.type)) {
      fail(`${context} 使用了无效关系类型“${relationship.type || ''}”`);
    }
    if (relationship.source === relationship.target) {
      fail(`${context} 的起点与终点相同：“${relationship.source}”`);
    }

    if (relationship.evidence !== undefined) {
      if (!Array.isArray(relationship.evidence)) {
        fail(`${context} 的 evidence 必须是数组`);
      } else {
        const seenEvidence = new Set();
        relationship.evidence.forEach((item, evidenceIndex) => {
          const evidenceContext = `${context} 的 evidence[${evidenceIndex}]`;
          if (!Number.isInteger(item.chapter) || item.chapter < 1 || item.chapter > 120) {
            fail(`${evidenceContext} 的 chapter 必须为第 1–120 回之间的整数`);
          }
          if (!String(item.scene || '').trim() || !String(item.summary || '').trim()) {
            fail(`${evidenceContext} 必须包含 scene 和 summary`);
          }
          if (item.status !== 'chapter') {
            fail(`${evidenceContext} 的 status 必须为 chapter（只能引用回目级证据）`);
          }
          if (item.chapter <= 80 && item.version !== '前八十回') {
            fail(`${evidenceContext} 的第 ${item.chapter} 回属于前八十回，version 必须为“前八十回”`);
          }
          if (item.chapter > 80 && !String(item.version || '').includes('续书')) {
            fail(`${evidenceContext} 的第 ${item.chapter} 回属于后四十回，version 必须标注续书`);
          }
          const key = `${item.chapter}|${item.scene || ''}`;
          if (seenEvidence.has(key)) {
            fail(`${evidenceContext} 重复引用了同一回目依据：${key}`);
          }
          seenEvidence.add(key);
        });
      }
    }
    if (relationship.evidenceNote && !(relationship.evidence || []).length) {
      fail(`${context} 有 evidenceNote 但没有 evidence`);
    }

    if (relationship.type !== 'blood') return;

    const from = byId.get(relationship.source);
    const to = byId.get(relationship.target);
    const fromGen = from?.generation;
    const toGen = to?.generation;
    // generation 0 表示未归类，不参与方向校验。
    if (!Number.isInteger(fromGen) || !Number.isInteger(toGen) || fromGen === 0 || toGen === 0) return;

    if (ELDER_TO_YOUNGER.has(relationship.label) && toGen <= fromGen) {
      fail(`${context}「${relationship.label}」方向应为长辈→晚辈，实际 ${fromGen} → ${toGen}（${relationship.source} → ${relationship.target}）`);
    }
    if (YOUNGER_TO_ELDER.has(relationship.label) && fromGen <= toGen) {
      fail(`${context}「${relationship.label}」方向应为晚辈→长辈，实际 ${fromGen} → ${toGen}（${relationship.source} → ${relationship.target}）`);
    }
  });

  knowledge.forEach((entry, index) => {
    (entry.relatedCharacters || []).forEach((id) => {
      if (!characterIds.has(id)) {
        fail(`知识条目“${entry.id || index}”引用了不存在的人物“${id}”`);
      }
    });
  });

  // parentIds/childrenIds 与 relationships 必须互相对应：图谱只读 relationships，
  // 家谱树只读数组字段。两处不一致时，人物会在一个视图里有父母、在另一个视图里没有。
  const bloodEdges = new Set(
    relationships
      .filter((relationship) => relationship.type === 'blood')
      .map((relationship) => `${relationship.source}->${relationship.target}`)
  );
  characters.forEach((character) => {
    (character.parentIds || []).forEach((parentId) => {
      if (!bloodEdges.has(`${parentId}->${character.id}`)) {
        fail(`人物“${character.id}”的 parentIds 包含“${parentId}”，但缺少对应的 blood 关系`);
      }
    });
    (character.childrenIds || []).forEach((childId) => {
      if (!bloodEdges.has(`${character.id}->${childId}`)) {
        fail(`人物“${character.id}”的 childrenIds 包含“${childId}”，但缺少对应的 blood 关系`);
      }
    });
  });

  (provenance.evidence || []).forEach((entry, index) => {
    const context = `证据[${index}]`;
    if (!characterIds.has(entry.entityId)) {
      fail(`${context} 引用了不存在的人物“${entry.entityId || ''}”`);
    }
    if (!String(entry.field || '').trim() || !String(entry.claim || '').trim()) {
      fail(`${context} 必须包含 field 和 claim`);
    }
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
      fail(`${context} 至少需要一条来源`);
    }
    (entry.sources || []).forEach((ref, sourceIndex) => {
      validateSourceRef(ref, `${context}.sources[${sourceIndex}]`, catalog, baseEditions, maxChapter);
    });
  });

  const auditQueue = provenance.auditQueue || [];
  const quoteAudit = auditQueue.find((entry) => entry.id === 'character-quotes-without-source');
  const continuationAudit = auditQueue.find((entry) => entry.id === 'later-text-or-continuation-content');
  // 待核引语分三处：quotesPendingVerified、quoteComparisons，以及历史数据中
  // 仍混在 quotes 里的不合格 quoteSources。三者合起来才是真正的待核范围。
  const unverifiedQuoteRecords = characters.filter((character) => {
    const pending = (character.quotesPendingVerified || []).length;
    const comparisons = (character.quoteComparisons || []).length;
    const invalidQuotes = (character.quoteSources || []).some((ref) =>
      !isValidBaseRef(ref, catalog, baseEditions, maxChapter));
    return pending > 0 || comparisons > 0 || invalidQuotes || ((character.quotes || []).length && !hasCompleteQuoteSources(character));
  });
  const verifiedQuoteCharacters = characters.filter((character) =>
    (character.quoteSources || []).length > 0
      && character.quoteSources.every((ref) => isValidBaseRef(ref, catalog, baseEditions, maxChapter)));
  const verifiedQuoteLines = verifiedQuoteCharacters.reduce(
    (sum, character) => sum + character.quoteSources.length, 0);
  const pendingQuoteLines = characters.reduce(
    (sum, character) => sum + (character.quotesPendingVerified || []).length, 0);
  const comparisonQuoteLines = characters.reduce(
    (sum, character) => sum + (character.quoteComparisons || []).length, 0);
  const continuationCharacters = characters.filter(containsContinuationContent);

  if (!quoteAudit) fail('审计队列缺少 character-quotes-without-source 项');
  if (!continuationAudit) fail('审计队列缺少 later-text-or-continuation-content 项');
  if (quoteAudit) {
    if (quoteAudit.recordCount !== unverifiedQuoteRecords.length) {
      fail(`待核引语记录数为 ${unverifiedQuoteRecords.length}，与审计队列的 ${quoteAudit.recordCount} 不一致`);
    }
    if (quoteAudit.verifiedCount !== verifiedQuoteCharacters.length) {
      fail(`已核引语人物数为 ${verifiedQuoteCharacters.length}，与审计队列的 ${quoteAudit.verifiedCount} 不一致`);
    }
    if (quoteAudit.verifiedQuoteLines !== verifiedQuoteLines) {
      fail(`已核引语条数为 ${verifiedQuoteLines}，与审计队列的 ${quoteAudit.verifiedQuoteLines} 不一致`);
    }
    if (quoteAudit.pendingQuoteLines !== pendingQuoteLines) {
      fail(`待核引语条数为 ${pendingQuoteLines}，与审计队列的 ${quoteAudit.pendingQuoteLines} 不一致`);
    }
    if (quoteAudit.comparisonQuoteLines !== undefined && quoteAudit.comparisonQuoteLines !== comparisonQuoteLines) {
      fail(`版本异文条数为 ${comparisonQuoteLines}，与审计队列的 ${quoteAudit.comparisonQuoteLines} 不一致`);
    }
    if (quoteAudit.crossCheckMatches !== undefined
        && quoteAudit.crossCheckMatches !== (quoteCrosscheck?.summary?.matches ?? -1)) {
      fail(`引语候选命中数为 ${quoteCrosscheck?.summary?.matches ?? -1}，与审计队列的 ${quoteAudit.crossCheckMatches} 不一致`);
    }
  }
  if (continuationAudit) {
    const queuedIds = new Set(continuationAudit.entityIds || []);
    continuationCharacters.forEach((character) => {
      if (!queuedIds.has(character.id)) {
        fail(`人物“${character.id}”含续书或第八十一回后内容，但未进入审计队列`);
      }
    });
  }

  warn(`待核引语：${unverifiedQuoteRecords.length} 条人物记录（前端不显示为“经典语录”）`);
  warn(`含续书／第八十一回后内容：${continuationCharacters.length} 条人物记录（待逐条拆分校勘）`);
}

if (errors.length) {
  console.error('数据校验失败：');
  errors.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`✓ 数据结构与来源范围校验通过（${characters.length} 人物、${relationships.length} 关系、${knowledge.length} 知识条目）`);
}

warnings.forEach((message) => console.warn(`⚠ ${message}`));
