import assert from 'node:assert/strict';
import { loadPlaywright } from './scripts/playwright-loader.mjs';

const { chromium } = await loadPlaywright();
const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('hlm-exploration-seen', '1'));
const page = await context.newPage();
const errors = [];
const results = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(String(error)));

const pass = (name, detail = '') => {
  const message = `✓ ${name}${detail ? ` — ${detail}` : ''}`;
  results.push({ ok: true, message });
  console.log(message);
};
const fail = (name, error) => {
  const message = `✗ ${name} — ${error.message || error}`;
  results.push({ ok: false, message });
  console.log(message);
};
const run = async (name, fn) => {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
};
const sleep = (ms) => page.waitForTimeout(ms);
const openCharacter = async (id) => {
  await page.evaluate((characterId) => app._openCharacter(characterId), id);
  await sleep(500);
};
const sectionTitles = () => page.evaluate(() =>
  [...document.querySelectorAll('#character-card-overlay .card-section-title')].map((el) => el.innerText));

// ============================================================
// TC-43: 引语展示门禁
// ============================================================
await run('TC-43 引语按底本/异文/待校分档', async () => {
  await page.goto(`${BASE}/?view=graph`, { waitUntil: 'networkidle' });
  await sleep(700);

  await openCharacter('lin_daiyu');
  const daiyu = {
    titles: await sectionTitles(),
    quotes: await page.evaluate(() => [...document.querySelectorAll('#character-card-overlay .card-quote')].map((el) => el.innerText))
  };
  assert.ok(daiyu.titles.includes('经典语录'), `黛玉应有经典语录: ${daiyu.titles.join(' / ')}`);
  assert.ok(daiyu.quotes.some((text) => /甲戌本/.test(text)), '黛玉经典语录应带甲戌本来源');

  await openCharacter('xue_baochai');
  const baochaiTitles = await sectionTitles();
  assert.equal(baochaiTitles.includes('经典语录'), false, `宝钗不应再有经典语录: ${baochaiTitles.join(' / ')}`);
  assert.ok(baochaiTitles.includes('待校摘录') || baochaiTitles.includes('版本异文'), '宝钗应显示待校或版本异文');

  await openCharacter('wang_xifeng');
  const xifeng = {
    titles: await sectionTitles(),
    comparisonCount: await page.evaluate(() => document.querySelectorAll('#character-card-overlay .card-quote-comparison').length)
  };
  assert.equal(xifeng.titles.includes('经典语录'), false, `王熙凤不应把程乙本对照当经典语录: ${xifeng.titles.join(' / ')}`);
  assert.ok(xifeng.titles.some((title) => title.startsWith('版本异文')), `王熙凤应有版本异文: ${xifeng.titles.join(' / ')}`);
  assert.ok(xifeng.comparisonCount >= 1, '王熙凤应至少有一条程乙本对照');
});

// ============================================================
// TC-44: 结局展示门禁
// ============================================================
await run('TC-44 结局按底本/续书/待校分档', async () => {
  const outcomes = await page.evaluate(() => Object.fromEntries(
    ['jia_she', 'qingwen', 'wang_xifeng', 'jia_mu'].map((id) => [
      id,
      app.listView._formatOutcome(app.characterMap.get(id))
    ])
  ));
  assert.match(outcomes.jia_she, /^（续书）/, `贾赦结局应标续书: ${outcomes.jia_she}`);
  assert.match(outcomes.qingwen, /^（待校）/, `晴雯结局应标待校: ${outcomes.qingwen}`);
  assert.match(outcomes.wang_xifeng, /^（前八十回）/, `王熙凤结局应标前八十回: ${outcomes.wang_xifeng}`);
  assert.match(outcomes.jia_mu, /^（前八十回）/, `贾母结局应标前八十回: ${outcomes.jia_mu}`);
});

// ============================================================
// TC-45: 续书章节与关键事迹标签
// ============================================================
await run('TC-45 续书章节与关键事迹逐条标记', async () => {
  await openCharacter('lin_daiyu');
  const daiyu = await page.evaluate(() => ({
    chapters: document.querySelectorAll('#character-card-overlay .card-chapter-item').length,
    continuationChapters: document.querySelectorAll('#character-card-overlay .card-chapter-item.is-continuation').length,
    continuationEvents: document.querySelectorAll('#character-card-overlay .key-event-version').length,
    timelineContinuation: document.querySelectorAll('#character-card-overlay .card-fate-cell.is-continuation').length
  }));
  assert.equal(daiyu.chapters, 6, `黛玉应保留 6 个关键回目: ${JSON.stringify(daiyu)}`);
  assert.equal(daiyu.continuationChapters, 1, `黛玉应有 1 个续书章节: ${JSON.stringify(daiyu)}`);
  assert.ok(daiyu.continuationEvents >= 2, `黛玉焚稿/泪尽应标续书: ${JSON.stringify(daiyu)}`);
  assert.equal(daiyu.timelineContinuation, 1, `时间线第97回应标续书: ${JSON.stringify(daiyu)}`);

  await openCharacter('xue_baochai');
  const baochai = await page.evaluate(() => ({
    chapters: document.querySelectorAll('#character-card-overlay .card-chapter-item').length,
    continuationChapters: document.querySelectorAll('#character-card-overlay .card-chapter-item.is-continuation').length
  }));
  assert.equal(baochai.chapters, 6);
  assert.equal(baochai.continuationChapters, 2, `宝钗第97/120回应标续书: ${JSON.stringify(baochai)}`);
});

