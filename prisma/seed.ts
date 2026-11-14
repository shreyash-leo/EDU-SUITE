import "../apps/api/src/env";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "../apps/api/src/password";
const db = new PrismaClient();
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw Error("Development seeding is prohibited in production");
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw Error("Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD");
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing)
    await db.user.create({
      data: {
        email: email.toLowerCase(),
        name: "Platform Administrator",
        role: "PLATFORM_ADMIN",
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        mustChangePassword: true,
      },
    });
  if (process.env.DEV_SEED_SAMPLE_DATA === "true") {
    const o = await db.organization.upsert({
      where: { email: "admin@springwood-demo.example" },
      create: {
        name: "Springwood Education Trust — Demo",
        legalName: "Springwood Education Trust",
        type: "Education trust",
        email: "admin@springwood-demo.example",
        contactName: "Aarav Deshmukh",
        phone: "9999900001",
        address: "12 Learning Avenue",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
        status: "DRAFT",
      },
      update: {},
    });
    for (const sample of [
      {
        name: "Springwood Academy — Demo",
        registration: "DEMO-SW-001",
        boards: ["CBSE", "ICSE"],
      },
      {
        name: "Riverdale School — Demo",
        registration: "DEMO-RD-002",
        boards: ["IB"],
      },
    ])
      await db.institution.upsert({
        where: {
          organizationId_registration: {
            organizationId: o.id,
            registration: sample.registration,
          },
        },
        create: {
          ...sample,
          organizationId: o.id,
          address: "Pune, Maharashtra",
          officer: "Meera Patil",
          email: "office@springwood-demo.example",
          phone: "9999900002",
        },
        update: {},
      });
  }
  console.log(
    "Development administrator and requested fictional drafts provisioned. Existing credentials were not modified.",
  );
}
seed()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
