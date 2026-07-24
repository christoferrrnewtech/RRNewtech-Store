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
import { brandSlug, brandProductSlugify } from "@/lib/products";
import { BRAND_GROUPS } from "@/lib/constants";

export type ActionState = { ok?: string; error?: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
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

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Multi-value text inputs (repeatable rows), with blanks dropped. */
function textList(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
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
      const descriptions = form.getAll("productDescription").map(String);
      const highlightsRaw = form.getAll("productHighlights").map(String);
      const galleryJson = form.getAll("productGalleryJson").map(String);
      const inStocks = form.getAll("productInStock").map(String);
      const contactSalesFlags = form.getAll("productContactSales").map(String);
      const existingImages = form.getAll("productImage").map(String);
      const files = form.getAll("productImageFile");

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

        out.push({
          id,
          slug,
          name,
          price,
          compareAtPrice: compareAt > price ? compareAt : undefined,
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
