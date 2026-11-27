#!/usr/bin/env python3
"""
小米 MiMo TTS 增量补全知识库音频

Key（不写进代码）：
  读取环境变量 MIMO_API_KEY（逗号分隔）以及项目根目录的 .env.mimo（已被 .gitignore 的 .env.* 忽略），
  两处的 Key 合并去重。sk- 开头走按量付费接口，tp- 开头走 Token Plan 接口。
  开始生成前会逐个探测，401/402 的 Key 自动跳过。

用法（在项目根目录）:
  .venv/bin/python scripts/generate-mimo-v2.py --dry-run                          # 只统计
  .venv/bin/python scripts/generate-mimo-v2.py --dry-run --show-text --ids poem_zanghua   # 看实际发给模型的内容
  .venv/bin/python scripts/generate-mimo-v2.py --ids poem_zanghua --voices 茉莉 --force   # 试一条
  .venv/bin/python scripts/generate-mimo-v2.py                                     # 补全缺失/失败/过期
  .venv/bin/python scripts/generate-mimo-v2.py --types poem,verse,prophecy,couplet,riddle --force  # 按新断句重做诗词

断句控制（依据 MiMo 官方文档的两种方式）：
  ① user 消息 = 自然语言朗读指令（语速、停顿、节奏），不会被读出来；
  ② assistant 消息 = 待读文本，可在开头放 (风格) 标签、句中插入（停顿）等音频标签。
  诗词类（poem/verse/prophecy/couplet/riddle）：开头加 (--poem-style) 风格标签，句号/问号/叹号后插入
  --sentence-tag，换行（一联/一节）处插入 --line-tag，并配专门的吟诵指令。
  其他类：配讲解指令，按原文标点与段落朗读。
  注意：MiMo 会把文本里的（…）/(…)/[…] 当作标签，所以原文的“（第三十一回）”之类会先改写成普通标点，
  【拼音】这类小标题改写成“拼音：”。

增量规则：某条目某音色只有在 ① mp3 不存在 ② 上次失败 ③ 该音色记录的文案指纹与当前文案不一致
（旧清单没有音色级指纹时，退回条目顶层的 textHash）④ 指定 --force 时才会生成。
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
import os
import re
import sys
import threading
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib import error, request

ROOT_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_FILE = ROOT_DIR / "data" / "knowledge.json"
AUDIO_DIR = ROOT_DIR / "audio" / "knowledge"
MANIFEST_FILE = ROOT_DIR / "audio" / "audio-manifest.json"
KEY_FILE = ROOT_DIR / ".env.mimo"

PAYG_BASE_URL = "https://api.xiaomimimo.com/v1"
TOKEN_PLAN_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
MODEL = "mimo-v2.5-tts"
DEFAULT_VOICES = "白桦,苏打,茉莉"
POEM_TYPES = {"poem", "verse", "prophecy", "couplet", "riddle"}
# 朗读指令/文本处理方式的版本。改了指令就递增，配合 --stale-prompt 可只重做旧版本生成的音频。
PROMPT_VERSION = "v3"
MAX_RETRIES = 3
SAVE_EVERY = 20

POEM_INSTRUCTION = (
    "古典诗词朗诵。语速正常，和平常朗读一样，不要刻意放慢；吐字清晰，带一点感情起伏，不要拖腔。"
    "严格按诗句断句：逗号处轻微停顿，句号、问号、叹号处稍作停顿，每一联换行处停顿约一秒，不要出现长时间的空白。"
    "句内按意群读，五言按“二、三”、七言按“二、二、三”的节奏，不要把上下句连成一口气，也不要在词语中间断开。"
)
PROSE_INSTRUCTION = (
    "沉稳温和的文化讲解，像博物馆讲解员娓娓道来。语速正常，按标点自然断句："
    "逗号短停，句号明显停顿，段落之间稍作停留；人名、书名和引文要读清楚。"
)


class FatalAPIError(Exception):
    """Key 无效或余额不足：继续请求没有意义。"""


def slugify(s):
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", s)


def speech_hash(text):
    """与 scripts/check-audio.mjs、前端 AudioPreloadCache 保持一致。"""
    normalized = unicodedata.normalize("NFKC", text or "")
    normalized = "".join(
        ch for ch in normalized
        if not ch.isspace() and not unicodedata.category(ch).startswith(("P", "Z"))
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ─── Key ─────────────────────────────────────────────────────────────────────

def load_keys():
    raw = os.environ.get("MIMO_API_KEY", "")
    if KEY_FILE.exists():
        raw += "\n" + KEY_FILE.read_text(encoding="utf-8")
    seen, keys = set(), []
    for k in re.findall(r"\b(?:sk|tp)-[A-Za-z0-9]{20,}", raw):
        if k not in seen:
            seen.add(k)
            keys.append(k)
    return keys


def base_url_for(key):
    return TOKEN_PLAN_BASE_URL if key.startswith("tp-") else PAYG_BASE_URL


# ─── 文本准备 ─────────────────────────────────────────────────────────────────

def clean_punct(t):
    t = re.sub(r"([，。！？；：、])[，、]+", r"\1", t)
    t = re.sub(r"[，、]+([。！？；：])", r"\1", t)
    t = re.sub(r"^[，、]+", "", t, flags=re.M)
    t = re.sub(r"[，、]+$", "。", t, flags=re.M)
    return t


def neutralize_brackets(text):
    """MiMo 把 ()（）[] 里的内容当作风格/音频标签，原文里的括号要改写，否则会被吞掉不读。
    注释性括号改成「」（不是 MiMo 的标签括号，读起来是轻微停顿），小标题【拼音】改成“拼音：”。"""
    text = re.sub(r"【([^】]+)】\s*", r"\1：", text)
    text = re.sub(r"[（(]([^）)]*)[）)]", r"「\1」", text)
    text = re.sub(r"[\[\]]", "", text)
    text = text.replace("：：", "：")
    return clean_punct(text)


def build_messages(item, args):
    text = neutralize_brackets(item["content"].strip())
    style = "poem" if item.get("type") in POEM_TYPES else "prose"
    if args.plain:
        return style, "朗读", item["content"].strip()
    if style == "poem":
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if args.sentence_tag:
            lines = [re.sub(r"([。！？])(?=[^。！？\s”’])", r"\1" + args.sentence_tag, l) for l in lines]
        # 不用标签时保留换行，模型会把换行当作一联/一节的分隔
        body = args.line_tag.join(lines) if args.line_tag else "\n".join(lines)
        if args.poem_style:
            body = f"({args.poem_style}){body}"
        return style, args.poem_instruction or POEM_INSTRUCTION, body
    return style, args.prose_instruction or PROSE_INSTRUCTION, text


def split_text(text, max_len=500):
    if len(text) <= max_len:
        return [text]
    chunks, cur = [], ""
    for s in re.split(r"(?<=[。！？；\n])", text):
        if not s.strip():
            continue
        if len(cur) + len(s) > max_len and cur:
            chunks.append(cur)
            cur = ""
        cur += s
    if cur.strip():
        chunks.append(cur)
    return chunks


# ─── 静音压缩 ─────────────────────────────────────────────────────────────────
# MiMo 返回 MPEG-2 Layer III、24 kHz、单声道的 VBR MP3，每帧固定 576 采样 = 24 ms；
# 静音段被编码成 8 kbps 的最小帧。模型偶尔会在停顿标签处生成几十秒甚至几分钟的空白，
# 这里把连续静音帧压到 --max-pause 以内（保留静音段末尾若干帧，避免位池引用丢失产生杂音）。

_MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
_MPEG2_RATES = [22050, 24000, 16000]
FRAME_MS = 24


def mp3_frames_vbr(data):
    frames, i, n = [], 0, len(data)
    while i + 4 <= n:
        b1, b2 = data[i + 1], data[i + 2]
        if data[i] == 0xFF and (b1 & 0xE0) == 0xE0 and ((b1 >> 3) & 3) == 2:
            br = _MPEG2_BITRATES[(b2 >> 4) & 15]
            sri = (b2 >> 2) & 3
            if br and sri < 3:
                length = 72 * br * 1000 // _MPEG2_RATES[sri] + ((b2 >> 1) & 1)
                frames.append((i, length, br))
                i += length
                continue
        i += 1
    return frames


def compress_silence(data, max_pause_ms, keep_tail=12):
    """返回 (新音频, 原时长秒, 新时长秒)。无法解析时原样返回。"""
    frames = mp3_frames_vbr(data)
    if not frames or max_pause_ms <= 0:
        dur = len(frames) * FRAME_MS / 1000
        return data, dur, dur
    limit = max(keep_tail + 2, round(max_pause_ms / FRAME_MS))
    keep = [True] * len(frames)
    i = 0
    while i < len(frames):
        if frames[i][2] <= 8:
            start = i
            while i < len(frames) and frames[i][2] <= 8:
                i += 1
            if i - start > limit:
                for k in range(start + limit - keep_tail, i - keep_tail):
                    keep[k] = False
        else:
            i += 1
    out = bytearray(data[:frames[0][0]])
    for (off, length, _), k in zip(frames, keep):
        if k:
            out += data[off:off + length]
    return bytes(out), len(frames) * FRAME_MS / 1000, sum(keep) * FRAME_MS / 1000


# ─── 调用 ─────────────────────────────────────────────────────────────────────

def gen_one(text, key, voice, instruction):
    payload = json.dumps({
        "model": MODEL,
        "modalities": ["text", "audio"],
        "audio": {"voice": voice, "format": "mp3"},
        "messages": [
            {"role": "user", "content": instruction},
            {"role": "assistant", "content": text},
        ],
    }).encode("utf-8")
    for attempt in range(MAX_RETRIES + 1):
        req = request.Request(
            f"{base_url_for(key)}/chat/completions", data=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        try:
            with request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read())
            if "error" in body:
                raise RuntimeError(str(body["error"])[:200])
            return base64.b64decode(body["choices"][0]["message"]["audio"]["data"])
        except error.HTTPError as e:
            detail = e.read()[:300].decode("utf-8", "ignore")
            if e.code in (401, 402, 403):
                raise FatalAPIError(f"HTTP {e.code}: {detail}")
            if attempt < MAX_RETRIES and (e.code == 429 or e.code >= 500):
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {e.code}: {detail}")
        except (error.URLError, TimeoutError) as e:
            if attempt < MAX_RETRIES:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"{type(e).__name__}: {e}")


def check_keys(keys, voice):
    """用一句短文本逐个探测 Key，返回 (可用 Key 列表, [(Key 尾号, 原因)])。"""
    def probe(key):
        try:
            gen_one("测试", key, voice, "朗读")
            return key, None
        except FatalAPIError as e:
            return key, str(e).replace("\n", " ")[:90]
        except Exception as e:
            return key, f"{type(e).__name__}: {str(e)[:80]}"

    good, bad = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(keys))) as pool:
        for key, err in pool.map(probe, keys):
            (bad.append((f"{key[:3]}…{key[-6:]}", err)) if err else good.append(key))
    return good, bad


# ─── 清单 ─────────────────────────────────────────────────────────────────────

def needs_generation(entry, engine_key, fpath, expected, force, stale_prompt=False):
    if force:
        return True
    voice = (entry or {}).get(engine_key)
    if not voice or voice.get("status") == "failed" or not voice.get("file"):
        return True
    if not fpath.exists() or fpath.stat().st_size < 1024:
        return True
    if stale_prompt and voice.get("prompt") != PROMPT_VERSION:
        return True
    return (voice.get("textHash") or (entry or {}).get("textHash")) != expected


def load_manifest():
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    return {"engines": {}, "manifest": {}, "textHashAlgorithm": "sha256(nfkc-cjk-strip-punct)"}


def save_manifest(data, knowledge_count):
    data["generatedAt"] = datetime.now().isoformat(timespec="seconds")
    data["knowledgeItems"] = knowledge_count
    data["manifestEntries"] = len(data.get("manifest", {}))
    tmp = MANIFEST_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, MANIFEST_FILE)


# ─── 主流程 ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="MiMo TTS 增量补全知识库音频")
    p.add_argument("--voices", default=DEFAULT_VOICES, help=f"逗号分隔（默认 {DEFAULT_VOICES}）")
    p.add_argument("--ids", help="只生成这些条目 id（逗号分隔）")
    p.add_argument("--types", help="只生成这些类型，如 poem,verse,prophecy,couplet,riddle")
    p.add_argument("--limit", type=int, default=0, help="最多生成多少个音频")
    p.add_argument("--force", action="store_true", help="强制重新生成")
    p.add_argument("--stale-prompt", action="store_true",
                   help=f"同时重做用旧版指令生成的音频（清单里 prompt 不是 {PROMPT_VERSION} 的）")
    p.add_argument("--dry-run", action="store_true", help="只统计，不生成")
    p.add_argument("--show-text", action="store_true", help="配合 --dry-run 打印发给模型的指令和文本")
    p.add_argument("--concurrency", type=int, default=0, help="并发数（默认每个可用 Key 2 个）")
    p.add_argument("--skip-key-check", action="store_true", help="跳过开始前的 Key 可用性检测")
    p.add_argument("--plain", action="store_true", help="恢复旧行为：只发“朗读”+原文，不加指令和标签")
    p.add_argument("--poem-style", default="", help="诗词开头的风格标签，如“舒缓”（默认不加）")
    p.add_argument("--sentence-tag", default="", help="诗词句末（。！？）后插入的标签，如“（停顿）”（默认不加）")
    p.add_argument("--line-tag", default="", help="诗词换行处插入的标签，如“（停顿）”（默认不加，保留换行）")
    p.add_argument("--max-pause", type=int, default=1200, help="静音最长保留多少毫秒（默认 1200；0 不压缩）")
    p.add_argument("--fix-pauses", action="store_true",
                   help="不调用接口，只把已有 MiMo 音频里的超长静音压到 --max-pause 以内")
    p.add_argument("--poem-instruction", help="覆盖诗词类的朗读指令")
    p.add_argument("--prose-instruction", help="覆盖散文类的朗读指令")
    args = p.parse_args()

    keys = load_keys()
    if not keys and not args.dry_run and not args.fix_pauses:
        sys.exit("没有找到 Key：export MIMO_API_KEY=sk-xxx，或写入项目根目录 .env.mimo（每行一个）")

    knowledge = json.loads(KNOWLEDGE_FILE.read_text(encoding="utf-8"))
    items = knowledge
    if args.ids:
        wanted = {x.strip() for x in args.ids.split(",") if x.strip()}
        unknown = wanted - {i["id"] for i in knowledge}
        if unknown:
            print(f"⚠️ 知识库中不存在: {', '.join(sorted(unknown))}")
        items = [i for i in items if i["id"] in wanted]
    if args.types:
        types = {x.strip() for x in args.types.split(",") if x.strip()}
        items = [i for i in items if i.get("type") in types]

    voices = [v.strip() for v in args.voices.split(",") if v.strip()]
    data = load_manifest()
    manifest = data.setdefault("manifest", {})
    engines = data.setdefault("engines", {})

    if args.fix_pauses:
        fixed = total_saved = 0
        for voice in voices:
            tag = f"mimo_{voice}"
            for item in items:
                fpath = AUDIO_DIR / f"{slugify(item['id'])}_{tag}.mp3"
                if not fpath.exists():
                    continue
                audio, raw_dur, dur = compress_silence(fpath.read_bytes(), args.max_pause or 1200)
                if raw_dur - dur < 0.5:
                    continue
                if not args.dry_run:
                    tmp = fpath.with_name(fpath.name + ".part")
                    tmp.write_bytes(audio)
                    os.replace(tmp, fpath)
                    rec = manifest.get(item["id"], {}).get(f"engine:{tag}")
                    if rec:
                        rec.update(durationSec=round(dur, 1), rawDurationSec=round(raw_dur, 1))
                fixed += 1
                total_saved += raw_dur - dur
                print(f"  {'[预览] ' if args.dry_run else ''}{fpath.name}  {raw_dur:.0f}s → {dur:.0f}s")
        if fixed and not args.dry_run:
            save_manifest(data, len(knowledge))
        print(f"压缩 {fixed} 个文件，共去掉 {total_saved:.0f}s 空白（上限 {args.max_pause or 1200}ms）")
        return 0

    jobs = []
    reasons = {"缺失": 0, "失败": 0, "文案已改": 0, "旧版指令": 0, "强制": 0}
    for voice in voices:
        tag = f"mimo_{voice}"
        engine_key = f"engine:{tag}"
        for item in items:
            if not (item.get("content") or "").strip():
                continue
            fname = f"{slugify(item['id'])}_{tag}.mp3"
            fpath = AUDIO_DIR / fname
            expected = speech_hash(item.get("content", ""))
            entry = manifest.get(item["id"])
            if needs_generation(entry, engine_key, fpath, expected, args.force, args.stale_prompt):
                v = (entry or {}).get(engine_key)
                if args.force:
                    reasons["强制"] += 1
                elif not v or not fpath.exists():
                    reasons["缺失"] += 1
                elif v.get("status") == "failed":
                    reasons["失败"] += 1
                elif (v.get("textHash") or (entry or {}).get("textHash")) != expected:
                    reasons["文案已改"] += 1
                else:
                    reasons["旧版指令"] += 1
                jobs.append((item, voice, tag, fname, fpath, expected))
    if args.limit:
        jobs = jobs[: args.limit]

    chars = sum(len(j[0]["content"]) for j in jobs)
    print(f"知识库 {len(knowledge)} 条 · 音色 {', '.join(voices)} · Key {len(keys)} 个")
    print(f"待生成 {len(jobs)} 个音频，共 {chars} 字（" + "，".join(f"{k} {v}" for k, v in reasons.items() if v) + "）")
    if args.dry_run or not jobs:
        shown = set()
        for item, voice, *_ in jobs[:20]:
            style, instruction, body = build_messages(item, args)
            print(f"  - {item['id']}  {voice}  {item.get('title', '')}  [{style}]")
            if args.show_text and item["id"] not in shown:
                shown.add(item["id"])
                print(f"      user     : {instruction}")
                print("      assistant: " + body.replace("\n", "\n                 "))
        if len(jobs) > 20:
            print(f"  … 另有 {len(jobs) - 20} 个")
        return 0

    if not args.skip_key_check:
        print(f"检测 {len(keys)} 个 Key …")
        keys, bad = check_keys(keys, voices[0])
        for tail, err in bad:
            print(f"  ✗ {tail}  {err}")
        print(f"  可用 {len(keys)} 个" + ("" if bad else "（全部可用）"))
        if not keys:
            print("没有可用的 Key：401 检查 Key 是否有效；402 对应账号需要充值。", file=sys.stderr)
            return 2
    concurrency = args.concurrency or max(1, 2 * len(keys))
    print(f"并发 {concurrency}")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for voice in voices:
        engines[f"mimo_{voice}"] = {"model": MODEL, "voice": voice, "provider": "mimo", "prompt": PROMPT_VERSION}

    lock = threading.Lock()
    stop = threading.Event()
    state = {"done": 0, "ok": 0, "fail": 0, "fatal": None}
    failures = []
    start = time.time()

    def run(idx, job):
        item, voice, tag, fname, fpath, expected = job
        if stop.is_set():
            return
        key = keys[idx % len(keys)]
        style, instruction, body = build_messages(item, args)
        try:
            parts = [gen_one(c, key, voice, instruction) for c in split_text(body)]
            audio, raw_dur, dur = compress_silence(b"".join(parts), args.max_pause)
            tmp = fpath.with_name(fpath.name + ".part")
            tmp.write_bytes(audio)
            os.replace(tmp, fpath)
            record = {"file": f"audio/knowledge/{fname}", "status": "generated",
                      "durationSec": round(dur, 1), "rawDurationSec": round(raw_dur, 1)}
        except FatalAPIError as e:
            with lock:
                state["fatal"] = str(e)
            stop.set()
            return  # 不改清单：保留原有记录，处理后重跑即可
        except Exception as e:
            record = {"file": None, "status": "failed", "error": str(e)[:200]}
        with lock:
            entry = manifest.setdefault(item["id"], {})
            entry.setdefault("textHash", expected)
            entry[f"engine:{tag}"] = {
                **record, "voice": voice, "model": MODEL, "provider": "mimo",
                "style": style, "prompt": "plain" if args.plain else PROMPT_VERSION,
                "textHash": expected, "generatedAt": datetime.now().isoformat(timespec="seconds"),
            }
            state["done"] += 1
            if record["status"] == "generated":
                state["ok"] += 1
            else:
                state["fail"] += 1
                failures.append((item["id"], voice, record.get("error", "")[:120]))
            rate = state["done"] / max(time.time() - start, 1) * 60
            sys.stdout.write(f"\r  [{state['done']}/{len(jobs)}] ✅{state['ok']} ❌{state['fail']}  {rate:.0f}/min   ")
            sys.stdout.flush()
            if state["done"] % SAVE_EVERY == 0:
                save_manifest(data, len(knowledge))

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            list(pool.map(lambda a: run(*a), enumerate(jobs)))
    except KeyboardInterrupt:
        stop.set()
        print("\n已中断，进度已写入清单，重跑即可继续。")
    finally:
        save_manifest(data, len(knowledge))

    print(f"\n完成：✅{state['ok']} ❌{state['fail']}  耗时 {time.time() - start:.0f}s")
    if state["fatal"]:
        print(f"✗ 已停止：{state['fatal']}\n  401 检查 Key；402 账户余额不足，充值后重跑会从断点继续。")
    for fid, voice, err in failures[:30]:
        print(f"  - {fid}  {voice}  {err}")
    print("下一步：npm run check:audio -- --engines " + ",".join(f"mimo_{v}" for v in voices))
    return 1 if (state["fail"] or state["fatal"]) else 0


if __name__ == "__main__":
    sys.exit(main())
