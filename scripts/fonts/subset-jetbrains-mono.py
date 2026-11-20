#!/usr/bin/env python3
import argparse
import hashlib
import re
import sys
import unicodedata
from pathlib import Path

from fontTools.subset import Options, Subsetter, save_font
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REPO_ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = REPO_ROOT / "public" / "fonts"
CONTENT_DIR = REPO_ROOT / "content"
CSS_DIR = REPO_ROOT / "app" / "css"

UPSTREAM_VERSION = "2.304"
UPSTREAM_ARCHIVE = (
    "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip"
)
UPSTREAM_MEMBER = "fonts/variable/JetBrainsMono[wght].ttf"
UPSTREAM_SHA256 = "662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016"

WEIGHT_AXIS = "wght"
FACES = {400: "jetbrains-mono-400.woff2", 700: "jetbrains-mono-700.woff2"}
WOFF2 = "woff2"
LAYOUT_FEATURES = ["calt", "ccmp", "frac", "locl", "mark"]
NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14]
LATIN_SOURCE = "the Latin base"
LATIN_RANGES = (
    (0x000D, 0x000D),
    (0x0020, 0x007E),
    (0x00A0, 0x00FF),
    (0x0102, 0x0102),
    (0x0131, 0x0131),
    (0x0152, 0x0153),
    (0x02BC, 0x02BC),
    (0x02C6, 0x02C6),
    (0x02DA, 0x02DA),
    (0x02DC, 0x02DC),
    (0x0300, 0x0301),
    (0x0303, 0x0304),
    (0x0308, 0x0309),
    (0x0323, 0x0323),
    (0x2013, 0x2014),
    (0x2018, 0x201A),
    (0x201C, 0x201E),
    (0x2022, 0x2022),
    (0x2026, 0x2026),
    (0x2032, 0x2033),
    (0x2039, 0x203A),
    (0x2044, 0x2044),
    (0x20AC, 0x20AC),
    (0x2122, 0x2122),
    (0x2191, 0x2191),
    (0x2193, 0x2193),
    (0x2212, 0x2212),
    (0x2215, 0x2215),
    (0xFEFF, 0xFEFF),
)

COPY_GLOB = "*.ts"
TEST_SUFFIX = ".test.ts"
STYLESHEET_GLOB = "*.css"
DRAWS_NO_GLYPH = {"Cc", "Cf"}
HEX = 16
JS_ESCAPE = re.compile(r"\\u(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))")
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)
CSS_STRING = r""""(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'"""
CSS_VALUE = rf"""((?:{CSS_STRING}|[^;}}"'])+)"""
CONTENT_DECLARATION = re.compile(rf"(?<![\w-])content\s*:{CSS_VALUE}")
CUSTOM_PROPERTY = re.compile(rf"--[\w-]+\s*:{CSS_VALUE}")
CSS_STRING_TOKEN = re.compile(CSS_STRING)
CSS_ESCAPE = re.compile(r"\\(?:([0-9a-fA-F]{1,6})\s?|(.))", re.S)

USAGE = (
    f"Writes {', '.join(FACES.values())} into public/fonts from JetBrains Mono {UPSTREAM_VERSION}. "
    f"Download {UPSTREAM_ARCHIVE}, unzip it and pass the path of {UPSTREAM_MEMBER}. "
    "The faces hold the Latin base plus every glyph a content/*.ts file or a CSS content value "
    "writes, the same sources __tests__/meta/glyph-coverage.test.ts reads. Needs fonttools and "
    "brotli."
)


def js_unescape(text: str) -> str:
    return JS_ESCAPE.sub(lambda match: chr(int(match.group(1) or match.group(2), HEX)), text)


def css_unescape(text: str) -> str:
    return CSS_ESCAPE.sub(
        lambda match: chr(int(match.group(1), HEX)) if match.group(1) else match.group(2), text
    )


def copy_texts() -> list[tuple[str, str]]:
    return [
        (str(path.relative_to(REPO_ROOT)), js_unescape(path.read_text(encoding="utf-8")))
        for path in sorted(CONTENT_DIR.glob(COPY_GLOB))
        if not path.name.endswith(TEST_SUFFIX)
    ]


def generated_texts() -> list[tuple[str, str]]:
    texts = []
    for path in sorted(CSS_DIR.glob(STYLESHEET_GLOB)):
        css = CSS_COMMENT.sub("", path.read_text(encoding="utf-8"))
        values = CONTENT_DECLARATION.findall(css) + CUSTOM_PROPERTY.findall(css)
        for value in values:
            for token in CSS_STRING_TOKEN.findall(value):
                texts.append((str(path.relative_to(REPO_ROOT)), css_unescape(token[1:-1])))
    return texts


def required_glyphs() -> dict[int, set[str]]:
    required: dict[int, set[str]] = {}
    for first, last in LATIN_RANGES:
        for code_point in range(first, last + 1):
            required.setdefault(code_point, set()).add(LATIN_SOURCE)
    for source, text in copy_texts() + generated_texts():
        for glyph in text:
            if unicodedata.category(glyph) not in DRAWS_NO_GLYPH:
                required.setdefault(ord(glyph), set()).add(source)
    return required


def write_face(upstream: Path, weight: int, code_points: list[int], target: Path) -> int:
    font = instantiateVariableFont(
        TTFont(upstream, recalcTimestamp=False), {WEIGHT_AXIS: weight}, updateFontNames=True
    )
    options = Options()
    options.flavor = WOFF2
    options.layout_features = LAYOUT_FEATURES
    options.name_IDs = NAME_IDS
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=code_points)
    subsetter.subset(font)
    save_font(font, str(target), options)
    return target.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser(description=USAGE)
    parser.add_argument("upstream", type=Path, help=f"path of {UPSTREAM_MEMBER}")
    upstream = parser.parse_args().upstream
    digest = hashlib.sha256(upstream.read_bytes()).hexdigest()
    if digest != UPSTREAM_SHA256:
        sys.exit(
            f"{upstream} is not {UPSTREAM_MEMBER} of JetBrains Mono {UPSTREAM_VERSION}: "
            f"its sha256 is {digest}"
        )
    required = required_glyphs()
    held = TTFont(upstream).getBestCmap()
    absent = [
        f"U+{code_point:04X} {chr(code_point)} used in {', '.join(sorted(sources))}"
        for code_point, sources in sorted(required.items())
        if code_point not in held
    ]
    if absent:
        sys.exit(
            f"JetBrains Mono {UPSTREAM_VERSION} lacks these glyphs, "
            "so the copy has to use one it holds:\n" + "\n".join(absent)
        )
    for weight, name in FACES.items():
        size = write_face(upstream, weight, sorted(required), FONT_DIR / name)
        print(f"{name}: {size} bytes, {len(required)} code points")


if __name__ == "__main__":
    main()
