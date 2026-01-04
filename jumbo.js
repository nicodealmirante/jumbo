import fetch from "node-fetch";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =======================
   Helpers
======================= */
const normalize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const similarity = (a, b) => {
  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  const common = [...aw].filter((w) => bw.has(w));
  return common.length / Math.max(aw.size, bw.size);
};

/* =======================
   SQL
======================= */
const selectProducts = `
  SELECT id, name, normalized_name, price
  FROM products
  WHERE source = 'jumbo'
`;

const updatePrice = `
  UPDATE products
  SET price = $1,
      list_price = $2,
      updated_at = NOW()
  WHERE id = $3
`;

/* =======================
   Jumbo API
======================= */
async function fetchJumbo(query) {
  const url = `https://www.jumbo.com.ar/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  return res.json();
}

/* =======================
   RUN
======================= */
async function run() {
  const client = await pool.connect();
  let updated = 0;
  let skipped = 0;

  try {
    const { rows } = await client.query(selectProducts);

    for (const p of rows) {
      try {
        const data = await fetchJumbo(p.name);
        if (!Array.isArray(data) || !data.length) {
          skipped++;
          continue;
        }

        const target = p.normalized_name || normalize(p.name);

        const candidates = data.map((prod) => {
          const item = prod.items?.[0];
          const offer = item?.sellers?.[0]?.commertialOffer;

          return {
            name: prod.productName,
            normalized: normalize(prod.productName),
            price: offer?.Price,
            listPrice: offer?.ListPrice ?? offer?.Price,
          };
        });

        const best = candidates
          .map((c) => ({
            ...c,
            score: similarity(target, c.normalized),
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (!best || best.score < 0.5 || best.price == null) {
          skipped++;
          continue;
        }

        if (Number(p.price) !== Number(best.price)) {
          await client.query(updatePrice, [
            best.price,
            best.listPrice,
            p.id,
          ]);

          console.log(`✅ ${p.name} | ${p.price} → ${best.price}`);
          updated++;
        }
      } catch {
        skipped++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("====== RESUMEN ======");
  console.log("Actualizados:", updated);
  console.log("Sin match/error:", skipped);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
