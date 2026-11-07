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

const [characters, relationships, knowledge, provenance] = await Promise.all([
  readJson(dataUrl('characters.json')),
  readJson(dataUrl('relationships.json')),
  readJson(dataUrl('knowledge.json')),
  readJson(dataUrl('provenance.json')),
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
    if (!baseEditions.has(source.edition)) {
      fail(`来源目录“${source.id || ''}”不属于甲戌本／庚辰本底本`);
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
    if (character.quoteSources && character.quoteSources.length !== (character.quotes || []).length) {
      fail(`人物“${character.id}”的 quoteSources 必须与 quotes 一一对应`);
    }
    if (character.outcomeSources && !character.outcome) {
      fail(`人物“${character.id}”有 outcomeSources 但没有 outcome`);
    }
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
  // 待校引语现在存放在 quotesPendingVerified；quotes 只保留有 quoteSources 的已核条目。
  const unverifiedQuoteRecords = characters.filter((character) =>
    (character.quotesPendingVerified || []).length || ((character.quotes || []).length && !hasCompleteQuoteSources(character)));
  const continuationCharacters = characters.filter(containsContinuationContent);

  if (!quoteAudit) fail('审计队列缺少 character-quotes-without-source 项');
  if (!continuationAudit) fail('审计队列缺少 later-text-or-continuation-content 项');
  if (quoteAudit && quoteAudit.recordCount !== unverifiedQuoteRecords.length) {
    warn(`待核引语记录数为 ${unverifiedQuoteRecords.length}，与审计队列的 ${quoteAudit.recordCount} 不一致`);
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
