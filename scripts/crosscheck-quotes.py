#!/usr/bin/env python3
"""用《红楼梦脂批本新校电子版》对 pending 引语做候选检索。

该新校本是现代整理本（水木清华 BBS 脂批本为底本，参考甲戌、庚辰、列藏、
程乙等校订），不是单一庚辰底本。因此命中只记为“候选”，不能直接升级为
“经典语录”；仍需庚辰影印本逐条复核。
"""
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from opencc import OpenCC

ROOT = Path(__file__).resolve().parent.parent
SOURCE_ID = "liaoping-xinjiao"
BASE = "https://cdn.jsdelivr.net/gh/yo1995/Hong-Lou-Meng@gh-pages/book"
HEADERS = {"User-Agent": "honglou-graph quote crosscheck (public-domain research)"}
ANNOTATION_RE = re.compile(r"【[^】]*】|\[[^\]]*\]")
PUNCT_RE = re.compile(r"[\s\u3000，。！？；：、“”‘’（）《》〈〉…—·,.!?;:\"'()\[\]{}<>]")
CC = OpenCC("t2s")


def normalize(text):
    return PUNCT_RE.sub("", CC.convert(str(text or "")))


def fetch_chapters():
    session = requests.Session()
    session.headers.update(HEADERS)
    chapters = {}
    for chapter in range(1, 81):
        url = f"{BASE}/{chapter:02d}.htm"
        for attempt in range(3):
            try:
                response = session.get(url, timeout=30)
                response.raise_for_status()
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(0.5)
        soup = BeautifulSoup(response.text, "lxml")
        for node in soup.select("span.red, style, script"):
            node.decompose()
        text = soup.get_text(" ", strip=True)
        chapters[chapter] = normalize(ANNOTATION_RE.sub("", text))
        time.sleep(0.03)
    return chapters


def main():
    characters_path = ROOT / "data/characters.json"
    characters = json.loads(characters_path.read_text(encoding="utf-8"))
    chapters = fetch_chapters()
    records = []
    matches = 0
    total = 0
    for character in characters:
        pending = character.get("quotesPendingVerified") or []
        for index, item in enumerate(pending):
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "")
            if not text.strip():
                continue
            total += 1
            normalized = normalize(text)
            found = [chapter for chapter, body in chapters.items() if normalized and normalized in body]
            if found:
                matches += 1
                item.setdefault("sourceAudit", {})["crossCheck"] = {
                    "sourceId": SOURCE_ID,
                    "status": "match",
                    "chapters": found,
                }
                status = "match"
            else:
                item.setdefault("sourceAudit", {})["crossCheck"] = {
                    "sourceId": SOURCE_ID,
                    "status": "not-found",
                    "chapters": [],
                }
                status = "not-found"
            records.append({
                "characterId": character["id"],
                "quoteIndex": index,
                "text": text,
                "sourceId": SOURCE_ID,
                "status": status,
                "chapters": found,
            })
    output = {
        "schemaVersion": 1,
        "sourceId": SOURCE_ID,
        "sourceNote": "现代新校本，候选检索用；命中仍需庚辰影印本复核。",
        "summary": {"total": total, "matches": matches, "notFound": total - matches},
        "records": records,
    }
    (ROOT / "data/quote-crosscheck.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    characters_path.write_text(
        json.dumps(characters, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    provenance_path = ROOT / "data/provenance.json"
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    audit = next((item for item in provenance.get("auditQueue", []) if item["id"] == "character-quotes-without-source"), None)
    if audit:
        audit["crossCheckSource"] = SOURCE_ID
        audit["crossCheckMatches"] = matches
        audit["crossCheckTotal"] = total
        audit["crossCheckNote"] = "命中仅代表新校本可检索，仍待庚辰影印本复核，不升级为经典语录。"
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ 引语候选检索：{matches}/{total} 命中（{SOURCE_ID}）")


if __name__ == "__main__":
    main()
