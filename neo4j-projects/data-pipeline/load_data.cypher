// ============================================================
// ICIJ Offshore Leaks — Neo4j Load Script
// ============================================================
//
// INSTRUCTIONS:
// 1. Download CSVs from https://offshoreleaks.icij.org/pages/database
// 2. Upload them to a public URL (e.g. GitHub repo raw URL)
// 3. Replace YOUR_URL_HERE below with that base URL
// 4. Run each section one at a time in Neo4j Browser
// ============================================================

// --- STEP 1: Create Constraints and Indexes ---
// Run these one at a time:

CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.node_id IS UNIQUE;

CREATE CONSTRAINT officer_id IF NOT EXISTS FOR (o:Officer) REQUIRE o.node_id IS UNIQUE;

CREATE CONSTRAINT intermediary_id IF NOT EXISTS FOR (i:Intermediary) REQUIRE i.node_id IS UNIQUE;

CREATE CONSTRAINT address_id IF NOT EXISTS FOR (a:Address) REQUIRE a.node_id IS UNIQUE;

CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);

CREATE INDEX officer_name IF NOT EXISTS FOR (o:Officer) ON (o.name);


// --- STEP 2: Load Entities ---

LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/nodes-entities.csv' AS row
MERGE (e:Entity {node_id: row.node_id})
SET e.name = row.name,
    e.jurisdiction = row.jurisdiction,
    e.country = row.countries,
    e.status = row.status,
    e.source = row.sourceID,
    e.incorporation_date = row.incorporation_date;


// --- STEP 3: Load Officers ---

LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/nodes-officers.csv' AS row
MERGE (o:Officer {node_id: row.node_id})
SET o.name = row.name,
    o.country = row.countries,
    o.source = row.sourceID;


// --- STEP 4: Load Intermediaries ---

LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/nodes-intermediaries.csv' AS row
MERGE (i:Intermediary {node_id: row.node_id})
SET i.name = row.name,
    i.country = row.countries,
    i.source = row.sourceID;


// --- STEP 5: Load Addresses ---

LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/nodes-addresses.csv' AS row
MERGE (a:Address {node_id: row.node_id})
SET a.address = row.address,
    a.country = row.countries,
    a.source = row.sourceID;


// --- STEP 6: Load Relationships (run each separately) ---

// Officer relationships
LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/relationships.csv' AS row
WITH row WHERE row.rel_type = 'officer_of'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:OFFICER_OF]->(b);

// Registered address relationships
LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/relationships.csv' AS row
WITH row WHERE row.rel_type = 'registered_address'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:REGISTERED_ADDRESS]->(b);

// Intermediary relationships
LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/relationships.csv' AS row
WITH row WHERE row.rel_type = 'intermediary_of'
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:INTERMEDIARY_OF]->(b);

// Related entity relationships
LOAD CSV WITH HEADERS FROM 'YOUR_URL_HERE/relationships.csv' AS row
WITH row WHERE row.rel_type IN ['related_entity', 'same_name_as', 'same_id_as', 'probably_same_officer_as', 'similar_name_and_address']
MATCH (a {node_id: row.node_1})
MATCH (b {node_id: row.node_2})
MERGE (a)-[:RELATED_TO]->(b);


// --- STEP 7: Verify data loaded ---

MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC;
