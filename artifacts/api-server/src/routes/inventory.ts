import { Router, type IRouter } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  DeleteProductParams,
  AdjustStockParams,
  AdjustStockBody,
  ListProductsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: Number(p.price),
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    isLowStock: p.stockQuantity <= p.lowStockThreshold,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);

  let q = db.select().from(productsTable).$dynamic();

  if (query.data?.search) {
    q = q.where(ilike(productsTable.name, `%${query.data.search}%`)) as any;
  }

  const products = await (q as any).orderBy(productsTable.name);
  let result = products.map(formatProduct);

  if (query.data?.lowStock) {
    result = result.filter((p: any) => p.isLowStock);
  }

  res.json(result);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    costPrice: parsed.data.costPrice == null ? null : String(parsed.data.costPrice),
    price: String(parsed.data.price),
  }).returning();
  res.status(201).json(formatProduct(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { costPrice, price, ...rest } = parsed.data;
  const [product] = await db.update(productsTable).set({
    ...rest,
    ...(costPrice !== undefined ? { costPrice: costPrice == null ? null : String(costPrice) } : {}),
    ...(price !== undefined ? { price: String(price) } : {}),
  }).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/products/:id/stock", async (req, res): Promise<void> => {
  const params = AdjustStockParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdjustStockBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const newQty = Math.max(0, existing.stockQuantity + parsed.data.adjustment);
  const [product] = await db.update(productsTable).set({ stockQuantity: newQty }).where(eq(productsTable.id, params.data.id)).returning();
  res.json(formatProduct(product));
});

export default router;
