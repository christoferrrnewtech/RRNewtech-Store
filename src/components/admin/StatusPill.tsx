/** Draft / Published, with a dot — the brand status everywhere in the admin. */
export function StatusPill({ status }: { status: "draft" | "published" }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        published ? "bg-success/10 text-success" : "bg-elevated text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-success" : "bg-muted-light"}`} />
      {published ? "Published" : "Draft"}
    </span>
  );
}
