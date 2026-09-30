import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5001";
const email = process.env.SMOKE_EMAIL ?? "stage1-admin@completeaccounting.test";
const password = process.env.SMOKE_PASSWORD ?? "";
if (!password) throw new Error("SMOKE_PASSWORD not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function expectStatus(response: Response | Promise<Response>, expected: number, label: string) {
  const actual = await response;
  if (actual.status !== expected) throw new Error(`${label}: expected ${expected}, got ${actual.status}: ${await actual.text()}`);
  return actual;
}

async function json(response: Response | Promise<Response>) {
  return (await response).json() as any;
}

function nextDate(dayOffset: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO staff (name, email, password_hash, role, is_active)
     VALUES ('Stage 1 Admin', $1, $2, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true`,
    [email, passwordHash],
  );

  const login = await expectStatus(fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }), 200, "login");
  const setCookie = login.headers.get("set-cookie");
  if (!setCookie) throw new Error("login did not return a session cookie");
  const cookie = setCookie.split(";")[0];
  const headers = { "content-type": "application/json", cookie };

  const staff = await json(await expectStatus(fetch(`${baseUrl}/api/staff`, {
    method: "POST", headers,
    body: JSON.stringify({ name: "Stage 1 Stylist", email: "stage1-stylist@completeaccounting.test", password: "stage1-stylist-password", role: "stylist" }),
  }), 201, "staff create"));

  const schedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek, isWorking: true, startTime: "09:00", endTime: "18:00",
  }));
  await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/schedule`, {
    method: "PUT", headers, body: JSON.stringify({ hours: schedule }),
  }), 200, "staff schedule");

  const client = await json(await expectStatus(fetch(`${baseUrl}/api/clients`, {
    method: "POST", headers, body: JSON.stringify({ name: "Stage 1 Client", phone: "0500000001" }),
  }), 201, "client create"));

  const service = await json(await expectStatus(fetch(`${baseUrl}/api/services`, {
    method: "POST", headers, body: JSON.stringify({ name: "Stage 1 Service", duration: 60, price: 100 }),
  }), 201, "service create"));

  const appointmentDate = nextDate(1);
  const appointment = await json(await expectStatus(fetch(`${baseUrl}/api/appointments`, {
    method: "POST", headers,
    body: JSON.stringify({ clientId: client.id, staffId: staff.id, serviceId: service.id, date: appointmentDate, startTime: "10:00" }),
  }), 201, "appointment create"));
  if (appointment.endTime !== "11:00" || Number(appointment.totalPrice) !== 100) throw new Error("appointment duration/price was not calculated from service");

  await expectStatus(fetch(`${baseUrl}/api/appointments`, {
    method: "POST", headers,
    body: JSON.stringify({ clientId: client.id, staffId: staff.id, serviceId: service.id, date: appointmentDate, startTime: "10:30" }),
  }), 409, "overlapping appointment rejection");

  const moved = await json(await expectStatus(fetch(`${baseUrl}/api/appointments/${appointment.id}`, {
    method: "PATCH", headers,
    body: JSON.stringify({ startTime: "12:00" }),
  }), 200, "appointment reschedule"));
  if (moved.endTime !== "13:00" || Number(moved.totalPrice) !== 100) throw new Error("appointment reschedule did not recalculate end time/price");

  await expectStatus(fetch(`${baseUrl}/api/appointments/${appointment.id}/status`, {
    method: "PATCH", headers, body: JSON.stringify({ status: "completed" }),
  }), 409, "invalid appointment lifecycle transition");
  await expectStatus(fetch(`${baseUrl}/api/appointments/${appointment.id}/status`, {
    method: "PATCH", headers, body: JSON.stringify({ status: "confirmed" }),
  }), 200, "confirm appointment");
  await expectStatus(fetch(`${baseUrl}/api/appointments/${appointment.id}/status`, {
    method: "PATCH", headers, body: JSON.stringify({ status: "in_progress" }),
  }), 200, "start appointment");

  const product = await json(await expectStatus(fetch(`${baseUrl}/api/products`, {
    method: "POST", headers,
    body: JSON.stringify({ name: "Stage 1 Product", price: 20, stockQuantity: 3 }),
  }), 201, "product create"));

  const sale = await json(await expectStatus(fetch(`${baseUrl}/api/sales`, {
    method: "POST", headers,
    body: JSON.stringify({
      clientId: client.id, staffId: staff.id, appointmentId: appointment.id, paymentMethod: "cash", discount: 10,
      items: [
        { type: "service", referenceId: service.id, name: "wrong", quantity: 1, unitPrice: 1 },
        { type: "product", referenceId: product.id, name: "wrong", quantity: 2, unitPrice: 1 },
      ],
    }),
  }), 201, "POS sale"));
  if (Number(sale.subtotal) !== 140 || Number(sale.total) !== 130) throw new Error("POS totals are incorrect");
  const productAfter = await json(await expectStatus(fetch(`${baseUrl}/api/products/${product.id}`, { headers: { cookie } }), 200, "product read"));
  if (productAfter.stockQuantity !== 1) throw new Error("POS did not decrement inventory");
  const clientAfter = await json(await expectStatus(fetch(`${baseUrl}/api/clients/${client.id}`, { headers: { cookie } }), 200, "client read"));
  if (Number(clientAfter.totalSpent) !== 130 || clientAfter.visitCount !== 1) throw new Error("POS did not update client sales stats");

  await expectStatus(fetch(`${baseUrl}/api/tips`, {
    method: "POST", headers, body: JSON.stringify({ saleId: sale.id, staffId: staff.id, clientId: client.id, amount: 5, note: "Stage 1 tip" }),
  }), 201, "tip create");
  const tipSummary = await json(await expectStatus(fetch(`${baseUrl}/api/tips/summary`, { headers: { cookie } }), 200, "tip summary"));
  if (Number(tipSummary.totalTips) < 5) throw new Error("tip summary did not include the created tip");

  const pkg = await json(await expectStatus(fetch(`${baseUrl}/api/packages`, {
    method: "POST", headers, body: JSON.stringify({ name: "Stage 1 Package", price: 80, validityDays: 30, services: [{ serviceId: service.id, quantity: 2 }] }),
  }), 201, "package create"));
  const clientPackage = await json(await expectStatus(fetch(`${baseUrl}/api/client-packages`, {
    method: "POST", headers, body: JSON.stringify({ clientId: client.id, packageId: pkg.id }),
  }), 201, "package purchase"));
  await expectStatus(fetch(`${baseUrl}/api/client-packages/${clientPackage.id}/use`, {
    method: "POST", headers, body: JSON.stringify({ serviceId: service.id }),
  }), 200, "package use 1");
  await expectStatus(fetch(`${baseUrl}/api/client-packages/${clientPackage.id}/use`, {
    method: "POST", headers, body: JSON.stringify({ serviceId: service.id }),
  }), 200, "package use 2");
  await expectStatus(fetch(`${baseUrl}/api/client-packages/${clientPackage.id}/use`, {
    method: "POST", headers, body: JSON.stringify({ serviceId: service.id }),
  }), 409, "package overuse rejection");

  const plan = await json(await expectStatus(fetch(`${baseUrl}/api/membership-plans`, {
    method: "POST", headers, body: JSON.stringify({ name: "Stage 1 Membership", price: 90, validityDays: 30, services: [{ serviceId: service.id, quantity: 1 }] }),
  }), 201, "membership plan create"));
  const membership = await json(await expectStatus(fetch(`${baseUrl}/api/client-memberships`, {
    method: "POST", headers, body: JSON.stringify({ clientId: client.id, planId: plan.id, startDate: nextDate(0), paymentMethod: "cash" }),
  }), 201, "membership assign"));
  await expectStatus(fetch(`${baseUrl}/api/client-memberships/${membership.id}/use`, {
    method: "POST", headers, body: JSON.stringify({ serviceId: service.id }),
  }), 200, "membership use");
  await expectStatus(fetch(`${baseUrl}/api/client-memberships/${membership.id}/use`, {
    method: "POST", headers, body: JSON.stringify({ serviceId: service.id }),
  }), 409, "membership overuse rejection");

  const giftType = await json(await expectStatus(fetch(`${baseUrl}/api/gift-card-types`, {
    method: "POST", headers, body: JSON.stringify({ name: "Stage 1 Gift Card", purchaseAmount: 100, creditAmount: 120, validityDays: 30 }),
  }), 201, "gift card type create"));
  const gift = await json(await expectStatus(fetch(`${baseUrl}/api/gift-cards`, {
    method: "POST", headers, body: JSON.stringify({ clientId: client.id, typeId: giftType.id, paymentMethod: "cash" }),
  }), 201, "gift card sell"));
  const wallet = await json(await expectStatus(fetch(`${baseUrl}/api/clients/${client.id}/wallet`, { headers: { cookie } }), 200, "wallet read"));
  if (Number(wallet.balance) < 120) throw new Error("gift card did not credit client wallet");
  await expectStatus(fetch(`${baseUrl}/api/clients/${client.id}/wallet/redeem`, {
    method: "POST", headers, body: JSON.stringify({ amount: 20, description: "Stage 1 gift card redemption", referenceType: "gift_card", referenceId: gift.id }),
  }), 200, "gift card wallet redemption");

  await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/wage-settings`, {
    method: "PUT", headers, body: JSON.stringify({ wageType: "monthly", baseAmount: 1000 }),
  }), 200, "wage settings");
  await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/commission-slabs`, {
    method: "POST", headers, body: JSON.stringify({ minAmount: 0, maxAmount: 1000, rate: 10 }),
  }), 201, "commission slab");
  await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/attendance-logs`, {
    method: "POST", headers, body: JSON.stringify({ date: nextDate(0), clockIn: "09:00", clockOut: "17:00", totalHours: 8 }),
  }), 201, "attendance log");
  await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/wage-payments`, {
    method: "POST", headers, body: JSON.stringify({ amount: 200, periodFrom: nextDate(0), periodTo: nextDate(0), paymentDate: nextDate(0), paymentMethod: "cash" }),
  }), 201, "wage payment");
  const financial = await json(await expectStatus(fetch(`${baseUrl}/api/staff/${staff.id}/financial-summary?from=${nextDate(-1)}&to=${nextDate(1)}`, { headers: { cookie } }), 200, "financial summary"));
  if (Number(financial.totalRevenue) !== 130 || Number(financial.commissionEarned) !== 13 || Number(financial.wagePaid) !== 200 || Number(financial.netPayable) !== 813) {
    throw new Error(`unexpected payroll calculation: ${JSON.stringify(financial)}`);
  }

  const salesSummary = await json(await expectStatus(fetch(`${baseUrl}/api/sales/summary?from=${nextDate(-1)}&to=${nextDate(1)}`, { headers: { cookie } }), 200, "sales summary"));
  if (Number(salesSummary.totalRevenue) < 130) throw new Error("sales summary did not include the POS sale");

  for (const [path, id, label] of [
    ["/clients", client.id, "client"],
    ["/services", service.id, "service"],
    ["/products", product.id, "product"],
    ["/packages", pkg.id, "package"],
    ["/membership-plans", plan.id, "membership plan"],
    ["/gift-card-types", giftType.id, "gift card type"],
    ["/staff", staff.id, "staff"],
  ] as Array<[string, number, string]>) {
    const cleanupResponse = await fetch(`${baseUrl}/api${path}/${id}`, { method: "DELETE", headers: { cookie } });
    const expectedCleanupStatus = label === "membership plan" ? 200 : 204;
    if (cleanupResponse.status !== expectedCleanupStatus) throw new Error(`${label} cleanup: expected ${expectedCleanupStatus}, got ${cleanupResponse.status}: ${await cleanupResponse.text()}`);
  }

  await expectStatus(fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie } }), 200, "logout");
  console.log("Stage 1 salon-core smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
