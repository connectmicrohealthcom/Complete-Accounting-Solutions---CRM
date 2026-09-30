import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
  const [pkg] = await db.insert(packagesTable).values(pkgData).returning();

  if (services?.length) {
    await db.insert(packageServicesTable).values(services.map((s) => ({ packageId: pkg.id, serviceId: s.serviceId, quantity: s.quantity })));
  }

  res.status(201).json(await buildPackageResponse(pkg));
});

router.patch("/packages/:id", async (req, res): Promise<void> => {
  const params = UpdatePackageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePackageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [pkg] = await db.update(packagesTable).set(parsed.data).where(eq(packagesTable.id, params.data.id)).returning();
  if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildPackageResponse(pkg));
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
