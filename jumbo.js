/**
 * Esta función se conecta directamente a la base de datos pública de Jumbo
 * y trae los resultados de búsqueda como un objeto de JavaScript.
 */
async function buscarEnJumbo(termino) {
  // 1. Construimos la URL de la API (es la que usa Jumbo internamente)
  const url = `https://www.jumbo.com.ar/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(termino)}`;

  try {
    console.log(`Buscando "${termino}" en la API de Jumbo...`);
    
    // 2. Hacemos la petición (sin necesidad de abrir un navegador)
    const respuesta = await fetch(url);
    
    if (!respuesta.ok) throw new Error("Error en la conexión");

    const productosRaw = await respuesta.json();

    // 3. Transformamos los datos complejos de la API a algo simple
    return productosRaw.map(p => {
      // Extraemos el precio y la disponibilidad del primer vendedor
      const oferta = p.items[0].sellers[0].commertialOffer;
      
      return {
        id: p.productId,
        nombre: p.productName,
        precio: oferta.Price,
        link: "https://www.jumbo.com.ar" + p.link,
        disponible: oferta.IsAvailable,
        imagen: p.items[0].images[0].imageUrl
      };
    });

  } catch (error) {
    console.error("Hubo un problema:", error);
    return [];
  }
}

// --- EJEMPLO DE USO ---
// Llamamos a la función y mostramos los resultados en la consola
buscarEnJumbo("detergente").then(resultados => {
  console.table(resultados); // Muestra una tabla linda en la terminal
});
