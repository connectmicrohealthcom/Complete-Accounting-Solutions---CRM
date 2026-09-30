import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, packagesTable, packageServicesTable, servicesTable, clientsTable, clientPackagesTable, clientPackageUsageTable } from "@workspace/db";
import {
  CreatePackageBody,
  UpdatePackageBody,
  UpdatePackageParams,
  GetClientLoyaltyParams,
  RedeemPointsParams,
  RedeemPointsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PurchasePackageBody = z.object({
  clientId: z.number().int(),
  packageId: z.number().int(),
  purchaseDate: z.string().optional(),
});

const UsePackageBody = z.object({
  serviceId: z.number().int(),
});

async function buildPackageResponse(pkg: typeof packagesTable.$inferSelect) {
  const packageServices = await db
    .select({ serviceId: packageServicesTable.serviceId, serviceName: servicesTable.name, quantity: packageServicesTable.quantity })
    .from(packageServicesTable)
    .leftJoin(servicesTable, eq(packageServicesTable.serviceId, servicesTable.id))
    .where(eq(packageServicesTable.packageId, pkg.id));

  return {
    ...pkg,
    price: Number(pkg.price),
    createdAt: pkg.createdAt.toISOString(),
    services: packageServices.map((ps) => ({
      serviceId: ps.serviceId,
      serviceName: ps.serviceName ?? "Unknown",
      quantity: ps.quantity,
    })),
  };
}

router.get("/packages", async (_req, res): Promise<void> => {
  const packages = await db.select().from(packagesTable).orderBy(packagesTable.name);
  const result = await Promise.all(packages.map(buildPackageResponse));
  res.json(result);
});

router.post("/packages", async (req, res): Promise<void> => {
  const parsed = CreatePackageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { services, ...pkgData } = parsed.data;
  const [pkg] = await db.insert(packagesTable).values({
    ...pkgData,
    price: String(pkgData.price),
  }).returning();

  if (services?.length) {
    await db.insert(packageServicesTable).values(services.map((s) => ({ packageId: pkg.id, serviceId: s.serviceId, quantity: s.quantity })));
  }

  res.status(201).json(await buildPackageResponse(pkg));
});

router.delete("/packages/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [pkg] = await db.select({ id: packagesTable.id }).from(packagesTable).where(eq(packagesTable.id, id));
  if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(packagesTable).where(eq(packagesTable.id, id));
  res.sendStatus(204);
});

router.patch("/packages/:id", async (req, res): Promise<void> => {
  const params = UpdatePackageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePackageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { price, ...rest } = parsed.data;
  const [pkg] = await db.update(packagesTable).set({
    ...rest,
    ...(price !== undefined ? { price: String(price) } : {}),
  }).where(eq(packagesTable.id, params.data.id)).returning();
  if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildPackageResponse(pkg));
});

router.post("/client-packages", async (req, res): Promise<void> => {
  const parsed = PurchasePackageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, parsed.data.clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  const [pkg] = await db.select().from(packagesTable).where(eq(packagesTable.id, parsed.data.packageId));
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
  if (!pkg.isActive) { res.status(409).json({ error: "Package is inactive" }); return; }

  const purchasedAt = parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : new Date();
  if (Number.isNaN(purchasedAt.getTime())) { res.status(400).json({ error: "Invalid purchaseDate" }); return; }
  const expiry = new Date(purchasedAt);
  expiry.setDate(expiry.getDate() + pkg.validityDays);

  const [clientPackage] = await db.insert(clientPackagesTable).values({
    clientId: client.id,
    packageId: pkg.id,
    purchasedAt,
    expiryDate: expiry.toISOString().split("T")[0],
  }).returning();

  if (pkg.loyaltyPointsBonus > 0) {
    await db.update(clientsTable).set({ loyaltyPoints: client.loyaltyPoints + pkg.loyaltyPointsBonus }).where(eq(clientsTable.id, client.id));
  }

  res.status(201).json({
    ...clientPackage,
    packageName: pkg.name,
    price: Number(pkg.price),
    loyaltyPointsBonus: pkg.loyaltyPointsBonus,
  });
});

