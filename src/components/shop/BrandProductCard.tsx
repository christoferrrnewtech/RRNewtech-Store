import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import type { BrandProduct } from "@/lib/content";
import { brandProductHref, contactSalesHref } from "@/lib/products";
import { brandCartItem } from "@/lib/cart-item";
import { discountPercent, formatPHP } from "@/lib/format";

/**
 * Storefront card for a brand-owned product. The image and title link to the product's detail page.
 * Falls back to the brand logo on a white plate when the product has no image of its own.
 */
export function BrandProductCard({
  product,
  brandName,
  brandSlug,
  brandLogo,
  showBrand = false,
  categoryLabel,
}: {
  product: BrandProduct;
  brandName: string;
  brandSlug: string;
  brandLogo: string;
  /** Show the brand name as an eyebrow above the title — used on mixed grids (e.g. the home page),
   *  off on a brand's own page where the brand is already obvious. */
  showBrand?: boolean;
  /** Optional resolved category/subcategory label shown after the brand (parent resolves the name). */
  categoryLabel?: string;
}) {
  const off = product.contactSales ? null : discountPercent(product.price, product.compareAtPrice);
  const image = product.image || brandLogo;
  const usingLogo = !product.image;
  const href = brandProductHref(brandSlug, product);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg">
      <Link
        href={href}
        className={[
          "relative block aspect-square overflow-hidden",
          usingLogo ? "bg-white" : "bg-elevated",
        ].join(" ")}
      >
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          className={
            usingLogo
              ? "object-contain p-6"
              : "object-cover transition-transform duration-300 group-hover:scale-105"
          }
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off && <Badge tone="sale">-{off}%</Badge>}
          {!product.contactSales && !product.inStock && (
            <Badge tone="muted">Out of stock</Badge>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {showBrand && (
          <p className="mb-1 truncate text-xs font-medium uppercase tracking-wide text-muted-light">
            <Link href={`/brands/${brandSlug}`} className="hover:text-brand-700">
              {brandName}
            </Link>
            {categoryLabel && <span> · {categoryLabel}</span>}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-fg">
          <Link href={href} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>
        {product.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{product.summary}</p>
        )}

        {!product.contactSales && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-fg">{formatPHP(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-muted-light line-through">
                {formatPHP(product.compareAtPrice)}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex-1" />
        {product.contactSales ? (
          <LinkButton
            href={contactSalesHref(brandSlug, product)}
            size="sm"
            className="w-full whitespace-nowrap"
          >
            Contact a sales agent
          </LinkButton>
        ) : (
          <AddToCartButton
            size="sm"
            fullWidth
            disabled={!product.inStock}
            item={brandCartItem(product, brandSlug, brandName, image)}
          />
        )}
      </div>
    </div>
  );
}
