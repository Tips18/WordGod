from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import pdfplumber
import requests
from bs4 import BeautifulSoup
from docx import Document


REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = REPO_ROOT / "真题题库" / "kaoyan-english-ii"
ARTICLES_DIR = OUTPUT_ROOT / "articles"
CACHE_ROOT = Path(tempfile.gettempdir()) / "wordgod-english-ii-source-cache"

IQIHANG_LIST_URL = "https://jixun.iqihang.com/zlzx/ggkzt/yy2/"
BURNING_LIST_URL = "https://zhenti.burningvocabulary.cn/kaoyan"
EOL_ENGLISH_URL = "https://kaoyan.eol.cn/shiti/yingyu/"

IQIHANG_SOURCES = {
    2010: "https://jixun.iqihang.com/uploadfile/2017/0421/20170421112316795.zip",
    2013: "https://jixun.iqihang.com/uploadfile/2017/0421/20170421112403237.zip",
    2014: "https://jixun.iqihang.com/uploadfile/2017/0421/20170421112419546.zip",
    2015: "https://jixun.iqihang.com/uploadfile/2017/0320/20170320043038734.zip",
    2016: "https://jixun.iqihang.com/uploadfile/2017/0421/20170421112436858.zip",
    2017: "https://jixun.iqihang.com/uploadfile/2017/0320/20170320043101815.zip",
    2019: "https://jixun.iqihang.com/uploadfile/2019/0904/20190904102150100.zip",
}

EOL_SOURCES = {
    2018: [
        "https://kaoyan.eol.cn/shiti/yingyu/201712/t20171223_1575588.shtml",
        "https://kaoyan.eol.cn/shiti/yingyu/201712/t20171223_1575588_1.shtml",
        "https://kaoyan.eol.cn/shiti/yingyu/201712/t20171223_1575588_2.shtml",
        "https://kaoyan.eol.cn/shiti/yingyu/201712/t20171223_1575588_3.shtml",
        "https://kaoyan.eol.cn/shiti/yingyu/201712/t20171223_1575588_4.shtml",
    ],
    2019: [
        "https://kaoyan.eol.cn/nnews/201812/t20181223_1638266.shtml",
    ],
}

BURNING_YEARS = range(2020, 2027)
TARGET_YEARS = range(2010, 2027)
EXPECTED_TITLES = ["Section I Use of English", "Text 1", "Text 2", "Text 3", "Text 4"]


@dataclass
class Article:
    """Store one standardized English II article and its derived metrics."""

    title: str
    content: str

    @property
    def paragraph_count(self) -> int:
        """Return the number of Markdown paragraphs in the article content."""
        return len([paragraph for paragraph in self.content.split("\n\n") if paragraph.strip()])

    @property
    def word_count(self) -> int:
        """Return the English word count for the article content."""
        return len(re.findall(r"\b[A-Za-z][A-Za-z'-]*\b", self.content))


@dataclass
class SourceResult:
    """Represent one year's source extraction result before Markdown writing."""

    year: int
    source_name: str
    source_url: str
    source_domain: str
    articles: list[Article]
    warnings: list[str]
    source_pdf_url: str | None = None


def request_text(url: str) -> str:
    """Fetch a public HTML page and decode it with the response's best-known encoding."""
    response = requests.get(url, timeout=45)
    response.raise_for_status()
    encoding = response.encoding if response.encoding and response.encoding.lower() != "iso-8859-1" else None
    return response.content.decode(encoding or response.apparent_encoding or "utf-8", errors="replace")


def request_bytes(url: str) -> bytes:
    """Fetch a public binary source file such as a PDF, DOCX, or ZIP archive."""
    response = requests.get(url, timeout=90)
    response.raise_for_status()
    return response.content


def extract_json_object_after_marker(text: str, marker: str) -> str:
    """Extract the first balanced JSON object that appears after a JavaScript marker."""
    marker_index = text.find(marker)
    if marker_index < 0:
        raise ValueError(f"Cannot find marker {marker!r}")

    start = text.find("{", marker_index)
    if start < 0:
        raise ValueError(f"Cannot find JSON object after marker {marker!r}")

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    raise ValueError(f"Unclosed JSON object after marker {marker!r}")


