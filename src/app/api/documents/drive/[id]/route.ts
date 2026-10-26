import { getAllProducts } from "@/lib/catalog";
import { getBrands } from "@/lib/content";
import { DRIVE_ID, driveFileId, parseInline } from "@/lib/product-description";

/**
 * A Google Drive PDF linked from a product description, served from our own origin so the on-page
 * viewer (pdf.js) can read it — Drive's download endpoint sends no CORS headers.
 *
 * Only files that some published product actually links to are served. Without that check this is
 * an open relay: anyone could serve any public Drive PDF from our domain (and on our bandwidth).
 */

export const dynamic = "force-dynamic";

/** Brochures and spec sheets are a few MB; anything far past that isn't what this is for. */
const MAX_BYTES = 50 * 1024 * 1024;

const notFound = () => new Response("Not found", { status: 404 });

async function linkedDriveIds(): Promise<Set<string>> {
  const [products, brands] = await Promise.all([getAllProducts(), getBrands()]);
  const descriptions = [
    ...products.map((p) => p.description),
    ...brands.flatMap((b) => b.products.map((p) => p.description)),
  ];
  const ids = new Set<string>();
  for (const line of descriptions.flat()) {
    if (typeof line !== "string") continue;
    for (const seg of parseInline(line)) {
      const id = seg.type === "link" && driveFileId(seg.href);
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** PDFs start with "%PDF-", give or take some leading junk the spec tolerates. */
function looksLikePdf(chunk: Uint8Array): boolean {
  return new TextDecoder("latin1").decode(chunk.subarray(0, 1024)).includes("%PDF-");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DRIVE_ID.test(id) || !(await linkedDriveIds()).has(id)) return notFound();

  let upstream: Response;
  try {
    // confirm=t skips the "can't scan this file for viruses" page Drive puts in front of big files.
    upstream = await fetch(
      `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
      { cache: "no-store" },
    );
  } catch {
    return new Response("Couldn't reach Google Drive", { status: 502 });
  }

  const size = Number(upstream.headers.get("content-length"));
  if (!upstream.ok || !upstream.body || size > MAX_BYTES) {
    await upstream.body?.cancel();
    return notFound();
  }

  // Not shared publicly, or not a PDF: Drive answers with an HTML page, not the file.
  const reader = upstream.body.getReader();
  const first = await reader.read();
  if (first.done || !looksLikePdf(first.value)) {
    await reader.cancel();
    return notFound();
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(first.value);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Short, so a file replaced in Drive (same id) shows up on the site within the hour.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
