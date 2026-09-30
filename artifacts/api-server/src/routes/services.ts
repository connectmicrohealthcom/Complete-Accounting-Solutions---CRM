import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, servicesTable, serviceCategoriesTable } from "@workspace/db";
import {
  CreateServiceBody,
  UpdateServiceBody,
  UpdateServiceParams,
  DeleteServiceParams,
  ListServicesQueryParams,
  CreateServiceCategoryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/services", async (req, res): Promise<void> => {
  const query = ListServicesQueryParams.safeParse(req.query);

  const services = await db
    .select({
      id: servicesTable.id,
      name: servicesTable.name,
      description: servicesTable.description,
      categoryId: servicesTable.categoryId,
      categoryName: serviceCategoriesTable.name,
      duration: servicesTable.duration,
      price: servicesTable.price,
      isActive: servicesTable.isActive,
      createdAt: servicesTable.createdAt,
    })
    .from(servicesTable)
    .leftJoin(serviceCategoriesTable, eq(servicesTable.categoryId, serviceCategoriesTable.id))
    .orderBy(servicesTable.name);

  res.json(
    services.map((s) => ({
      ...s,
      price: Number(s.price),
      createdAt: s.createdAt.toISOString(),
    }))
  );
});

router.post("/services", async (req, res): Promise<void> => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [service] = await db.insert(servicesTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
  }).returning();
  res.status(201).json({ ...service, price: Number(service.price), createdAt: service.createdAt.toISOString(), categoryName: null });
});

router.patch("/services/:id", async (req, res): Promise<void> => {
  const params = UpdateServiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateServiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { price, ...rest } = parsed.data;
  const [service] = await db.update(servicesTable).set({
    ...rest,
    ...(price !== undefined ? { price: String(price) } : {}),
  }).where(eq(servicesTable.id, params.data.id)).returning();
  if (!service) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...service, price: Number(service.price), createdAt: service.createdAt.toISOString(), categoryName: null });
});

router.delete("/services/:id", async (req, res): Promise<void> => {
  const params = DeleteServiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(servicesTable).where(eq(servicesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/service-categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(serviceCategoriesTable).orderBy(serviceCategoriesTable.name);
  res.json(categories);
});

router.post("/service-categories", async (req, res): Promise<void> => {
  const parsed = CreateServiceCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cat] = await db.insert(serviceCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
});

export default router;
