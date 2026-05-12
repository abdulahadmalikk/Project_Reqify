# -*- coding: utf-8 -*-
"""
Pre-download script for all-MiniLM-L6-v2 SentenceTransformer model.
Shows exact byte-level progress bar for every file downloaded.
"""
import os
import sys
import requests
from tqdm import tqdm
from pathlib import Path

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CACHE_DIR = Path.home() / ".cache" / "huggingface" / "hub"

# All files needed for the model
MODEL_FILES = [
    "config.json",
    "tokenizer_config.json",
    "tokenizer.json",
    "vocab.txt",
    "special_tokens_map.json",
    "sentence_bert_config.json",
    "modules.json",
    "config_sentence_transformers.json",
    "pytorch_model.bin",        # PyTorch weights
    "model.safetensors",        # Safetensors weights (~90MB - the new default)
    "1_Pooling/config.json",
]

HF_BASE = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"

def download_file(url, dest_path):
    """Download a file with a real tqdm progress bar showing exact bytes."""
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # Skip if already fully downloaded
    if dest_path.exists() and dest_path.stat().st_size > 0:
        print(f"  ✅ Already exists: {dest_path.name} ({dest_path.stat().st_size / 1024:.1f} KB) — skipping")
        return True

    print(f"\n[DOWNLOADING] {dest_path.name}")
    print(f"   URL: {url}")

    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))
        block_size = 8192  # 8 KB chunks

        with tqdm(
            total=total_size,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc=f"  {dest_path.name}",
            bar_format="{desc}: {percentage:3.1f}%|{bar:40}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
            colour="green",
            dynamic_ncols=True,
        ) as pbar:
            with open(dest_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=block_size):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))

        final_size = dest_path.stat().st_size
        print(f"  [DONE] {dest_path.name} ({final_size / 1024 / 1024:.2f} MB)")
        return True

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"  [SKIP] Not found (optional): {dest_path.name}")
            return True  # Optional file, not fatal
        print(f"  [FAIL] HTTP Error {e.response.status_code}: {dest_path.name}")
        return False
    except Exception as e:
        print(f"  [FAIL] Error downloading {dest_path.name}: {e}")
        return False


def main():
    print("=" * 60)
    print("  Pre-downloading: sentence-transformers/all-MiniLM-L6-v2")
    print("=" * 60)
    print(f"  Cache location: {CACHE_DIR}")
    print()

    # Build the model-specific cache path (matches HuggingFace hub structure)
    model_cache = CACHE_DIR / "models--sentence-transformers--all-MiniLM-L6-v2" / "snapshots" / "main"
    
    failed = []

    for file_path in MODEL_FILES:
        url = f"{HF_BASE}/{file_path}"
        dest = model_cache / file_path
        success = download_file(url, dest)
        if not success:
            failed.append(file_path)

    print()
    print("=" * 60)
    if failed:
        print(f"  [FAIL] {len(failed)} file(s) failed: {failed}")
        print("  Try running again or check your internet connection.")
        sys.exit(1)
    else:
        print("  [SUCCESS] All files downloaded!")
        print()
        print("  Now loading SentenceTransformer to verify + finalize cache...")
        print("  (This takes ~10 seconds)")
        print()
        try:
            # This finalizes the HF cache structure properly
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
            test = model.encode(["test sentence"])
            print(f"  [OK] Model verified! Embedding shape: {test.shape}")
            print()
            print("  [READY] You can now start the server!")
        except Exception as e:
            print(f"  [FAIL] Verification failed: {e}")
            sys.exit(1)
    print("=" * 60)


if __name__ == "__main__":
    main()
