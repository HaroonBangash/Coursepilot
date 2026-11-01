import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def row(i, question, module_hint, qtype, support, expected_modules, expected_keywords, gold_notes):
    return {
        "question_id": f"q{i}",
        "qid": f"q{i}",
        "question": question,
        "module_hint": module_hint,
        "question_type": qtype,
        "type": qtype,
        "expected_support_type": support,
        "expected_modules": expected_modules,
        "expected_keywords": expected_keywords,
        "gold_notes": gold_notes,
        "supported": support != "unsupported",
    }


def main():
    out = config.EVAL_DIR / "benchmark_questions_v2_36.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)

    rows = [
        # AI Foundations in Practice
        row(1, "Define reinforcement learning in terms of agent, environment, and reward.", "AI Foundations in Practice", "definition", "supported", ["AI Foundations in Practice"], ["agent", "environment", "reward", "policy"], "Core RL definition from Reinforcementlearning slides."),
        row(2, "What is overfitting in neural networks and how is it usually controlled?", "AI Foundations in Practice", "factual", "supported", ["AI Foundations in Practice"], ["overfitting", "regularization", "validation", "generalization"], "ANN-DNN and supervised learning material."),
        row(3, "Compare supervised and unsupervised learning with one example each.", "AI Foundations in Practice", "comparison", "supported", ["AI Foundations in Practice"], ["labeled", "unlabeled", "classification", "clustering"], "Supervised/Unsupervised decks likely contain direct comparison."),
        row(4, "Explain transfer learning in computer vision and when it is useful.", "AI Foundations in Practice", "multi_step", "supported", ["AI Foundations in Practice"], ["transfer learning", "pretrained", "fine-tuning", "computer vision"], "From Computervision_transferlearning deck."),
        row(5, "How does data augmentation help image model performance?", "AI Foundations in Practice", "explanation", "supported", ["AI Foundations in Practice"], ["augmentation", "generalization", "images", "overfitting"], "From Dataaugmentation slides."),
        row(6, "Differentiate ANN and deep neural networks by architecture depth.", "AI Foundations in Practice", "comparison", "supported", ["AI Foundations in Practice"], ["ANN", "deep", "layers", "hidden"], "ANN-DNNF slides."),
        row(7, "What are the main stages of a reinforcement learning workflow?", "AI Foundations in Practice", "multi_step", "partial", ["AI Foundations in Practice"], ["state", "action", "reward", "policy"], "May be spread over several RL slides; partial acceptable."),

        # Big Data and ML Applications
        row(8, "Explain the MapReduce pipeline step by step.", "Big Data And Machine Learning Applications", "multi_step", "supported", ["Big Data And Machine Learning Applications"], ["map", "shuffle", "reduce", "key-value"], "Week1 MapReduce pdf."),
        row(9, "What problem does PageRank solve and what is its core intuition?", "Big Data And Machine Learning Applications", "definition", "supported", ["Big Data And Machine Learning Applications"], ["pagerank", "graph", "rank", "links"], "Week2&3 PageRank."),
        row(10, "Compare batch processing and stream processing from the course notes.", "Big Data And Machine Learning Applications", "comparison", "partial", ["Big Data And Machine Learning Applications"], ["batch", "stream", "latency", "throughput"], "May require week8 streaming + mapreduce/spark context."),
        row(11, "What is Spark and why is it faster than classic MapReduce for some workloads?", "Big Data And Machine Learning Applications", "explanation", "supported", ["Big Data And Machine Learning Applications"], ["spark", "in-memory", "mapreduce", "speed"], "Week4 Spark."),
        row(12, "Summarize recommendation system approaches covered in week 5.", "Big Data And Machine Learning Applications", "cross_topic", "supported", ["Big Data And Machine Learning Applications"], ["recommendation", "collaborative", "content-based", "matrix"], "Week5 RecommendationSystems."),
        row(13, "How are CNN and RNN topics positioned across the big data module?", "Big Data And Machine Learning Applications", "cross_topic", "partial", ["Big Data And Machine Learning Applications"], ["cnn", "rnn", "sequence", "convolution"], "Uses week7 and week9; partial acceptable."),
        row(14, "What are key design concerns in real-time streaming analytics?", "Big Data And Machine Learning Applications", "factual", "supported", ["Big Data And Machine Learning Applications"], ["streaming", "real-time", "latency", "window"], "Week8 streaming."),

        # Data Viz and Exploratory Analytics
        row(15, "What makes a dashboard effective according to the lecture materials?", "Data Visualisation And Exploratory Analytics", "definition", "supported", ["Data Visualisation And Exploratory Analytics"], ["dashboard", "clarity", "audience", "layout"], "Dashboards deck."),
        row(16, "Explain annotation techniques used to improve chart interpretation.", "Data Visualisation And Exploratory Analytics", "explanation", "supported", ["Data Visualisation And Exploratory Analytics"], ["annotation", "label", "highlight", "context"], "Annotations/Communicating charts."),
        row(17, "Compare when to use line, bar, and scatter charts.", "Data Visualisation And Exploratory Analytics", "comparison", "supported", ["Data Visualisation And Exploratory Analytics"], ["line", "bar", "scatter", "chart"], "Graphs/which one deck."),
        row(18, "What role do colour and interactivity play in visual analytics?", "Data Visualisation And Exploratory Analytics", "cross_topic", "supported", ["Data Visualisation And Exploratory Analytics"], ["colour", "interactivity", "encoding", "exploration"], "Annotations, Colour & Interactivity."),
        row(19, "Outline the visual design process from problem framing to final chart.", "Data Visualisation And Exploratory Analytics", "multi_step", "supported", ["Data Visualisation And Exploratory Analytics"], ["design process", "audience", "iterate", "story"], "Data viz design process."),
        row(20, "How should uncertainty be communicated in time-series forecasting visuals?", "Data Visualisation And Exploratory Analytics", "ambiguous", "partial", ["Data Visualisation And Exploratory Analytics"], ["forecast", "uncertainty", "time series", "interval"], "Might be partially covered in time series deck."),
        row(21, "What are common anti-patterns in poor data visualisation?", "Data Visualisation And Exploratory Analytics", "factual", "supported", ["Data Visualisation And Exploratory Analytics"], ["misleading", "clutter", "scale", "ink"], "Better viz hints/tips + practices."),

        # Intelligent Data and Text Analytics
        row(22, "Define text mining and list typical preprocessing steps.", "Intelligent Data And Text Analytics", "definition", "supported", ["Intelligent Data And Text Analytics"], ["text mining", "tokenization", "stopwords", "stemming"], "TextMining1/2."),
        row(23, "Compare classification and clustering in data analytics tasks.", "Intelligent Data And Text Analytics", "comparison", "supported", ["Intelligent Data And Text Analytics"], ["classification", "clustering", "labels", "unsupervised"], "Classification + Clustering PDFs."),
        row(24, "Explain the difference between regression and association rules.", "Intelligent Data And Text Analytics", "comparison", "supported", ["Intelligent Data And Text Analytics"], ["regression", "association", "rules", "prediction"], "RegressionAndAssociationRules."),
        row(25, "What are the core steps in a practical text analytics pipeline?", "Intelligent Data And Text Analytics", "multi_step", "supported", ["Intelligent Data And Text Analytics"], ["preprocessing", "features", "model", "evaluation"], "Data preparation + text mining sequence."),
        row(26, "How are LLMs introduced in TextMining3 and what cautions are noted?", "Intelligent Data And Text Analytics", "factual", "supported", ["Intelligent Data And Text Analytics"], ["llm", "limitations", "prompt", "text mining"], "TextMining3_LLMs."),
        row(27, "Link data preparation choices to downstream classification quality.", "Intelligent Data And Text Analytics", "cross_topic", "partial", ["Intelligent Data And Text Analytics"], ["data preparation", "features", "classification", "quality"], "Cross-topic relation; partial acceptable."),

        # Programming for Data Analysis and AI
        row(28, "What Python workflow is recommended for exploratory data analysis in the weekly slides?", "Programming for Data Analysis and AI", "multi_step", "supported", ["Programming for Data Analysis and AI"], ["python", "pandas", "analysis", "workflow"], "Likely spread across week slides."),
        row(29, "How is train/validation/test splitting explained in the programming module?", "Programming for Data Analysis and AI", "definition", "supported", ["Programming for Data Analysis and AI"], ["train", "validation", "test", "split"], "Typical ML prep content."),
        row(30, "Compare classification metrics and regression metrics covered in weeks 9-10.", "Programming for Data Analysis and AI", "comparison", "partial", ["Programming for Data Analysis and AI"], ["accuracy", "precision", "rmse", "evaluation"], "Could require multiple weeks; partial accepted."),
        row(31, "What are common data-cleaning operations demonstrated in the programming notes?", "Programming for Data Analysis and AI", "factual", "supported", ["Programming for Data Analysis and AI"], ["missing values", "outliers", "types", "cleaning"], "From EDA/prep weeks."),

        # Cross-topic + unsupported + ambiguous
        row(32, "Compare reinforcement learning with recommendation systems from the course materials.", "cross-module", "cross_topic", "partial", ["AI Foundations in Practice", "Big Data And Machine Learning Applications"], ["reinforcement learning", "recommendation", "feedback", "policy"], "Cross-module conceptual bridge; partial acceptable."),
        row(33, "How do data visualisation choices affect model interpretation quality?", "cross-module", "cross_topic", "partial", ["Data Visualisation And Exploratory Analytics", "Programming for Data Analysis and AI"], ["visualisation", "interpretation", "model", "communication"], "Cross-module; likely partial evidence."),
        row(34, "Explain quantum supremacy applications in medicine from these course notes.", None, "unsupported", "unsupported", [], [], "Expected refusal."),
        row(35, "What is the capital of France?", None, "unsupported", "unsupported", [], [], "Expected refusal."),
        row(36, "Give exact legal compliance steps for GDPR certification from these slides.", None, "ambiguous", "unsupported", [], [], "Outside corpus scope; expected refusal."),
    ]

    with out.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"Saved: {out}")
    print(f"Rows: {len(rows)}")


if __name__ == "__main__":
    main()
