"use server";

/**
 * All admin mutations.
 *
 * SECURITY: every action re-checks authentication and authorization itself. Server actions are
 * directly callable HTTP endpoints — the layout guard in (app)/layout.tsx does not protect them.
 * Never remove a `requireUser` / `requireAdmin` / `canEditBrand` call from an action because
 * "the UI already hides it".
 *
 * Persistence is Firestore (+ Firebase Auth for users, Firebase Storage for images) via the
 * helpers in `@/lib/content`, `@/lib/auth`, and `@/lib/firebase`.
 */

import crypto from "node:crypto";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
  saveAboutContent,
  type AboutContent,
  getCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
  reorderSubcategories,
  brandExists,
  createBrand,
  saveBrand,
  deleteBrand,
  reorderBrands,
  getBrandForAdmin,
  getUserByEmail,
  upsertAdminUser,
  updateUserBrands,
  deleteAdminUserDoc,
  nextBrandOrder,
  getBrandBySlug,
  type Brand,
  type BrandProduct,
  type GalleryImage,
} from "@/lib/content";
import {
  authenticate,
  canEditBrand,
  createSession,
  destroySession,
  createFirebaseUser,
  deleteFirebaseUser,
  requireAdmin,
  requireUser,
} from "@/lib/auth";
import { getBucket } from "@/lib/firebase";
import {
  applyOrderPayment,
  getOrder,
  setOrderJrsBooking,
  setOrderJrsShipment,
  setOrderNote,
  setOrderStatus,
  type JrsShipment,
  type Order,
} from "@/lib/orders";
import { expireCheckoutSession, getCheckoutSession } from "@/lib/paymongo";
import { bookJrsShipment, getJrsRate, isJrsConfigured, RATE_ORIGIN } from "@/lib/jrs";
import { buildParcel, toParcelItem } from "@/lib/jrs-packaging";
import { setInquiryStatus, setInquiryNote } from "@/lib/inquiries";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/lib/inquiry-status";
import { brandSlug, brandProductSlugify } from "@/lib/products";
import { BRAND_GROUPS } from "@/lib/constants";
// NB: ActionState is NOT re-exported from here. A `export type { … }` in a "use server" module is
// picked up by the server-action transform as a runtime export and fails the build — consumers
// import the type straight from @/lib/form-data instead.
import { text, textList, type ActionState } from "@/lib/form-data";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Internal notes on an order or inquiry. Long enough for context, short enough to bound the doc. */
const MAX_NOTE = 2000;
// SVG is deliberately excluded — it can carry script and would be served from our own origin.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Refresh every surface that renders brand or banner content. */
function revalidateStorefront(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/brands");
  // "layout" so the brand page AND its nested product detail pages both refresh.
  if (slug) revalidatePath(`/brands/${slug}`, "layout");
  // Category pages list brand products, so refresh them all when brand content changes.
  revalidatePath("/categories/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

/**
 * Upload an image to Firebase Storage and return a public download URL.
 * Returns "" when no file was supplied (an unchanged image field).
 *
 * The upload is downscaled to a max 1600px edge and re-encoded to WebP (quality 80), so banners and
 * logos land at tens of KB instead of multi-MB. Uses Firebase's download-token URL rather than
 * `makePublic()`: it works with uniform bucket-level access and doesn't expose the whole bucket.
 */
async function storeUpload(file: FormDataEntryValue | null, prefix: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) return "";

  if (!ALLOWED_TYPES[file.type]) throw new Error("Only PNG, JPG and WebP images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5 MB or smaller.");

  // Resize (never upscale) and re-encode to WebP so Storage stays small. `rotate()` bakes in EXIF
  // orientation so phone photos aren't saved sideways.
  const compressed = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const bucket = getBucket();
  const token = crypto.randomUUID();
  const name = `uploads/${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await bucket.file(name).save(compressed, {
    resumable: false,
    metadata: {
      contentType: "image/webp",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    name,
  )}?alt=media&token=${token}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  let user;
  try {
    user = await authenticate(text(form, "email"), String(form.get("password") ?? ""));
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
  if (!user) return { error: "Incorrect email or password." };
  await createSession(user);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function addBannerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const image = await storeUpload(form.get("image"), "banner");
    if (!image) return { error: "Choose an image for the banner." };
    await addBanner({ image, alt: text(form, "alt"), href: text(form, "href") });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add the banner." };
  }

  revalidateStorefront();
  return { ok: "Banner added." };
}

export async function updateBannerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = text(form, "id");

  try {
    const uploaded = await storeUpload(form.get("image"), "banner");
    const patch: { alt: string; href: string; image?: string } = {
      alt: text(form, "alt"),
      href: text(form, "href"),
    };
    if (uploaded) patch.image = uploaded;
    await updateBanner(id, patch);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the banner." };
  }

  revalidateStorefront();
  return { ok: "Banner saved." };
}

export async function deleteBannerAction(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteBanner(text(form, "id"));
  revalidateStorefront();
}

/**
 * Set the carousel order to the given id sequence. Plain-arg action so the client can call it
 * imperatively (drag-drop and the arrow buttons both submit the full desired order).
 */
export async function reorderBannersAction(ids: string[]): Promise<void> {
  await requireAdmin();
  await reorderBanners(ids);
  revalidateStorefront();
}

// ─────────────────────────────────────────────────────────────────────────────
// About section (admin only) — the homepage "About" band
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAboutAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const heading = text(form, "heading");
  if (!heading) return { error: "Heading is required." };

  try {
    const uploaded = await storeUpload(form.get("image"), "about");
    const patch: Partial<AboutContent> = {
      eyebrow: text(form, "eyebrow"),
      heading,
      paragraphs: textList(form, "paragraph"),
      ctaLabel: text(form, "ctaLabel"),
      ctaHref: text(form, "ctaHref"),
    };
    // New upload wins; otherwise an explicit "use placeholder" clears it, and a plain save keeps it.
    if (uploaded) patch.image = uploaded;
    else if (form.get("removeImage") === "1") patch.image = "";
    await saveAboutContent(patch);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the About section." };
  }

  revalidateStorefront();
  return { ok: "About section saved." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories & subcategories (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function createCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await createCategory(text(form, "name"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the category." };
  }
  revalidateStorefront();
  return { ok: "Category created." };
}

export async function renameCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await renameCategory(text(form, "slug"), text(form, "name"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not rename the category." };
  }
  revalidateStorefront();
  return { ok: "Category renamed." };
}

export async function deleteCategoryAction(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteCategory(text(form, "slug"));
  revalidateStorefront();
}

export async function reorderCategoriesAction(slugs: string[]): Promise<void> {
  await requireAdmin();
  await reorderCategories(slugs);
  revalidateStorefront();
}

export async function createSubcategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await createSubcategory(text(form, "category"), text(form, "name"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the subcategory." };
  }
  revalidateStorefront();
  return { ok: "Subcategory created." };
}

export async function renameSubcategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await renameSubcategory(text(form, "category"), text(form, "slug"), text(form, "name"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not rename the subcategory." };
  }
  revalidateStorefront();
  return { ok: "Subcategory renamed." };
}

export async function deleteSubcategoryAction(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteSubcategory(text(form, "category"), text(form, "slug"));
  revalidateStorefront();
}

export async function reorderSubcategoriesAction(category: string, slugs: string[]): Promise<void> {
  await requireAdmin();
  await reorderSubcategories(category, slugs);
  revalidateStorefront();
}

// ─────────────────────────────────────────────────────────────────────────────
// Brands
// ─────────────────────────────────────────────────────────────────────────────

export async function createBrandAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const name = text(form, "name");
  if (!name) return { error: "Brand name is required." };

  const slug = brandSlug(name);
  if (!slug) return { error: "That name doesn't produce a usable URL." };
  if (await brandExists(slug)) {
    return { error: `A brand with the URL /brands/${slug} already exists.` };
  }

  try {
    const logo = await storeUpload(form.get("logo"), `logo-${slug}`);

    // New brands start as drafts so a half-finished page is never public.
    const brand: Brand = {
      slug,
      name,
      status: "draft",
      order: await nextBrandOrder(),
      featuredOnHome: true,
      group: "consumables",
      tagline: "",
      blurb: "",
      logo: logo || "/brand/logo.png",
      about: [],
      gallery: [],
      products: [],
      whyChoose: [],
      cta: {
        heading: "Interested in learning more?",
        body: "",
        buttonLabel: "Visit Official Website",
        websiteUrl: "",
      },
    };
    await createBrand(brand);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the brand." };
  }

  revalidateStorefront(slug);
  redirect(`/admin/brands/${slug}`);
}

export async function deleteBrandAction(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = text(form, "slug");
  await deleteBrand(slug);
  revalidateStorefront(slug);
  redirect("/admin/brands");
}

/**
 * Set the storefront display order from a full slug sequence. Plain-arg action so the rail can call
 * it imperatively from drag-drop and the arrow buttons (admin only — marketing users see a subset).
 */
export async function reorderBrandsAction(slugs: string[]): Promise<void> {
  await requireAdmin();
  await reorderBrands(slugs);
  revalidateStorefront();
}

/**
 * Every brand-section save funnels through here so the ownership check exists in exactly one
 * place. `apply` receives the brand object and the submitted form.
 */
async function saveBrandSection(
  form: FormData,
  apply: (brand: Brand, form: FormData) => Promise<void> | void,
  successMessage: string,
): Promise<ActionState> {
  const user = await requireUser();
  const slug = text(form, "slug");

  if (!canEditBrand(user, slug)) {
    return { error: "You don't have access to this brand." };
  }

  const brand = await getBrandForAdmin(slug);
  if (!brand) return { error: "That brand no longer exists." };

  try {
    await apply(brand, form);
    await saveBrand(brand);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save changes." };
  }

  revalidateStorefront(slug);
  return { ok: successMessage };
}

export async function saveBrandStatusAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      brand.status = form.get("status") === "published" ? "published" : "draft";
      brand.featuredOnHome = form.get("featuredOnHome") === "1";
    },
    "Status updated.",
  );
}

export async function saveBrandHeroAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    async (brand) => {
      const uploaded = await storeUpload(form.get("heroImage"), `hero-${brand.slug}`);
      if (uploaded) brand.heroImage = uploaded;
      if (form.get("remove") === "1") brand.heroImage = undefined;
    },
    "Hero banner saved.",
  );
}

export async function saveBrandLogoAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    async (brand) => {
      const uploaded = await storeUpload(form.get("logo"), `logo-${brand.slug}`);
      if (!uploaded) throw new Error("Choose an image first.");
      brand.logo = uploaded;
    },
    "Logo saved.",
  );
}

export async function saveBrandAboutAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      const name = text(form, "name");
      if (!name) throw new Error("Brand name can't be empty.");
      brand.name = name;
      brand.tagline = text(form, "tagline");
      brand.blurb = text(form, "blurb");
      brand.about = textList(form, "about");
      const group = text(form, "group");
      if (BRAND_GROUPS.some((g) => g.key === group)) {
        brand.group = group as (typeof BRAND_GROUPS)[number]["key"];
      }
    },
    "About section saved.",
  );
}

export async function saveBrandVideoAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      brand.youtubeUrl = text(form, "youtubeUrl") || undefined;
    },
    "Video saved.",
  );
}

export async function saveBrandGalleryAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    async (brand) => {
      // Existing rows come back as src+caption pairs; blank srcs mean the row was removed.
      const srcs = form.getAll("gallerySrc").map(String);
      const captions = form.getAll("galleryCaption").map(String);
      const kept: GalleryImage[] = [];
      srcs.forEach((src, i) => {
        if (!src) return;
        const caption = (captions[i] ?? "").trim();
        kept.push(caption ? { src, caption } : { src });
      });

      for (const file of form.getAll("newImages")) {
        const uploaded = await storeUpload(file, `gallery-${brand.slug}`);
        if (uploaded) kept.push({ src: uploaded });
      }

      brand.gallery = kept;
    },
    "Gallery saved.",
  );
}

/** Split a textarea value into trimmed, non-empty lines (one paragraph / bullet per line). */
function linesOf(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Parse a `productGalleryJson` hidden value into the kept (already-uploaded) gallery images. */
function parseGalleryJson(raw: string): GalleryImage[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.src === "string" && g.src)
      .map((g) => (g.caption ? { src: String(g.src), caption: String(g.caption) } : { src: String(g.src) }));
  } catch {
    return [];
  }
}

/**
 * One posted parcel dimension, or `undefined` for "not measured".
 *
 * `decimals` defaults to 2 because JRS's own packaging is specified to the hundredth of a
 * centimetre; weight passes 0, since a gram is already the smallest unit its caps use. Anything
 * blank, zero, negative or unparseable is absent rather than 0 — the box-fitting aggregate treats a
 * 0 cm side as missing data, and storing it would be a lie that looks like a measurement.
 */
function dimension(raw: string, decimals = 2): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export async function saveBrandProductsAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    async (brand) => {
      // Parallel per-row arrays (kept aligned by the client), plus per-row file inputs.
      const ids = form.getAll("productId").map(String);
      const names = form.getAll("productName").map(String);
      const prices = form.getAll("productPrice").map(String);
      const compareAts = form.getAll("productCompareAt").map(String);
      const summaries = form.getAll("productSummary").map(String);
      const categories = form.getAll("productCategory").map(String);
      const subcategories = form.getAll("productSubcategory").map(String);
      const lengths = form.getAll("productLength").map(String);
      const widths = form.getAll("productWidth").map(String);
      const heights = form.getAll("productHeight").map(String);
      const weights = form.getAll("productWeight").map(String);
      const allCategories = await getCategories();
      const descriptions = form.getAll("productDescription").map(String);
      const highlightsRaw = form.getAll("productHighlights").map(String);
      const galleryJson = form.getAll("productGalleryJson").map(String);
      const inStocks = form.getAll("productInStock").map(String);
      const contactSalesFlags = form.getAll("productContactSales").map(String);
      const existingImages = form.getAll("productImage").map(String);
      const files = form.getAll("productImageFile");

      // ---- TEMPORARY DIAGNOSTIC — remove once the tag-loss cause is confirmed. Read-only. ----
      // Untouched, collapsed rows have been losing their category on save; this shows whether the
      // client posted an empty select, posted nothing at all, or posted a value we then dropped.
      {
        const before = new Map(brand.products.map((p) => [p.id, p.category]));
        console.log("[products-save]", brand.slug, {
          names: names.length,
          ids: ids.length,
          categories: categories.length,
          subcategories: subcategories.length,
          prices: prices.length,
          inStocks: inStocks.length,
          images: existingImages.length,
          files: files.length,
        });
        names.forEach((n, i) => {
          const was = before.get(ids[i] ?? "");
          const posted = categories[i];
          const flag = was && !String(posted ?? "").trim() ? "  <-- LOSES TAG" : "";
          console.log(
            `  [${String(i).padStart(2)}] id=${(ids[i] ?? "").slice(0, 8)} cat=${JSON.stringify(posted)}` +
              ` sub=${JSON.stringify(subcategories[i])} was=${JSON.stringify(was)} ${String(n).slice(0, 32)}${flag}`,
          );
        });
      }
      // ---- END TEMPORARY DIAGNOSTIC ----

      const usedSlugs = new Set<string>();
      const out: BrandProduct[] = [];
      for (let i = 0; i < names.length; i++) {
        const name = (names[i] ?? "").trim();
        if (!name) continue; // a blank name means the row was cleared/removed

        const id = ids[i] || crypto.randomUUID();

        // Slug always follows the current name (deduped within the brand); the read path recomputes
        // it too, so URLs never drift from a renamed product.
        let slug = brandProductSlugify(name, id);
        if (usedSlugs.has(slug)) {
          let n = 2;
          while (usedSlugs.has(`${slug}-${n}`)) n++;
          slug = `${slug}-${n}`;
        }
        usedSlugs.add(slug);

        // "Price on request" products hide the price on the storefront, so we don't retain a figure.
        const contactSales = contactSalesFlags[i] === "1";
        const price = contactSales ? 0 : Math.max(0, Math.round(Number(prices[i]) || 0));
        const compareAt = contactSales ? 0 : Math.round(Number(compareAts[i]) || 0);

        // A newly chosen file uploads (and compresses); otherwise keep the prior image URL.
        const uploaded = await storeUpload(files[i] ?? null, `product-${brand.slug}`);
        const image = uploaded || (existingImages[i] ?? "");

        // Gallery: kept images come back as JSON; new files (keyed by row id) upload and append.
        const gallery = parseGalleryJson(galleryJson[i] ?? "");
        for (const file of form.getAll(`productGalleryFiles_${id}`)) {
          const galleryUrl = await storeUpload(file, `bp-${brand.slug}`);
          if (galleryUrl) gallery.push({ src: galleryUrl });
        }

        const description = linesOf(descriptions[i] ?? "");
        const highlights = linesOf(highlightsRaw[i] ?? "");

        // Keep a category only if it exists, and a subcategory only if it belongs to that category.
        const rawCategory = (categories[i] ?? "").trim();
        const cat = allCategories.find((c) => c.slug === rawCategory);
        const category = cat?.slug;
        const rawSub = (subcategories[i] ?? "").trim();
        const subcategory =
          cat && cat.subcategories.some((s) => s.slug === rawSub) ? rawSub : undefined;

        out.push({
          id,
          slug,
          name,
          price,
          compareAtPrice: compareAt > price ? compareAt : undefined,
          category,
          subcategory,
          // Optional, and `undefined` is the right absent value: Firestore runs with
          // `ignoreUndefinedProperties`, so a blank field simply isn't written, and nothing queries
          // these. Zero and negative are treated as blank — they're missing data, not a flat item.
          length: dimension(lengths[i] ?? ""),
          width: dimension(widths[i] ?? ""),
          height: dimension(heights[i] ?? ""),
          weight: dimension(weights[i] ?? "", 0),
          summary: (summaries[i] ?? "").trim() || undefined,
          description: description.length ? description : undefined,
          highlights: highlights.length ? highlights : undefined,
          gallery: gallery.length ? gallery : undefined,
          image,
          inStock: inStocks[i] === "1",
          contactSales,
        });
      }
      brand.products = out;
    },
    "Products saved.",
  );
}

export async function saveBrandReasonsAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      const titles = form.getAll("reasonTitle").map(String);
      const bodies = form.getAll("reasonBody").map(String);
      brand.whyChoose = titles
        .map((title, i) => ({ title: title.trim(), body: (bodies[i] ?? "").trim() }))
        .filter((r) => r.title);
    },
    "Reasons saved.",
  );
}

export async function saveBrandCtaAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      const websiteUrl = text(form, "websiteUrl");
      if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
        throw new Error("The website URL must start with http:// or https://");
      }
      brand.cta = {
        heading: text(form, "heading") || "Interested in learning more?",
        body: text(form, "body"),
        buttonLabel: text(form, "buttonLabel") || "Visit Official Website",
        websiteUrl,
      };
    },
    "Contact section saved.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Users (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function createUserAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const email = text(form, "email").toLowerCase();
  const name = text(form, "name");
  const password = String(form.get("password") ?? "");
  const brandSlugs = form.getAll("brandSlugs").map(String);

  if (!email || !name) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await getUserByEmail(email)) {
    return { error: "That email already has an account." };
  }

  try {
    const uid = await createFirebaseUser(email, password, name);
    await upsertAdminUser({ uid, email, name, role: "marketing", brandSlugs });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the user." };
  }

  return { ok: `${name} can now sign in.` };
}

export async function updateUserBrandsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  await updateUserBrands(text(form, "uid"), form.getAll("brandSlugs").map(String));
  return { ok: "Brand access updated." };
}

export async function deleteUserAction(form: FormData): Promise<void> {
  await requireAdmin();
  const uid = text(form, "uid");
  await deleteFirebaseUser(uid).catch(() => {});
  await deleteAdminUserDoc(uid);
  redirect("/admin/users");
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders & inquiries
//
// These render nowhere on the storefront, so they deliberately do NOT call
// revalidateStorefront(). They revalidate their own admin paths instead — including the layout,
// since the sidebar's unread badges are computed there.
// ─────────────────────────────────────────────────────────────────────────────

function revalidateQueue(section: "orders" | "inquiries", id?: string) {
  // "layout" so the sidebar badge recounts, not just the list body.
  revalidatePath(`/admin/${section}`, "layout");
  if (id) revalidatePath(`/admin/${section}/${id}`);
}

export async function setOrderStatusAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  const status = text(form, "status") as OrderStatus;
  if (!id) return { error: "That order no longer exists." };
  if (!ORDER_STATUSES.includes(status)) return { error: "Pick a valid status." };

  try {
    await setOrderStatus(id, status);

    // Cancelling an unpaid order kills its payment link too, so a customer can't pay it from a
    // stale tab. Best effort — this legitimately fails when the session is already expired or has
    // a payment in flight, and neither should block the cancellation.
    if (status === "cancelled") {
      const order = await getOrder(id);
      if (order?.paymentStatus === "awaiting_payment" && order.checkoutSessionId) {
        await expireCheckoutSession(order.checkoutSessionId).catch(() => false);
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the order." };
  }

  revalidateQueue("orders", id);
  return { ok: `Marked as ${ORDER_STATUS_LABELS[status].toLowerCase()}.` };
}

/**
 * Ask PayMongo what actually happened to this order's payment.
 *
 * The escape hatch for when the webhook is down or was never registered. Zero risk — it only
 * reads the gateway's own truth and feeds it through the same transaction the webhook uses.
 */
export async function recheckPaymentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  if (!id) return { error: "That order no longer exists." };

  try {
    const order = await getOrder(id);
    if (!order) return { error: "That order no longer exists." };
    if (!order.checkoutSessionId) return { error: "This order has no PayMongo session to check." };

    const session = await getCheckoutSession(order.checkoutSessionId);
    if (!session) return { error: "PayMongo doesn't recognise that session." };

    if (session.paymentStatus === "paid") {
      const changed = await applyOrderPayment(id, {
        paymentStatus: "paid",
        paidAt: session.paidAt,
        paymentMethod: session.paymentMethod,
      });
      revalidateQueue("orders", id);
      return { ok: changed ? "Payment confirmed." : "Already marked paid." };
    }

    if (session.paymentStatus === "failed") {
      await applyOrderPayment(id, { paymentStatus: "failed" });
      revalidateQueue("orders", id);
      return { ok: "PayMongo reports the payment failed." };
    }

    return { ok: "PayMongo has no completed payment for this order yet." };
  } catch (err) {
    console.error("[admin] recheck payment failed:", err);
    return { error: "Could not reach PayMongo. Try again in a moment." };
  }
}

/**
 * Record a payment that happened off-platform — bank transfer, cash on pickup, or a gateway hiccup
 * settled by hand.
 *
 * This exists because the alternative is editing Firestore directly, which leaves no trace at all.
 * The guardrails matter more than the feature:
 *
 *   - `paymentMethod: "manual"` keeps gateway money and off-platform money distinguishable when
 *     anyone reconciles the books
 *   - an audit line naming the admin is appended to the order's note, so "who decided this?" has
 *     an answer a year from now
 *   - ONE WAY. There is no un-mark. A mistake gets another note, not rewritten history — and
 *     `applyOrderPayment` refuses to move anything off `paid` regardless.
 */
export async function markOrderPaidAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // Never rely on the UI hiding the button — authorize the action itself.
  const user = await requireAdmin();

  const id = text(form, "id");
  if (!id) return { error: "That order no longer exists." };

  try {
    const order = await getOrder(id);
    if (!order) return { error: "That order no longer exists." };
    if (order.paymentStatus === "paid") return { ok: "Already marked paid." };

    const changed = await applyOrderPayment(id, {
      paymentStatus: "paid",
      paidAt: Date.now(),
      paymentMethod: "manual",
    });
    if (!changed) return { ok: "Already marked paid." };

    const stamp = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const audit = `[${stamp}] Marked paid offline by ${user.email}`;
    await setOrderNote(id, `${order.note ? `${order.note}\n` : ""}${audit}`.slice(0, MAX_NOTE));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not mark the order paid." };
  }

  revalidateQueue("orders", id);
  return { ok: "Marked as paid offline." };
}

export async function setOrderNoteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  if (!id) return { error: "That order no longer exists." };

  try {
    await setOrderNote(id, text(form, "note").slice(0, MAX_NOTE));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the note." };
  }

  revalidateQueue("orders", id);
  return { ok: "Note saved." };
}

/**
 * Book the JRS shipment for an order — the "Create shipping order" button.
 *
 * THE WHOLE POINT is that this does not re-quote. Checkout froze the exact rate request onto the
 * order as `jrsShipment`, and that payload is replayed verbatim: same packaging, same items, same
 * addresses. Re-deriving it here would read today's product dimensions against today's tariff, and
 * the customer was charged against neither — they'd get a box we never priced.
 *
 * The live-quote branch exists only for orders placed before `jrsShipment` existed. It quotes,
 * STORES what it quoted, then books from it — so even a retry after a failure replays a frozen
 * payload rather than asking for a third rate.
 *
 * `order.shippingFee` is never touched. Whatever JRS charges now, the customer paid what they were
 * quoted; a courier price change is the business's to absorb, not something to bill retroactively.
 */
export async function createJrsShipmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // Never rely on the UI hiding the button — authorize the action itself.
  await requireAdmin();

  const id = text(form, "id");
  if (!id) return { error: "That order no longer exists." };

  try {
    const order = await getOrder(id);
    if (!order) return { error: "That order no longer exists." };

    // A non-empty waybill IS the guard. Booking twice means two riders and two charges.
    if (order.jrsBooking?.waybillNumber) {
      return { ok: `Already booked — waybill ${order.jrsBooking.waybillNumber}.` };
    }
    if (!isJrsConfigured()) return { error: "JRS is not configured on this deployment." };

    let shipment = order.jrsShipment;
    let quotedNow = false;

    if (!shipment) {
      shipment = await quoteOrderLive(order);
      await setOrderJrsShipment(id, shipment);
      quotedNow = true;
    }

    const booking = await bookJrsShipment({
      shipment,
      recipientName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      recipientPhone: order.customer.phone,
      recipientEmail: order.customer.email,
      recipientFullAddress: fullAddress(order),
      reference: order.ref,
    });

    await setOrderJrsBooking(id, {
      bookedAt: Date.now(),
      waybillNumber: booking.waybillNumber,
      error: "",
      rawResponse: booking.rawResponse,
    });

    revalidateQueue("orders", id);
    const quoted = quotedNow ? " (quoted fresh — this order predates stored shipments)" : "";
    return {
      ok: booking.waybillNumber
        ? `Shipment booked — waybill ${booking.waybillNumber}.${quoted}`
        : `Shipment booked, but JRS returned no waybill number.${quoted}`,
    };
  } catch (err) {
    console.error("[admin] JRS booking failed:", err);
    // Recorded on the order so the failure survives the page refresh that hides this message.
    await setOrderJrsBooking(id, {
      bookedAt: 0,
      waybillNumber: "",
      error: err instanceof Error ? err.message : String(err),
      rawResponse: "",
    }).catch(() => {});
    revalidateQueue("orders", id);
    return { error: "JRS refused the booking. The reason is on the order — try again in a moment." };
  }
}

/** Street address for the rider, as opposed to the "City, Province" the rate was quoted against. */
function fullAddress(order: Order): string {
  return [
    order.shipping.address,
    order.shipping.apartment,
    order.shipping.barangay,
    order.shipping.city,
    order.shipping.region,
    order.shipping.postal,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Quote an order that never stored a rate — legacy orders only.
 *
 * Dimensions aren't on the order document (they were transient at checkout), so they're re-read
 * from the brand's CURRENT products, exactly the way `reprice()` resolves a cart line. A product
 * that has since been deleted or renamed simply comes back unmeasured, which the fallback parcel
 * absorbs rather than failing on.
 */
async function quoteOrderLive(order: Order): Promise<JrsShipment> {
  const brandSlugs = new Set(
    order.lines
      .filter((l) => l.source === "brand")
      .map((l) => /^\/brands\/([^/]+)\//.exec(l.href)?.[1] ?? "")
      .filter(Boolean),
  );
  const brands = new Map(
    (await Promise.all([...brandSlugs].map((slug) => getBrandBySlug(slug))))
      .filter((b) => b !== undefined)
      .map((b) => [b.slug, b]),
  );

  const { shipmentItems, packagingName } = buildParcel(
    order.lines.map((line) => {
      const brand = brands.get(/^\/brands\/([^/]+)\//.exec(line.href)?.[1] ?? "");
      const product = brand?.products.find((p) => p.id === line.id);
      return { price: line.price, quantity: line.quantity, parcel: toParcelItem(product) };
    }),
  );

  const recipient = [order.shipping.city, order.shipping.region].filter(Boolean).join(", ");
  const rate = await getJrsRate({ recipient, shipmentItems, packagingName });

  return {
    packagingName: packagingName ?? null,
    shipmentItems,
    shipperAddressLine1: RATE_ORIGIN,
    recipientAddressLine1: recipient,
    express: false,
    insurance: true,
    valuation: true,
    codAmountToCollect: 0,
    shippingCost: rate.shippingCost,
    insuranceCost: rate.insuranceCost,
    valuationCost: rate.valuationCost,
    quotedAt: Date.now(),
    rawResponse: rate.rawResponse,
  };
}

export async function setInquiryStatusAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  const status = text(form, "status") as InquiryStatus;
  if (!id) return { error: "That inquiry no longer exists." };
  if (!INQUIRY_STATUSES.includes(status)) return { error: "Pick a valid status." };

  try {
    await setInquiryStatus(id, status);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the inquiry." };
  }

  revalidateQueue("inquiries", id);
  return { ok: `Marked as ${INQUIRY_STATUS_LABELS[status].toLowerCase()}.` };
}

export async function setInquiryNoteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  if (!id) return { error: "That inquiry no longer exists." };

  try {
    await setInquiryNote(id, text(form, "note").slice(0, MAX_NOTE));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the note." };
  }

  revalidateQueue("inquiries", id);
  return { ok: "Note saved." };
}
