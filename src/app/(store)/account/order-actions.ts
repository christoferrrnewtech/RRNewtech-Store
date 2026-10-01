"use server";

/**
 * Order mutations for the signed-in customer — today, just cancelling.
 *
 * SECURITY: starts at `requireCustomer()`, and the posted order id is checked against the
 * session's own customer before anything happens. Ownership is the same two-key test
 * `listOrdersForCustomer` uses to put the order on /account in the first place — uid, or the
 * account's verified email — so a customer can cancel exactly the orders they can see, and an
 * order id lifted from someone else's pay-page URL gets the same answer as one that doesn't exist.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireCustomer } from "@/lib/customer-auth";
import { cancelUnpaidOrder, getOrder, type Order } from "@/lib/orders";
import { isCustomerCancellable } from "@/lib/order-status";
import { reconcileOrderPayment, retireCheckoutSession } from "@/lib/payments";
import { isOrderId, parsePendingPayment, PAY_COOKIE } from "@/lib/pay-window";
import type { Customer } from "@/lib/customers";
import { text, type ActionState } from "@/lib/form-data";

function owns(customer: Customer, order: Order): boolean {
  if (order.customer.userId && order.customer.userId === customer.uid) return true;
  const email = customer.email.trim().toLowerCase();
  return email !== "" && order.customer.email === email;
}

/**
 * Cancel one of the customer's own unpaid orders.
 *
 * The PayMongo session is retired BEFORE the order is marked cancelled, and conclusively (see
 * `retireCheckoutSession`): cancelling while the link could still charge would let a stale tab
 * pay for a cancelled order, leaving staff a refund to make. If a payment is in flight the
 * customer is asked to wait; if it already went through, the order is paid and stays.
 */
export async function cancelOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const customer = await requireCustomer();

  const id = text(form, "id");
  const missing = { error: "We couldn't find that order." };
  if (!isOrderId(id)) return missing;

  try {
    const found = await getOrder(id);
    if (!found || !owns(customer, found)) return missing;

    const order = await reconcileOrderPayment(found);
    if (order.paymentStatus === "paid") {
      revalidatePath("/account");
      return {
        error: "This order has already been paid. Contact us if you'd like to cancel it.",
      };
    }
    if (!isCustomerCancellable(order)) {
      return { error: "This order can no longer be cancelled here. Please contact us." };
    }

    const retired = await retireCheckoutSession(order);
    if (retired === "paid") {
      revalidatePath("/account");
      return {
        error: "A payment for this order just went through. Contact us if you'd like to cancel it.",
      };
    }
    if (retired === "busy") {
      return {
        error: "A payment for this order is still being processed. Please try again in a few minutes.",
      };
    }

    if (!(await cancelUnpaidOrder(order.id))) {
      revalidatePath("/account");
      return { error: "This order can no longer be cancelled here. Please contact us." };
    }

    // Drop the site-wide "finish your payment" banner if it points at the order just cancelled.
    const store = await cookies();
    if (parsePendingPayment(store.get(PAY_COOKIE)?.value)?.orderId === order.id) {
      store.delete(PAY_COOKIE);
    }
  } catch (err) {
    console.error("[account] could not cancel order", id, err);
    return { error: "We couldn't cancel that order just now. Please try again shortly." };
  }

  revalidatePath("/account");
  // "layout" so the sidebar's order badges recount too.
  revalidatePath("/admin/orders", "layout");
  return { ok: "Order cancelled." };
}
