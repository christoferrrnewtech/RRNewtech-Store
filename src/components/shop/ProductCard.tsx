import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { CATEGORY_MAP, productImageUrl, type Product } from "@/lib/products";
import { discountPercent, formatPHP } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const off = discountPercent(product.price, product.compareAtPrice);
  const category = CATEGORY_MAP[product.category];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-elevated"
      >
        <Image
          src={productImageUrl(product, 600)}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off && <Badge tone="sale">-{off}%</Badge>}
          {!product.inStock && <Badge tone="muted">Out of stock</Badge>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-light">
          {product.brand} · {category.name}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-fg">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-fg">{formatPHP(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted-light line-through">
              {formatPHP(product.compareAtPrice)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">per {product.unit}</p>

        <div className="mt-4 flex-1" />
        <AddToCartButton
          size="sm"
          fullWidth
          disabled={!product.inStock}
          item={{
            slug: product.slug,
            name: product.name,
            price: product.price,
            unit: product.unit,
            sku: product.sku,
            category: category.name,
            image: productImageUrl(product, 300),
          }}
        />
      </div>
    </div>
  );
}
