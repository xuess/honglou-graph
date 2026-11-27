#!/usr/bin/env node
/**
 * 校验预生成语音与 knowledge.json 的对应关系。
 *
 * 语音是按条目的 content 生成的，文件名只含 id，不含文本指纹；如果 content
 * 改了而音频没重生成，页面会播出旧文案。这里用与前端一致的归一化哈希
 * （NFKC + 去空白/标点）比对，标点样式变化不会误报，实际字词变化才会。
 *
 * 用法:
 *   node scripts/check-audio.mjs           # 有人声缺失/过期则退出码 1
 *   node scripts/check-audio.mjs --json    # 机器可读输出
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knowledge = JSON.parse(readFileSync(resolve(root, 'data/knowledge.json'), 'utf8'));
const manifestData = JSON.parse(readFileSync(resolve(root, 'audio/audio-manifest.json'), 'utf8'));
const manifest = manifestData.manifest || {};
// 顶层 engines 可能只记录了最近一次生成的音色；以条目里实际出现的 engine 为准。
const engineNames = [...new Set([
  ...Object.keys(manifestData.engines || {}),
  ...Object.values(manifest).flatMap((entry) =>
    Object.keys(entry).filter((key) => key.startsWith('engine:')).map((key) => key.slice(7))
  )
])].sort();
const engines = engineNames.map((name) => `engine:${name}`);

/** TTS 文案指纹：只关心会被读出来的字词，忽略空白与标点。 */
const speechHash = (text) => {
  const normalized = String(text || '')
    .normalize('NFKC')
    .replace(/[\p{P}\p{Z}\s]+/gu, '');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
};

const byId = new Map(knowledge.map((item) => [item.id, item]));
const missing = [];
const stale = [];
const failed = [];
const missingFiles = [];

for (const item of knowledge) {
  const entry = manifest[item.id];
  if (!entry) {
    missing.push({ id: item.id, title: item.title, engines: [...engineNames] });
    continue;
  }
  const expected = speechHash(item.content);
  for (const engine of engines) {
    const voice = entry[engine];
    const name = engine.replace('engine:', '');
    if (!voice || !voice.file || voice.status === 'failed') {
      failed.push({ id: item.id, title: item.title, engine: name, status: voice?.status || 'missing' });
      continue;
    }
    if (!existsSync(resolve(root, voice.file))) {
      missingFiles.push({ id: item.id, engine: name, file: voice.file });
    }
    // 引擎条目自带 textHash 时以它为准，否则沿用条目顶层的（旧清单格式）。
    const actual = voice.textHash || entry.textHash || null;
    if (actual !== expected) {
      stale.push({ id: item.id, title: item.title, engine: name, expected, actual });
    }
  }
}

const orphans = Object.keys(manifest).filter((id) => !byId.has(id));

// 文件存在但没有任何清单条目引用：通常是条目删除/改名后的残留。
const referencedFiles = new Set(
  Object.values(manifest).flatMap((entry) =>
    Object.entries(entry)
      .filter(([key, value]) => key.startsWith('engine:') && value?.file)
      .map(([, value]) => value.file)
  )
);
const audioDir = resolve(root, 'audio/knowledge');
const orphanFiles = existsSync(audioDir)
  ? readdirSync(audioDir)
      .filter((name) => name.endsWith('.mp3'))
      .map((name) => `audio/knowledge/${name}`)
      .filter((file) => !referencedFiles.has(file))
  : [];

const summary = {
  knowledgeItems: knowledge.length,
  manifestItems: Object.keys(manifest).length,
  engines: engineNames,
  missingEntries: missing.length,
  staleText: stale.length,
  failedVoices: failed.length,
  missingFiles: missingFiles.length,
  orphanEntries: orphans.length,
  orphanFiles: orphanFiles.length
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, missing, stale, failed, missingFiles, orphans, orphanFiles }, null, 2));
} else {
  console.log('语音覆盖:', JSON.stringify(summary));
  if (missing.length) {
    console.log('\n缺少音频条目:');
    for (const x of missing) console.log(`  - ${x.id}  ${x.title || ''}`);
  }
  if (stale.length) {
    console.log('\n文案已改、音频未重生成:');
    for (const x of stale) console.log(`  - ${x.id}  ${x.engine}  ${x.title || ''}`);
  }
  if (failed.length) {
    console.log('\n失败/待重生成的人声:');
    for (const x of failed) console.log(`  - ${x.id}  ${x.engine}  (${x.status})`);
  }
  if (missingFiles.length) {
    console.log('\n清单指向的文件不存在:');
    for (const x of missingFiles) console.log(`  - ${x.id}  ${x.engine}  ${x.file}`);
  }
  if (orphans.length) {
    console.log('\n知识库中已不存在的孤儿条目:', orphans.join(', '));
  }
  if (orphanFiles.length) {
    console.log('\n没有任何条目引用的音频文件:');
    for (const file of orphanFiles) console.log(`  - ${file}`);
  }
}

const hasErrors = missing.length || stale.length || failed.length || missingFiles.length || orphanFiles.length;
if (hasErrors) {
  console.error('\n✗ 语音与文案不一致，请重新生成上述条目');
  process.exit(1);
}
console.log('\n✓ 语音与文案一致');
