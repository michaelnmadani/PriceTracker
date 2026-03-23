import { runQuery } from "../../../lib/neo4j";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit) || 25;
  const minEntities = parseInt(req.query.min) || 20;

  try {
    const results = await runQuery(
      `
      MATCH (i:Intermediary)-[:INTERMEDIARY_OF]->(e:Entity)
      WITH i, count(e) AS entityCount,
           collect(DISTINCT e.jurisdiction)[..5] AS jurisdictions
      WHERE entityCount >= $minEntities
      RETURN i.name AS intermediary, i.node_id AS intermediaryId,
             i.country AS country, entityCount, jurisdictions
      ORDER BY entityCount DESC
      LIMIT $limit
    `,
      { limit: parseInt(limit), minEntities: parseInt(minEntities) }
    );

    res.status(200).json({ pattern: "intermediary_hubs", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