router.get("/clients/:id/packages", async (req, res): Promise<void> => {
  const clientId = Number(req.params.id);
  if (!Number.isInteger(clientId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select()
    .from(clientPackagesTable)
    .leftJoin(packagesTable, eq(clientPackagesTable.packageId, packagesTable.id))
    .where(eq(clientPackagesTable.clientId, clientId))
    .orderBy(desc(clientPackagesTable.purchasedAt));
  res.json(rows.map(row => ({
    id: row.client_packages.id,
    packageId: row.client_packages.packageId,
    packageName: row.packages?.name ?? "Unknown",
    purchasedAt: row.client_packages.purchasedAt.toISOString(),
    expiryDate: row.client_packages.expiryDate,
    status: row.client_packages.expiryDate < new Date().toISOString().split("T")[0] ? "expired" : "active",
  })));
});

router.post("/client-packages/:id/use", async (req, res): Promise<void> => {
  const clientPackageId = Number(req.params.id);
  if (!Number.isInteger(clientPackageId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UsePackageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cp] = await db.select().from(clientPackagesTable).where(eq(clientPackagesTable.id, clientPackageId));
  if (!cp) { res.status(404).json({ error: "Client package not found" }); return; }
  if (cp.expiryDate < new Date().toISOString().split("T")[0]) { res.status(409).json({ error: "Package is expired" }); return; }

  const [included] = await db.select().from(packageServicesTable)
    .where(and(eq(packageServicesTable.packageId, cp.packageId), eq(packageServicesTable.serviceId, parsed.data.serviceId)));
  if (!included) { res.status(400).json({ error: "Service is not included in this package" }); return; }

  const used = await db.select().from(clientPackageUsageTable)
    .where(and(eq(clientPackageUsageTable.clientPackageId, clientPackageId), eq(clientPackageUsageTable.serviceId, parsed.data.serviceId)));
  if (used.length >= included.quantity) { res.status(409).json({ error: "No remaining uses for this service" }); return; }

  await db.insert(clientPackageUsageTable).values({
    clientPackageId,
    serviceId: parsed.data.serviceId,
  });
  res.json({ success: true, remaining: included.quantity - used.length - 1 });
});

router.get("/clients/:id/loyalty", async (req, res): Promise<void> => {
  const params = GetClientLoyaltyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const clientPackages = await db
    .select()
    .from(clientPackagesTable)
    .leftJoin(packagesTable, eq(clientPackagesTable.packageId, packagesTable.id))
    .where(eq(clientPackagesTable.clientId, params.data.id));

  const activePackages = await Promise.all(
    clientPackages.map(async (cp) => {
      const pkg = cp.packages;
      if (!pkg) return null;

      const pkgServices = await db
        .select({ serviceId: packageServicesTable.serviceId, serviceName: servicesTable.name, quantity: packageServicesTable.quantity })
        .from(packageServicesTable)
        .leftJoin(servicesTable, eq(packageServicesTable.serviceId, servicesTable.id))
        .where(eq(packageServicesTable.packageId, pkg.id));

      const usageRows = await db
        .select()
        .from(clientPackageUsageTable)
        .where(eq(clientPackageUsageTable.clientPackageId, cp.client_packages.id));

      const usageByService: Record<number, number> = {};
      for (const u of usageRows) {
        usageByService[u.serviceId] = (usageByService[u.serviceId] ?? 0) + 1;
      }

      return {
        packageId: pkg.id,
        packageName: pkg.name,
        expiryDate: cp.client_packages.expiryDate,
        remainingServices: pkgServices.map((ps) => ({
          serviceId: ps.serviceId!,
          serviceName: ps.serviceName ?? "Unknown",
          remaining: ps.quantity - (usageByService[ps.serviceId!] ?? 0),
        })),
      };
    })
  );

  res.json({
    clientId: params.data.id,
    points: client.loyaltyPoints,
    activePackages: activePackages.filter(Boolean),
  });
});

router.post("/clients/:id/loyalty/redeem", async (req, res): Promise<void> => {
  const params = RedeemPointsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = RedeemPointsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const newPoints = Math.max(0, client.loyaltyPoints - parsed.data.points);
  await db.update(clientsTable).set({ loyaltyPoints: newPoints }).where(eq(clientsTable.id, params.data.id));

  res.json({ clientId: params.data.id, points: newPoints, activePackages: [] });
});

export default router;
