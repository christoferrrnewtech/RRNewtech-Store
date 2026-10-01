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
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-extrabold text-white">
            R
          </span>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
            R&amp;R Admin
          </h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage orders, brands and site content.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
