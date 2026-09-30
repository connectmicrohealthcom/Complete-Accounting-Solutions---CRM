import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentCheckout = { id: string; url: string; provider: "stripe" | "mock" };

function paymentMode(): "stripe" | "mock" {
  return process.env.PAYMENT_GATEWAY_MODE === "mock" ? "mock" : "stripe";
}

function requireStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export async function createBookingCheckout(input: {
  appointmentId: number;
  serviceName: string;
  amountAed: number;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<PaymentCheckout> {
  if (paymentMode() === "mock") {
    const id = `mock_cs_${input.appointmentId}_${Date.now()}`;
    return { id, url: `${input.successUrl}&mock_payment=success`, provider: "mock" };
  }

  const secret = requireStripeKey();
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", String(input.appointmentId));
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "aed");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amountAed * 100)));
  body.set("line_items[0][price_data][product_data][name]", input.serviceName);
  body.set("metadata[appointmentId]", String(input.appointmentId));
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !data.id || !data.url) throw new Error(data.error?.message ?? "Payment gateway could not create a checkout session");
  return { id: data.id, url: data.url, provider: "stripe" };
}

export function verifyStripeSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const values = signatureHeader.split(",").map(part => part.split("=", 2));
  const timestamp = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some(signature => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}

export function isMockPaymentMode(): boolean {
  return paymentMode() === "mock";
}
