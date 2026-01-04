import scrapy
import urllib.parse
import re

def normalize(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s.lower())).strip()

def similarity(a, b):
    aw = set(a.split())
    bw = set(b.split())
    if not aw or not bw:
        return 0
    return len(aw & bw) / max(len(aw), len(bw))


class JumboPriceSpider(scrapy.Spider):
    name = "jumbo_price"

    def __init__(self, productName="", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.productName = productName
        self.target_norm = normalize(productName)

        base = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search/"
        params = {"ft": productName}
        self.start_urls = [base + "?" + urllib.parse.urlencode(params)]

    def parse(self, response):
        data = response.json()

        if not isinstance(data, list) or not data:
            yield {"error": "Sin resultados"}
            return

        candidates = []

        for prod in data:
            try:
                item = prod.get("items", [])[0]
                offer = item.get("sellers", [])[0].get("commertialOffer", {})
                price = offer.get("Price")
                list_price = offer.get("ListPrice", price)

                if price is None:
                    continue

                name = prod.get("productName", "")
                score = similarity(self.target_norm, normalize(name))

                candidates.append({
                    "name": name,
                    "price": price,
                    "list_price": list_price,
                    "score": score,
                    "link": "https://www.jumbo.com.ar" + prod.get("link", "")
                })
            except Exception:
                continue

        if not candidates:
            yield {"error": "No se pudieron armar candidatos"}
            return

        best = sorted(candidates, key=lambda x: x["score"], reverse=True)[0]

        if best["score"] < 0.5:
            yield {"error": "Match débil", "mejor": best}
            return

        yield {
            "productName": best["name"],
            "price": best["price"],
            "list_price": best["list_price"],
            "link": best["link"],
            "score": best["score"]
        }
