import json
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


TOKEN_RE = re.compile(r"\w+", re.UNICODE)
BULLET_RE = re.compile(r"^\s*(?:[-•*‣◦]|\d+[.)])\s+")

# Phase-1 chunking controls
PPTX_SHORT_TOKEN_THRESHOLD = 140
PPTX_LONG_GROUP_MAX_TOKENS = 180
PDF_MIN_TOKENS = 120
PDF_TARGET_TOKENS = 240
PDF_MAX_TOKENS = 320


def token_count(text: str) -> int:
    return len(TOKEN_RE.findall(text or ""))


def split_paragraphs(text: str):
    return [p.strip() for p in re.split(r"\n\s*\n+", text or "") if p.strip()]


def chunk_pptx(row: dict):
    text = row.get("cleaned_text", "").strip()
    heading = row.get("section_heading") or row.get("title")
    if not text:
        return []

    tks = token_count(text)
    chunks = []

    # one slide = one chunk when short/coherent
    if tks <= PPTX_SHORT_TOKEN_THRESHOLD:
        chunks.append({
            "chunk_type": "slide_full",
            "parent_heading": heading,
            "chunk_text": text,
        })
        return chunks

    # long slide: heading + bullet-group chunking
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if not lines:
        return []

    title_line = lines[0] if heading else None
    body_lines = lines[1:] if title_line else lines

    group = []
    group_tokens = 0

    def flush_group():
        nonlocal group, group_tokens
        if not group:
            return
        block = "\n".join(group).strip()
        if title_line and title_line.lower() not in block.lower():
            block = f"{title_line}\n{block}"
        chunks.append({
            "chunk_type": "slide_bullets",
            "parent_heading": heading or title_line,
            "chunk_text": block,
        })
        group = []
        group_tokens = 0

    for ln in body_lines:
        ln_tokens = token_count(ln)
        starts_new = BULLET_RE.match(ln) is not None and group_tokens >= PPTX_LONG_GROUP_MAX_TOKENS
        over_limit = (group_tokens + ln_tokens) > PPTX_LONG_GROUP_MAX_TOKENS and group_tokens >= 80
        if starts_new or over_limit:
            flush_group()
        group.append(ln)
        group_tokens += ln_tokens

    flush_group()

    if not chunks:
        chunks.append({
            "chunk_type": "slide_full",
            "parent_heading": heading,
            "chunk_text": text,
        })

    return chunks


def chunk_pdf(row: dict):
    text = row.get("cleaned_text", "").strip()
    heading = row.get("section_heading") or row.get("title")
    if not text:
        return []

    paragraphs = split_paragraphs(text)
    if not paragraphs:
        paragraphs = [text]

    chunks = []
    current = []
    current_tokens = 0

    def flush_current():
        nonlocal current, current_tokens
        if not current:
            return
        block = "\n\n".join(current).strip()
        chunks.append({
            "chunk_type": "pdf_paragraph",
            "parent_heading": heading,
            "chunk_text": block,
        })
        current = []
        current_tokens = 0

    for para in paragraphs:
        pt = token_count(para)

        # very long paragraph => sectional split (sentence based)
        if pt > PDF_MAX_TOKENS:
            flush_current()
            sents = re.split(r"(?<=[.!?])\s+", para)
            buf = []
            buf_t = 0
            for s in sents:
                st = token_count(s)
                if buf_t + st > PDF_TARGET_TOKENS and buf_t >= PDF_MIN_TOKENS:
                    chunks.append({
                        "chunk_type": "pdf_section",
                        "parent_heading": heading,
                        "chunk_text": " ".join(buf).strip(),
                    })
                    buf, buf_t = [], 0
                buf.append(s)
                buf_t += st
            if buf:
                chunks.append({
                    "chunk_type": "pdf_section",
                    "parent_heading": heading,
                    "chunk_text": " ".join(buf).strip(),
                })
            continue

        if current_tokens + pt > PDF_TARGET_TOKENS and current_tokens >= PDF_MIN_TOKENS:
            flush_current()

        current.append(para)
        current_tokens += pt

    flush_current()

    if not chunks:
        chunks.append({
            "chunk_type": "pdf_paragraph",
            "parent_heading": heading,
            "chunk_text": text,
        })

    return chunks


def row_to_v2_chunk(row: dict, part: dict, idx: int):
    source_file_name = row.get("source_file_name", row.get("file_name"))
    source_file_path = row.get("source_file_path", row.get("source_path"))
    source_type = row.get("source_type", "")
    unit_type = "slide" if str(source_type).lower() in {"pptx", "ppt"} else "page"
    page_or_slide = row.get("page_or_slide")

    chunk_text = (part.get("chunk_text") or "").strip()

    refined = row.get("metadata_refined", {}) or {}

    v2 = {
        "chunk_id": f"{row['doc_id']}::{unit_type}:{page_or_slide}::c{idx}",
        "doc_id": row.get("doc_id"),
        "module_name": row.get("module_name"),
        "subject_name": row.get("module_name"),
        "source_file_name": source_file_name,
        "source_file_path": source_file_path,
        "source_type": source_type,
        "page_or_slide": page_or_slide,
        "page_number": row.get("page_number"),
        "slide_number": row.get("slide_number"),
        "inferred_week": row.get("inferred_week", row.get("week_number")),
        "inferred_topic": row.get("inferred_topic", row.get("topic_name")),
        "parent_heading": part.get("parent_heading") or row.get("section_heading") or row.get("title"),
        "chunk_type": part.get("chunk_type"),
        "chunk_text": chunk_text,
        "token_count": token_count(chunk_text),
        "char_count": len(chunk_text),
        "chunk_order_in_unit": idx,
        "provenance_path": f"{row.get('module_name')}/{source_file_name}/{unit_type}:{page_or_slide}",
        "chunk_quality_flags": [],
        "metadata_course_title": refined.get("detected_course_title"),
        "metadata_instructor_names": refined.get("detected_instructor_names", []),
        "metadata_emails": refined.get("detected_emails", []),
        "metadata_removed_boilerplate_lines": refined.get("removed_boilerplate_lines", []),
        # compatibility aliases
        "file_name": source_file_name,
        "unit_type": unit_type,
        "title": row.get("title"),
    }

    if v2["token_count"] < 35:
        v2["chunk_quality_flags"].append("short_context")

    return v2


def main():
    inp = config.CLEANED_DIR / "cleaned_units.jsonl"
    out = config.CHUNKS_DIR / "chunks.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)

    n = 0
    with inp.open("r", encoding="utf-8") as fin, out.open("w", encoding="utf-8") as fout:
        for line in fin:
            row = json.loads(line)
            source_type = str(row.get("source_type", "")).lower()

            if source_type in {"ppt", "pptx"}:
                parts = chunk_pptx(row)
            else:
                parts = chunk_pdf(row)

            for i, part in enumerate(parts, start=1):
                out_row = row_to_v2_chunk(row, part, i)
                if not out_row["chunk_text"]:
                    continue
                fout.write(json.dumps(out_row, ensure_ascii=False) + "\n")
                n += 1

    print(f"Saved: {out}")
    print(f"Chunks: {n}")


if __name__ == "__main__":
    main()
