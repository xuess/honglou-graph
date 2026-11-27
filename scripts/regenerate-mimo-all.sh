#!/usr/bin/env bash
# 用当前（已确认的）朗读方式批量生成全部知识库 MiMo 音频
#
# 用法（在项目根目录）:
#   bash scripts/regenerate-mimo-all.sh            # 全部重做：缺失 + 失败 + 文案已改 + 旧版指令生成的
#   bash scripts/regenerate-mimo-all.sh changed    # 只补：缺失 + 失败 + 文案已改（旧音频保持不动）
#   bash scripts/regenerate-mimo-all.sh preview    # 只统计，不生成
#
# Key 读取项目根目录 .env.mimo（或环境变量 MIMO_API_KEY）。可随时 Ctrl+C，重跑会从断点继续。
set -uo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-all}"
PY=.venv/bin/python
GEN=scripts/generate-mimo-v2.py
VOICES="白桦,苏打,茉莉"
ENGINES="mimo_白桦,mimo_苏打,mimo_茉莉"

case "$MODE" in
  all)     ARGS=(--stale-prompt) ;;
  changed) ARGS=() ;;
  preview) $PY $GEN --voices "$VOICES" --stale-prompt --dry-run; exit $? ;;
  *) echo "未知模式: $MODE（可选 all / changed / preview）"; exit 2 ;;
esac

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$HOME/honglou-audio-backup-$STAMP"
echo "① 备份现有音频与清单 → $BACKUP"
mkdir -p "$BACKUP" && cp -R audio/knowledge "$BACKUP/" && cp audio/audio-manifest.json "$BACKUP/" \
  || { echo "备份失败，已停止"; exit 1; }

echo "② 从清单移除已不再使用的 Edge 引擎条目"
$PY - <<'EOF'
import json
from pathlib import Path
p = Path("audio/audio-manifest.json")
data = json.loads(p.read_text(encoding="utf-8"))
removed = 0
for entry in data.get("manifest", {}).values():
    for key in [k for k in entry if k.startswith("engine:edge_")]:
        del entry[key]
        removed += 1
for key in [k for k in data.get("engines", {}) if k.startswith("edge_")]:
    del data["engines"][key]
p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"   移除 {removed} 条")
EOF

echo "③ 生成（失败的条目自动重试，最多 3 轮）"
for round in 1 2 3; do
  # ${ARGS[@]+...}：兼容 macOS 自带 bash 3.2 在 set -u 下展开空数组报错
  $PY $GEN --voices "$VOICES" ${ARGS[@]+"${ARGS[@]}"}
  code=$?
  [ $code -eq 0 ] && break
  [ $code -eq 2 ] && { echo "没有可用的 Key，已停止"; exit 2; }
  [ $round -lt 3 ] && { echo "   第 $round 轮有失败，30 秒后重试…"; sleep 30; }
done

echo "④ 压缩个别超长静音（不调用接口）"
$PY $GEN --voices "$VOICES" --fix-pauses

echo "⑤ 刷新前端清单版本号与资源指纹"
NEW_VER=$(date +%Y-%m-%d-%H%M)
sed -i '' -E "s/(this\._manifestVersion = ')[^']*'/\1${NEW_VER}'/" js/audio-preload-cache.js
npm run --silent stamp

echo "⑥ 校验语音与文案是否一致"
node scripts/check-audio.mjs --engines "$ENGINES"
status=$?

echo
# 变量后紧跟中文标点时必须写成 ${BACKUP}，否则 bash 会把标点的字节当成变量名的一部分
echo "旧音频备份在 ${BACKUP}，确认新音频没问题后可删除。"
exit $status
