import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF
from pptx import Presentation
from tqdm import tqdm

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def infer_week_number(text: str):
    if not text:
        return None
    m = re.search(r"week\s*[-_ ]?0?(\d{1,2})", text, re.IGNORECASE)
    return int(m.group(1)) if m else None


def infer_topic(path: Path):
    return path.stem.strip() if path and path.stem else None


def make_doc_id(module_name: str, file_name: str) -> str:
    return f"{module_name}::{file_name}"


def extract_pdf(path: Path, module_name: str):
    rows = []
    doc = fitz.open(path)
    inferred_week = infer_week_number(path.stem)

    for i, page in enumerate(doc, start=1):
        raw_text = page.get_text("text") or ""
        rows.append({
            "doc_id": make_doc_id(module_name, path.name),
            "module_name": module_name,
            "source_file_name": path.name,
            "source_file_path": str(path),
            "source_type": "pdf",
            "page_number": i,
            "slide_number": None,
            "page_or_slide": i,
            "inferred_week": inferred_week,
            "inferred_topic": infer_topic(path),
            "section_heading": None,
            "raw_extracted_text": raw_text,
            "cleaned_text": "",
            "speaker_notes": None,
            "unit_has_low_text": len((raw_text or "").strip()) < config.OCR_MIN_TEXT_THRESHOLD,
            "extraction_flags": ["ocr_candidate"] if len((raw_text or "").strip()) < config.OCR_MIN_TEXT_THRESHOLD else [],
            # compatibility aliases
            "file_name": path.name,
            "source_path": str(path),
            "source_extension": ".pdf",
            "unit_type": "page",
            "text": raw_text,
            "week_number": inferred_week,
            "topic_name": infer_topic(path),
            "title": None,
            "has_speaker_notes": False,
            "needs_ocr": len((raw_text or "").strip()) < config.OCR_MIN_TEXT_THRESHOLD,
        })

    doc.close()
    return rows


def extract_pptx(path: Path, module_name: str):
    rows = []
    prs = Presentation(str(path))
    inferred_week_from_name = infer_week_number(path.stem)

    for i, slide in enumerate(prs.slides, start=1):
        texts = []
        title = None

        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                t = shape.text.strip()
                if t:
                    texts.append(t)

        if slide.shapes.title is not None and slide.shapes.title.text:
            title = slide.shapes.title.text.strip()

        notes_text = None
        try:
            if slide.has_notes_slide and slide.notes_slide and slide.notes_slide.notes_text_frame:
                notes_text = slide.notes_slide.notes_text_frame.text.strip() or None
        except Exception:
            notes_text = None

        raw_text = "\n".join(texts)
        inferred_week = inferred_week_from_name or infer_week_number(raw_text) or infer_week_number(title or "")

        rows.append({
            "doc_id": make_doc_id(module_name, path.name),
            "module_name": module_name,
            "source_file_name": path.name,
            "source_file_path": str(path),
            "source_type": "pptx",
            "page_number": None,
            "slide_number": i,
            "page_or_slide": i,
            "inferred_week": inferred_week,
            "inferred_topic": infer_topic(path),
            "section_heading": title,
            "raw_extracted_text": raw_text,
            "cleaned_text": "",
            "speaker_notes": notes_text if config.INCLUDE_SPEAKER_NOTES else None,
            "unit_has_low_text": False,
            "extraction_flags": [],
            # compatibility aliases
            "file_name": path.name,
            "source_path": str(path),
            "source_extension": ".pptx",
            "unit_type": "slide",
            "text": raw_text,
            "week_number": inferred_week,
            "topic_name": infer_topic(path),
            "title": title,
            "has_speaker_notes": bool(notes_text),
            "needs_ocr": False,
        })

    return rows


def main():
    root = config.RAW_ROOT
    out = config.EXTRACTED_DIR / "extracted_pages_slides.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)

    files = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".pdf", ".pptx"}]
    all_rows = []

    for p in tqdm(files, desc="Extracting"):
        module_name = p.parent.name
        try:
            if p.suffix.lower() == ".pdf":
                all_rows.extend(extract_pdf(p, module_name))
            else:
                all_rows.extend(extract_pptx(p, module_name))
        except Exception as e:
            all_rows.append({
                "doc_id": make_doc_id(module_name, p.name),
                "module_name": module_name,
                "source_file_name": p.name,
                "source_file_path": str(p),
                "source_type": p.suffix.lower().replace(".", ""),
                "page_number": None,
                "slide_number": None,
                "page_or_slide": None,
                "inferred_week": infer_week_number(p.stem),
                "inferred_topic": infer_topic(p),
                "section_heading": None,
                "raw_extracted_text": "",
                "cleaned_text": "",
                "speaker_notes": None,
                "unit_has_low_text": False,
                "extraction_flags": [f"error:{str(e)}"],
            })

    with out.open("w", encoding="utf-8") as f:
        for row in all_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Saved: {out}")
    print(f"Units: {len(all_rows)}")


if __name__ == "__main__":
    main()
