import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Seeding salon data…");

  // ─── STAFF ────────────────────────────────────────────────────────────────
  const staffData = [
    { name: "Shobha Sharma", email: "shobha@layalalzahra.com", phone: "+971 50 111 2222", role: "stylist" as const, specialization: "Hairstyling, Blow Dry", color: "#E91E63", commissionRate: "8", targetMonthly: "8000", isActive: true },
    { name: "Do Thi Hong", email: "do.hong@layalalzahra.com", phone: "+971 50 333 4444", role: "stylist" as const, specialization: "Nail Art, Gel Nails, Gelish", color: "#9C27B0", commissionRate: "8", targetMonthly: "6000", isActive: true },
    { name: "Hoang Huong Ly", email: "hoang.ly@layalalzahra.com", phone: "+971 50 555 6666", role: "stylist" as const, specialization: "Nail Technician, Gel Nails, Refill", color: "#2196F3", commissionRate: "8", targetMonthly: "6000", isActive: true },
    { name: "Manjusha Rajan", email: "manjusha@layalalzahra.com", phone: "+971 50 777 8888", role: "stylist" as const, specialization: "Hairstyling, Eyebrow Tinting, Threading", color: "#FF5722", commissionRate: "8", targetMonthly: "7000", isActive: true },
    { name: "Pramika Bhujel", email: "pramika@layalalzahra.com", phone: "+971 50 999 0000", role: "therapist" as const, specialization: "Massage Therapy, Foot Massage", color: "#4CAF50", commissionRate: "8", targetMonthly: "5000", isActive: true },
  ];

  const hash = await bcrypt.hash("staff123", 10);
  const createdStaff: { id: number; name: string }[] = [];

  for (const s of staffData) {
    const existing = await db.select().from(schema.staffTable).where(eq(schema.staffTable.email, s.email));
    if (existing.length > 0) {
      console.log(`  ⏭  Staff already exists: ${s.name}`);
      createdStaff.push({ id: existing[0].id, name: existing[0].name });
      continue;
    }
    const [inserted] = await db.insert(schema.staffTable).values({ ...s, passwordHash: hash }).returning();
    createdStaff.push({ id: inserted.id, name: inserted.name });
    console.log(`  ✅ Staff: ${s.name}`);
  }

  // ─── WORKING HOURS (Mon–Sat) ───────────────────────────────────────────────
  for (const staff of createdStaff) {
    const existing = await db.select().from(schema.workingHoursTable).where(eq(schema.workingHoursTable.staffId, staff.id));
    if (existing.length > 0) { console.log(`  ⏭  Schedule exists: ${staff.name}`); continue; }

    const days = [
      { dayOfWeek: 1, isWorking: true, startTime: "10:00", endTime: "20:00" },
      { dayOfWeek: 2, isWorking: true, startTime: "10:00", endTime: "20:00" },
      { dayOfWeek: 3, isWorking: true, startTime: "10:00", endTime: "20:00" },
      { dayOfWeek: 4, isWorking: true, startTime: "10:00", endTime: "20:00" },
      { dayOfWeek: 5, isWorking: true, startTime: "10:00", endTime: "20:00" },
      { dayOfWeek: 6, isWorking: true, startTime: "10:00", endTime: "18:00" },
    ];
    await db.insert(schema.workingHoursTable).values(days.map((d) => ({ ...d, staffId: staff.id })));
    console.log(`  ✅ Schedule: ${staff.name}`);
  }

  // ─── SERVICE CATEGORIES ───────────────────────────────────────────────────
  const categories = [
    { name: "Hair Treatments", color: "#E91E63", order: 1 },
    { name: "Gel Nails", color: "#9C27B0", order: 2 },
    { name: "Gelish", color: "#673AB7", order: 3 },
    { name: "Tinting & Threading", color: "#FF5722", order: 4 },
    { name: "Massage Services", color: "#4CAF50", order: 5 },
    { name: "Hair Removal", color: "#FF9800", order: 6 },
  ];

  const catMap: Record<string, number> = {};
  for (const cat of categories) {
    const existing = await db.select().from(schema.serviceCategoriesTable).where(eq(schema.serviceCategoriesTable.name, cat.name));
    if (existing.length > 0) {
      catMap[cat.name] = existing[0].id;
      console.log(`  ⏭  Category exists: ${cat.name}`);
      continue;
    }
    const [inserted] = await db.insert(schema.serviceCategoriesTable).values({ name: cat.name, color: cat.color, sortOrder: cat.order }).returning();
    catMap[cat.name] = inserted.id;
    console.log(`  ✅ Category: ${cat.name}`);
  }

  // ─── SERVICES ─────────────────────────────────────────────────────────────
  const services = [
    // Hair
    { name: "Blow Dry", category: "Hair Treatments", duration: 45, price: "80" },
    { name: "Hair Wash & Blow Dry", category: "Hair Treatments", duration: 60, price: "100" },
    { name: "Hair Cut & Blow Dry", category: "Hair Treatments", duration: 75, price: "120" },
    // Gel Nails
    { name: "Gel Nails", category: "Gel Nails", duration: 60, price: "150" },
    { name: "Gel Nails Refill", category: "Gel Nails", duration: 45, price: "100" },
    { name: "Gel Nails Removal", category: "Gel Nails", duration: 30, price: "60" },
    // Gelish
    { name: "Gelish Manicure", category: "Gelish", duration: 60, price: "120" },
    { name: "Gelish Pedicure", category: "Gelish", duration: 75, price: "140" },
    // Tinting & Threading
    { name: "Eyebrow Threading", category: "Tinting & Threading", duration: 15, price: "25" },
    { name: "Eyebrow Tinting", category: "Tinting & Threading", duration: 20, price: "35" },
    { name: "Eyebrow Threading & Tinting", category: "Tinting & Threading", duration: 30, price: "55" },
    { name: "Upper Lip Threading", category: "Tinting & Threading", duration: 10, price: "15" },
    // Massage
    { name: "Foot Massage", category: "Massage Services", duration: 60, price: "120" },
    { name: "Full Body Massage 60 min", category: "Massage Services", duration: 60, price: "250" },
    { name: "Full Body Massage 90 min", category: "Massage Services", duration: 90, price: "350" },
    // Hair Removal
    { name: "Nose Wax", category: "Hair Removal", duration: 10, price: "30" },
    { name: "Eyebrow Wax", category: "Hair Removal", duration: 15, price: "35" },
    { name: "Upper Lip Wax", category: "Hair Removal", duration: 10, price: "25" },
  ];

  for (const svc of services) {
    const existing = await db.select().from(schema.servicesTable).where(eq(schema.servicesTable.name, svc.name));
    if (existing.length > 0) { console.log(`  ⏭  Service exists: ${svc.name}`); continue; }
    const catId = catMap[svc.category];
    if (!catId) { console.log(`  ⚠️  Category not found: ${svc.category}`); continue; }
    await db.insert(schema.servicesTable).values({ name: svc.name, categoryId: catId, duration: svc.duration, price: svc.price, isActive: true });
    console.log(`  ✅ Service: ${svc.name}`);
  }

  console.log("\n🎉 Seed complete!");
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
