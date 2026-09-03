"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/(store)/account/actions";
import { FormMessage, Honeypot, SubmitButton } from "@/components/ui/FormControls";
import { Field, ImageInput, PasswordInput, TextInput } from "@/components/account/fields";
import {
  MAX_EMAIL,
  MAX_NAME,
  MAX_PASSWORD,
  MIN_PASSWORD,
  PHONE_PATTERN,
  PRC_IMAGE_ACCEPT,
  PRC_PATTERN,
} from "@/lib/customer-fields";
import type { ActionState } from "@/lib/form-data";

/**
 * Sign-up form. Every `pattern` and `maxLength` here comes from `customer-fields.ts`, the same
 * module `registerAction` validates against — so the browser and the server can't drift apart on
 * what a valid phone number or PRC ID looks like. The browser checks are purely a courtesy; the
 * server re-checks all of them.
 *
 * On success the action redirects to /account/verify, so there is no success state to render.
 */
export function RegisterForm() {
  const [state, action] = useActionState<ActionState, FormData>(registerAction, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <Honeypot />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <TextInput
            name="firstName"
            autoComplete="given-name"
            maxLength={MAX_NAME}
            required
            autoFocus
            placeholder="Juan"
          />
        </Field>
        <Field label="Last name" required>
          <TextInput
            name="lastName"
            autoComplete="family-name"
            maxLength={MAX_NAME}
            required
            placeholder="Dela Cruz"
          />
        </Field>
      </div>

      <Field label="Email address" hint="We'll send a confirmation link here." required>
        <TextInput
          name="email"
          type="email"
          autoComplete="email"
          maxLength={MAX_EMAIL}
          required
          placeholder="you@clinic.ph"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number" hint="09XX-XXX-XXXX or 09XXXXXXXXX" required>
          <TextInput
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern={PHONE_PATTERN}
            maxLength={13}
            required
            placeholder="0917-123-4567"
          />
        </Field>
        <Field label="PRC ID number" hint="6 or 7 digits" required>
          <TextInput
            name="prcId"
            inputMode="numeric"
            pattern={PRC_PATTERN}
            maxLength={7}
            required
            placeholder="1234567"
          />
        </Field>
      </div>

      <ImageInput
        name="prcIdImage"
        accept={PRC_IMAGE_ACCEPT}
        required
        hint="A clear photo or scan of your PRC ID card — PNG, JPG or WebP, up to 8 MB. We check it against the number above before your account is approved."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters`} required>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            required
          />
        </Field>
        <Field label="Confirm password" required>
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            required
          />
        </Field>
      </div>

      <FormMessage state={state} />

      <SubmitButton pendingLabel="Creating your account…" size="lg" className="w-full">
        Create account
      </SubmitButton>

      <p className="text-center text-xs leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <a href="/terms" className="font-semibold text-brand-700 hover:text-brand-800">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="font-semibold text-brand-700 hover:text-brand-800">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
