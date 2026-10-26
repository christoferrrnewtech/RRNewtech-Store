"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DocumentViewer } from "@/lib/product-description";
import { PdfViewer } from "./PdfViewer";

/**
 * A description link to a PDF or Drive file, opened in the on-page view-only viewer. It's a button
 * rather than a link on purpose: a real href would let middle-click or "Open link in new tab" reach
 * the original file, with its download and print buttons.
 */
export function DocumentButton({
  viewer,
  title,
  className,
  children,
}: {
  viewer: DocumentViewer;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {/* Portalled: the link can sit inside a <p>, which a <dialog> may not. */}
      {open &&
        createPortal(
          <DocumentDialog
            src={viewer.src}
            title={title}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

/** Mounted only while open, so the document isn't fetched until the shopper asks for it. */
function DocumentDialog({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() gives us the backdrop, focus trapping and Escape-to-close; we add the scroll lock.
  // The cleanup must not call close(): that queues a `close` event, and under Strict Mode's
  // mount → cleanup → mount the event lands after the re-open and unmounts the dialog straight
  // away. Unmounting removes the dialog from the top layer anyway.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click landing on the <dialog> itself (not its contents) is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={title}
      className="m-auto h-dvh max-h-none w-full max-w-none bg-surface p-0 shadow-xl backdrop:bg-ink/40 sm:h-[90dvh] sm:w-[min(64rem,calc(100vw-2rem))] sm:rounded-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-fg">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <PdfViewer src={src} title={title} />
      </div>
    </dialog>
  );
}
