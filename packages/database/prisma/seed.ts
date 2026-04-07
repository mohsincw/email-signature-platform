import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed data from UK M365 user list (exported 3 Apr 2026).
 * Only real people — shared/location mailboxes excluded.
 * Job titles and phone numbers to be filled in via admin UI.
 */
interface SeedSender {
  name: string;
  email: string;
  title?: string;
  phone?: string;
  phone2?: string;
}

const senders: SeedSender[] = [
  // ── Leadership (confirmed from signature screenshots) ──────────────
  { name: "muhummed ibrahim", email: "muhummed@chaiiwala.co.uk", title: "CEO & Co-Founder", phone: "+44 (0) 7725 416 738" },
  { name: "abdul piranie", email: "apiranie@chaiiwala.co.uk", title: "CFO & Co-Founder", phone: "+44 (0) 7900 937 378" },
  { name: "mustafa ismail", email: "mustafa@chaiiwala.co.uk", title: "COO & Co-Founder", phone: "+44 (0) 7837 704 347" },
  { name: "sohail ali", email: "sohail@chaiiwala.co.uk", title: "CCO & Co-Founder", phone: "+44 (0) 7568 569 870", phone2: "+44 (0) 1162 966 705" },
  { name: "mohsin gandhi", email: "mohsin@chaiiwala.co.uk", title: "Chief of Staff", phone: "+44 (0) 7988 151 756" },
  { name: "ben clayton", email: "Ben.clayton@chaiiwala.co.uk", title: "Chief Operating Officer", phone: "+44 (0) 7751 711 921" },

  // ── Staff (confirmed from signature screenshots) ───────────────────
  { name: "georgina reynolds", email: "georgina@chaiiwala.co.uk", title: "Financial Analyst", phone: "+44 (0) 7983 625 151" },
  { name: "jitin topiwala", email: "jitin@chaiiwala.co.uk", title: "Marketing Director", phone: "+44 (0) 7989 605 163" },
  { name: "ben robinson", email: "ben@chaiiwala.co.uk", title: "Marketing Executive", phone: "+44 (0) 7398 840 817" },
  { name: "urvashi meghji", email: "urvashi@chaiiwala.co.uk", title: "Junior Designer", phone: "+44 (0) 7968 674 201" },
  { name: "shaukat patel", email: "sp@chaiiwala.co.uk", title: "Design Lead", phone: "+44 (0) 7492 978 487" },
  { name: "usman khalid", email: "usman@chaiiwala.co.uk", title: "Design Manager", phone: "+44 (0) 7462 912 331" },
  { name: "musadiq jivraj", email: "muz@chaiiwala.co.uk", title: "Director of Procurement EMEA & North America", phone: "+44 (0) 7971 403741" },
  { name: "kaloyan simeonov", email: "Kaloyan@chaiiwala.co.uk", title: "Franchise Business Coach", phone: "+44 (0) 7743 942 413" },
  { name: "nabeel akhtar", email: "Nabeel@chaiiwala.co.uk", title: "Brand Excellence Manager", phone: "+44 (0) 7742 076 074" },

  // ── Remaining staff (title & phone to be filled via admin UI) ──────
  { name: "Abdeldjallil Kadid", email: "abdeldjallil@chaiiwala.co.uk" },
  { name: "Abdul Kadri", email: "abdul@chaiiwala.co.uk" },
  { name: "Abdul Noor", email: "anoor@chaiiwala.co.uk" },
  { name: "Abdul Polli", email: "polli@chaiiwala.co.uk" },
  { name: "Abu Bakar", email: "abubakar@chaiiwala.co.uk" },
  { name: "Ajaz Khan Mahmad", email: "Ajaz@chaiiwala.co.uk" },
  { name: "Alwaleed Alqasim", email: "alwaleed@chaiiwala.co.uk" },
  { name: "Amirah Zaman", email: "Amirah@chaiiwala.co.uk" },
  { name: "Arif Master", email: "a.master@chaiiwala.co.uk" },
  { name: "Arshad Ibrahim", email: "Arshad@chaiiwala.co.uk" },
  { name: "Asiya Sacranie", email: "asiya@chaiiwala.co.uk" },
  { name: "Awais Tahir", email: "awais.tahir@chaiiwala.co.uk" },
  { name: "Bryan Fish", email: "bryan@chaiiwala.co.uk" },
  { name: "Cedric Mukolonga", email: "Cedric@chaiiwala.co.uk" },
  { name: "Chengaz Hassan", email: "Chengaz@chaiiwala.co.uk" },
  { name: "David Roome", email: "david.roome@chaiiwala.co.uk" },
  { name: "Hassan", email: "Hassan@chaiiwala.co.uk" },
  { name: "Hussein Saleh", email: "hussein.saleh@chaiiwala.co.uk" },
  { name: "Ian Saunders", email: "ian@chaiiwala.co.uk" },
  { name: "Islam Hussein", email: "ih@chaiiwala.co.uk" },
  { name: "James Weaver", email: "james@chaiiwala.co.uk" },
  { name: "Josh Baker", email: "Josh@chaiiwala.co.uk" },
  { name: "Juber Saiyad", email: "JuberSaiyad@chaiiwala.co.uk" },
  { name: "Keerthana Chandar", email: "keerthana@chaiiwala.co.uk" },
  { name: "Mayur Babu", email: "mayur@chaiiwala.co.uk" },
  { name: "Mike Bostock", email: "mike@chaiiwala.co.uk" },
  { name: "Nadia Altairy", email: "nadia@chaiiwala.co.uk" },
  { name: "Nahima Begum", email: "nahima@chaiiwala.co.uk" },
  { name: "Narinder Gill", email: "narinder@chaiiwala.co.uk" },
  { name: "Nazibur Rahman", email: "nazibur@chaiiwala.co.uk" },
  { name: "Ninoska Gracias", email: "Ninoska@chaiiwala.co.uk" },
  { name: "Rabia Kalsoom", email: "Rabia@chaiiwala.co.uk" },
  { name: "Rambabu Challa", email: "rambabu@chaiiwala.co.uk" },
  { name: "Rashidat Ismailah", email: "Rashidat@chaiiwala.co.uk" },
  { name: "Riqtar Khan", email: "riqtar@chaiiwala.co.uk" },
  { name: "Saheema Ismail", email: "saheema@chaiiwala.co.uk" },
  { name: "Saitej Bollapally", email: "saitej@chaiiwala.co.uk" },
  { name: "Samir Nabipurwala", email: "samir@chaiiwala.co.uk" },
  { name: "Saurabh Grover", email: "Saurabh@chaiiwala.co.uk" },
  { name: "Shahidraza Rokadiya", email: "shahidraza@chaiiwala.co.uk" },
  { name: "Sharza Khan", email: "sharza@chaiiwala.co.uk" },
  { name: "Simon Hooper", email: "simon@chaiiwala.co.uk" },
  { name: "Tariq Altairy", email: "t.altairy@chaiiwala.co.uk" },
  { name: "Umaymah Mathia", email: "u.mathia@chaiiwala.co.uk" },
  { name: "Vijay Bolgam", email: "v.bolgam@chaiiwala.co.uk" },
  { name: "Yakub Master", email: "y.master@chaiiwala.co.uk" },
  { name: "Yasin Khalifa", email: "yasin@chaiiwala.co.uk" },
  { name: "Yasmeen Mateen", email: "Yasmeen@chaiiwala.co.uk" },
  { name: "Yunus Piranie", email: "yp@chaiiwala.co.uk" },
];

