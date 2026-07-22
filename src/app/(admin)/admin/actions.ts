"use server";

/**
 * All admin mutations.
 *
 * SECURITY: every action re-checks authentication and authorization itself. Server actions are
 * directly callable HTTP endpoints — the layout guard in (app)/layout.tsx does not protect them.
 * Never remove a `requireUser` / `requireAdmin` / `canEditBrand` call from an action because
 * "the UI already hides it".
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getContent,
  updateContent,
  type Brand,
  type GalleryImage,
} from "@/lib/content";
import {
  authenticate,
  canEditBrand,
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  requireUser,
} from "@/lib/auth";
import { brandSlug } from "@/lib/products";

export type ActionState = { ok?: string; error?: string };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
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
  if (slug) revalidatePath(`/brands/${slug}`);
  revalidatePath("/sitemap.xml");
}

/**
 * Persist an uploaded image under public/uploads and return its public path.
 * Returns undefined when no file was supplied (an unchanged image field).
 */
async function storeUpload(file: FormDataEntryValue | null, prefix: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) return "";

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Only PNG, JPG and WebP images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5 MB or smaller.");

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
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
  const user = authenticate(text(form, "email"), String(form.get("password") ?? ""));
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

export async function saveBannerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const uploaded = await storeUpload(form.get("image"), "banner");
    updateContent((draft) => {
      if (uploaded) draft.banner.image = uploaded;
      draft.banner.alt = text(form, "alt");
      draft.banner.href = text(form, "href");
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the banner." };
  }

  revalidateStorefront();
  return { ok: "Banner saved." };
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
  if (getContent().brands.some((b) => b.slug === slug)) {
    return { error: `A brand with the URL /brands/${slug} already exists.` };
  }

  try {
    const logo = await storeUpload(form.get("logo"), `logo-${slug}`);

    // New brands start as drafts so a half-finished page is never public.
    const brand: Brand = {
      slug,
      name,
      status: "draft",
      order: getContent().brands.length,
      tagline: "",
      blurb: "",
      logo: logo || "/brand/logo.png",
      about: [],
      gallery: [],
      featuredProductSlugs: [],
      whyChoose: [],
      cta: {
        heading: "Interested in learning more?",
        body: "",
        buttonLabel: "Visit Official Website",
        websiteUrl: "",
      },
    };
    updateContent((draft) => {
      draft.brands.push(brand);
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the brand." };
  }

  revalidateStorefront(slug);
  redirect(`/admin/brands/${slug}`);
}

export async function deleteBrandAction(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = text(form, "slug");

  updateContent((draft) => {
    draft.brands = draft.brands.filter((b) => b.slug !== slug);
    // Drop the deleted brand from any marketing user's assignments.
    for (const user of draft.users) {
      user.brandSlugs = user.brandSlugs.filter((s) => s !== slug);
    }
  });

  revalidateStorefront(slug);
  redirect("/admin/brands");
}

/**
 * Every brand-section save funnels through here so the ownership check exists in exactly one
 * place. `apply` receives the brand draft and the submitted form.
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
  if (!getContent().brands.some((b) => b.slug === slug)) {
    return { error: "That brand no longer exists." };
  }

  try {
    const draft = structuredClone(getContent());
    const brand = draft.brands.find((b) => b.slug === slug)!;
    await apply(brand, form);
    updateContent((d) => {
      const target = d.brands.findIndex((b) => b.slug === slug);
      d.brands[target] = brand;
    });
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

export async function saveBrandProductsAction(_prev: ActionState, form: FormData) {
  return saveBrandSection(
    form,
    (brand) => {
      brand.featuredProductSlugs = form.getAll("productSlug").map(String);
    },
    "Featured products saved.",
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
  if (getContent().users.some((u) => u.email.toLowerCase() === email)) {
    return { error: "That email already has an account." };
  }

  const { passwordHash, salt } = hashPassword(password);
  updateContent((draft) => {
    draft.users.push({
      id: crypto.randomUUID(),
      email,
      name,
      role: "marketing",
      passwordHash,
      salt,
      brandSlugs,
    });
  });

  return { ok: `${name} can now sign in.` };
}

export async function updateUserBrandsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(form, "id");
  const brandSlugs = form.getAll("brandSlugs").map(String);

  updateContent((draft) => {
    const user = draft.users.find((u) => u.id === id);
    if (user) user.brandSlugs = brandSlugs;
  });

  return { ok: "Brand access updated." };
}

export async function deleteUserAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id");

  updateContent((draft) => {
    draft.users = draft.users.filter((u) => u.id !== id);
  });

  redirect("/admin/users");
}
