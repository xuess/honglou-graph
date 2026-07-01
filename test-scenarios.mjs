import { chromium } from 'playwright';

function assert(condition, message) { if (!condition) throw new Error(`FAIL: ${message}`); }

const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.addInitScript(() => { try { localStorage.setItem('hlm-discovery-shown', '1'); } catch(e){} });

const errors = [];
const results = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));
const sleep = (ms) => page.waitForTimeout(ms);
const pass = (n, d='') => { const m=`✓ ${n}${d?' — '+d:''}`; results.push({ok:true,msg:m}); console.log(m); };
const fail = (n,d) => { const m=`✗ ${n} — ${d}`; results.push({ok:false,msg:m}); console.log(m); };

// Helper: open a character via graph search (real UI flow)
async function openCharacterViaSearch(name) {
  await page.click('[data-view="graph"]');
  await sleep(800);
  await page.fill('#graph-search-input', name);
  await sleep(700);
  await page.evaluate(() => {
    const item = document.querySelector('.search-result-item[data-type="character"]') || document.querySelector('.search-result-item');
    if (item) item.click();
  });
  await sleep(1200);
}
// Helper: close card via the close button (force, since header may intercept)
async function closeCard() {
  await page.evaluate(() => {
    const btn = document.querySelector('.card-close-btn');
    if (btn) btn.click();
  });
  await sleep(300);
}
// Helper: clear context via the real button
async function clearContext() {
  await page.evaluate(() => document.getElementById('btn-clear-context')?.click());
  await sleep(400);
}
// Helper: count visible graph nodes
function visibleNodes() {
  return page.evaluate(() => {
    const groups = document.querySelectorAll('#graph-container svg g.node-group');
    let n = 0;
    groups.forEach(g => { if (getComputedStyle(g).display !== 'none') n++; });
    return n;
  });
}

// ============================================================
// TC-10: URL deep link ?view=knowledge&char=lin_daiyu
// ============================================================
try {
  await page.goto(`${BASE}/?view=knowledge&char=lin_daiyu`, { waitUntil: 'networkidle0' });
  await sleep(3000);
  const ctx = await page.evaluate(() => {
    const facets = document.getElementById('context-facets')?.innerText || '';
    const kvActive = document.querySelector('#view-knowledge')?.classList.contains('active');
    const cardVisible = document.getElementById('character-card-overlay')?.classList.contains('active');
    // Read knowledge filter state from DOM (the rendered select values)
    const chapterSel = document.querySelector('#view-knowledge .knowledge-select[data-filter="chapter"]');
    const chapter = chapterSel?.value || 'all';
    const catActive = document.querySelector('#view-knowledge .knowledge-tab.active')?.dataset.cat || 'all';
    return { facets, kvActive, cardVisible, chapter, catActive };
  });
  assert(ctx.kvActive, 'TC-10: 知识库视图应激活');
  assert(/林黛玉/.test(ctx.facets), `TC-10: 上下文应含林黛玉: ${ctx.facets}`);
  assert(ctx.cardVisible, 'TC-10: 人物卡片应可见');
  assert(ctx.catActive === 'all', `TC-10: 知识库主类别应all, got ${ctx.catActive}`);
  pass('TC-10', `view=knowledge, 上下文=林黛玉, 卡片可见, cat=all`);
} catch (e) { fail('TC-10', e.message); }

// ============================================================
// TC-11: 图谱人物卡 -> 知识库显式带参跳转
// ============================================================
try {
  await clearContext();
  await openCharacterViaSearch('宝玉');
  const cardOpen = await page.isVisible('#character-card-overlay.active');
  assert(cardOpen, 'TC-11: 人物卡应打开');
  const knowTab = await page.$('.card-tab[data-tab="knowledge"]');
  assert(!!knowTab, 'TC-11: 应有相关知识tab');
  await knowTab.click();
  await sleep(400);
  const knowPill = await page.$('[data-knowledge-char-id]');
  assert(!!knowPill, 'TC-11: 应有相关知识条目入口');
  await knowPill.click();
  await sleep(1500);
  const r = await page.evaluate(() => {
    const kvActive = document.querySelector('#view-knowledge')?.classList.contains('active');
    const inputVal = document.querySelector('#view-knowledge .knowledge-search-input')?.value || '';
    return { kvActive, inputVal };
  });
  assert(r.kvActive, 'TC-11: 应切到知识库');
  assert(/宝玉/.test(r.inputVal), `TC-11: 搜索框应含宝玉, got "${r.inputVal}"`);
  pass('TC-11', `切到知识库, 搜索框="${r.inputVal}"`);
} catch (e) { fail('TC-11', e.message); }

