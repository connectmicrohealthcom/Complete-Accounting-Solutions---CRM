import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const hash = await bcrypt.hash("admin123", 10);

await pool.query(
  `INSERT INTO staff (name, email, password_hash, role, is_active)
   VALUES ('Admin', 'admin@layalalzahra.com', $1, 'admin', true)
   ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
  [hash],
);

console.log("Admin user seeded: admin@layalalzahra.com / admin123");
await pool.end();
