import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def main():
    out = config.EVAL_DIR / "benchmark_questions_template_30.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    # 24 supported + 6 unsupported template slots
    qid = 1
    for module in [
        "AI Foundations in Practice",
        "Big Data And Machine Learning Applications",
        "Data Visualisation And Exploratory Analytics",
        "Intelligent Data And Text Analytics",
        "Programming for Data Analysis and AI",
    ]:
        for _ in range(5):
            rows.append({
                "qid": f"q{qid}",
                "question": "[ADD QUESTION HERE]",
                "type": "definition|comparison|topic_explanation|revision",
                "expected_modules": [module],
                "expected_keywords": ["[k1]", "[k2]", "[k3]"],
                "supported": True,
            })
            qid += 1

    for _ in range(5):
        rows.append({
            "qid": f"q{qid}",
            "question": "[ADD UNSUPPORTED QUESTION HERE]",
            "type": "unsupported",
            "expected_modules": [],
            "expected_keywords": [],
            "supported": False,
        })
        qid += 1

    with out.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"Saved: {out}")
    print(f"Template rows: {len(rows)}")


if __name__ == "__main__":
    main()
