import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * 解析 Playwright。
 * 1. 默认从本仓库 node_modules 加载（npm install 后即可）。
 * 2. 没有本地依赖时，允许用 PLAYWRIGHT_MODULE 指向任意一份 playwright 包，
 *    方便在未安装 node_modules 的检出版本里复用已有环境跑回归。
 */
export async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright'
  ].filter(Boolean);

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      failures.push(`${candidate}: ${err.code || err.message}`);
    }
  }

  throw new Error(
    '未找到 Playwright。请先运行 `npm install`，或设置 PLAYWRIGHT_MODULE 指向 playwright 包目录。\n'
    + `已尝试：\n- ${failures.join('\n- ')}`
  );
}
