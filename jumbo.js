import fs from "fs";
import pkg from "pg";

const { Pool } = pkg;

/* =======================
   CONFIG
======================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ⚠️ Ruta al JSON (ajustá si está en otro lugar)
const JSON_PATH = "./HTTP_Jumbo_updated.json";

// límites de seguridad
const MIN_PRICE = 100;      // precio mínimo aceptado
const MAX_VARIATION = 1.5;  // +50% / -50%

/* =======================
   SQL
======================= */
const selectProducts = `
  SELECT id, name, price
  FROM products
  WHERE source = 'jumbo'
`;

const updateProduct = `
  UPDATE products
  SET
    price = $1,
    description = $2
  WHERE id = $3
`;

/* =======================
   HELPERS
======================= */
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
    // cargar JSON
    const jsonData = loadJson();

    // indexar por id (O(1))
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

      const oldPrice = Number(p.price);
      const newPrice = Number(jsonItem.price);
      const newDescription =
        jsonItem.description !== undefined
          ? String(jsonItem.description)
          : null;

      // ===== VALIDACIONES =====
      if (!newPrice || isNaN(newPrice) || newPrice < MIN_PRICE) {
        console.log(
          `⚠️ SALTADO (precio inválido): ${p.name} → ${newPrice}`
        );
        skipped++;
        continue;
      }

      const ratio = newPrice / oldPrice;
      if (oldPrice > 0 && (ratio < 1 / MAX_VARIATION || ratio > MAX_VARIATION)) {
        console.log(
          `⚠️ SALTADO (variación extrema): ${p.name} | ${oldPrice} → ${newPrice}`
        );
        skipped++;
        continue;
      }

      // ===== UPDATE =====
      if (
        oldPrice !== newPrice ||
        (newDescription && newDescription !== "")
      ) {
        await client.query(updateProduct, [
          newPrice,
          newDescription,
          p.id,
        ]);

        console.log(
          `✅ ${p.name} | ${oldPrice} → ${newPrice}` +
          (newDescription ? ` | desc: ${newDescription}` : "")
        );
        updated++;
      }
    }
  } catch (e) {
    console.error("❌ ERROR GENERAL:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("====== RESUMEN ======");
  console.log("Actualizados:", updated);
  console.log("Saltados:", skipped);
}

/* =======================
   START
======================= */
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
