# HubSpot integration (on hold)

**Status:** built and type-checked, then switched off before it was tested or deployed, because the
boss put it on hold. Nothing sends data to HubSpot right now. Inquiries still save to Firestore and
still send the staff email, the same as before.

Every disabled spot is marked `HUBSPOT-DISABLED`. To list them all:

```bash
grep -rn "HUBSPOT-DISABLED" . --exclude-dir=node_modules --exclude-dir=.next
```

## What it does once switched back on

Each inquiry creates or updates a HubSpot **contact**, matched on email address, so someone who
sends several inquiries stays one HubSpot record instead of turning into duplicates.

| Form | Firestore `kind` | HubSpot result |
|---|---|---|
| `/contact` | `message` | Contact, lifecycle stage left as it is |
| `/request-quote` | `quote` | Contact with lifecycle stage set to **Lead** |

HubSpot receives the name (split into first and last), email, phone, clinic (as the company), and
the message tagged with the inquiry reference (`INQ-…`) and the product name, if there is one.

If HubSpot is down, refuses the request, or has no key set, the inquiry still saves and the
visitor still reaches the thank-you page. The failure is logged with a `[hubspot]` prefix.

## Step 1: Uncomment the code (4 places)

### 1. `src/app/(store)/actions.ts`: the import (near the top, around line 42)

```ts
// HUBSPOT-DISABLED — on hold; see docs/hubspot-integration.md to turn it back on.
// import { syncInquiryToHubSpot } from "@/lib/hubspot";
```

Uncomment the `import` line and delete the `HUBSPOT-DISABLED` line above it.

### 2. `src/app/(store)/actions.ts`: the call (in `sendInquiryAction`, around line 802)

```ts
    // HUBSPOT-DISABLED — on hold; swap the two lines below to turn the sync back on.
    await notifyNewInquiry(inquiry);
    // await Promise.all([notifyNewInquiry(inquiry), syncInquiryToHubSpot(inquiry)]);
```

Delete the plain `await notifyNewInquiry(inquiry);` line, uncomment the `Promise.all` line, and
delete the `HUBSPOT-DISABLED` line. Keep only one of the two lines, or the staff email goes out
twice.

### 3. `.env.example`

Change `# HUBSPOT_ACCESS_TOKEN=` back to `HUBSPOT_ACCESS_TOKEN=` and delete the `HUBSPOT-DISABLED`
line above it.

### 4. `src/lib/hubspot.ts`

Nothing to uncomment in this file; it was left whole. Only delete the `HUBSPOT-DISABLED` paragraph
at the top of the header comment.

## Step 2: Test locally against a HubSpot test account

Use a test account so test inquiries don't end up in the real CRM.

1. In HubSpot, go to **Development → Testing** and create a developer test account (free).
2. Switch to that test account, go to **Development → Keys → Service Keys**, and create a key with
   these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`

   Don't use the **Personal Access Key**, which only signs in the HubSpot CLI, or the
   **Developer API Key**. Neither works for this. If Service Keys aren't available, use
   **Legacy Apps → Create → Private** with the same scopes.
3. In `.env.local` (gitignored), set `HUBSPOT_ACCESS_TOKEN=<test account key>`.
4. Restart `npm run dev`. Next.js only reads env files when it starts.
5. Send one inquiry from `/contact` and one from `/request-quote`.
6. Check **Contacts** in the test account: there should be two contacts, and the quote sender should
   have lifecycle stage **Lead**. If not, look for a `[hubspot]` line in the dev server terminal.

## Step 3: Go live

The order matters. A rollout that references a secret that doesn't exist yet fails.

1. In the **production** HubSpot account, create a separate Service Key with the same two scopes.
   Don't reuse the test-account key.
2. Store it in Firebase:
   ```bash
   firebase apphosting:secrets:set HUBSPOT_ACCESS_TOKEN
   ```
   Paste the production key when it asks, and say yes when it offers to grant the backend access.
3. **Only after step 2**, uncomment the block in `apphosting.yaml` (near the Resend section) and
   delete its `HUBSPOT-DISABLED` line:
   ```yaml
     - variable: HUBSPOT_ACCESS_TOKEN
       secret: HUBSPOT_ACCESS_TOKEN
       availability: [RUNTIME]
   ```
4. Commit, push and roll out. The live site only runs the new code after a rollout.
5. Send one real test inquiry on the live site and check that it appears in the production HubSpot
   account.

## Notes for later

- **Lifecycle stages only move forward.** HubSpot won't demote a contact (for example, from
  Customer back to Lead). If an existing customer asks for a quote, the code retries without the
  stage change, so the contact is still updated and their stage stays as it is.
- **HubSpot's separate Leads object is not used.** We chose the lifecycle stage on the contact
  because it works on every HubSpot plan, including Free. Switching to the Leads object would need
  new code, a paid Sales Hub seat, and the `crm.objects.leads.read` and `crm.objects.leads.write`
  scopes.
- **Firestore stays the source of truth.** HubSpot is a copy for the sales team. Inquiries sent
  while this was off are not copied over automatically when it's switched back on.
