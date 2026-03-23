import { runQuery } from "../../../lib/neo4j";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit) || 25;
  const minEntities = parseInt(req.query.min) || 10;

  try {
    const results = await runQuery(
      `
      MATCH (o:Officer)-[:OFFICER_OF]->(e:Entity)
      WITH o, collect(e.name) AS entities, count(e) AS entityCount
      WHERE entityCount >= $minEntities
      RETURN o.name AS officer, o.node_id AS officerId,
             o.country AS country, entityCount,
             entities[..5] AS sampleEntities
      ORDER BY entityCount DESC
      LIMIT $limit
    `,
      { limit: neo4jInt(limit), minEntities: neo4jInt(minEntities) }
    );

    res.status(200).json({ pattern: "shell_company_operators", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function neo4jInt(val) {
  return parseInt(val);
}
