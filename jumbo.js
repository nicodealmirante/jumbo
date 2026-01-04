import fs from "fs";
import pkg from "pg";

const { Pool } = pkg;

/* =======================
   DB
======================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =======================
   SQL
======================= */
const selectProducts = `
  SELECT id, name, price, list_price
  FROM products
  WHERE source = 'jumbo'
`;

const updateProduct = `
  UPDATE products
  SET
    price = $1,
    list_price = $2,
    updated_at = NOW()
  WHERE id = $3
`;

/* =======================
   JSON
======================= */
// puede ser ruta local o montado en Railway
const JSON_PATH = "./HTTP_Jumbo_updated.json";

function loadJson() {
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  return JSON.parse(raw);
}

/* =======================
   RUN
======================= */
async function run() {
  const client = await pool.connect();
  let updated = 0;
  let skipped = 0;

  try {
    const jsonData = loadJson();

    // armamos un map por id para lookup O(1)
    const jsonById = new Map(
      jsonData
        .filter((j) => j.id != null)
        .map((j) => [Number(j.id), j])
    );

    const { rows } = await client.query(selectProducts);

    for (const p of rows) {
      const jsonItem = jsonById.get(Number(p.id));

      if (!jsonItem) {
        skipped++;
        continue;
      }

      const newPrice = Number(jsonItem.price);
      const newListPrice =
        jsonItem.list_price != null
          ? Number(jsonItem.list_price)
          : newPrice;

      if (
        Number(p.price) !== newPrice ||
        Number(p.list_price) !== newListPrice
      ) {
        await client.query(updateProduct, [
          newPrice,
          newListPrice,
          p.id,
        ]);

        console.log(
          `✅ ${p.name} | ${p.price} → ${newPrice}`
        );
        updated++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("====== RESUMEN ======");
  console.log("Actualizados:", updated);
  console.log("Sin match:", skipped);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
