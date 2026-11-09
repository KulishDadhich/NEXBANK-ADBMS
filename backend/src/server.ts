import "dotenv/config";
import { app, logger } from "./app.js";
import { jwtSecret } from "./services/auth.js";
import { pool } from "./database/pool.js";
import { prisma } from "./repositories/users.js";
jwtSecret();
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const server = app.listen(Number(process.env.PORT || 4000), "0.0.0.0", () =>
  logger.info("NEXBANK API started"),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await pool.end();
    await prisma.$disconnect();
    process.exit(0);
  }),
);