def build_burning_pdf_url_from_html(html: str) -> str:
    """Build the public BurningVocabulary PDF viewer URL from its page configuration."""
    config = json.loads(extract_json_object_after_marker(html, "var globalConfig"))
    file_name = "".join(reversed(config["fn"]["f1"] + config["fn"]["f2"]))
    pdf_host = config.get("pdfHost", "https://res-zhenti.burningvocabulary.cn")
    url = f"{pdf_host}/images/read/{config['filePath']}/{file_name}.pdf"
    if config.get("fnameVersion"):
        url = f"{url}?v={config['fnameVersion']}"
    return url


def cache_path_for_url(url: str, year: int) -> Path:
    """Return a deterministic local cache path for a downloaded source URL."""
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix or ".bin"
    return CACHE_ROOT / f"{year}{suffix.lower()}"


def download_to_cache(url: str, year: int) -> Path:
    """Download a source URL once and return the cached local file path."""
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    path = cache_path_for_url(url, year)
    if path.exists() and path.stat().st_size > 0:
        return path
    path.write_bytes(request_bytes(url))
    return path


def normalize_text(text: str) -> str:
    """Normalize whitespace, punctuation spacing, and common extraction artifacts."""
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    text = text.replace("，", ", ").replace("：", ": ")
    text = text.replace("Ⅰ", "I").replace("Ⅱ", "II")
    text = text.replace("’ s", "’s").replace("' s", "'s")
    text = text.replace("I’ m", "I’m").replace("I' m", "I'm")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"(?<=[a-z0-9])\.(?=[A-Z])", ". ", text)
    text = re.sub(r"([([{])\s+", r"\1", text)
    text = re.sub(r"\s+([])}])", r"\1", text)
    text = re.sub(r"\b([A-Za-z])\s+-\s+([A-Za-z])\b", r"\1-\2", text)
    text = re.sub(r"(?<=\w)\s+'(?=\w)", "'", text)
    text = re.sub(r"(?<=\w)\s+’(?=\w)", "’", text)
    text = re.sub(r"\bANSWER\s+SHEET\b", "ANSWER SHEET", text, flags=re.IGNORECASE)
    return text.strip()


def normalize_heading(text: str) -> str:
    """Return a compact heading key for tolerant source heading comparisons."""
    text = text.replace("Ⅰ", "I").replace("Ⅱ", "II")
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def is_chinese_line(text: str) -> bool:
    """Detect lines that are primarily Chinese metadata, page footers, or explanations."""
    chinese_count = len(re.findall(r"[\u4e00-\u9fff]", text))
    ascii_count = len(re.findall(r"[A-Za-z]", text))
    return chinese_count > 0 and chinese_count >= ascii_count


def is_noise_line(text: str) -> bool:
    """Detect source headers, footers, URLs, and page furniture that should not enter articles."""
    stripped = normalize_text(text)
    if not stripped:
        return False
    lowered = stripped.lower()
    if "zhenti.burningvocabulary.cn" in lowered or "qihang.com.cn" in lowered:
        return True
    if lowered.startswith(("http://", "https://", "考研购课咨询")):
        return True
    if re.fullmatch(r"\d+\s*", stripped):
        return True
    if re.search(r"第\s*\d+\s*页|共\s*\d+\s*页", stripped):
        return True
    return False


def is_direction_line(text: str) -> bool:
    """Detect exam directions and section labels that are not article body content."""
    key = normalize_heading(text)
    direction_keys = {
        "directions",
        "parta",
        "sectioni",
        "sectioniuseofenglish",
        "sectioniuseofenglishdirections",
        "sectioniireadingcomprehension",
        "readingcomprehension",
    }
    if key in direction_keys:
        return True
    lowered = normalize_text(text).lower()
    return lowered.startswith(
        (
            "a, b, c or d",
            "b, c or d",
            "on the answer sheet",
            "or d on the answer sheet",
            "read the following text",
            "read the following passage",
            "read the following four texts",
            "answer the questions",
            "choose the best word",
            "mark your answers",
        )
    )


def is_option_or_question_line(text: str) -> bool:
    """Detect numbered questions and A-D option rows in extracted exam text."""
    stripped = normalize_text(text)
    if re.match(r"^(?:[1-4]?\d)\s*[.．]\s*(?:\[?[A-D]\]?|[A-D]\s*[.．])", stripped):
        return True
    if re.match(r"^(?:2[1-9]|3[0-9]|40)\s*[.．\s]", stripped):
        return True
    if re.match(r"^(?:\[[A-D]\]|\(?[A-D]\)?[.．])", stripped):
        return True
    return False


