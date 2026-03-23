import { runQuery } from "../../lib/neo4j";

export default async function handler(req, res) {
  const { q } = req.query;
  const limit = parseInt(req.query.limit) || 20;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }

  try {
    const searchTerm = `(?i).*${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*`;

    const results = await runQuery(
      `
      CALL {
        MATCH (e:Entity)
        WHERE e.name =~ $searchTerm
        RETURN e.node_id AS id, e.name AS name, 'Entity' AS type,
               e.jurisdiction AS detail
        LIMIT $limit
        UNION ALL
        MATCH (o:Officer)
        WHERE o.name =~ $searchTerm
        RETURN o.node_id AS id, o.name AS name, 'Officer' AS type,
               o.country AS detail
        LIMIT $limit
        UNION ALL
        MATCH (i:Intermediary)
        WHERE i.name =~ $searchTerm
        RETURN i.node_id AS id, i.name AS name, 'Intermediary' AS type,
               i.country AS detail
        LIMIT $limit
      }
      RETURN id, name, type, detail
      LIMIT $limit
    `,
      { searchTerm, limit: parseInt(limit) }
    );

    res.status(200).json({ query: q, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
