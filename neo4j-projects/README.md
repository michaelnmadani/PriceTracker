# Panama Papers Explorer — Neo4j Fraud Detection

A full-stack web application that uses the [ICIJ Offshore Leaks Database](https://offshoreleaks.icij.org/) with Neo4j to detect and visualize fraud-like clusters of bad actors: shell company networks, shared address hubs, and circular ownership structures.

## Architecture

- **Frontend**: Next.js with interactive graph visualization (vis-network)
- **Backend**: Next.js API routes querying Neo4j Aura
- **Database**: Neo4j Aura Free (cloud-hosted graph database)
- **Data Pipeline**: Python scripts for downloading and loading ICIJ data
- **Deployment**: Vercel

## Fraud Detection Patterns

1. **Shell Company Operators** — Officers controlling 10+ entities
2. **Shared Address Clusters** — Addresses with many registered entities (red flag for shell companies)
3. **Intermediary Hubs** — Law firms/agents setting up the most entities
4. **Cross-Jurisdiction Networks** — Officers with entities across many jurisdictions
5. **Circular Ownership** — Entities that own each other in loops

## Setup

### 1. Neo4j Aura

Create a free Neo4j Aura instance at [console.neo4j.io](https://console.neo4j.io/) and copy the credentials.

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Neo4j credentials:

```bash
cp .env.example .env.local
```

### 3. Load ICIJ Data into Neo4j

There are two ways to load the data:

#### Option A: Python Loader (recommended)

1. Download CSVs from https://offshoreleaks.icij.org/pages/database
2. Unzip all files into `data-pipeline/data/`
3. Run:

```bash
cd data-pipeline
pip install -r requirements.txt
python load_graph.py       # Loads data into Neo4j Aura
python detect_clusters.py  # Runs fraud detection queries (optional)
```

#### Option B: Cypher LOAD CSV (load directly in Neo4j Browser)

See [data-pipeline/load_via_cypher.md](data-pipeline/load_via_cypher.md) for step-by-step Cypher queries you can run directly in the Neo4j Aura console.

### 4. Run the Web App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Data Source

Data from the [ICIJ Offshore Leaks Database](https://offshoreleaks.icij.org/), including:
- **Panama Papers** (2016) — Mossack Fonseca
- **Paradise Papers** (2017) — Appleby
- **Pandora Papers** (2021) — 14 offshore service providers

810,000+ offshore entities across 200+ countries.

## Graph Model

- **Nodes**: Entity (companies/trusts), Officer (people), Intermediary (agents), Address
- **Relationships**: OFFICER_OF, REGISTERED_ADDRESS, INTERMEDIARY_OF, RELATED_TO

## Tech Stack

- [Next.js](https://nextjs.org/) — React framework
- [Neo4j](https://neo4j.com/) — Graph database
- [vis-network](https://visjs.github.io/vis-network/) — Graph visualization
- [Python](https://python.org/) — Data pipeline