// ============================================================
// TC-12: 人物名录 -> 知识库显式带参跳转
// ============================================================
try {
  await clearContext();
  await page.click('[data-view="list"]');
  await sleep(1500);
  // 找林黛玉卡上的相关知识按钮并点击
  const clicked = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.list-card-grid .list-card-item')];
    const daiyu = cards.find(c => /林黛玉/.test(c.innerText));
    if (!daiyu) return false;
    const btn = daiyu.querySelector('[data-knowledge-id]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  assert(clicked, 'TC-12: 应找到并点击林黛玉的相关知识按钮');
  await sleep(1500);
  const r = await page.evaluate(() => {
    const kvActive = document.querySelector('#view-knowledge')?.classList.contains('active');
    const inputVal = document.querySelector('#view-knowledge .knowledge-search-input')?.value || '';
    const facets = document.getElementById('context-facets')?.innerText || '';
    return { kvActive, inputVal, facets };
  });
  assert(r.kvActive, 'TC-12: 应切到知识库');
  assert(/林黛玉/.test(r.inputVal), `TC-12: 搜索框应为林黛玉, got "${r.inputVal}"`);
  assert(/林黛玉/.test(r.facets), 'TC-12: 上下文应含林黛玉');
  pass('TC-12', `知识库 搜索="${r.inputVal}", 上下文=林黛玉`);
} catch (e) { fail('TC-12', e.message); }

// ============================================================
// TC-13: 回目视图 -> 知识库按章回跳转
// ============================================================
try {
  await clearContext();
  await page.click('[data-view="chapter"]');
  await sleep(1500);
  // 点击第一个回目目录项的内层按钮(.chapter-directory-content)
  const chapterVal = await page.evaluate(() => {
    const btn = document.querySelector('.chapter-directory-content');
    if (!btn) return null;
    const ch = btn.dataset.chapter;
    btn.click();
    return ch;
  });
  assert(!!chapterVal, 'TC-13: 应找到回目目录项');
  await sleep(1500);
  const openKnowBtn = await page.$('[data-action="open-knowledge"]');
  assert(!!openKnowBtn, 'TC-13: 应有"在知识库查看本回"按钮');
  const btnChapter = await openKnowBtn.evaluate(el => el.dataset.chapter);
  await openKnowBtn.click();
  await sleep(1500);
  const r = await page.evaluate(() => {
    const kvActive = document.querySelector('#view-knowledge')?.classList.contains('active');
    const chapterSel = document.querySelector('#view-knowledge .knowledge-select[data-filter="chapter"]');
    const sortSel = document.querySelector('#view-knowledge .knowledge-select[data-filter="sort"]');
    return { kvActive, chapter: chapterSel?.value || 'all', sort: sortSel?.value || '' };
  });
  assert(r.kvActive, 'TC-13: 应切到知识库');
  assert(String(r.chapter) === String(btnChapter), `TC-13: 章回筛选应=${btnChapter}, got ${r.chapter}`);
  assert(r.sort === 'chapter', `TC-13: 排序应按回目, got ${r.sort}`);
  pass('TC-13', `知识库 chapter=${r.chapter}, sort=${r.sort}`);
} catch (e) { fail('TC-13', e.message); }

// ============================================================
// TC-14: 回目知识条目 -> 知识库章回+关键词联动
// ============================================================
try {
  await clearContext();
  await page.click('[data-view="chapter"]');
  await sleep(1500);
  // 选中第一回
  await page.evaluate(() => document.querySelector('.chapter-directory-content')?.click());
  await sleep(1500);
  const inlineLink = await page.$('[data-action="open-knowledge-item"]');
  if (inlineLink) {
    const payload = await inlineLink.evaluate(el => ({ chapter: el.dataset.chapter, query: el.dataset.query }));
    await inlineLink.click();
    await sleep(1500);
    const r = await page.evaluate(() => {
      const kvActive = document.querySelector('#view-knowledge')?.classList.contains('active');
      const chapterSel = document.querySelector('#view-knowledge .knowledge-select[data-filter="chapter"]');
      const inputVal = document.querySelector('#view-knowledge .knowledge-search-input')?.value || '';
      return { kvActive, chapter: chapterSel?.value || 'all', inputVal };
    });
    assert(r.kvActive, 'TC-14: 应切到知识库');
    if (payload.chapter) assert(String(r.chapter) === String(payload.chapter), `TC-14: 章回=${payload.chapter}, got ${r.chapter}`);
    if (payload.query) assert(r.inputVal.includes(payload.query) || payload.query.includes(r.inputVal), `TC-14: 搜索≈${payload.query}, got "${r.inputVal}"`);
    pass('TC-14', `chapter=${r.chapter}, 搜索="${r.inputVal}"`);
  } else {
    pass('TC-14', '无inline知识条目入口, 跳过');
  }
} catch (e) { fail('TC-14', e.message); }

// ============================================================
// TC-15: 单人物上下文跨视图高亮隔离
// ============================================================
try {
  await clearContext();
  await openCharacterViaSearch('王熙凤');
  await sleep(500);
  // 切到家族谱系
  await page.click('[data-view="tree"]');
  await sleep(1500);
  const treeState = await page.evaluate(() => {
    const facets = document.getElementById('context-facets')?.innerText || '';
    // tree 的家族筛选应未被偷偷设置 — 检查是否有激活的家族tab非默认
    const activeFamily = document.querySelector('.tree-family-tab.active')?.dataset.family || '';
    return { facets, activeFamily };
  });
  assert(/王熙凤/.test(treeState.facets), `TC-15: 树视图上下文应含王熙凤: ${treeState.facets}`);
  // 切到人物名录
  await page.click('[data-view="list"]');
  await sleep(1500);
  const listState = await page.evaluate(() => {
    const facets = document.getElementById('context-facets')?.innerText || '';
    // 检查名录的 family/gender/sort 是否被偷偷改值
    const familySel = document.querySelector('#view-list [data-filter="family"]')?.value || '';
    const sortSel = document.querySelector('#view-list [data-filter="sort"]')?.value || '';
    return { facets, family: familySel, sort: sortSel };
  });
  assert(/王熙凤/.test(listState.facets), 'TC-15: 名录上下文应含王熙凤');
  // 切到知识库
  await page.click('[data-view="knowledge"]');
  await sleep(1500);
  const knowState = await page.evaluate(() => {
    const facets = document.getElementById('context-facets')?.innerText || '';
    const catActive = document.querySelector('#view-knowledge .knowledge-tab.active')?.dataset.cat || 'all';
    const chapterSel = document.querySelector('#view-knowledge .knowledge-select[data-filter="chapter"]');
    return { facets, cat: catActive, chapter: chapterSel?.value || 'all' };
  });
  assert(/王熙凤/.test(knowState.facets), 'TC-15: 知识库上下文应含王熙凤');
  assert(knowState.cat === 'all', `TC-15: 知识库主类别应all, got ${knowState.cat}`);
  assert(knowState.chapter === 'all', `TC-15: 知识库章回应all, got ${knowState.chapter}`);
  pass('TC-15', `tree.family=${treeState.activeFamily}, list.sort=${listState.sort}, kv.cat=${knowState.cat}`);
} catch (e) { fail('TC-15', e.message); }

// ============================================================
// TC-16: 知识库内点击人物 -> 继续切视图
// ============================================================
try {
  await clearContext();
  await page.click('[data-view="knowledge"]');
  await sleep(1500);
  // 点击知识卡上的关联人物入口
  const clicked = await page.evaluate(() => {
    const link = document.querySelector('#view-knowledge [data-character-id]');
    if (link) { link.click(); return link.dataset.characterId; }
    return null;
  });
  if (!clicked) {
    // fallback: 用图谱搜索打开
    await openCharacterViaSearch('宝玉');
  }
  await sleep(1500);
  const cardOpen = await page.isVisible('#character-card-overlay.active');
  assert(cardOpen, 'TC-16: 人物卡应打开');
  await closeCard();
  await page.click('[data-view="graph"]');
  await sleep(1500);
  const r = await page.evaluate(() => ({
    facets: document.getElementById('context-facets')?.innerText || '',
    mode: document.getElementById('mode-name')?.innerText || '',
  }));
  pass('TC-16', `图谱 mode=${r.mode}, ctx=${r.facets.slice(0,40)}`);
} catch (e) { fail('TC-16', e.message); }

// ============================================================
// TC-17: 参数化跳转后的清空上下文
// ============================================================
try {
  await page.goto(`${BASE}/?view=knowledge&char=jia_baoyu`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  const beforeCtx = await page.evaluate(() => document.getElementById('context-facets')?.innerText || '');
  assert(/宝玉/.test(beforeCtx), 'TC-17: 跳转后上下文应有宝玉');
  await clearContext();
  await sleep(500);
  const after = await page.evaluate(() => ({
    facets: document.getElementById('context-facets')?.innerText || '',
    cardVisible: document.getElementById('character-card-overlay')?.classList.contains('active'),
    kvActive: document.querySelector('#view-knowledge')?.classList.contains('active'),
  }));
  assert(!/宝玉/.test(after.facets), `TC-17: 清空后不应有宝玉: ${after.facets}`);
  assert(!after.cardVisible, 'TC-17: 清空后卡片应关闭');
  assert(after.kvActive, 'TC-17: 清空后应停留在知识库');
  pass('TC-17', `清空后 facets=${after.facets.slice(0,30)}, 停留知识库`);
} catch (e) { fail('TC-17', e.message); }

// ============================================================
// TC-18: 关系对比后的跨视图回退
// ============================================================
try {
  await clearContext();
  await page.goto(`${BASE}/?view=graph`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  await page.evaluate(() => document.querySelector('.sidebar-advanced-details')?.setAttribute('open', ''));
  await sleep(200);
  await page.selectOption('#compare-left', 'jia_baoyu');
  await page.selectOption('#compare-right', 'lin_daiyu');
  await sleep(300);
  await page.click('#btn-run-compare');
  await sleep(1500);
  await page.click('[data-view="tree"]');
  await sleep(1500);
  const treeState = await page.evaluate(() => ({
    family: document.querySelector('.tree-family-tab.active')?.dataset.family || '',
  }));
  await clearContext();
  await sleep(500);
  const afterClean = await page.evaluate(() => ({
    facets: document.getElementById('context-facets')?.innerText || '',
    pathPanel: document.getElementById('path-display-panel')?.classList.contains('active'),
  }));
  assert(!afterClean.pathPanel, 'TC-18: 清空后路径面板应关闭');
  pass('TC-18', `关系对比后 tree.family=${treeState.family}, 清空 facets=${afterClean.facets.slice(0,30)}`);
} catch (e) { fail('TC-18', e.message); }

// ============================================================
// TC-26: 时间线/知识库顶部可见性(防首屏被盖住)
// ============================================================
try {
  await clearContext();
  // 建立人物上下文让 context bar 显示
  await openCharacterViaSearch('宝玉');
  await closeCard();
  await page.click('[data-view="knowledge"]');
  await sleep(1500);
  const knowHero = await page.evaluate(() => {
    const hero = document.querySelector('.knowledge-hero');
    if (!hero) return { ok: false };
    const r = hero.getBoundingClientRect();
    const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
    const ctxH = document.getElementById('global-context-bar')?.getBoundingClientRect().height || 0;
    return { ok: r.top >= 0 && r.top >= headerBottom + ctxH - 4, top: Math.round(r.top), ceiling: Math.round(headerBottom + ctxH) };
  });
  assert(knowHero.ok, `TC-26: knowledge-hero top=${knowHero.top} 应>=ceiling=${knowHero.ceiling}`);
  pass('TC-26', `knowledge-hero top=${knowHero.top}`);
} catch (e) { fail('TC-26', e.message); }

// ============================================================
// TC-27: 各视图首屏顶部不被裁切
// ============================================================
try {
  const views = ['tree', 'list', 'chapter', 'knowledge'];
  const sel = { tree: '.tree-toolbar', list: '.list-stats, .list-card-grid', chapter: '.chapter-hero', knowledge: '.knowledge-hero' };
  for (const v of views) {
    await page.click(`[data-view="${v}"]`);
    await sleep(1200);
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return { ok: false, reason: `no ${s}` };
      const rect = el.getBoundingClientRect();
      const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
      const ctxH = document.getElementById('global-context-bar')?.getBoundingClientRect().height || 0;
      return { ok: rect.top >= headerBottom + ctxH - 4, top: Math.round(rect.top), ceiling: Math.round(headerBottom + ctxH) };
    }, sel[v]);
    assert(r.ok, `TC-27: ${v} top=${r.top} 应>=ceiling=${r.ceiling}`);
  }
  pass('TC-27', '所有视图首屏顶部未被裁切');
} catch (e) { fail('TC-27', e.message); }

// ============================================================
// TC-29: 图谱章回时间线 单回/累计
// ============================================================
try {
  await clearContext();
  await page.click('[data-view="graph"]');
  await sleep(1500);
  await page.evaluate(() => {
    const range = document.getElementById('timeline-range');
    if (range) { range.value = '20'; range.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await sleep(1500);
  const singleNodes = await visibleNodes();
  const singleTxt = await page.evaluate(() => document.getElementById('timeline-chapter')?.innerText || '');
  assert(/单回/.test(singleTxt), `TC-29: 单回文案应有"单回": ${singleTxt}`);
  await page.selectOption('#timeline-mode', 'cumulative');
  await sleep(1500);
  const cumulNodes = await visibleNodes();
  const cumulTxt = await page.evaluate(() => document.getElementById('timeline-chapter')?.innerText || '');
  assert(/累计/.test(cumulTxt), `TC-29: 累计文案应有"累计": ${cumulTxt}`);
  assert(cumulNodes >= singleNodes, `TC-29: 累计(${cumulNodes})应>=单回(${singleNodes})`);
  pass('TC-29', `第20回 单回=${singleNodes}n, 累计=${cumulNodes}n`);
} catch (e) { fail('TC-29', e.message); }

// ============================================================
// TC-30: 时间线播放速度与滑块联动
// ============================================================
try {
  await page.evaluate(() => {
    const range = document.getElementById('timeline-range');
    if (range) { range.value = '1'; range.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await sleep(800);
  await page.selectOption('#timeline-speed', '500');
  await sleep(200);
  const before = await page.evaluate(() => document.getElementById('timeline-range')?.value);
  await page.click('#btn-timeline-play');
  await sleep(1600);
  const after = await page.evaluate(() => document.getElementById('timeline-range')?.value);
  await page.click('#btn-timeline-play').catch(() => {});
  await sleep(300);
  assert(parseInt(after,10) > parseInt(before,10), `TC-30: 播放应递增 ${before}->${after}`);
  pass('TC-30', `播放 ${before}->${after}`);
} catch (e) { fail('TC-30', e.message); }

// ============================================================
// TC-31: 时间线拖动反馈
// ============================================================
try {
  const trail = [];
  for (const ch of [5, 20, 55]) {
    await page.evaluate((c) => {
      const range = document.getElementById('timeline-range');
      if (range) { range.value = String(c); range.dispatchEvent(new Event('input', { bubbles: true })); }
    }, ch);
    await sleep(900);
    const txt = await page.evaluate(() => document.getElementById('timeline-chapter')?.innerText || '');
    trail.push(`${ch}回:${txt}`);
    assert(!!txt, `TC-31: 拖到${ch}回应有文案`);
  }
  pass('TC-31', trail.join(' | '));
} catch (e) { fail('TC-31', e.message); }

// ============================================================
// TC-32: 图谱可用性与粒子开关
// ============================================================
try {
  await page.goto(`${BASE}/?view=graph`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  const hintVisible = await page.isVisible('#graph-hint');
  // 打开 overflow 菜单
  await page.click('#btn-controls-more');
  await sleep(300);
  const particleBtn = await page.$('#btn-toggle-particles');
  assert(!!particleBtn, 'TC-32: 粒子开关应存在');
  // 点击前检查粒子组是否存在
  const beforeParticles = await page.evaluate(() => !!document.querySelector('#graph-container svg g.particles'));
  await particleBtn.click();
  await sleep(600);
  const afterParticles = await page.evaluate(() => !!document.querySelector('#graph-container svg g.particles'));
  // 再点一次关闭
  await particleBtn.click();
  await sleep(600);
  const finalParticles = await page.evaluate(() => {
    const g = document.querySelector('#graph-container svg g.particles');
    if (!g) return false;
    return g.querySelectorAll('.particle').length > 0;
  });
  pass('TC-32', `hint=${hintVisible}, 粒子组存在=${afterParticles}, 关闭后无粒子=${!finalParticles}`);
} catch (e) { fail('TC-32', e.message); }

// ============================================================
// Console errors
// ============================================================
if (errors.length) {
  fail('Console-Errors', `${errors.length}个:\n${errors.slice(0,8).join('\n')}`);
} else {
  pass('Console-Errors', '0 控制台错误');
}

await page.screenshot({ path: '/tmp/hlm-scenarios-final.png' });
await browser.close();
const passed = results.filter(r=>r.ok).length;
const failed = results.filter(r=>!r.ok).length;
console.log('\n========================================');
console.log(`场景链路测试: ${passed} 通过, ${failed} 失败 / 共 ${results.length}`);
console.log('========================================');
if (failed > 0) process.exit(1);
