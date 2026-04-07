import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "mohsin@chaiwiala.co.uk";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "chaiiwala2026!";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Mohsin Gandhi";

const defaultSettings = {
  addressLine1: "90 Freemens Common Road",
  addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
  website: "www.chaiiwala.co.uk",
  logoUrl: "",
  badgeUrl: "",
};

async function main() {
  console.log("Seeding database...\n");

  await prisma.globalSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...defaultSettings },
  });
  console.log("\u2713 Global settings ensured");

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: ADMIN_EMAIL.toLowerCase() },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.adminUser.create({
      data: {
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        name: ADMIN_NAME,
        role: "admin",
      },
    });
    console.log(`\u2713 Admin user created: ${ADMIN_EMAIL}`);
  } else {
    console.log(`\u2713 Admin user already exists: ${ADMIN_EMAIL}`);
  }

  console.log("\nDone. Add senders via the admin UI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