def line_starts_new_paragraph(line: str) -> bool:
    """Guess whether a line starts a new paragraph in PDF line extraction."""
    stripped = normalize_text(line)
    return bool(re.match(r'^[A-Z"“‘\']', stripped))


def line_ends_sentence(line: str) -> bool:
    """Guess whether a line ends a complete sentence or quoted sentence."""
    return bool(re.search(r'[.!?。！？][)"”’\']?$', normalize_text(line)))


def convert_cloze_blanks(text: str) -> str:
    """Convert source blank numbers in Section I into stable Markdown blank markers."""
    text = re.sub(r"_+\s*(?:\(?\s*)?([1-9]|1\d|20)(?:\s*\)?)\s*_+", r"____(\1)____", text)
    text = re.sub(
        r"(?<!\d)([1-9]|1\d|20)(?!\d)(?!\s*(?:,\s*\d{4}|percent|points?|years?|minutes?|am|pm|\)))",
        r"____(\1)____",
        text,
    )
    text = re.sub(r"\s*____\((\d+)\)____\s*", r" ____(\1)____ ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(?:_{4}\(\d+\)_{4}\s*){2,}", lambda match: match.group(0).split()[0], text)
    return text


def merge_body_blocks(blocks: Iterable[str], *, section: str) -> str:
    """Merge source lines or paragraphs into Markdown paragraphs for one article."""
    paragraphs: list[str] = []
    current: list[str] = []

    def flush_current() -> None:
        """Commit the active source-line group as one Markdown paragraph."""
        if not current:
            return
        paragraph = normalize_text(" ".join(current))
        if section == "cloze":
            paragraph = convert_cloze_blanks(paragraph)
        if paragraph:
            paragraphs.append(paragraph)
        current.clear()

    for raw_block in blocks:
        block = normalize_text(raw_block)
        if not block:
            flush_current()
            continue
        if is_noise_line(block) or is_direction_line(block) or is_chinese_line(block):
            continue
        if is_option_or_question_line(block):
            break
        if current and line_ends_sentence(current[-1]) and line_starts_new_paragraph(block):
            flush_current()
        current.append(block)

    flush_current()
    return "\n\n".join(paragraphs).strip()


def split_compound_headings(blocks: Iterable[str]) -> list[str]:
    """Split source blocks that contain headings embedded at the start of paragraph text."""
    split_blocks: list[str] = []
    heading_pattern = re.compile(r"(Section\s*I+\s*Use\s*of\s*English|Section\s*II\s*Reading\s*Comprehension|T(?:ex|xe)t\s*[1-4]|Part\s*A)", re.I)
    for block in blocks:
        text = normalize_text(block)
        if not text:
            split_blocks.append("")
            continue
        cursor = 0
        for match in heading_pattern.finditer(text):
            before = text[cursor : match.start()].strip()
            if before:
                split_blocks.append(before)
            split_blocks.append(normalize_text(match.group(1)))
            cursor = match.end()
        rest = text[cursor:].strip()
        if rest:
            split_blocks.append(rest)
    return split_blocks


def find_heading_index(blocks: list[str], heading: str, start_at: int = 0) -> int | None:
    """Find the first source block that matches a normalized exam heading."""
    wanted = normalize_heading(heading)
    for index in range(start_at, len(blocks)):
        actual = normalize_heading(blocks[index]).replace("txet", "text")
        if actual == wanted:
            return index
    return None


def find_section_i_index(blocks: list[str]) -> int | None:
    """Find the Section I heading in source blocks using tolerant heading keys."""
    for index, block in enumerate(blocks):
        key = normalize_heading(block)
        if key in {"sectioniuseofenglish", "section1useofenglish"}:
            return index
        if key == "sectioni" and index + 1 < len(blocks) and normalize_heading(blocks[index + 1]).startswith("useofenglish"):
            return index
    return None


def find_section_ii_index(blocks: list[str], start_at: int = 0) -> int | None:
    """Find the Section II or Part A heading that ends the cloze extraction window."""
    for index in range(start_at, len(blocks)):
        key = normalize_heading(blocks[index])
        if key in {"sectioniireadingcomprehension", "parta", "readingcomprehension"}:
            return index
    return None


def extract_cloze_article(blocks: list[str]) -> Article | None:
    """Extract Section I Use of English from normalized source blocks."""
    start = find_section_i_index(blocks)
    if start is None:
        return None

    end = find_section_ii_index(blocks, start + 1)
    for index in range(start + 1, end if end is not None else len(blocks)):
        if is_option_or_question_line(blocks[index]):
            end = index
            break

    raw = blocks[start + 1 : end]
    content = merge_body_blocks(raw, section="cloze")
    if len(content) < 120:
        return None
    return Article("Section I Use of English", content)


