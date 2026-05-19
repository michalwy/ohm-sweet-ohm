import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed e2e data.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.part.deleteMany();

  await prisma.part.createMany({
    data: [
      {
        catalogNumber: "NE555P",
        manufacturerName: "Texas Instruments"
      },
      {
        catalogNumber: "1N4148W",
        manufacturerName: "Diodes Incorporated"
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
