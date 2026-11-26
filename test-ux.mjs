import assert from 'node:assert/strict';
import { loadPlaywright } from './scripts/playwright-loader.mjs';

const { chromium } = await loadPlaywright();
const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch();
const errors = [];
const results = [];

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
const sleep = (page, ms) => page.waitForTimeout(ms);

async function openPage(viewport = { width: 1440, height: 900 }, initScript) {
  const context = await browser.newContext({ viewport });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return { context, page };
}

// ============================================================
// TC-34: 跨视图保留知识库阅读位置
// ============================================================
await run('TC-34 跨视图保留知识库滚动位置', async () => {
  const { context, page } = await openPage();
  try {
    await page.goto(`${BASE}/?view=knowledge`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.knowledge-card');
    await sleep(page, 700);
    await page.evaluate(() => { document.querySelector('.knowledge-main').scrollTop = 720; });
    await sleep(page, 300);
    const before = await page.evaluate(() => document.querySelector('.knowledge-main').scrollTop);
    assert.ok(before >= 600, `切换前滚动位置异常: ${before}`);

    await page.click('[data-view="tree"]');
    await sleep(page, 700);
    await page.click('[data-view="knowledge"]');
    await sleep(page, 800);
    const after = await page.evaluate(() => document.querySelector('.knowledge-main').scrollTop);
    assert.ok(after >= 600, `切回后滚动位置丢失: ${after}`);
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-35: 知识库吸顶结果栏与回到顶部
// ============================================================
await run('TC-35 知识库吸顶结果栏与回到顶部', async () => {
  const { context, page } = await openPage();
  try {
    await page.goto(`${BASE}/?view=knowledge`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.knowledge-card');
    await sleep(page, 700);
    const initial = await page.evaluate(() => ({
      hidden: document.querySelector('[data-action="back-to-top"]')?.hidden,
      position: getComputedStyle(document.querySelector('.knowledge-results-head')).position
    }));
    assert.equal(initial.hidden, true, '未滚动时回到顶部按钮应隐藏');
    assert.equal(initial.position, 'sticky', '桌面端结果栏应吸顶');

    await page.evaluate(() => { document.querySelector('.knowledge-main').scrollTop = 760; });
    await sleep(page, 400);
    const scrolled = await page.evaluate(() => ({
      hidden: document.querySelector('[data-action="back-to-top"]')?.hidden,
      headTop: Math.round(document.querySelector('.knowledge-results-head').getBoundingClientRect().top),
      mainTop: Math.round(document.querySelector('.knowledge-main').getBoundingClientRect().top)
    }));
    assert.equal(scrolled.hidden, false, '滚动后回到顶部按钮应出现');
    assert.ok(Math.abs(scrolled.headTop - scrolled.mainTop) <= 2, `吸顶结果栏偏移: ${JSON.stringify(scrolled)}`);

    await page.click('[data-action="back-to-top"]');
    await sleep(page, 900);
    const after = await page.evaluate(() => ({
      top: document.querySelector('.knowledge-main').scrollTop,
      hidden: document.querySelector('[data-action="back-to-top"]')?.hidden
    }));
    assert.equal(after.top, 0, '回到顶部后 scrollTop 应为 0');
    assert.equal(after.hidden, true, '回到顶部后按钮应重新隐藏');
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-36: 其他人物按身份分组并关联主家谱系
// ============================================================
await run('TC-36 其他人物按身份分组', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { context, page } = await openPage(viewport);
    try {
      await page.goto(`${BASE}/?view=tree`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.tree-shell');
      await sleep(page, 500);
      await page.click('.tree-family-tab[data-family="其他"]');
      await sleep(page, 500);
      const state = await page.evaluate(() => ({
        cards: document.querySelectorAll('.tree-other-card').length,
        expected: app.characters.filter((character) =>
          !['贾家', '史家', '王家', '薛家', '林家'].includes(character.family)).length,
        groups: [...document.querySelectorAll('.tree-other-group')].map((group) => ({
          title: group.querySelector('.tree-other-group-title')?.innerText || '',
          count: group.querySelectorAll('.tree-other-card').length,
          hasFamilyLink: !!group.querySelector('.tree-other-family-link')
        })),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      assert.equal(state.cards, state.expected, `其他人物数量异常: ${state.cards}/${state.expected}`);
      assert.ok(state.expected >= 65, `其他人物数量异常: ${state.expected}`);
      assert.ok(state.groups.length >= 5, `身份分组不足: ${state.groups.length}`);
      assert.equal(state.groups.reduce((sum, group) => sum + group.count, 0), state.expected);
      assert.ok(state.groups.some((group) => /丫鬟/.test(group.title) && group.hasFamilyLink), '贾府丫鬟组应有主家谱系入口');
      assert.ok(state.groups.some((group) => /僧道神仙/.test(group.title)), '应有僧道神仙分组');
      assert.ok(state.overflow <= 1, `横幅溢出: ${state.overflow}`);

      await page.click('.tree-other-family-link');
      await sleep(page, 500);
      const jumped = await page.evaluate(() => ({
        family: app.treeView?.currentFamily,
        query: app.treeView?.searchQuery
      }));
      assert.equal(jumped.family, '贾家', `主家谱系跳转失败: ${JSON.stringify(jumped)}`);
      assert.equal(jumped.query, '', '跳转主家谱系应清空搜索词');
    } finally {
      await context.close();
    }
  }
});

// ============================================================
// TC-37: 全站搜索类型筛选、结果计数与最近记录
// ============================================================
await run('TC-37 全站搜索筛选与最近记录', async () => {
  const { context, page } = await openPage({ width: 1440, height: 900 }, () => {
    localStorage.setItem('hlm-exploration-seen', '1');
    localStorage.setItem('hlm-search-history', JSON.stringify(['黛玉', '第5回']));
  });
  try {
    await page.goto(`${BASE}/?view=list`, { waitUntil: 'networkidle' });
    await sleep(page, 600);
    await page.click('#global-search-toggle');
    await sleep(page, 300);
    const history = await page.evaluate(() => ({
      items: [...document.querySelectorAll('[data-global-history]')].map((item) => item.innerText),
      active: document.querySelector('.global-search-filter.active')?.innerText,
      status: document.querySelector('#global-search-status')?.innerText
    }));
    assert.deepEqual(history.items, ['黛玉', '第5回']);
    assert.equal(history.active, '全部');
    assert.match(history.status, /输入关键词/);

    await page.fill('#global-search-input', '宝玉');
    await sleep(page, 700);
    const all = await page.evaluate(() => ({
      count: document.querySelectorAll('#global-search-results [data-type]').length,
      status: document.querySelector('#global-search-status')?.innerText || ''
    }));
    assert.ok(all.count > 0, '全站搜索应返回结果');
    assert.match(all.status, /找到\s*\d+\s*条结果/);

    await page.click('.global-search-filter[data-search-type="knowledge"]');
    await sleep(page, 500);
    const filtered = await page.evaluate(() => ({
      types: [...document.querySelectorAll('#global-search-results [data-type]')].map((item) => item.dataset.type),
      groups: [...document.querySelectorAll('#global-search-results .search-group-title')].map((item) => item.innerText)
    }));
    assert.ok(filtered.types.length > 0, '知识筛选后应有结果');
    assert.ok(filtered.types.every((type) => type === 'knowledge'), `知识筛选混入其他类型: ${filtered.types}`);
    assert.equal(filtered.groups.length, 1, '知识筛选后应只剩知识分组');

    await page.keyboard.press('Escape');
    await sleep(page, 200);
    assert.equal(await page.evaluate(() => document.getElementById('global-search-overlay').classList.contains('active')), false);

    await page.keyboard.press('Meta+Shift+K');
    await sleep(page, 300);
    assert.equal(await page.evaluate(() => document.getElementById('global-search-overlay').classList.contains('active')), true);
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-38: 知识卡回到所属回目
// ============================================================
await run('TC-38 知识卡回到所属回目', async () => {
  const { context, page } = await openPage();
  try {
    await page.goto(`${BASE}/?view=knowledge`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.knowledge-card');
    await sleep(page, 700);
    const target = await page.evaluate(() => {
      for (const card of document.querySelectorAll('.knowledge-card')) {
        const chapterText = card.querySelector('.knowledge-card-chapter')?.textContent || '';
        const chapter = Number((chapterText.match(/\d+/) || [])[0]);
        if (!chapter) continue;
        card.querySelector('.knowledge-card-header')?.click();
        return { id: card.dataset.id, chapter };
      }
      return null;
    });
    assert.ok(target, '应找到带章回的知识卡');
    await sleep(page, 700);
    const jump = page.locator(`.knowledge-card[data-id="${target.id}"] [data-chapter-jump]`);
    assert.equal(await jump.count(), 1, '展开后应有回目跳转按钮');
    assert.equal(await jump.isVisible(), true);
    await jump.click();
    await sleep(page, 900);
    const chapterState = await page.evaluate(() => ({
      active: document.querySelector('.view-panel.active')?.id,
      current: app.chapterView?.activeChapter,
      focused: document.activeElement === document.querySelector('.chapter-focus-title'),
      label: document.getElementById('fullscreen-view-label')?.innerText || ''
    }));
    assert.equal(chapterState.active, 'view-chapter');
    assert.equal(chapterState.current, target.chapter);
    assert.equal(chapterState.focused, true, '跳转后焦点应落到回目标题');
    assert.match(chapterState.label, new RegExp(`第${target.chapter}回`));

    await page.goBack();
    await sleep(page, 900);
    assert.equal(await page.evaluate(() => document.querySelector('.view-panel.active')?.id), 'view-knowledge');
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-39: 人物卡章节完整展示并跳转
// ============================================================
await run('TC-39 人物卡章节完整展示并跳转', async () => {
  const { context, page } = await openPage();
  try {
    await page.goto(`${BASE}/?view=graph`, { waitUntil: 'networkidle' });
    await sleep(page, 700);
    const expected = await page.evaluate(() => {
      const character = app.characters.find((item) => (item.chapters || []).length === 6);
      if (!character) return null;
      app._openCharacter(character.id);
      return { id: character.id, count: character.chapters.length };
    });
    assert.ok(expected, '应找到有 6 回记录的人物');
    await sleep(page, 700);
    const card = await page.evaluate(() => ({
      count: document.querySelectorAll('.card-chapters [data-chapter-jump]').length,
      label: document.querySelector('.card-section-count')?.innerText
    }));
    assert.equal(card.count, expected.count, `人物卡章节被截断: ${card.count}/${expected.count}`);
    assert.match(card.label, new RegExp(`^${expected.count} 回`), `人物卡章节计数异常: ${card.label}`);

    const chapter = await page.evaluate(() => Number(document.querySelector('.card-chapters [data-chapter-jump]')?.dataset.chapterJump));
    await page.click('.card-chapters [data-chapter-jump]');
    await sleep(page, 900);
    const state = await page.evaluate(() => ({
      active: document.querySelector('.view-panel.active')?.id,
      current: app.chapterView?.activeChapter
    }));
    assert.equal(state.active, 'view-chapter');
    assert.equal(state.current, chapter);
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-40: 无障碍跳转、状态播报与减少动态效果
// ============================================================
await run('TC-40 无障碍跳转与状态播报', async () => {
  const { context, page } = await openPage();
  try {
    await page.goto(`${BASE}/?view=graph`, { waitUntil: 'networkidle' });
    await sleep(page, 600);
    await page.keyboard.press('Tab');
    assert.match(await page.evaluate(() => document.activeElement?.className || ''), /skip-link/);
    await page.keyboard.press('Enter');
    await sleep(page, 300);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');

    await page.click('[data-view="knowledge"]');
    await sleep(page, 800);
    const aria = await page.evaluate(() => ({
      role: document.querySelector('.knowledge-results-subtitle')?.getAttribute('role'),
      live: document.querySelector('.knowledge-results-subtitle')?.getAttribute('aria-live'),
      pressed: document.querySelector('[data-action="toggle-all-cards"]')?.getAttribute('aria-pressed')
    }));
    assert.equal(aria.role, 'status');
    assert.equal(aria.live, 'polite');
    assert.equal(aria.pressed, 'false');

    const targetId = await page.evaluate(() => {
      const items = app.knowledgeView._getFilteredItems();
      return items[5]?.id;
    });
    assert.ok(targetId);
    await page.evaluate((id) => app._openKnowledgeItem(id), targetId);
    await sleep(page, 1000);
    const focusCard = await page.evaluate(() => document.activeElement?.closest('.knowledge-card')?.dataset.id);
    assert.equal(focusCard, targetId, '知识定位后焦点应在目标卡片内');
  } finally {
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const page = await reduced.newPage();
    await page.goto(`${BASE}/?view=knowledge`, { waitUntil: 'networkidle' });
    await sleep(page, 500);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
  } finally {
    await reduced.close();
  }
});

// ============================================================
// TC-41: 装饰字体非阻塞首屏
// ============================================================
await run('TC-41 装饰字体非阻塞加载', async () => {
  const { context, page } = await openPage();
  try {
    await page.route('**/css/display-font.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await page.goto(`${BASE}/?view=graph`, { waitUntil: 'domcontentloaded' });
    await sleep(page, 200);
    const early = await page.evaluate(() => ({
      media: document.querySelector('link[href*="display-font"]')?.media,
      fetched: performance.getEntriesByType('resource').some((entry) => /zcool/.test(entry.name))
    }));
    assert.equal(early.media, 'print', '装饰字体样式表初始应为非阻塞');
    assert.equal(early.fetched, false, '首屏阶段不应请求装饰字体');

    await sleep(page, 1200);
    await page.evaluate(() => document.fonts.ready);
    const late = await page.evaluate(() => ({
      media: document.querySelector('link[href*="display-font"]')?.media,
      fetched: performance.getEntriesByType('resource').some((entry) => /zcool/.test(entry.name))
    }));
    assert.equal(late.media, 'all', '加载完成后装饰字体样式表应启用');
    assert.equal(late.fetched, true, '加载完成后应请求装饰字体');
  } finally {
    await context.close();
  }
});

// ============================================================
// TC-42: 控制台无错误
// ============================================================
await run('TC-42 控制台无错误', async () => {
  assert.equal(errors.length, 0, errors.join('\n'));
});

await browser.close();
console.log('\n========================================');
console.log(`UX 回归测试: ${results.filter((item) => item.ok).length} 通过, ${results.filter((item) => !item.ok).length} 失败 / 共 ${results.length}`);
console.log('========================================');
process.exitCode = results.some((item) => !item.ok) ? 1 : 0;