def extract_reading_text_article(blocks: list[str], text_number: int) -> Article | None:
    """Extract one Reading Comprehension Text article from normalized source blocks."""
    start = find_heading_index(blocks, f"Text {text_number}")
    if start is None:
        return None

    next_text = find_heading_index(blocks, f"Text {text_number + 1}", start + 1) if text_number < 4 else None
    question_start = 21 + (text_number - 1) * 5
    end = next_text
    for index in range(start + 1, end if end is not None else len(blocks)):
        if re.match(rf"^{question_start}\s*[.．\s]", normalize_text(blocks[index])):
            end = index
            break
        if text_number == 4 and normalize_heading(blocks[index]) in {"partb", "sectioniiitranslation"}:
            end = index
            break

    raw = blocks[start + 1 : end]
    content = merge_body_blocks(raw, section="reading")
    if len(content) < 120:
        return None
    return Article(f"Text {text_number}", content)


def extract_articles_from_blocks(blocks: Iterable[str]) -> list[Article]:
    """Extract Section I and Text 1-4 articles from source blocks."""
    normalized = split_compound_headings(blocks)
    articles: list[Article] = []

    cloze = extract_cloze_article(normalized)
    if cloze:
        articles.append(cloze)

    for text_number in range(1, 5):
        article = extract_reading_text_article(normalized, text_number)
        if article:
            articles.append(article)

    return articles


def extract_pdf_blocks(path: Path) -> list[str]:
    """Extract readable line blocks from a PDF while preserving page order."""
    blocks: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            blocks.extend(text.splitlines())
            blocks.append("")
    return blocks


def extract_docx_blocks(path: Path) -> list[str]:
    """Extract paragraph blocks from a DOCX source file."""
    document = Document(path)
    return [paragraph.text for paragraph in document.paragraphs]


def extract_docx_or_pdf_from_zip(path: Path, year: int) -> Path:
    """Extract the first DOCX or PDF file from an IQihang ZIP archive."""
    target_dir = CACHE_ROOT / f"{year}-unzipped"
    target_dir.mkdir(parents=True, exist_ok=True)
    preferred_suffixes = (".docx", ".pdf")
    with zipfile.ZipFile(path) as archive:
        for suffix in preferred_suffixes:
            for member in archive.infolist():
                if member.filename.lower().endswith(suffix):
                    target = target_dir / f"{year}{suffix}"
                    with archive.open(member) as source, target.open("wb") as destination:
                        shutil.copyfileobj(source, destination)
                    return target
    raise ValueError(f"No DOCX or PDF source found in {path}")


def fetch_iqihang_year(year: int, source_url: str) -> SourceResult:
    """Download and extract one English II year from IQihang public files."""
    archive_path = download_to_cache(source_url, year)
    source_path = extract_docx_or_pdf_from_zip(archive_path, year) if archive_path.suffix.lower() == ".zip" else archive_path
    if source_path.suffix.lower() == ".docx":
        blocks = extract_docx_blocks(source_path)
    elif source_path.suffix.lower() == ".pdf":
        blocks = extract_pdf_blocks(source_path)
    else:
        raise ValueError(f"Unsupported IQihang source type: {source_path.suffix}")
    articles = extract_articles_from_blocks(blocks)
    return SourceResult(
        year=year,
        source_name="IQihang public file",
        source_url=source_url,
        source_domain=urlparse(source_url).netloc,
        articles=articles,
        warnings=quality_warnings(articles),
    )


def fetch_eol_year(year: int, source_urls: list[str]) -> SourceResult:
    """Download and extract one English II year from EOL public HTML pages."""
    blocks: list[str] = []
    for url in source_urls:
        soup = BeautifulSoup(request_text(url), "html.parser")
        article = soup.select_one(".TRS_Editor") or soup.select_one(".article")
        if article is None:
            continue
        for paragraph in article.find_all(["p", "div"]):
            text = paragraph.get_text("\n", strip=True)
            if text:
                blocks.extend(text.splitlines())
                blocks.append("")
    articles = extract_articles_from_blocks(blocks)
    return SourceResult(
        year=year,
        source_name="EOL public HTML",
        source_url=source_urls[0],
        source_domain=urlparse(source_urls[0]).netloc,
        articles=articles,
        warnings=quality_warnings(articles),
    )