// ============================================================
// TC-46: 回目人物关联纠错
// ============================================================
await run('TC-46 回目人物关联纠错', async () => {
  await page.evaluate(() => app._closeCard());
  await page.click('[data-view="chapter"]');
  await sleep(900);
  const profiles = await page.evaluate(() => [1, 9, 81].map((chapter) => ({
    chapter,
    names: app.chapterView.chapterProfileMap.get(chapter).characters.map((item) => item.character.name)
  })));
  const names = (chapter) => profiles.find((item) => item.chapter === chapter).names;

  assert.ok(!names(1).includes('贾宝玉'), `第1回不应出现贾宝玉: ${names(1).join('、')}`);
  assert.ok(names(1).includes('甄士隐') && names(1).includes('贾雨村'), `第1回应有甄士隐/贾雨村: ${names(1).join('、')}`);
  assert.ok(!names(9).includes('贾芸') && !names(9).includes('小红'), `第9回不应出现贾芸/小红: ${names(9).join('、')}`);
  assert.ok(names(9).includes('秦钟') && names(9).includes('茗烟'), `第9回应有秦钟/茗烟: ${names(9).join('、')}`);
  assert.ok(names(81).includes('贾探春'), `第81回应有贾探春: ${names(81).join('、')}`);
  assert.ok(!names(81).includes('薛宝钗'), `第81回宝钗只是被提及，不应算出场: ${names(81).join('、')}`);

  const chapter81 = await page.evaluate(() => app.knowledge.find((item) => item.chapter === 81 && item.type === 'chapter'));
  assert.match(chapter81.content, /探春、李纹、李绮、邢岫烟/, '第81回四美名单应校正');
  assert.doesNotMatch(chapter81.content, /迎春、探春、惜春、黛玉/, '第81回不应保留错误四美名单');
});

// ============================================================
// TC-47: 审计队列与数据实际统计一致
// ============================================================
await run('TC-47 引语审计队列与数据统计一致', async () => {
  const audit = await page.evaluate(() => {
    const chars = app.characters;
    const quoteAudit = app.provenance.auditQueue.find((item) => item.id === 'character-quotes-without-source');
    return {
      quotes: chars.reduce((sum, character) => sum + (character.quotes || []).length, 0),
      quoteCharacters: chars.filter((character) => (character.quotes || []).length).length,
      pending: chars.reduce((sum, character) => sum + (character.quotesPendingVerified || []).length, 0),
      comparisons: chars.reduce((sum, character) => sum + (character.quoteComparisons || []).length, 0),
      unverifiedCharacters: chars.filter((character) =>
        (character.quotesPendingVerified || []).length || (character.quoteComparisons || []).length).length,
      audit: quoteAudit
    };
  });
  assert.equal(audit.quotes, 17);
  assert.equal(audit.quoteCharacters, 10);
  assert.equal(audit.pending, 120);
  assert.equal(audit.comparisons, 36);
  assert.equal(audit.unverifiedCharacters, 106);
  assert.equal(audit.audit.recordCount, 106);
  assert.equal(audit.audit.verifiedCount, 10);
  assert.equal(audit.audit.verifiedQuoteLines, 17);
  assert.equal(audit.audit.pendingQuoteLines, 120);
  assert.equal(audit.audit.comparisonQuoteLines, 36);
});

// ============================================================
// TC-49: 缺失人物与孤立节点
// ============================================================
await run('TC-49 缺失人物与孤立节点', async () => {
  const state = await page.evaluate(() => {
    const requiredIds = [
      'jia_yan', 'jia_yuan', 'zhen_baoyu', 'jia_cong', 'jin_rong',
      'li_shen', 'li_wen', 'li_qi', 'liu_saozi', 'bao_er',
      'duo_hunchong', 'feng_shi', 'huo_qi', 'jia_huang', 'huang_da_nainai'
    ];
    const characterIds = new Set(app.characters.map((character) => character.id));
    const linked = new Set(app.relationships.flatMap((relation) => [relation.source, relation.target]));
    return {
      missing: requiredIds.filter((id) => !characterIds.has(id)),
      isolated: app.characters.filter((character) => !linked.has(character.id)).map((character) => character.name),
      oldXuejiu: characterIds.has('old_xuejiu'),
      count: app.characters.length,
      relationshipCount: app.relationships.length
    };
  });
  assert.deepEqual(state.missing, [], `缺失人物: ${state.missing.join('、')}`);
  assert.deepEqual(state.isolated, [], `仍有孤立人物: ${state.isolated.join('、')}`);
  assert.equal(state.oldXuejiu, false, 'old_xuejiu 应与贾代儒合并');
  assert.ok(state.count >= 125, `人物数量异常: ${state.count}`);
  assert.ok(state.relationshipCount >= 200, `关系数量异常: ${state.relationshipCount}`);
});

