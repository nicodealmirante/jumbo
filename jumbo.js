import fetch from 'node-fetch'; // Solo si usas Node antiguo, en Node 18+ no hace falta
async function jumbo(query) {
    const baseUrl = "https://www.jumbo.com.ar";
    const endpoint = `${baseUrl}/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        const nombreBuscado = "Limpiador Multiuso Para Diluir Marina Rinde 5 Litros X 150ml";

        // Filtramos para encontrar el producto exacto
        const productoExacto = data
            .map(product => {
                const item = product.items[0];
                const seller = item.sellers[0].commertialOffer;
                
                return {
                    id: product.productId,
                    name: product.productName,
                    price: seller.Price,
                    link: `${baseUrl}${product.link}`,
                    unavailable: !seller.IsAvailable
                };
            })
            // AQUÍ FILTRAMOS: Solo el que coincida exactamente con el nombre
            .find(p => p.name === nombreBuscado);

        if (productoExacto) {
            console.log(productoExacto.price);
        } else {
            console.log("❌ No se encontró exactamente ese producto.");
        }
        
        return productoExacto;

    } catch (error) {
        console.error("Error:", error.message);
    }
}

jumbo("Limpiador Multiuso Para Diluir Marina");
