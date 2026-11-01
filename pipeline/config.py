from pathlib import Path
import os

# Portable config: all paths are relative by default, overridable via env vars.
PROJECT_ROOT = Path(__file__).resolve().parent

# Input corpus root (where client keeps PDF/PPT/PPTX files)
RAW_ROOT = Path(os.getenv("RAG_RAW_ROOT", str(PROJECT_ROOT / "input" / "corpus"))).resolve()

# Working data/output dirs
DATA_DIR = Path(os.getenv("RAG_DATA_DIR", str(PROJECT_ROOT / "data"))).resolve()
RAW_MANIFEST_DIR = DATA_DIR / "raw_manifest"
EXTRACTED_DIR = DATA_DIR / "extracted"
CLEANED_DIR = DATA_DIR / "cleaned"
CHUNKS_DIR = DATA_DIR / "chunks"
INDEX_DIR = DATA_DIR / "index"
EVAL_DIR = Path(os.getenv("RAG_EVAL_DIR", str(PROJECT_ROOT / "eval"))).resolve()

# === Supported formats ===
SUPPORTED_EXTENSIONS = {".pdf", ".ppt", ".pptx"}

# === Extraction ===
INCLUDE_SPEAKER_NOTES = True
ENABLE_OCR_FALLBACK = True
OCR_MIN_TEXT_THRESHOLD = 30  # chars on page before OCR fallback considered

# === Chunking ===
TARGET_CHUNK_TOKENS = 350
CHUNK_OVERLAP_TOKENS = 50
MIN_CHUNK_CHARS = 120

# === Retrieval ===
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
TOP_K = 6
USE_BM25 = False
USE_RERANKER = False
RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
MIN_RETRIEVAL_SCORE = 0.76
MIN_STRONG_EVIDENCE_CHUNKS = 2

# Optional mode-specific thresholds (used in V2 scripts)
DENSE_MIN_RETRIEVAL_SCORE = 0.76
HYBRID_MIN_RETRIEVAL_SCORE = 0.82

# === Safety/Grounding ===
INSUFFICIENT_EVIDENCE_TEXT = "Not enough evidence in the provided course materials."
