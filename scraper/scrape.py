#!/usr/bin/env python3
"""Main scraper entry point. Reads products.json, fetches prices, updates prices.json."""

import json
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path so we can import the scraper package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper.fetchers import GenericFetcher
from scraper.utils import random_delay

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
PRICES_FILE = os.path.join(DATA_DIR, "prices.json")
MAX_HISTORY_DAYS = 365


def load_json(filepath: str) -> dict:
    with open(filepath, "r") as f:
        return json.load(f)


def save_json(filepath: str, data: dict):
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def prune_history(history: list, max_days: int = MAX_HISTORY_DAYS) -> list:
    """Remove history entries older than max_days."""
    if not history:
        return history
    cutoff = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Calculate cutoff date
    from datetime import timedelta
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=max_days)).strftime("%Y-%m-%d")
    return [entry for entry in history if entry.get("date", "") >= cutoff_date]


def run_scraper(product_id: str | None = None):
    """Run the scraper for all active products (or a single product by ID)."""
    products_data = load_json(PRODUCTS_FILE)
    products = products_data.get("products", [])

    if not products:
        print("No products to track. Add products to data/products.json.")
        return

    # Load existing prices
    try:
        prices_data = load_json(PRICES_FILE)
    except (FileNotFoundError, json.JSONDecodeError):
        prices_data = {"last_updated": None, "entries": {}}

    entries = prices_data.get("entries", {})
    fetcher = GenericFetcher()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()

    success_count = 0
    fail_count = 0

    for product in products:
        pid = product.get("id")
        name = product.get("name", "Unknown")

        if product_id and pid != product_id:
            continue

        if not product.get("active", True):
            print(f"Skipping inactive product: {name}")
            continue

        urls = product.get("urls", [])
        if not urls:
            print(f"Skipping product with no URLs: {name}")
            continue

        print(f"\n--- Tracking: {name} ({len(urls)} URL(s)) ---")

        # Initialize product entry if needed
        if pid not in entries:
            entries[pid] = {
                "urls": {},
                "best_current_price": None,
                "best_current_source": None,
                "overall_all_time_low": None,
                "overall_all_time_low_date": None,
                "overall_all_time_low_source": None,
            }

        product_entry = entries[pid]
        url_entries = product_entry.get("urls", {})

        for url_info in urls:
            url = url_info.get("url")
            label = url_info.get("label", "Unknown")

            if not url:
                continue

            print(f"  Fetching: {label} ({url})")
            result = fetcher.fetch(url)

            # Initialize URL entry if needed
            if url not in url_entries:
                url_entries[url] = {
                    "label": label,
                    "current_price": None,
                    "current_availability": True,
                    "all_time_low": None,
                    "all_time_low_date": None,
                    "history": [],
                }

            url_entry = url_entries[url]
            url_entry["label"] = label

            if result["price"] is not None:
                price = result["price"]
                available = result["available"]

                url_entry["current_price"] = price
                url_entry["current_availability"] = available

                # Update all-time low
                if url_entry["all_time_low"] is None or price < url_entry["all_time_low"]:
                    url_entry["all_time_low"] = price
                    url_entry["all_time_low_date"] = today

                # Add history entry (avoid duplicates for same date)
                history = url_entry.get("history", [])
                if history and history[0].get("date") == today:
                    history[0] = {"date": today, "price": price, "available": available}
                else:
                    history.insert(0, {"date": today, "price": price, "available": available})

                url_entry["history"] = prune_history(history)

                print(f"    Price: ${price:.2f} | Available: {available}")
                success_count += 1
            else:
                error = result.get("error", "Unknown error")
                print(f"    FAILED: {error}")

                # Add a failed entry to history
                history = url_entry.get("history", [])
                if not (history and history[0].get("date") == today):
                    history.insert(0, {"date": today, "price": None, "available": False})
                    url_entry["history"] = prune_history(history)

                fail_count += 1

            # Delay between requests
            if url_info != urls[-1]:
                random_delay(1.0, 3.0)

        product_entry["urls"] = url_entries

        # Compute best current price across all URLs
        valid_prices = [
            (url_entries[u]["current_price"], url_entries[u]["label"])
            for u in url_entries
            if url_entries[u]["current_price"] is not None
        ]

        if valid_prices:
            best_price, best_source = min(valid_prices, key=lambda x: x[0])
            product_entry["best_current_price"] = best_price
            product_entry["best_current_source"] = best_source

        # Compute overall all-time low across all URLs
        valid_lows = [
            (url_entries[u]["all_time_low"], url_entries[u]["all_time_low_date"], url_entries[u]["label"])
            for u in url_entries
            if url_entries[u]["all_time_low"] is not None
        ]

        if valid_lows:
            best_low, best_low_date, best_low_source = min(valid_lows, key=lambda x: x[0])
            product_entry["overall_all_time_low"] = best_low
            product_entry["overall_all_time_low_date"] = best_low_date
            product_entry["overall_all_time_low_source"] = best_low_source

        entries[pid] = product_entry

        # Delay between products
        if product != products[-1]:
            random_delay(2.0, 5.0)

    prices_data["last_updated"] = now_iso
    prices_data["entries"] = entries
    save_json(PRICES_FILE, prices_data)

    print(f"\nDone! {success_count} succeeded, {fail_count} failed.")
    print(f"Prices saved to {PRICES_FILE}")


if __name__ == "__main__":
    pid = None
    if len(sys.argv) > 1 and sys.argv[1] == "--product-id" and len(sys.argv) > 2:
        pid = sys.argv[2]
    run_scraper(pid)
