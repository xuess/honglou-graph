#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8080';
const baseUrl = `http://localhost:${port}`;
const suites = [
  { name: '回归 / 数据完整性', file: 'test-hlm.mjs' },
  { name: '跨视图场景链路', file: 'test-scenarios.mjs' },
  { name: '交互与无障碍回归', file: 'test-ux.mjs' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function serverReady() {
  try {
    const response = await fetch(`${baseUrl}/index.html`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverReady()) {
    console.log(`使用已运行的本地服务器：${baseUrl}`);
    return null;
  }

  const python = process.env.PYTHON || 'python3';
  console.log(`启动本地服务器：${python} -m http.server ${port}`);
  const child = spawn(python, ['-m', 'http.server', port], {
    cwd: root,
    stdio: 'ignore'
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) break;
    if (await serverReady()) return child;
    await sleep(250);
  }

  child.kill();
  throw new Error(`本地服务器启动失败：${baseUrl}`);
}

function runSuite(suite) {
  console.log(`\n=== ${suite.name} (${suite.file}) ===`);
  const result = spawnSync(process.execPath, [suite.file], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: port }
  });
  if (result.error) {
    console.error(result.error);
    return false;
  }
  return result.status === 0;
}

const server = await ensureServer();
const results = [];
try {
  for (const suite of suites) {
    results.push({ suite, ok: runSuite(suite) });
  }
} finally {
  server?.kill();
}

console.log('\n========================================');
for (const { suite, ok } of results) {
  console.log(`${ok ? '✓' : '✗'} ${suite.name}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(`${results.length - failed} 套通过, ${failed} 套失败 / 共 ${results.length} 套`);
console.log('========================================');

process.exitCode = failed ? 1 : 0;
