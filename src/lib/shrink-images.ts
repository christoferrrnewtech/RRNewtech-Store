/**
 * Browser-side image downscaling for admin forms that upload through Server Actions.
 *
 * Server Actions cap the whole request body (6 MB, see next.config.ts), and a form that posts
 * several photos at once blows past that even when each one is under the per-image 5 MB limit —
 * Next rejects the request before the action runs, so the admin sees a generic "Server Components
 * render" crash instead of a message. The server re-encodes every upload to a max-1600px WebP
 * anyway (`storeUpload` in the admin actions), so resizing to the same bound first loses nothing.
 *
 * Client-only: uses createImageBitmap and <canvas>.
 */

/** Matches the server's resize bound. */
const MAX_EDGE = 1600;
/** Matches the server's MIN_IMAGE_EDGE — never shrink an image the server would have accepted into one it rejects. */
const MIN_EDGE = 200;

/** Headroom under the 6 MB Server Action limit for the form's text fields and multipart overhead. */
export const UPLOAD_BUDGET_BYTES = 5.5 * 1024 * 1024;

/**
 * Return a copy of `form` with every image file downscaled. A file that can't be decoded here
 * (e.g. HEIC outside Safari) or wouldn't get smaller is passed through untouched — the server
 * still validates it.
 */
export async function shrinkImages(form: FormData): Promise<FormData> {
  const out = new FormData();
  for (const [key, value] of form.entries()) {
    out.append(key, value instanceof File ? await shrink(value) : value);
  }
  return out;
}

/** Total bytes of the files in `form`. */
export function uploadBytes(form: FormData): number {
  let total = 0;
  for (const value of form.values()) if (value instanceof File) total += value.size;
  return total;
}

async function shrink(file: File): Promise<File> {
  // SVG is refused server-side; rasterising it here would sneak it past that check.
  if (file.size === 0 || file.type === "image/svg+xml") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const scale = Math.min(1, Math.max(MAX_EDGE / longEdge, MIN_EDGE / shortEdge));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // Browsers that can't encode WebP silently hand back PNG, which can be larger than the original.
  // Fall back to JPEG there, on white: product shots are shown on white, and JPEG has no alpha.
  let blob = await draw(canvas, ctx, bitmap, "image/webp");
  if (blob?.type !== "image/webp") blob = await draw(canvas, ctx, bitmap, "image/jpeg", "#fff");
  bitmap.close();

  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

function draw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  type: string,
  background?: string,
): Promise<Blob | null> {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}
