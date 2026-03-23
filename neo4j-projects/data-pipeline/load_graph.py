#!/usr/bin/env python3
"""Loads ICIJ Offshore Leaks CSV data into Neo4j Aura."""

import os
import sys
import pandas as pd
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(env_path)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")

BATCH_SIZE = 500


def get_driver():
    """Create a Neo4j driver instance."""
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))


def clear_database(driver):
    """Remove all nodes and relationships."""
    print("Clearing existing data...")
    with driver.session(database=NEO4J_DATABASE) as session:
        # Delete in batches to avoid memory issues
        while True:
            result = session.run(
                "MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*) AS deleted"
            )
            deleted = result.single()["deleted"]
            if deleted == 0:
                break
            print(f"  Deleted {deleted} nodes...")
    print("  Database cleared.")


def create_constraints(driver):
    """Create indexes and constraints for performance."""
    print("Creating constraints and indexes...")
    constraints = [
        "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.node_id IS UNIQUE",
        "CREATE CONSTRAINT officer_id IF NOT EXISTS FOR (o:Officer) REQUIRE o.node_id IS UNIQUE",
        "CREATE CONSTRAINT intermediary_id IF NOT EXISTS FOR (i:Intermediary) REQUIRE i.node_id IS UNIQUE",
        "CREATE CONSTRAINT address_id IF NOT EXISTS FOR (a:Address) REQUIRE a.node_id IS UNIQUE",
        "CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)",
        "CREATE INDEX officer_name IF NOT EXISTS FOR (o:Officer) ON (o.name)",
        "CREATE INDEX intermediary_name IF NOT EXISTS FOR (i:Intermediary) ON (i.name)",
    ]
    with driver.session(database=NEO4J_DATABASE) as session:
        for constraint in constraints:
            try:
                session.run(constraint)
            except Exception as e:
                # Constraint may already exist
                pass
    print("  Constraints created.")


def find_csv(pattern):
    """Find a CSV file in the data directory matching a pattern."""
    if not os.path.exists(DATA_DIR):
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        print("Run download_data.py first.")
        sys.exit(1)

    for f in os.listdir(DATA_DIR):
        if pattern in f.lower() and f.endswith(".csv"):
            return os.path.join(DATA_DIR, f)
    return None


