import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_dev_password@localhost:5432/ohm_sweet_ohm?schema=public";

let bossInstance: PgBoss | null = null;

export async function getPgBoss(): Promise<PgBoss> {
  if (bossInstance) {
    return bossInstance;
  }

  const boss = new PgBoss(connectionString);
  await boss.start();
  bossInstance = boss;
  return boss;
}
