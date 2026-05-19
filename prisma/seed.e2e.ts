import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
