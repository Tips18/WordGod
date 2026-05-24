from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("build_english_ii_articles.py")


def load_builder_module():
    """Load the English II builder script as an importable test module."""
    spec = importlib.util.spec_from_file_location("build_english_ii_articles", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class EnglishIIBuildTests(unittest.TestCase):
    def setUp(self) -> None:
        """Load the builder fresh for each test case."""
        self.builder = load_builder_module()

    def test_builds_burning_pdf_url_from_public_config(self) -> None:
        """Build the viewer PDF URL from a public BurningVocabulary page config."""
        html = """
        <script>
        var globalConfig = {
          "filePath": "kaoyan/2024/02",
          "fnameVersion": 2,
          "pdfHost": "https://res-zhenti.burningvocabulary.cn",
          "fn": {"f1": ["a", "b"], "f2": ["1", "2"]}
        };
        </script>
        """

        url = self.builder.build_burning_pdf_url_from_html(html)

        self.assertEqual(
            url,
            "https://res-zhenti.burningvocabulary.cn/images/read/kaoyan/2024/02/21ba.pdf?v=2",
        )

    def test_extracts_articles_and_preserves_markdown_paragraphs(self) -> None:
        """Extract Section I and Text articles while preserving blank-line paragraph breaks."""
        blocks = [
            "Section I Use of English",
            "Directions:",
            "Read the following text.",
            "The opening sentence contains 1 blank and continues on the same paragraph.",
            "",
            "A second cloze paragraph contains 2 another blank.",
            "1. A. one B. two C. three D. four",
            "Section II Reading Comprehension",
            "Part A",
            "Text 1",
            "The first reading paragraph starts here and wraps across lines.",
            "It remains part of the same paragraph.",
            "",
            "The second reading paragraph should remain clearly separated.",
            "It also wraps across a second line.",
            "21. According to the first paragraph, the author ____",
        ]

        articles = self.builder.extract_articles_from_blocks(blocks)

        self.assertEqual([article.title for article in articles], ["Section I Use of English", "Text 1"])
        self.assertIn("____(1)____", articles[0].content)
        self.assertIn("____(2)____", articles[0].content)
        self.assertIn(
            "same paragraph.\n\nThe second reading paragraph should remain clearly separated.",
            articles[1].content,
        )
        self.assertNotIn("21.", articles[1].content)


if __name__ == "__main__":
    unittest.main()
