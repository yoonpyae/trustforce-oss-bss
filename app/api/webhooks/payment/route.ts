import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSystemSettings } from "@/lib/queries/settings";
import { settleInvoice } from "@/lib/actions/billing";
import { recharge } from "@/lib/actions/customers";
import { logAudit } from "@/lib/audit";

// A real payment gateway (KBZPay/WavePay/AYA Pay) callback would POST here on
// successful payment. Verified with a shared secret rather than OAuth/mTLS,
// since there's no real merchant account behind this build — see Settings.
//
// Body: { customerId: string, invoiceId?: string, method?: string, transactionId: string }
// - invoiceId given → settles that specific invoice (auto CoA-reconnects if the
//   customer had lapsed).
// - invoiceId omitted → treated as a plan renewal for customerId, same as the
//   Recharge button (respects the daily/monthly billing calculation mode).
export async function POST(req: Request) {
  const settings = await getSystemSettings();
  const providedSecret = req.headers.get("x-webhook-secret");
  if (providedSecret !== settings.paymentWebhookSecret) {
    return Response.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  let body: { customerId?: string; invoiceId?: string; method?: string; transactionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { customerId, invoiceId, transactionId } = body;
  const method = body.method && ["kbzpay", "wavepay", "ayapay", "cash", "bank"].includes(body.method) ? body.method : "kbzpay";
  if (!customerId || !transactionId) {
    return Response.json({ error: "customerId and transactionId are required" }, { status: 400 });
  }

  const [customer] = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return Response.json({ error: `No customer with ID ${customerId}` }, { status: 404 });

  if (invoiceId) {
    const [invoice] = await db.select({ id: s.invoices.id, status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.id, invoiceId)).limit(1);
    if (!invoice) return Response.json({ error: `No invoice with ID ${invoiceId}` }, { status: 404 });
    if (invoice.status === "paid") return Response.json({ status: "ok", note: "Already paid" });

    const fd = new FormData();
    fd.set("invoiceId", invoiceId);
    fd.set("method", method);
    await settleInvoice(fd);
    await logAudit("Payment gateway callback", "invoice", invoiceId, `${method} txn ${transactionId}`);
    return Response.json({ status: "ok", invoiceId });
  }

  const fd = new FormData();
  fd.set("customerId", customerId);
  fd.set("method", method);
  await recharge(fd);
  await logAudit("Payment gateway callback", "customer", customerId, `${method} txn ${transactionId}, renewal`);
  return Response.json({ status: "ok", customerId });
}