const defaultSettings = {
  addressLine1: "90 Freemens Common Road",
  addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
  website: "www.chaiiwala.co.uk",
  logoUrl: "", // TODO: Upload chaiiwala logo to S3 and set URL here
  badgeUrl: "", // TODO: Upload 5-star franchisee badge to S3 and set URL here
};

async function main() {
  console.log("Seeding database...\n");

  // Upsert global settings with Chaiiwala defaults
  await prisma.globalSettings.upsert({
    where: { id: "singleton" },
    update: defaultSettings,
    create: { id: "singleton", ...defaultSettings },
  });
  console.log("✓ Global settings seeded (address, website)");

  // Upsert senders (safe to re-run — skips existing)
  let created = 0;
  let skipped = 0;

  for (const sender of senders) {
    const existing = await prisma.sender.findUnique({
      where: { email: sender.email },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.sender.create({
      data: {
        email: sender.email,
        name: sender.name,
        title: sender.title ?? null,
        phone: sender.phone ?? null,
        phone2: sender.phone2 ?? null,
        enabled: true,
      },
    });
    created++;
  }

  console.log(`✓ Senders: ${created} created, ${skipped} already existed`);
  console.log(`  Total in seed list: ${senders.length}`);

  // Seed default admin user
  const adminEmail = "nazibur@chaiiwala.co.uk";
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("chaiiwala2024", 12);
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: "Nazibur Rahman",
        role: "admin",
      },
    });
    console.log(`✓ Admin user created: ${adminEmail} / chaiiwala2024`);
    console.log("  ⚠ Change this password immediately after first login!");
  } else {
    console.log("✓ Admin user already exists");
  }

  console.log("\nDone. Fill in job titles and phone numbers via the admin UI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
