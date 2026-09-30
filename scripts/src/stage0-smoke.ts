import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5001";
const email = process.env.SMOKE_EMAIL ?? "stage0-admin@completeaccounting.test";
const password = process.env.SMOKE_PASSWORD ?? "";
if (!password) throw new Error("SMOKE_PASSWORD not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function expectStatus(response: Response | Promise<Response>, expected: number, label: string) {
  const actual = await response;
  if (actual.status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual.status}: ${await actual.text()}`);
  }
  return actual;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO staff (name, email, password_hash, role, is_active)
     VALUES ('Stage 0 Admin', $1, $2, 'admin', true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true`,
    [email, passwordHash],
  );

  await expectStatus(fetch(`${baseUrl}/api/healthz`), 200, "health");
  await expectStatus(fetch(`${baseUrl}/api/clients`), 401, "unauthenticated API access");

  const login = await expectStatus(
    fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    200,
    "login",
  );

  const setCookie = login.headers.get("set-cookie");
  if (!setCookie) throw new Error("login did not return a session cookie");
  const cookie = setCookie.split(";")[0];

  const me = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } }),
    200,
    "auth/me",
  ));
  if (me.email !== email || me.role !== "admin") {
    throw new Error("auth/me returned unexpected user");
  }

  const autoGroups = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/clients/groups/auto`, { headers: { cookie } }),
    200,
    "auto client groups",
  ));
  if (!Array.isArray(autoGroups) || autoGroups.length !== 12) {
    throw new Error("expected 12 built-in client groups");
  }

  const customGroup = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/clients/groups/custom`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Stage 0 Smoke Group",
        logic: "AND",
        rules: [{ field: "total_spend", operator: "gt", value: 0 }],
      }),
    }),
    201,
    "custom client group create",
  ));

  await expectStatus(
    fetch(`${baseUrl}/api/clients/groups/custom/${customGroup.id}/count`, { headers: { cookie } }),
    200,
    "custom client group count",
  );

  await expectStatus(
    fetch(`${baseUrl}/api/clients/groups/custom/${customGroup.id}`, {
      method: "DELETE",
      headers: { cookie },
    }),
    204,
    "custom client group delete",
  );

  for (const path of [
    "/finance/payment-breakdown",
    "/finance/reports/pnl",
    "/finance/reports/trial-balance",
    "/finance/reports/balance-sheet",
  ]) {
    await expectStatus(
      fetch(`${baseUrl}/api${path}`, { headers: { cookie } }),
      200,
      `finance endpoint ${path}`,
    );
  }

  const client = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Stage 0 Smoke Client" }),
    }),
    201,
    "client create",
  ));

  const service = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/services`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Stage 0 Smoke Service", duration: 30, price: 10 }),
    }),
    201,
    "service create",
  ));

  const product = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Stage 0 Smoke Product", price: 5 }),
    }),
    201,
    "product create",
  ));

  const pkg = await readJson(await expectStatus(
    fetch(`${baseUrl}/api/packages`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Stage 0 Smoke Package", price: 20, validityDays: 30 }),
    }),
    201,
    "package create",
  ));

  for (const [path, id, label] of [
    ["/clients", client.id, "client"],
    ["/services", service.id, "service"],
    ["/products", product.id, "product"],
  ] as Array<[string, number, string]>) {
    await expectStatus(fetch(`${baseUrl}/api${path}/${id}`, {
      method: "DELETE",
      headers: { cookie },
    }), 204, `${label} delete`);
  }

  await expectStatus(
    fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie } }),
    200,
    "logout",
  );
  await expectStatus(fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } }), 401, "logged-out session");

  console.log("Stage 0 smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
