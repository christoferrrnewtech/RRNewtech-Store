import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/** Public route — sits outside the (app) group so the auth guard doesn't loop on it. */
export default async function AdminLoginPage() {
  if (await getSessionUser()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
          R&amp;R Admin
        </h1>
        <p className="mt-1 text-sm text-muted">Sign in to manage brands and site content.</p>
        <LoginForm />
      </div>
    </div>
  );
}
