"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

/**
 * A view-only PDF viewer: pages are drawn onto canvases with pdf.js, so there's no browser PDF
 * toolbar and with it no download or print button, and no text layer to copy from. It only removes
 * the buttons — the file itself still reaches the browser, as it must for anyone to see it.
 *
 * pdf.js (~1 MB with its worker) is imported on first open, never in the product page bundle.
 */

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | undefined;

function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    // One worker for the page's lifetime; pdf.js reuses it for every document opened.
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    return pdfjs;
  });
  return pdfjsPromise;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Pages wider than this on a big screen are harder to read, not easier. */
const MAX_FIT_WIDTH = 900;

/** Per-canvas pixel budget. iOS Safari refuses canvases much past 16M pixels. */
const MAX_CANVAS_PIXELS = 8_000_000;

export function PdfViewer({ src, title }: { src: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(0);

  useEffect(() => {
    let live = true;
    let destroy: (() => void) | undefined;
    loadPdfjs()
      .then((pdfjs) => {
        if (!live) return;
        const task = pdfjs.getDocument({ url: src });
        destroy = () => void task.destroy();
        return task.promise.then((d) => live && setDoc(d));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      destroy?.();
    };
  }, [src]);

  // Pages fit the scroll area's width (less its padding); zoom scales from there.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setFitWidth(Math.min(entry.contentRect.width, MAX_FIT_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const pageWidth = Math.floor(fitWidth * zoom);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-center gap-1 border-b border-line px-4 py-2 text-sm text-muted">
        <ZoomButton
          label="Zoom out"
          path="M5 12h14"
          disabled={!doc || zoomIndex <= 0}
          onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])}
        />
        <span className="w-14 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <ZoomButton
          label="Zoom in"
          path="M5 12h14M12 5v14"
          disabled={!doc || zoomIndex >= ZOOM_STEPS.length - 1}
          onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])}
        />
        {doc && (
          <span className="ml-3 tabular-nums">
            {doc.numPages} {doc.numPages === 1 ? "page" : "pages"}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        // No "Save image as…" on the page canvases.
        onContextMenu={(e) => e.preventDefault()}
        className="min-h-0 flex-1 overflow-auto bg-elevated px-3 py-4 sm:px-6"
        aria-label={title}
      >
        {failed ? (
          <p className="py-16 text-center text-sm text-muted">
            This document couldn&apos;t be loaded. Please try again later.
          </p>
        ) : !doc || pageWidth === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Loading document…</p>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-4">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage
                key={i}
                doc={doc}
                pageNumber={i + 1}
                width={pageWidth}
                root={scrollRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  path,
  disabled,
  onClick,
}: {
  label: string;
  path: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-elevated hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * One page. It's only drawn while near the visible area and cleared again once scrolled well away,
 * so a long catalogue doesn't hold dozens of full-resolution canvases (which crashes phones).
 */
function PdfPage({
  doc,
  pageNumber,
  width,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  root: RefObject<HTMLDivElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    let live = true;
    doc.getPage(pageNumber).then((p) => live && setPage(p), () => {});
    return () => {
      live = false;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: root.current,
      rootMargin: "150% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  const base = useMemo(() => page?.getViewport({ scale: 1 }), [page]);
  // A4 proportions until the page's real size is known, so the scrollbar doesn't jump much.
  const height = Math.floor(base ? (width * base.height) / base.width : width * 1.414);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page || !base) return;
    if (!near) {
      canvas.width = canvas.height = 0;
      return;
    }
    const density = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    );
    const viewport = page.getViewport({ scale: (width / base.width) * density });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = page.render({ canvas, viewport });
    // Rejects with RenderingCancelledException when the cleanup below cancels it.
    task.promise.catch(() => {});
    return () => task.cancel();
  }, [page, base, near, width, height]);

  return (
    <div
      ref={wrapRef}
      style={{ width, height }}
      className="shrink-0 bg-white shadow-sm ring-1 ring-line"
    >
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="block select-none"
        aria-label={`Page ${pageNumber}`}
      />
    </div>
  );
}