def load_entities(driver):
    """Load Entity nodes from CSV."""
    csv_path = find_csv("entit")
    if not csv_path:
        print("WARNING: Entities CSV not found, skipping.")
        return 0

    print(f"Loading entities from {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.fillna("")

    # Identify key columns (ICIJ CSV format varies)
    id_col = next((c for c in df.columns if "node_id" in c.lower() or c == "id"), df.columns[0])
    name_col = next((c for c in df.columns if "name" in c.lower()), None)
    jurisdiction_col = next((c for c in df.columns if "jurisdiction" in c.lower()), None)
    country_col = next((c for c in df.columns if "country" in c.lower() and "code" not in c.lower()), None)
    status_col = next((c for c in df.columns if "status" in c.lower()), None)
    source_col = next((c for c in df.columns if "sourceID" in c or "source_id" in c.lower()), None)

    count = 0
    with driver.session(database=NEO4J_DATABASE) as session:
        batch = []
        for _, row in df.iterrows():
            props = {"node_id": str(row[id_col])}
            if name_col:
                props["name"] = str(row[name_col])
            if jurisdiction_col:
                props["jurisdiction"] = str(row[jurisdiction_col])
            if country_col:
                props["country"] = str(row[country_col])
            if status_col:
                props["status"] = str(row[status_col])
            if source_col:
                props["source"] = str(row[source_col])
            batch.append(props)

            if len(batch) >= BATCH_SIZE:
                session.run(
                    "UNWIND $batch AS props "
                    "MERGE (e:Entity {node_id: props.node_id}) "
                    "SET e += props",
                    batch=batch,
                )
                count += len(batch)
                print(f"\r  Loaded {count} entities...", end="", flush=True)
                batch = []

        if batch:
            session.run(
                "UNWIND $batch AS props "
                "MERGE (e:Entity {node_id: props.node_id}) "
                "SET e += props",
                batch=batch,
            )
            count += len(batch)

    print(f"\r  Loaded {count} entities total.")
    return count


def load_officers(driver):
    """Load Officer nodes from CSV."""
    csv_path = find_csv("officer")
    if not csv_path:
        print("WARNING: Officers CSV not found, skipping.")
        return 0

    print(f"Loading officers from {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.fillna("")

    id_col = next((c for c in df.columns if "node_id" in c.lower() or c == "id"), df.columns[0])
    name_col = next((c for c in df.columns if "name" in c.lower()), None)
    country_col = next((c for c in df.columns if "country" in c.lower() and "code" not in c.lower()), None)
    source_col = next((c for c in df.columns if "sourceID" in c or "source_id" in c.lower()), None)

    count = 0
    with driver.session(database=NEO4J_DATABASE) as session:
        batch = []
        for _, row in df.iterrows():
            props = {"node_id": str(row[id_col])}
            if name_col:
                props["name"] = str(row[name_col])
            if country_col:
                props["country"] = str(row[country_col])
            if source_col:
                props["source"] = str(row[source_col])
            batch.append(props)

            if len(batch) >= BATCH_SIZE:
                session.run(
                    "UNWIND $batch AS props "
                    "MERGE (o:Officer {node_id: props.node_id}) "
                    "SET o += props",
                    batch=batch,
                )
                count += len(batch)
                print(f"\r  Loaded {count} officers...", end="", flush=True)
                batch = []

        if batch:
            session.run(
                "UNWIND $batch AS props "
                "MERGE (o:Officer {node_id: props.node_id}) "
                "SET o += props",
                batch=batch,
            )
            count += len(batch)

    print(f"\r  Loaded {count} officers total.")
    return count


def load_intermediaries(driver):
    """Load Intermediary nodes from CSV."""
    csv_path = find_csv("intermediar")
    if not csv_path:
        print("WARNING: Intermediaries CSV not found, skipping.")
        return 0

    print(f"Loading intermediaries from {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.fillna("")

    id_col = next((c for c in df.columns if "node_id" in c.lower() or c == "id"), df.columns[0])
    name_col = next((c for c in df.columns if "name" in c.lower()), None)
    country_col = next((c for c in df.columns if "country" in c.lower() and "code" not in c.lower()), None)
    source_col = next((c for c in df.columns if "sourceID" in c or "source_id" in c.lower()), None)

    count = 0
    with driver.session(database=NEO4J_DATABASE) as session:
        batch = []
        for _, row in df.iterrows():
            props = {"node_id": str(row[id_col])}
            if name_col:
                props["name"] = str(row[name_col])
            if country_col:
                props["country"] = str(row[country_col])
            if source_col:
                props["source"] = str(row[source_col])
            batch.append(props)

            if len(batch) >= BATCH_SIZE:
                session.run(
                    "UNWIND $batch AS props "
                    "MERGE (i:Intermediary {node_id: props.node_id}) "
                    "SET i += props",
                    batch=batch,
                )
                count += len(batch)
                print(f"\r  Loaded {count} intermediaries...", end="", flush=True)
                batch = []

        if batch:
            session.run(
                "UNWIND $batch AS props "
                "MERGE (i:Intermediary {node_id: props.node_id}) "
                "SET i += props",
                batch=batch,
            )
            count += len(batch)

    print(f"\r  Loaded {count} intermediaries total.")
    return count


def load_addresses(driver):
    """Load Address nodes from CSV."""
    csv_path = find_csv("address")
    if not csv_path:
        print("WARNING: Addresses CSV not found, skipping.")
        return 0

    print(f"Loading addresses from {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.fillna("")

    id_col = next((c for c in df.columns if "node_id" in c.lower() or c == "id"), df.columns[0])
    address_col = next((c for c in df.columns if "address" in c.lower() and "node" not in c.lower()), None)
    country_col = next((c for c in df.columns if "country" in c.lower() and "code" not in c.lower()), None)
    source_col = next((c for c in df.columns if "sourceID" in c or "source_id" in c.lower()), None)

    count = 0
    with driver.session(database=NEO4J_DATABASE) as session:
        batch = []
        for _, row in df.iterrows():
            props = {"node_id": str(row[id_col])}
            if address_col:
                props["address"] = str(row[address_col])
            if country_col:
                props["country"] = str(row[country_col])
            if source_col:
                props["source"] = str(row[source_col])
            batch.append(props)

            if len(batch) >= BATCH_SIZE:
                session.run(
                    "UNWIND $batch AS props "
                    "MERGE (a:Address {node_id: props.node_id}) "
                    "SET a += props",
                    batch=batch,
                )
                count += len(batch)
                print(f"\r  Loaded {count} addresses...", end="", flush=True)
                batch = []

        if batch:
            session.run(
                "UNWIND $batch AS props "
                "MERGE (a:Address {node_id: props.node_id}) "
                "SET a += props",
                batch=batch,
            )
            count += len(batch)

    print(f"\r  Loaded {count} addresses total.")
    return count


def load_relationships(driver):
    """Load relationships from CSV."""
    csv_path = find_csv("relation")
    if not csv_path:
        print("WARNING: Relationships CSV not found, skipping.")
        return 0

    print(f"Loading relationships from {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.fillna("")

    # Identify columns
    start_col = next((c for c in df.columns if "start" in c.lower() or "node_id_start" in c.lower()), None)
    end_col = next((c for c in df.columns if "end" in c.lower() or "node_id_end" in c.lower()), None)
    type_col = next((c for c in df.columns if "rel_type" in c.lower() or "type" in c.lower() or "link" in c.lower()), None)

    if not start_col or not end_col:
        # Try positional: many ICIJ CSVs use node_1, node_2 or START_ID, END_ID
        cols = df.columns.tolist()
        start_col = next((c for c in cols if "node_1" in c or "START" in c), cols[0])
        end_col = next((c for c in cols if "node_2" in c or "END" in c), cols[1] if len(cols) > 1 else cols[0])

    # Map relationship types
    rel_type_map = {
        "officer_of": "OFFICER_OF",
        "registered_address": "REGISTERED_ADDRESS",
        "intermediary_of": "INTERMEDIARY_OF",
        "similar_name_and_address": "RELATED_TO",
        "related_entity": "RELATED_TO",
        "same_name_as": "RELATED_TO",
        "same_id_as": "RELATED_TO",
        "probably_same_officer_as": "RELATED_TO",
    }

    # Group by relationship type for efficient loading
    count = 0
    with driver.session(database=NEO4J_DATABASE) as session:
        batch = []
        for _, row in df.iterrows():
            start_id = str(row[start_col])
            end_id = str(row[end_col])
            raw_type = str(row[type_col]).lower().strip() if type_col else "related_to"
            rel_type = rel_type_map.get(raw_type, "RELATED_TO")

            batch.append({"start": start_id, "end": end_id, "type": rel_type})

            if len(batch) >= BATCH_SIZE:
                # Use a generic approach: find any node by node_id
                for rtype in set(r["type"] for r in batch):
                    typed_batch = [r for r in batch if r["type"] == rtype]
                    query = (
                        f"UNWIND $batch AS rel "
                        f"MATCH (a {{node_id: rel.start}}) "
                        f"MATCH (b {{node_id: rel.end}}) "
                        f"MERGE (a)-[:{rtype}]->(b)"
                    )
                    session.run(query, batch=typed_batch)
                count += len(batch)
                print(f"\r  Loaded {count} relationships...", end="", flush=True)
                batch = []

        if batch:
            for rtype in set(r["type"] for r in batch):
                typed_batch = [r for r in batch if r["type"] == rtype]
                query = (
                    f"UNWIND $batch AS rel "
                    f"MATCH (a {{node_id: rel.start}}) "
                    f"MATCH (b {{node_id: rel.end}}) "
                    f"MERGE (a)-[:{rtype}]->(b)"
                )
                session.run(query, batch=typed_batch)
            count += len(batch)

    print(f"\r  Loaded {count} relationships total.")
    return count


def print_stats(driver):
    """Print database statistics."""
    print("\n" + "=" * 60)
    print("DATABASE STATISTICS")
    print("=" * 60)
    with driver.session(database=NEO4J_DATABASE) as session:
        for label in ["Entity", "Officer", "Intermediary", "Address"]:
            result = session.run(f"MATCH (n:{label}) RETURN count(n) AS count")
            count = result.single()["count"]
            print(f"  {label} nodes: {count:,}")

        result = session.run("MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC")
        print("\n  Relationships:")
        for record in result:
            print(f"    {record['type']}: {record['count']:,}")
    print("=" * 60)


def main():
    print("=" * 60)
    print("ICIJ Offshore Leaks → Neo4j Loader")
    print("=" * 60)
    print(f"\nConnecting to: {NEO4J_URI}")

    driver = get_driver()

    # Verify connection
    try:
        driver.verify_connectivity()
        print("Connected successfully!\n")
    except Exception as e:
        print(f"ERROR: Could not connect to Neo4j: {e}")
        sys.exit(1)

    clear_database(driver)
    create_constraints(driver)

    total = 0
    total += load_entities(driver)
    total += load_officers(driver)
    total += load_intermediaries(driver)
    total += load_addresses(driver)
    total += load_relationships(driver)

    print(f"\nTotal items loaded: {total:,}")
    print_stats(driver)

    driver.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
