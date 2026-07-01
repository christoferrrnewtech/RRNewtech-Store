import { SITE } from "@/lib/constants";
import { CATEGORY_MAP, productImageUrl, type Product } from "@/lib/products";

/**
 * Product JSON-LD (schema.org/Product + Offer) — powers Google rich results and Shopping
 * surfaces. Availability + price come straight from the catalog so it stays accurate.
 */
export function ProductJsonLd({ product }: { product: Product }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    category: CATEGORY_MAP[product.category].name,
    image: [productImageUrl(product, 800)],
    offers: {
      "@type": "Offer",
      url: `${SITE.url}/products/${product.slug}`,
      priceCurrency: "PHP",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE.legalName },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
