# Loading ICIJ Data Directly into Neo4j Aura

The fastest way to load data is using Neo4j's built-in `LOAD CSV` command.
Run these queries in the **Neo4j Aura Console** (https://console.neo4j.io → your instance → Query).

## Step 1: Download the ICIJ data

1. Go to https://offshoreleaks.icij.org/pages/database
2. Download all CSV ZIP files
3. Unzip them — you'll get files like:
   - `nodes-entities.csv`
   - `nodes-officers.csv`
   - `nodes-intermediaries.csv`
   - `nodes-addresses.csv`
   - `relationships.csv`

## Step 2: Upload to a public URL

Neo4j `LOAD CSV` needs files accessible via HTTP. Options:
- Upload to a GitHub repo (raw URL)
- Upload to Google Drive (with direct download link)
- Use a temporary file hosting service

Or use **Neo4j Desktop Import** (see Step 2b below).

## Step 3: Run these Cypher queries in Neo4j Browser

Replace `$URL` with the actual URL to each CSV file.

### Create Constraints (run first)

```cypher
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.node_id IS UNIQUE;
CREATE CONSTRAINT officer_id IF NOT EXISTS FOR (o:Officer) REQUIRE o.node_id IS UNIQUE;
CREATE CONSTRAINT intermediary_id IF NOT EXISTS FOR (i:Intermediary) REQUIRE i.node_id IS UNIQUE;
CREATE CONSTRAINT address_id IF NOT EXISTS FOR (a:Address) REQUIRE a.node_id IS UNIQUE;
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX officer_name IF NOT EXISTS FOR (o:Officer) ON (o.name);
```

### Load Entities

```cypher
LOAD CSV WITH HEADERS FROM '$URL/nodes-entities.csv' AS row
MERGE (e:Entity {node_id: row.node_id})
SET e.name = row.name,
    e.jurisdiction = row.jurisdiction,
    e.country = row.countries,
    e.status = row.status,
    e.source = row.sourceID,
    e.incorporation_date = row.incorporation_date;
```

### Load Officers

```cypher
LOAD CSV WITH HEADERS FROM '$URL/nodes-officers.csv' AS row
MERGE (o:Officer {node_id: row.node_id})
SET o.name = row.name,
    o.country = row.countries,
    o.source = row.sourceID;
```

### Load Intermediaries

```cypher
LOAD CSV WITH HEADERS FROM '$URL/nodes-intermediaries.csv' AS row
MERGE (i:Intermediary {node_id: row.node_id})
SET i.name = row.name,
    i.country = row.countries,
    i.source = row.sourceID;
```

### Load Addresses

```cypher
LOAD CSV WITH HEADERS FROM '$URL/nodes-addresses.csv' AS row
MERGE (a:Address {node_id: row.node_id})
SET a.address = row.address,
    a.country = row.countries,
    a.source = row.sourceID;
```

### Load Relationships

```cypher
LOAD CSV WITH HEADERS FROM '$URL/relationships.csv' AS row
WITH row
WHERE row.rel_type = 'officer_of'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:OFFICER_OF]->(b);
```

```cypher
LOAD CSV WITH HEADERS FROM '$URL/relationships.csv' AS row
WITH row
WHERE row.rel_type = 'registered_address'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:REGISTERED_ADDRESS]->(b);
```

```cypher
LOAD CSV WITH HEADERS FROM '$URL/relationships.csv' AS row
WITH row
WHERE row.rel_type = 'intermediary_of'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:INTERMEDIARY_OF]->(b);
```

```cypher
LOAD CSV WITH HEADERS FROM '$URL/relationships.csv' AS row
WITH row
WHERE row.rel_type IN ['related_entity', 'same_name_as', 'same_id_as', 'probably_same_officer_as', 'similar_name_and_address']
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:RELATED_TO]->(b);
```

## Step 2b: Alternative — Python Loader (local files)

If you have the CSVs locally:

```bash
cd data-pipeline
pip install -r requirements.txt
python load_graph.py
```

The Python script reads CSVs from `data-pipeline/data/` and loads them batch-by-batch.

## Verify the data loaded

```cypher
// Count all nodes
MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC;

// Count all relationships
MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC;

// Test: find top shell company operators
MATCH (o:Officer)-[:OFFICER_OF]->(e:Entity)
WITH o, count(e) AS cnt
WHERE cnt >= 10
RETURN o.name, cnt ORDER BY cnt DESC LIMIT 10;
```
