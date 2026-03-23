#!/usr/bin/env python3
"""Runs fraud detection queries against the ICIJ Offshore Leaks Neo4j graph."""

import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(env_path)

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")


def get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))


def shell_company_operators(session):
    """Find officers controlling many entities — potential shell company operators."""
    print("\n" + "=" * 70)
    print("FRAUD PATTERN 1: Shell Company Operators")
    print("Officers controlling 10+ entities")
    print("=" * 70)

    result = session.run("""
        MATCH (o:Officer)-[:OFFICER_OF]->(e:Entity)
        WITH o, collect(e.name) AS entities, count(e) AS entityCount
        WHERE entityCount >= 10
        RETURN o.name AS officer, o.country AS country,
               entityCount, entities[..5] AS sampleEntities
        ORDER BY entityCount DESC
        LIMIT 25
    """)

    for record in result:
        print(f"\n  {record['officer']} ({record['country'] or 'Unknown'})")
        print(f"    Controls {record['entityCount']} entities")
        print(f"    Sample: {', '.join(record['sampleEntities'][:3])}")


def shared_address_clusters(session):
    """Find addresses with many entities — red flag for shell companies."""
    print("\n" + "=" * 70)
    print("FRAUD PATTERN 2: Shared Address Clusters")
    print("Addresses with many registered entities")
    print("=" * 70)

    result = session.run("""
        MATCH (e:Entity)-[:REGISTERED_ADDRESS]->(a:Address)
        WITH a, collect(e.name) AS entities, count(e) AS entityCount
        WHERE entityCount >= 10
        RETURN a.address AS address, a.country AS country,
               entityCount, entities[..5] AS sampleEntities
        ORDER BY entityCount DESC
        LIMIT 25
    """)

    for record in result:
        addr = record["address"]
        if len(addr) > 80:
            addr = addr[:77] + "..."
        print(f"\n  {addr}")
        print(f"    Country: {record['country'] or 'Unknown'}")
        print(f"    Entities registered: {record['entityCount']}")
        print(f"    Sample: {', '.join(record['sampleEntities'][:3])}")


def intermediary_hubs(session):
    """Find intermediaries that set up the most entities."""
    print("\n" + "=" * 70)
    print("FRAUD PATTERN 3: Intermediary Hubs")
    print("Agents/firms setting up the most entities")
    print("=" * 70)

    result = session.run("""
        MATCH (i:Intermediary)-[:INTERMEDIARY_OF]->(e:Entity)
        WITH i, count(e) AS entityCount,
             collect(DISTINCT e.jurisdiction)[..5] AS jurisdictions
        WHERE entityCount >= 20
        RETURN i.name AS intermediary, i.country AS country,
               entityCount, jurisdictions
        ORDER BY entityCount DESC
        LIMIT 25
    """)

    for record in result:
        print(f"\n  {record['intermediary']} ({record['country'] or 'Unknown'})")
        print(f"    Entities created: {record['entityCount']}")
        print(f"    Jurisdictions: {', '.join(record['jurisdictions'])}")


def cross_jurisdiction_networks(session):
    """Find officers with entities across many jurisdictions."""
    print("\n" + "=" * 70)
    print("FRAUD PATTERN 4: Cross-Jurisdiction Networks")
    print("Officers with entities in many different jurisdictions")
    print("=" * 70)

    result = session.run("""
        MATCH (o:Officer)-[:OFFICER_OF]->(e:Entity)
        WITH o, collect(DISTINCT e.jurisdiction) AS jurisdictions,
             count(e) AS entityCount
        WHERE size(jurisdictions) >= 5
        RETURN o.name AS officer, o.country AS country,
               entityCount, size(jurisdictions) AS jurisdictionCount,
               jurisdictions[..8] AS sampleJurisdictions
        ORDER BY jurisdictionCount DESC
        LIMIT 25
    """)

    for record in result:
        print(f"\n  {record['officer']} ({record['country'] or 'Unknown'})")
        print(f"    Entities: {record['entityCount']} across {record['jurisdictionCount']} jurisdictions")
        print(f"    Jurisdictions: {', '.join(record['sampleJurisdictions'])}")


def circular_ownership(session):
    """Detect circular ownership patterns (entities owning each other)."""
    print("\n" + "=" * 70)
    print("FRAUD PATTERN 5: Circular Ownership Detection")
    print("Entities connected in loops")
    print("=" * 70)

    result = session.run("""
        MATCH path = (e:Entity)-[:RELATED_TO*2..4]->(e)
        WITH e, length(path) AS pathLength
        RETURN e.name AS entity, e.jurisdiction AS jurisdiction, pathLength
        ORDER BY pathLength DESC
        LIMIT 20
    """)

    records = list(result)
    if not records:
        print("\n  No circular ownership patterns detected.")
    else:
        for record in records:
            print(f"\n  {record['entity']} ({record['jurisdiction'] or 'Unknown'})")
            print(f"    Cycle length: {record['pathLength']}")


def summary_stats(session):
    """Print overall graph statistics."""
    print("\n" + "=" * 70)
    print("GRAPH SUMMARY")
    print("=" * 70)

    for label in ["Entity", "Officer", "Intermediary", "Address"]:
        result = session.run(f"MATCH (n:{label}) RETURN count(n) AS count")
        count = result.single()["count"]
        print(f"  {label} nodes: {count:,}")

    result = session.run(
        "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"
    )
    print("\n  Relationships:")
    for record in result:
        print(f"    {record['type']}: {record['count']:,}")


def main():
    print("=" * 70)
    print("ICIJ OFFSHORE LEAKS — FRAUD CLUSTER DETECTION")
    print("=" * 70)

    driver = get_driver()

    try:
        driver.verify_connectivity()
        print(f"Connected to: {NEO4J_URI}\n")
    except Exception as e:
        print(f"ERROR: Could not connect to Neo4j: {e}")
        sys.exit(1)

    with driver.session(database=NEO4J_DATABASE) as session:
        summary_stats(session)
        shell_company_operators(session)
        shared_address_clusters(session)
        intermediary_hubs(session)
        cross_jurisdiction_networks(session)
        circular_ownership(session)

    driver.close()
    print("\n\nAnalysis complete!")


if __name__ == "__main__":
    main()
