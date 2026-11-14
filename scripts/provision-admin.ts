import "../apps/api/src/env";
import { PrismaClient } from "@prisma/client";
import { hash } from "../apps/api/src/password";
import { passwordSchema } from "../apps/api/src/service";
const db = new PrismaClient();
async function main() {
  const email = process.env.PROVISION_ADMIN_EMAIL?.toLowerCase();
  const password = passwordSchema.parse(process.env.PROVISION_ADMIN_PASSWORD);
  if (!email || !email.includes("@")) throw Error("Set PROVISION_ADMIN_EMAIL");
  if (await db.user.findUnique({ where: { email } }))
    throw Error(
      "This administrator already exists; existing credentials were preserved",
    );
  await db.user.create({
    data: {
      email,
      name: process.env.PROVISION_ADMIN_NAME || "Platform Administrator",
      passwordHash: await hash(password),
      role: "PLATFORM_ADMIN",
      mustChangePassword: true,
    },
  });
  console.log(
    "Administrator provisioned. Password must be replaced at first login.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
