#!/usr/bin/env python3
"""从维基文库《脂砚斋重评石头记》会校本提取人物文本提及。

注意：该会校本由庚辰、己卯、甲戌合成，64/67/22 回以其他脂本配入，
只用于“文本提及索引”，不能单独支撑经典语录或事实定本。
"""
import json
import re
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://zh.wikisource.org"
INDEX = f"{BASE}/zh-hans/%E8%84%82%E7%A1%AF%E9%BD%8B%E9%87%8D%E8%A9%95%E7%9F%B3%E9%A0%AD%E8%A8%98"
SOURCE_ID = "wikisource-liaoping-synthesis"
HEADERS = {"User-Agent": "honglou-graph text-mention index builder (public-domain research)"}
ANNOTATION_RE = re.compile(r"【[^】]*】|\[[^\]]*\]")
SPACE_RE = re.compile(r"\s+")
CHAPTER_RE = re.compile(r"第[一二三四五六七八九十百零〇两]+回")


def text_of(node):
    return SPACE_RE.sub("", ANNOTATION_RE.sub("", node.get_text(" ", strip=True)))


def chapter_links():
    response = requests.get(INDEX, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    links = []
    seen = set()
    for anchor in soup.select(".mw-parser-output a[href]"):
        href = anchor.get("href", "")
        decoded = unquote(href)
        if "/脂硯齋重評石頭記/第" not in decoded:
            continue
        label = SPACE_RE.sub("", anchor.get_text(" ", strip=True))
        if not CHAPTER_RE.search(label):
            continue
        path = unquote(href).split("/wiki/", 1)
        if len(path) != 2:
            continue
        page = f"{BASE}/zh-hans/{path[1]}"
        if page in seen:
            continue
        seen.add(page)
        links.append(page)
    if len(links) < 80:
        raise RuntimeError(f"只找到 {len(links)} 回链接，预期 80 回")
    return links[:80]


def parse_characters():
    data = json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))
    excluded = {"姨妈", "王氏", "邢氏", "金氏", "薛父"}
    terms = {}
    for character in data:
        names = [character.get("name", ""), *(character.get("alias") or [])]
        for name in names:
            name = str(name).strip()
            if len(name) < 2 or name in excluded:
                continue
            terms[name] = character["id"]
    # 这些是“物”不是人物，作为占位词防止“宝玉”误吃“通灵宝玉”。
    blockers = {
        "通灵宝玉",
        # “X家的”是仆妇，不是男性仆人本人，避免把周瑞/林之孝/赖大误算成其妻。
        "周瑞家的",
        "林之孝家的",
        "赖大家的",
        "来旺家的",
        "旺儿家的"
    }
    return terms, blockers


def count_mentions(text, terms, blockers):
    entries = [(term, cid, True) for term, cid in terms.items()]
    entries += [(term, None, False) for term in blockers]
    entries.sort(key=lambda item: len(item[0]), reverse=True)
    occupied = [False] * len(text)
    counts = {}
    for term, cid, should_count in entries:
        start = 0
        while True:
            index = text.find(term, start)
            if index < 0:
                break
            end = index + len(term)
            if not any(occupied[index:end]):
                for pos in range(index, end):
                    occupied[pos] = True
                if should_count:
                    counts[cid] = counts.get(cid, 0) + 1
            start = index + 1
    return counts


def main():
    links = chapter_links()
    terms, blockers = parse_characters()
    records = []
    session = requests.Session()
    session.headers.update(HEADERS)
    for chapter, url in enumerate(links, start=1):
        response = session.get(url, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")
        main = soup.select_one(".mw-parser-output")
        if not main:
            raise RuntimeError(f"第{chapter}回缺少正文容器")
        parts = []
        for child in main.find_all(["p", "div"], recursive=False):
            if child.name == "div" and "poem" not in (child.get("class") or []):
                continue
            text = text_of(child)
            if text:
                parts.append(text)
        text = "".join(parts)
        counts = count_mentions(text, terms, blockers)
        for character_id, count in sorted(counts.items()):
            records.append({
                "characterId": character_id,
                "chapter": chapter,
                "count": count,
                "sourceId": SOURCE_ID,
            })
        time.sleep(0.08)
    output = {
        "schemaVersion": 1,
        "generatedFrom": "维基文库《脂砚斋重评石头记》会校本（庚辰/己卯/甲戌合成）",
        "sourceId": SOURCE_ID,
        "coveredChapters": list(range(1, 81)),
        "records": records,
    }
    (ROOT / "data/text-mentions.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"✓ 文本提及：{len(records)} 条，{len({item['characterId'] for item in records})} 人物，80 回")


if __name__ == "__main__":
    main()
