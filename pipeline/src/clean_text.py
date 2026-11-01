import json
import re
from collections import Counter, defaultdict
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402

BULLET_RE = re.compile(r"^\s*(?:[-•*‣◦]|\d+[.)])\s+")
ALL_CAPS_SHORT_RE = re.compile(r"^[A-Z][A-Z\s\-/&]{2,60}$")
EMAIL_RE = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b")
PROF_RE = re.compile(r"\b(?:prof(?:essor)?\.?|dr\.?)\s+[A-Za-z][A-Za-z\-\s]{1,60}\b", re.IGNORECASE)


def normalize_whitespace(text: str) -> str:
    t = (text or "").replace("\r", "\n").replace("\t", " ")
    t = re.sub(r"[ ]{2,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def normalize_line_for_freq(line: str) -> str:
    s = line.strip().lower()
    s = re.sub(r"\d+", "#", s)
    s = re.sub(r"\s+", " ", s)
    return s


def drop_footer_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if re.fullmatch(r"\d{1,3}", s):
        return True
    if re.search(r"copyright|all rights reserved|university|school of", s, re.IGNORECASE) and len(s) < 120:
        return True
    return False


def merge_pathological_linebreaks(text: str) -> str:
    lines = text.split("\n")
    merged, buffer = [], []

    def flush_buffer():
        nonlocal buffer
        if not buffer:
            return
        paragraph = " ".join(x.strip() for x in buffer if x.strip())
        paragraph = re.sub(r"\s+([,.;:!?])", r"\1", paragraph)
        merged.append(paragraph.strip())
        buffer = []

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_buffer()
            if merged and merged[-1] != "":
                merged.append("")
            continue
        if drop_footer_noise(line):
            continue
        if BULLET_RE.match(line) or ALL_CAPS_SHORT_RE.match(line):
            flush_buffer()
            merged.append(line)
            continue
        buffer.append(line)

    flush_buffer()

    out_lines = []
    for line in merged:
        if line == "":
            if out_lines and out_lines[-1] != "":
                out_lines.append("")
            continue
        out_lines.append(line)

    t = "\n".join(out_lines)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def discover_boilerplate(rows):
    by_doc_counts = defaultdict(Counter)
    by_doc_units = Counter()

    for r in rows:
        doc_id = r.get("doc_id") or f"{r.get('module_name')}::{r.get('source_file_name')}"
        raw = normalize_whitespace(r.get("raw_extracted_text", r.get("text", "")))
        lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
        uniq_norm = set(normalize_line_for_freq(ln) for ln in lines)
        by_doc_units[doc_id] += 1
        for n in uniq_norm:
            if 3 <= len(n) <= 140:
                by_doc_counts[doc_id][n] += 1

    by_doc_boilerplate = {}
    for doc_id, ctr in by_doc_counts.items():
        units = max(1, by_doc_units[doc_id])
        threshold = max(3, int(0.6 * units))
        by_doc_boilerplate[doc_id] = {line for line, c in ctr.items() if c >= threshold}

    return by_doc_boilerplate


def clean_and_tag(row, doc_boilerplate):
    source_type = str(row.get("source_type", row.get("source_extension", ""))).lower()
    text = normalize_whitespace(row.get("raw_extracted_text", row.get("text", "")))

    if source_type in {"pdf", ".pdf"}:
        text = merge_pathological_linebreaks(text)

    removed = []
    metadata = {
        "detected_emails": [],
        "detected_instructor_names": [],
        "detected_course_title": None,
        "removed_boilerplate_lines": [],
    }

    emails = sorted(set(EMAIL_RE.findall(text)))
    if emails:
        metadata["detected_emails"] = emails
        for em in emails:
            text = text.replace(em, " ")
        removed.extend(emails)

    prof_hits = sorted(set(m.group(0).strip() for m in PROF_RE.finditer(text)))
    if prof_hits:
        metadata["detected_instructor_names"] = prof_hits

    module_name = (row.get("module_name") or "").strip()
    if module_name:
        metadata["detected_course_title"] = module_name

    doc_id = row.get("doc_id") or f"{row.get('module_name')}::{row.get('source_file_name')}"
    boilerplate_norm = doc_boilerplate.get(doc_id, set())

    kept_lines = []
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            continue
        norm = normalize_line_for_freq(s)

        is_boilerplate = norm in boilerplate_norm
        is_course_label = module_name and module_name.lower() in s.lower() and len(s) < 180
        is_email_line = bool(EMAIL_RE.search(s))

        if is_boilerplate or is_course_label or is_email_line:
            metadata["removed_boilerplate_lines"].append(s)
            removed.append(s)
            continue

        kept_lines.append(s)

    cleaned = "\n".join(kept_lines)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    row["cleaned_text"] = cleaned
    row["text_clean"] = cleaned
    row["text"] = row.get("raw_extracted_text", row.get("text", ""))
    row["metadata_refined"] = metadata
    row["removed_non_semantic_text"] = sorted(set(x for x in removed if x and x.strip()))
    return row


def main():
    inp = config.EXTRACTED_DIR / "extracted_pages_slides.jsonl"
    out = config.CLEANED_DIR / "cleaned_units.jsonl"
    report = config.CLEANED_DIR / "preprocessing_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)

    rows = [json.loads(line) for line in inp.read_text(encoding="utf-8").splitlines() if line.strip()]
    doc_boilerplate = discover_boilerplate(rows)

    total_removed = 0
    with out.open("w", encoding="utf-8") as fout:
        for row in rows:
            row = clean_and_tag(row, doc_boilerplate)
            total_removed += len(row.get("removed_non_semantic_text", []))
            fout.write(json.dumps(row, ensure_ascii=False) + "\n")

    summary = {
        "total_units": len(rows),
        "doc_count": len(doc_boilerplate),
        "total_removed_non_semantic_items": total_removed,
        "rules": [
            "email removal from chunk body (stored in metadata_refined.detected_emails)",
            "repeated per-document lines removed when present in >=60% units",
            "course/module title line suppression when repetitive",
            "footer/page-number/university boilerplate suppression"
        ]
    }
    report.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Saved: {out}")
    print(f"Saved: {report}")
    print(f"Cleaned units: {len(rows)}")


if __name__ == "__main__":
    main()
