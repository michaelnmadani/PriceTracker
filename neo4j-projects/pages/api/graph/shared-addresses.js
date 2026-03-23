import { runQuery } from "../../../lib/neo4j";

export default async function handler(req, res) {
  const limit = parseInt(req.query.limit) || 25;
  const minEntities = parseInt(req.query.min) || 10;

  try {
    const results = await runQuery(
      `
      MATCH (e:Entity)-[:REGISTERED_ADDRESS]->(a:Address)
      WITH a, collect(e.name) AS entities, count(e) AS entityCount
      WHERE entityCount >= $minEntities
      RETURN a.address AS address, a.node_id AS addressId,
             a.country AS country, entityCount,
             entities[..5] AS sampleEntities
      ORDER BY entityCount DESC
      LIMIT $limit
    `,
      { limit: parseInt(limit), minEntities: parseInt(minEntities) }
    );

    res.status(200).json({ pattern: "shared_address_clusters", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