// ============================================================
// TC-50: 家族辈分与兄妹方向
// ============================================================
await run('TC-50 家族辈分与兄妹方向', async () => {
  const state = await page.evaluate(() => {
    const byId = app.characterMap;
    const edge = (source, target) => app.relationships.find((relation) =>
      relation.source === source && relation.target === target && relation.type === 'blood');
    return {
      daihuaParent: byId.get('jia_daihua')?.parentIds.includes('jia_yan'),
      daishanParent: byId.get('jia_daishan')?.parentIds.includes('jia_yuan'),
      qinNatal: byId.get('qin_keqing')?.natalGeneration,
      qinMarried: byId.get('qin_keqing')?.marriedGeneration,
      xuePanToBaochai: Boolean(edge('xue_pan', 'xue_baochai')),
      xueKeToBaoqin: Boolean(edge('xue_ke', 'xue_baoqin')),
      yuanchunToBaoyu: Boolean(edge('jia_yuanchun', 'jia_baoyu')),
      xifengFamily: byId.get('wang_xifeng')?.family,
      xifengMarried: byId.get('wang_xifeng')?.marriedFamily
    };
  });
  assert.equal(state.daihuaParent, true, '贾代化应挂到贾演名下');
  assert.equal(state.daishanParent, true, '贾代善应挂到贾源名下');
  assert.equal(state.qinNatal, 3);
  assert.equal(state.qinMarried, 4);
  assert.equal(state.xuePanToBaochai, true, '兄妹方向应为薛蟠→薛宝钗');
  assert.equal(state.xueKeToBaoqin, true, '兄妹方向应为薛蝌→薛宝琴');
  assert.equal(state.yuanchunToBaoyu, true, '姐弟方向应为贾元春→贾宝玉');
  assert.equal(state.xifengFamily, '王家');
  assert.equal(state.xifengMarried, '贾家');
});

// ============================================================
// TC-51: 核心关系证据与无证据兜底
// ============================================================
await run('TC-51 核心关系证据与无证据兜底', async () => {
  await page.evaluate(() => app._switchView('graph'));
  await sleep(900);
  const state = await page.evaluate(() => {
    const coreMissing = app.relationships.filter((relation) => {
      if (relation.evidence?.length || relation.weight < 4) return false;
      const source = app.characterMap.get(relation.source);
      const target = app.characterMap.get(relation.target);
      return Math.max(source?.importance || 0, target?.importance || 0) >= 4;
    });
    const linkHits = [...document.querySelectorAll('#graph-container .link-hit')];
    const noEvidenceLink = app.graph.links.find((link) => !link.evidence.length);
    if (noEvidenceLink) app._showRelationshipCard(noEvidenceLink);
    return {
      coreMissing: coreMissing.length,
      linkHits: linkHits.length,
      clickable: linkHits.filter((element) => element.getAttribute('role') === 'button' && element.getAttribute('tabindex') === '0').length,
      fallbackText: document.querySelector('#character-card-overlay .relation-evidence-empty')?.innerText || ''
    };
  });
  assert.equal(state.coreMissing, 0, `仍有核心关系缺少证据: ${state.coreMissing}`);
  assert.equal(state.linkHits, state.clickable, `并非所有关系都可点击: ${state.clickable}/${state.linkHits}`);
  assert.match(state.fallbackText, /尚未整理回目依据/, '无证据关系应显示兜底说明');
});

// ============================================================
// TC-52: 新人物进入回目关联
// ============================================================
await run('TC-52 新人物进入回目关联', async () => {
  await page.evaluate(() => app._closeCard());
  await page.click('[data-view="chapter"]');
  await sleep(900);
  const profiles = await page.evaluate(() => [1, 9, 10, 81].map((chapter) => ({
    chapter,
    names: app.chapterView.chapterProfileMap.get(chapter).characters.map((item) => item.character.name)
  })));
  const names = (chapter) => profiles.find((item) => item.chapter === chapter).names;
  assert.ok(names(1).includes('封氏') && names(1).includes('霍启'), `第1回应有封氏/霍启: ${names(1).join('、')}`);
  assert.ok(names(9).includes('金荣'), `第9回应有金荣: ${names(9).join('、')}`);
  assert.ok(names(10).includes('璜大奶奶'), `第10回应有璜大奶奶: ${names(10).join('、')}`);
  assert.ok(names(81).includes('李纹') && names(81).includes('李绮'), `第81回应有李纹/李绮: ${names(81).join('、')}`);
});

await run('TC-53 控制台无错误', async () => {
  assert.equal(errors.length, 0, errors.join('\n'));
});

await browser.close();
console.log('\n========================================');
console.log(`数据可信度回归: ${results.filter((item) => item.ok).length} 通过, ${results.filter((item) => !item.ok).length} 失败 / 共 ${results.length}`);
console.log('========================================');
process.exitCode = results.some((item) => !item.ok) ? 1 : 0;
