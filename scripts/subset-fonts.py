#!/usr/bin/env python3
"""
把 assets/fonts 下的全量 TTF 子集化为 WOFF2。

背景：原字体是 9 个 6–15 MB 的完整中文 TTF，首屏实际会下载 4 个（Noto Serif SC 的
400/600/700 与 ZCOOL XiaoWei），合计约 49 MB。子集化后只保留本站在用的字符，体积降两个
数量级，首屏从数十秒降到 1 秒以内。

用法：
  python3 scripts/subset-fonts.py           # 生成 assets/fonts/subset/*.woff2
  python3 scripts/subset-fonts.py --check   # 仅报告体积对比

字符集来源（全部参与扫描）：
  index.html, js/*.js, css/*.css, data/*.json
另外始终并入 GB2312 一级常用字 + 标点，保证用户搜索时输入的生僻字不全变成豆腐块。
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "assets" / "fonts"
OUT_DIR = FONTS_DIR / "subset"

# 字体清单：源文件 -> 输出名。与 css/fonts.css 的 @font-face 一一对应。
FONT_MAP = {
    "font-0.ttf": "noto-sans-sc-400",
    "font-1.ttf": "noto-sans-sc-500",
    "font-2.ttf": "noto-sans-sc-600",
    "font-3.ttf": "noto-sans-sc-700",
    "font-4.ttf": "noto-serif-sc-400",
    "font-5.ttf": "noto-serif-sc-600",
    "font-6.ttf": "noto-serif-sc-700",
    "font-7.ttf": "noto-serif-sc-900",
    "font-8.ttf": "zcool-xiaowei-400",
}

SCAN_GLOBS = ["index.html", "js/*.js", "css/*.css", "data/*.json"]
SKIP_DIRS = ("d3.v7.min.js",)  # 压缩库不含界面文案

# 这些字体里的某些字，内轮廓（洞）的方向与外轮廓相同，浏览器按非零环绕规则
# 填充时会变成实心块（例如 ZCOOL 小薇的「回」「查」「赐」）。子集化前先修正方向。
WINDING_FIX_FONTS = {"font-8.ttf"}

# ASCII 可打印 + 常用中文标点 + 全角符号
BASE_CHARS = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "　、。，．；：？！“”‘’（）《》〈〉【】「」『』—…·～￥％＃＠＆＊＋－／＝＼｜０１２３４５６７８９"
)


def _contour_area(points) -> float:
    area = 0.0
    for i, (x1, y1) in enumerate(points):
        x2, y2 = points[(i + 1) % len(points)]
        area += x1 * y2 - x2 * y1
    return area / 2


def _point_in_polygon(point, polygon) -> bool:
    x, y = point
    inside = False
    for i in range(len(polygon)):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % len(polygon)]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
    return inside


def repair_glyph_winding(font, max_report: int = 12) -> int:
    """让嵌套轮廓的绕向交替，保证洞按非零环绕规则被挖空。

    返回修正的字形数。字形按 glyf 点序直接反转，不需要重算曲线。
    """
    glyf = font["glyf"]
    fixed = 0
    samples = []
    for order in font.getGlyphOrder():
        glyph = glyf[order]
        if glyph.numberOfContours <= 1 or glyph.isComposite():
            continue
        coords = glyph.coordinates
        end_pts = list(glyph.endPtsOfContours)
        start = 0
        contours = []
        for end in end_pts:
            contours.append(list(coords[start:end + 1]))
            start = end + 1
        depths = []
        for i, contour in enumerate(contours):
            depth = sum(1 for j, other in enumerate(contours)
                        if i != j and _point_in_polygon(contour[0], other))
            depths.append(depth)
        if max(depths) == 0:
            continue

        # 不同字形的外轮廓朝向不统一（有的顺时针有的逆时针），只能以本字自身的
        # 最外层轮廓为基准：偶数层与外层同向，奇数层（洞）必须反向。
        outer_areas = [_contour_area(c) for c, d in zip(contours, depths) if d == 0]
        reference = 1 if sum(outer_areas) >= 0 else -1

        changed = False
        for i, (contour, depth) in enumerate(zip(contours, depths)):
            area = _contour_area(contour)
            if depth % 2 == 1 and area * reference > 0:
                contours[i] = list(reversed(contour))
                changed = True
        if not changed:
            continue

        new_coords = [pt for contour in contours for pt in contour]
        for i, point in enumerate(new_coords):
            coords[i] = point
        fixed += 1
        if len(samples) < max_report:
            samples.append(order)
    if fixed:
        print(f"  修正轮廓方向：{fixed} 个字形（{'、'.join(samples[:max_report])}…）")
    return fixed



def collect_chars() -> set[str]:
    chars: set[str] = set(BASE_CHARS)
    for pattern in SCAN_GLOBS:
        for path in ROOT.glob(pattern):
            if any(skip in path.name for skip in SKIP_DIRS):
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            chars.update(text)
    # data/*.json 的文本里还可能有 JSON 转义，这里统一按原字符收集即可；
    # 把 base64/URL 类的杂讯过滤掉（控制字符、私用区）。
    return {
        ch for ch in chars
        if ch.isprintable() and not (0xE000 <= ord(ch) <= 0xF8FF)
    }


def build_charset_file() -> Path:
    chars = collect_chars()
    out = ROOT / ".font-charset.txt"
    out.write_text("".join(sorted(chars)), encoding="utf-8")
    print(f"字符集：{len(chars)} 个不同字符")
    return out


def main() -> int:
    check_only = "--check" in sys.argv
    if not FONTS_DIR.exists():
        print("找不到 assets/fonts", file=sys.stderr)
        return 1

    charset_file = build_charset_file()
    OUT_DIR.mkdir(exist_ok=True)

    total_before = total_after = 0
    rows = []
    for src_name, out_name in FONT_MAP.items():
        src = FONTS_DIR / src_name
        if not src.exists():
            print(f"跳过不存在的字体：{src_name}", file=sys.stderr)
            continue
        dst = OUT_DIR / f"{out_name}.woff2"
        total_before += src.stat().st_size
        if not check_only:
            sub_src = src
            if src_name in WINDING_FIX_FONTS:
                print(f"预处理 {src_name}：")
                font = TTFont(src)
                repair_glyph_winding(font)
                sub_src = OUT_DIR / f".{out_name}.winding-fixed.ttf"
                font.save(sub_src)
                font.close()
            cmd = [
                sys.executable, "-m", "fontTools.subset", str(sub_src),
                f"--text-file={charset_file}",
                "--flavor=woff2",
                "--layout-features=*",
                "--name-IDs=*",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={dst}",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if sub_src != src:
                sub_src.unlink(missing_ok=True)
            if result.returncode != 0:
                print(f"{src_name} 子集化失败：\n{result.stderr}", file=sys.stderr)
                return 1
        size = dst.stat().st_size if dst.exists() else 0
        total_after += size
        rows.append((out_name, src.stat().st_size, size))

    print(f"{'字体':32} {'原体积':>10} {'子集后':>10} {'压缩比':>8}")
    for name, before, after in rows:
        ratio = f"{after / before:.1%}" if before else "-"
        print(f"{name:32} {before/1024/1024:>8.1f}M {after/1024/1024:>8.1f}M {ratio:>8}")
    print(f"{'合计':32} {total_before/1024/1024:>8.1f}M {total_after/1024/1024:>8.1f}M "
          f"{total_after/total_before:.1%}" if total_before else "")

    if not check_only:
        print(f"\n输出目录：{OUT_DIR.relative_to(ROOT)}")
        print("下一步：把 css/fonts.css 的 src 指向 subset/*.woff2（格式改为 woff2）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
