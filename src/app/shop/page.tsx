import { redirect } from "next/navigation";

/**
 * The Shop All catalog now lives at the site root ("/"). This route is kept only to redirect
 * any old /shop links (bookmarks, indexed pages) to the homepage, preserving category/sort.
 */
export default async function ShopRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const query = qs.toString();
  redirect(query ? `/?${query}` : "/");
}
