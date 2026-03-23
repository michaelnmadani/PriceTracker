#!/usr/bin/env python3
"""Downloads ICIJ Offshore Leaks CSV data files."""

import os
import zipfile
import requests

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# ICIJ Offshore Leaks bulk CSV download URL
DOWNLOAD_URL = "https://offshoreleaks.icij.org/pages/database"

# Direct CSV download URLs from ICIJ
CSV_URLS = {
    "nodes-entities.csv": "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_entities.csv.zip",
    "nodes-officers.csv": "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_officers.csv.zip",
    "nodes-intermediaries.csv": "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_intermediaries.csv.zip",
    "nodes-addresses.csv": "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_addresses.csv.zip",
    "relationships.csv": "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_relationships.csv.zip",
}


def download_file(url, dest_path):
    """Download a file with progress indication."""
    print(f"  Downloading {url}...")
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    downloaded = 0

    with open(dest_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = (downloaded / total) * 100
                print(f"\r  Progress: {pct:.1f}%", end="", flush=True)
    print()


def extract_zip(zip_path, dest_dir):
    """Extract a zip file and return the extracted CSV path."""
    with zipfile.ZipFile(zip_path, "r") as zf:
        csv_files = [f for f in zf.namelist() if f.endswith(".csv")]
        zf.extractall(dest_dir)
        return [os.path.join(dest_dir, f) for f in csv_files]


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("=" * 60)
    print("ICIJ Offshore Leaks Data Downloader")
    print("=" * 60)
    print(f"\nData will be saved to: {DATA_DIR}\n")

    for name, url in CSV_URLS.items():
        zip_name = name.replace(".csv", ".zip")
        zip_path = os.path.join(DATA_DIR, zip_name)
        csv_path = os.path.join(DATA_DIR, name)

        if os.path.exists(csv_path):
            print(f"[SKIP] {name} already exists")
            continue

        print(f"[DOWNLOAD] {name}")
        try:
            download_file(url, zip_path)
            extracted = extract_zip(zip_path, DATA_DIR)
            print(f"  Extracted: {', '.join(os.path.basename(f) for f in extracted)}")
            os.remove(zip_path)
        except Exception as e:
            print(f"  ERROR: {e}")
            print(f"  You may need to download manually from: {DOWNLOAD_URL}")
            continue

    print("\n" + "=" * 60)
    print("Download complete! Files in data/:")
    for f in sorted(os.listdir(DATA_DIR)):
        size = os.path.getsize(os.path.join(DATA_DIR, f))
        print(f"  {f}: {size / 1024 / 1024:.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
