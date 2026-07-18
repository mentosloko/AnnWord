#!/usr/bin/env python3
"""Generate the AnnWord legal PDF files used by the web interface."""

import base64
import gzip
import html
import os
import re
from pathlib import Path

from matplotlib import font_manager
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]
SOURCE_DIR = Path(os.getenv("LEGAL_SOURCE_DIR", ROOT / "legal-src"))
OUTPUT_DIR = Path(os.getenv("LEGAL_OUTPUT_DIR", ROOT / "public" / "legal"))

DOCUMENTS = {
    "01_user_agreement.md": "annword-user-agreement.pdf",
    "02_public_offer.md": "annword-public-offer.pdf",
    "03_privacy_policy.md": "annword-privacy-policy.pdf",
    "04_cookie_policy.md": "annword-cookie-policy.pdf",
    "05_personal_data_consent.md": "annword-personal-data-consent.pdf",
    "06_child_data_consent.md": "annword-child-data-consent.pdf",
    "07_marketing_consent.md": "annword-marketing-consent.pdf",
}

REGULAR_FONT = font_manager.findfont(
    font_manager.FontProperties(family="DejaVu Sans")
)
BOLD_FONT = font_manager.findfont(
    font_manager.FontProperties(family="DejaVu Sans", weight="bold")
)


def inline_markup(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r"\1", escaped)
    return escaped


def load_documents() -> dict[str, str]:
    encoded = "".join(
        part.read_text(encoding="utf-8").strip()
        for part in sorted(SOURCE_DIR.glob("legal-documents.b64.part*"))
    )
    if not encoded:
        raise RuntimeError("Legal source archive was not found")

    archive = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    documents: dict[str, str] = {}
    for block in archive.split("@@FILE:")[1:]:
        filename, text = block.split("@@\n", 1)
        documents[filename.strip()] = text.strip()
    return documents


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "LegalTitle",
            parent=base["Title"],
            fontName="AnnWordBold",
            fontSize=18,
            leading=23,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1e1b4b"),
            spaceAfter=8 * mm,
            keepWithNext=True,
        ),
        "heading2": ParagraphStyle(
            "LegalHeading2",
            parent=base["Heading2"],
            fontName="AnnWordBold",
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor("#312e81"),
            spaceBefore=5 * mm,
            spaceAfter=2.5 * mm,
            keepWithNext=True,
        ),
        "heading3": ParagraphStyle(
            "LegalHeading3",
            parent=base["Heading3"],
            fontName="AnnWordBold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#3730a3"),
            spaceBefore=3.5 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "LegalBody",
            parent=base["BodyText"],
            fontName="AnnWordRegular",
            fontSize=9.4,
            leading=13.2,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=2.1 * mm,
        ),
        "meta": ParagraphStyle(
            "LegalMeta",
            parent=base["BodyText"],
            fontName="AnnWordRegular",
            fontSize=8.8,
            leading=12.2,
            textColor=colors.HexColor("#475569"),
            spaceAfter=1.4 * mm,
        ),
        "list": ParagraphStyle(
            "LegalList",
            parent=base["BodyText"],
            fontName="AnnWordRegular",
            fontSize=9.2,
            leading=13,
            leftIndent=5 * mm,
            firstLineIndent=-3.5 * mm,
            bulletIndent=1 * mm,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=1.5 * mm,
        ),
        "box": ParagraphStyle(
            "LegalBox",
            parent=base["BodyText"],
            fontName="AnnWordRegular",
            fontSize=8.5,
            leading=11.7,
            leftIndent=3.5 * mm,
            rightIndent=2 * mm,
            borderColor=colors.HexColor("#e0e7ff"),
            borderWidth=0.6,
            borderPadding=5,
            backColor=colors.HexColor("#f8fafc"),
            textColor=colors.HexColor("#334155"),
            spaceAfter=1.7 * mm,
        ),
    }


def convert_markdown_table(
    lines: list[str], styles: dict[str, ParagraphStyle]
) -> list[object]:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        separator = cells and all(
            re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells
        )
        if not separator:
            rows.append(cells)

    if not rows:
        return []

    headers = rows[0]
    output: list[object] = []
    data_rows = rows[1:] if len(rows) > 1 else rows
    for row in data_rows:
        fragments: list[str] = []
        for index, cell in enumerate(row):
            if not cell:
                continue
            prefix = ""
            if len(rows) > 1 and index < len(headers) and headers[index]:
                prefix = f"<b>{inline_markup(headers[index])}:</b> "
            fragments.append(prefix + inline_markup(cell))
        if fragments:
            output.append(Paragraph(" &nbsp; ".join(fragments), styles["box"]))
    output.append(Spacer(1, 1.5 * mm))
    return output


def markdown_story(
    markdown: str, styles: dict[str, ParagraphStyle]
) -> list[object]:
    lines = markdown.splitlines()
    story: list[object] = []
    index = 0
    title_seen = False

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue

        if line.startswith("|") and line.endswith("|"):
            table_lines: list[str] = []
            while index < len(lines):
                table_line = lines[index].strip()
                if not (table_line.startswith("|") and table_line.endswith("|")):
                    break
                table_lines.append(table_line)
                index += 1
            story.extend(convert_markdown_table(table_lines, styles))
            continue

        if line.startswith("# "):
            if title_seen:
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(line[2:]), styles["title"]))
            title_seen = True
        elif line.startswith("## "):
            story.append(Paragraph(inline_markup(line[3:]), styles["heading2"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline_markup(line[4:]), styles["heading3"]))
        elif re.match(r"^[-*]\s+", line):
            value = re.sub(r"^[-*]\s+", "", line)
            story.append(
                Paragraph(inline_markup(value), styles["list"], bulletText="•")
            )
        elif line.startswith("> "):
            story.append(Paragraph(inline_markup(line[2:]), styles["box"]))
        else:
            style = (
                styles["meta"]
                if line.startswith("**") and line.endswith("**")
                else styles["body"]
            )
            story.append(Paragraph(inline_markup(line), style))
        index += 1

    return story


class LegalDocument(BaseDocTemplate):
    def __init__(self, filename: str, title: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=19 * mm,
            rightMargin=19 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=title,
            author="ИП Манто Ирина Александровна",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="legal-content",
        )
        self.addPageTemplates(
            PageTemplate(id="legal-page", frames=frame, onPage=self.draw_footer)
        )

    @staticmethod
    def draw_footer(canvas, document) -> None:
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#e0e7ff"))
        canvas.line(19 * mm, 13 * mm, A4[0] - 19 * mm, 13 * mm)
        canvas.setFont("AnnWordRegular", 7.5)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(19 * mm, 8.8 * mm, "AnnWord · support@annword.ru")
        canvas.drawRightString(
            A4[0] - 19 * mm, 8.8 * mm, f"Страница {document.page}"
        )
        canvas.restoreState()


def main() -> None:
    pdfmetrics.registerFont(TTFont("AnnWordRegular", REGULAR_FONT))
    pdfmetrics.registerFont(TTFont("AnnWordBold", BOLD_FONT))

    source_documents = load_documents()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    styles = build_styles()

    for source_name, output_name in DOCUMENTS.items():
        markdown = source_documents[source_name]
        title_match = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
        title = title_match.group(1) if title_match else output_name
        output_path = OUTPUT_DIR / output_name
        document = LegalDocument(str(output_path), title)
        document.build(markdown_story(markdown, styles))
        print(f"Generated {output_path} ({output_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
