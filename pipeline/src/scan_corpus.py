import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd

import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def infer_week_number(filename: str):
    m = re.search(r"week\s*[-_ ]?0?(\d{1,2})", filename, re.IGNORECASE)
    return int(m.group(1)) if m else None


def clean_topic_name(stem: str):
    topic = re.sub(r"[_\-]+", " ", stem)
    topic = re.sub(r"\s+", " ", topic).strip()
    topic = re.sub(r"\bweek\s*\d{1,2}\b", "", topic, flags=re.IGNORECASE).strip()
    return topic if topic else stem


def infer_content_type(filename: str):
    name = filename.lower()
    if "week" in name:
        return "week_file"
    if any(k in name for k in ["intro", "introduction", "classification", "clustering", "regression", "textmining", "spark", "mapreduce"]):
        return "topic_file"
    if "slides" in name:
        return "slides"
    if "notes" in name:
        return "notes"
    return "slides"


def md5_file(path: Path):
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def is_readable(path: Path):
    try:
        with path.open("rb") as f:
            _ = f.read(32)
        return True, None
    except Exception as e:
        return False, str(e)


def main():
    root = config.RAW_ROOT
    out_dir = config.RAW_MANIFEST_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if not root.exists():
        raise FileNotFoundError(f"Raw root not found: {root}")

    records = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue

        ext = p.suffix.lower()
        module_name = p.parent.name
        rel_path = p.relative_to(root)
        size_bytes = p.stat().st_size
        modified = datetime.fromtimestamp(p.stat().st_mtime).isoformat()

        readable, read_error = is_readable(p)
        supported = ext in config.SUPPORTED_EXTENSIONS

        record = {
            "full_path": str(p),
            "relative_path": str(rel_path),
            "module_folder": module_name,
            "file_name": p.name,
            "stem": p.stem,
            "extension": ext,
            "size_bytes": size_bytes,
            "modified_date": modified,
            "is_empty": size_bytes == 0,
            "is_supported": supported,
            "is_readable": readable,
            "read_error": read_error,
            "source_type": "pdf" if ext == ".pdf" else ("ppt" if ext in {".ppt", ".pptx"} else "other"),
            "inferred_content_type": infer_content_type(p.name),
            "module_name": module_name,
            "week_number": infer_week_number(p.stem),
            "topic_name": clean_topic_name(p.stem),
            "likely_usable_for_rag": bool(supported and readable and size_bytes > 0),
        }

        if readable and size_bytes > 0:
            try:
                record["md5"] = md5_file(p)
            except Exception:
                record["md5"] = None
        else:
            record["md5"] = None

        records.append(record)

    df = pd.DataFrame(records)

    # Duplicate detection (same filename / same hash)
    dup_by_name = []
    if not df.empty:
        for _, g in df.groupby("file_name"):
            if len(g) > 1:
                dup_by_name.extend(g["full_path"].tolist())

    dup_by_hash = []
    if not df.empty and "md5" in df.columns:
        hash_df = df[df["md5"].notna()]
        for _, g in hash_df.groupby("md5"):
            if len(g) > 1:
                dup_by_hash.extend(g["full_path"].tolist())

    if not df.empty:
        df["duplicate_name_flag"] = df["full_path"].isin(dup_by_name)
        df["duplicate_hash_flag"] = df["full_path"].isin(dup_by_hash)

    csv_path = out_dir / "corpus_inventory.csv"
    json_path = out_dir / "corpus_inventory.json"
    report_path = out_dir / "file_health_report.json"

    df.sort_values(["module_folder", "file_name"]).to_csv(csv_path, index=False, encoding="utf-8")
    df.sort_values(["module_folder", "file_name"]).to_json(json_path, orient="records", force_ascii=False, indent=2)

    report = {
        "root": str(root),
        "total_files": int(len(df)),
        "supported_files": int(df["is_supported"].sum()) if not df.empty else 0,
        "unsupported_files": int((~df["is_supported"]).sum()) if not df.empty else 0,
        "empty_files": int(df["is_empty"].sum()) if not df.empty else 0,
        "unreadable_files": int((~df["is_readable"]).sum()) if not df.empty else 0,
        "likely_usable_for_rag": int(df["likely_usable_for_rag"].sum()) if not df.empty else 0,
        "duplicates_by_name": sorted(set(dup_by_name)),
        "duplicates_by_hash": sorted(set(dup_by_hash)),
        "by_extension": df["extension"].value_counts(dropna=False).to_dict() if not df.empty else {},
        "by_module": df["module_folder"].value_counts(dropna=False).to_dict() if not df.empty else {},
        "generated_at": datetime.now().isoformat(),
    }

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Saved: {csv_path}")
    print(f"Saved: {json_path}")
    print(f"Saved: {report_path}")
    print(f"Total files: {report['total_files']}")


if __name__ == "__main__":
    main()