def fetch_burning_year(year: int) -> SourceResult:
    """Download and extract one English II year from BurningVocabulary's public PDF viewer."""
    page_url = f"https://zhenti.burningvocabulary.cn/kaoyan/{year}/02"
    html = request_text(page_url)
    pdf_url = build_burning_pdf_url_from_html(html)
    pdf_path = download_to_cache(pdf_url, year)
    articles = extract_articles_from_blocks(extract_pdf_blocks(pdf_path))
    return SourceResult(
        year=year,
        source_name="BurningVocabulary public PDF viewer",
        source_url=page_url,
        source_domain=urlparse(page_url).netloc,
        articles=articles,
        warnings=quality_warnings(articles),
        source_pdf_url=pdf_url,
    )


def quality_warnings(articles: list[Article]) -> list[str]:
    """Return quality warnings for missing articles or suspicious paragraph structure."""
    warnings: list[str] = []
    titles = [article.title for article in articles]
    for title in EXPECTED_TITLES:
        if title not in titles:
            warnings.append(f"missing_{title.lower().replace(' ', '_')}")
    for article in articles:
        if article.paragraph_count < 1:
            warnings.append(f"{article.title}:no_paragraphs")
        if article.word_count < 100:
            warnings.append(f"{article.title}:short_word_count")
    return warnings


def write_year_markdown(result: SourceResult) -> dict[str, object]:
    """Write one standardized yearly Markdown file and return index metadata."""
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"{result.year}-kaoyan-english-ii-articles.md"
    file_path = ARTICLES_DIR / file_name
    lines = [
        f"# {result.year} Kaoyan English II Articles",
        "",
        f"> Source: {result.source_url}",
        f"> Source type: {result.source_name}",
        "> Scope: public unauthenticated source text only; answers, analysis, translations, login-only content, paid flows, and download-limit flows are excluded.",
    ]
    if result.source_pdf_url:
        lines.append(f"> PDF viewer source: {result.source_pdf_url}")
    lines.append("")

    for article in result.articles:
        lines.extend([f"## {article.title}", "", article.content, ""])

    file_path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "year": result.year,
        "paper": "english-ii",
        "sourceName": result.source_name,
        "sourceUrl": result.source_url,
        "sourceDomain": result.source_domain,
        "sourcePdfUrl": result.source_pdf_url,
        "file": f"articles/{file_name}",
        "articleCount": len(result.articles),
        "wordCount": sum(article.word_count for article in result.articles),
        "paragraphCount": sum(article.paragraph_count for article in result.articles),
        "titles": [article.title for article in result.articles],
        "paragraphCounts": {article.title: article.paragraph_count for article in result.articles},
        "warnings": result.warnings,
    }


def fetch_year(year: int) -> SourceResult:
    """Fetch one year from the highest-quality allowed source available for that year."""
    if year in BURNING_YEARS:
        return fetch_burning_year(year)
    if year in EOL_SOURCES:
        return fetch_eol_year(year, EOL_SOURCES[year])
    if year in IQIHANG_SOURCES:
        return fetch_iqihang_year(year, IQIHANG_SOURCES[year])
    raise ValueError("no_selected_public_source")


def build_index(items: list[dict[str, object]], failures: list[dict[str, object]]) -> dict[str, object]:
    """Build the top-level JSON index for standardized English II articles."""
    return {
        "source": "IQihang public files, EOL public HTML, and BurningVocabulary public PDF viewer pages",
        "sourcePages": [IQIHANG_LIST_URL, EOL_ENGLISH_URL, BURNING_LIST_URL],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Kaoyan English II article bodies standardized as Markdown by year; restricted flows and answer analysis excluded",
        "items": items,
        "failures": failures,
    }


def main() -> None:
    """Download, extract, standardize, and index English II articles."""
    items: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []

    for year in TARGET_YEARS:
        try:
            result = fetch_year(year)
            if not result.articles:
                failures.append({"year": year, "paper": "english-ii", "reason": "no_articles_found"})
                continue
            items.append(write_year_markdown(result))
        except Exception as error:  # noqa: BLE001 - content scripts must record per-year source failures.
            failures.append({"year": year, "paper": "english-ii", "reason": str(error)})

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "index.json").write_text(
        json.dumps(build_index(items, failures), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved {len(items)} Markdown files and index.json to {OUTPUT_ROOT}")
    if failures:
        print(f"Failures: {len(failures)}", file=sys.stderr)


if __name__ == "__main__":
    main()
