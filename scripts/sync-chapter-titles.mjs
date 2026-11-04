#!/usr/bin/env node
/**
 * 把 characters.json 里各人物的 chapters[].title 同步为 knowledge.json 的 chapter 条目标题。
 *
 * 同一回目原本在 characters.json 和 knowledge.json 各存一份，已经漂移出 9 处不一致
 * （如第 39 回「信口开合/信口开河」、第 62 回「芍药裀/芍药裷」）。knowledge.json 覆盖
 * 全部 120 回，是唯一真源；characters.json 只保留回号与摘要。
 *
 * 用法：
 *   node scripts/sync-chapter-titles.mjs           # 写入
 *   node scripts/sync-chapter-titles.mjs --check   # 仅报告差异，退出码 1
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const charactersPath = resolve(root, 'data/characters.json');
const knowledgePath = resolve(root, 'data/knowledge.json');
const checkOnly = process.argv.includes('--check');

const characters = JSON.parse(readFileSync(charactersPath, 'utf8'));
const knowledge = JSON.parse(readFileSync(knowledgePath, 'utf8'));

// knowledge 的标题形如「第39回 村姥姥是信口开河 情哥哥偏寻根究底」，去掉回号前缀。
const titleByChapter = new Map();
for (const entry of knowledge) {
  if (entry.type !== 'chapter' || !Number.isInteger(entry.chapter)) continue;
  titleByChapter.set(entry.chapter, String(entry.title || '').replace(/^第\d+回\s*/, '').trim());
}

const drift = [];
let updated = 0;
for (const character of characters) {
  for (const item of character.chapters || []) {
    const canonical = titleByChapter.get(Number(item.chapter));
    if (!canonical || item.title === canonical) continue;
    drift.push(`${character.id} 第${item.chapter}回：「${item.title}」→「${canonical}」`);
    if (!checkOnly) {
      item.title = canonical;
      updated += 1;
    }
  }
}

if (checkOnly) {
  if (drift.length) {
    console.error(`characters.json 有 ${drift.length} 条回目与 knowledge.json 不一致：`);
    drift.forEach((line) => console.error(`  - ${line}`));
    process.exit(1);
  }
  console.log('✓ characters.json 的回目与 knowledge.json 完全一致');
  process.exit(0);
}

if (updated) {
  writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);
  console.log(`✓ 同步 ${updated} 条回目`);
  drift.slice(0, 12).forEach((line) => console.log(`  - ${line}`));
} else {
  console.log('✓ 无需同步');
}
