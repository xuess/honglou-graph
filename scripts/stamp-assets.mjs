#!/usr/bin/env node
/**
 * 把 index.html 中本地资源的 ?v= 改写为「资源内容哈希」。
 *
 * 手工维护的版本号会漂移（曾出现 app.js 的 ?v= 早于文件修改时间数月的情况），
 * 导致 Cloudflare 边缘缓存把旧 JS 配新 HTML 发给回访用户。
 *
 * 用内容哈希而不是 git sha：未提交的改动同样会失效缓存，本地调试不会被自己的缓存骗到。
 * 用法：
 *   node scripts/stamp-assets.mjs          # 写入
 *   node scripts/stamp-assets.mjs --check  # 仅校验，版本号与内容不符则退出码 1
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(root, 'index.html');
const checkOnly = process.argv.includes('--check');

// 只处理本地资源，外链（CDN）不动。
const ASSET_RE = /((?:href|src)=")((?!https?:|\/\/|data:)[^"]+\.(?:js|mjs|css))(\?v=[^"]*)?(")/g;
// 模块脚本用动态 import 加载，版本号写在 import 字符串里而不是 src 属性上。
const DYNAMIC_IMPORT_RE = /(import\(\s*['"])(\.\/[^'"?]+\.mjs)(\?v=[^'"]*)?(['"]\s*\))/g;

const html = readFileSync(indexPath, 'utf8');

// 所有资源共用一个哈希：整站版本一致，便于排查「JS 与 CSS 版本错配」。
// 动态 import 的路径是相对 index.html 的 ./js/xxx.mjs，比较时去掉开头的 ./。
const toDiskPath = (p) => p.replace(/^\.\//, '');
const assetPaths = [
  ...[...html.matchAll(ASSET_RE)].map((m) => m[2]),
  ...[...html.matchAll(DYNAMIC_IMPORT_RE)].map((m) => m[2]),
];
const missing = assetPaths.filter((p) => !existsSync(resolve(root, toDiskPath(p))));
if (missing.length) {
  console.error(`index.html 引用了不存在的资源：${missing.join(', ')}`);
  process.exit(1);
}

// data/*.json 由 app.js 用 ?v= 拉取（见 _loadData），也必须计入哈希，
// 否则改了数据但版本号不变，浏览器会继续用旧的 JSON。
const dataPaths = readdirSync(resolve(root, 'data'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => `data/${name}`);

// 字体文件只能从 css/fonts.css 里引用，拿不到 HTML 的 ?v=；
// 子集重建后文件名不变，回访用户会一直用旧 WOFF2（曾出现「回」渲染成实心块）。
// 这里按字体内容哈希给 @font-face 的 url() 打版本号。
const fontsCssPath = resolve(root, 'css/fonts.css');
let expectedFontsCss = null;
if (existsSync(fontsCssPath)) {
  const fontFiles = readdirSync(resolve(root, 'assets/fonts/subset'))
    .filter((name) => name.endsWith('.woff2'))
    .sort();
  const fontHash = createHash('sha256');
  for (const name of fontFiles) {
    fontHash.update(name);
    fontHash.update(readFileSync(resolve(root, 'assets/fonts/subset', name)));
  }
  const fontVersion = fontHash.digest('hex').slice(0, 10);
  const FONT_URL_RE = /(url\(\s*['"]?)(\.\.\/assets\/fonts\/subset\/[^'")]+?\.woff2)(\?v=[^'")]*)?(['"]?\s*\))/g;
  const fontsCss = readFileSync(fontsCssPath, 'utf8');
  let fontStale = 0;
  const nextCss = fontsCss.replace(FONT_URL_RE, (_m, pre, path, _ver, post) => {
    const next = `${pre}${path}?v=${fontVersion}${post}`;
    if (`${pre}${path}${_ver || ''}${post}` !== next) fontStale += 1;
    return next;
  });
  if (nextCss !== fontsCss) {
    expectedFontsCss = nextCss;
    if (!checkOnly) writeFileSync(fontsCssPath, nextCss);
  }
  console.log(`✓ 字体 URL 版本号 -> ${fontVersion}（${fontStale} 处变更，${fontFiles.length} 个 WOFF2）`);
}

const hash = createHash('sha256');
for (const p of [...assetPaths, ...dataPaths].sort()) {
  hash.update(p);
  const content = (p === 'css/fonts.css' && expectedFontsCss !== null)
    ? expectedFontsCss
    : readFileSync(resolve(root, toDiskPath(p)));
  hash.update(content);
}
const version = hash.digest('hex').slice(0, 10);

let stale = 0;
const restamp = (pre, path, _ver, post) => {
  const next = `${pre}${path}?v=${version}${post}`;
  if (`${pre}${path}${_ver || ''}${post}` !== next) stale += 1;
  return next;
};
const META_RE = /(<meta name="hlm-asset-version" content=")([^"]*)(")/;
const rewritten = html
  .replace(ASSET_RE, (_m, pre, path, _ver, post) => restamp(pre, path, _ver, post))
  .replace(DYNAMIC_IMPORT_RE, (_m, pre, path, _ver, post) => restamp(pre, path, _ver, post))
  .replace(META_RE, (_m, pre, _value, post) => {
    if (`${_m}` !== `${pre}${version}${post}`) stale += 1;
    return `${pre}${version}${post}`;
  });

if (checkOnly) {
  if (stale) {
    console.error(`index.html 有 ${stale} 处资源版本号与内容哈希 ${version} 不一致，请运行：npm run stamp`);
    process.exit(1);
  }
  console.log(`✓ 全部本地资源版本号均为 ${version}`);
  process.exit(0);
}

writeFileSync(indexPath, rewritten);

console.log(`✓ 资源版本号 -> ${version}（${stale} 处变更，${assetPaths.length} 个资源 + ${dataPaths.length} 个数据文件）`);
