import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, GALLERY_NAME } = process.env;
  if (
    !ADMIN_EMAIL ||
    !ADMIN_PASSWORD ||
    ADMIN_PASSWORD.length < 12 ||
    !GALLERY_NAME
  )
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters), and GALLERY_NAME.",
    );
  if (await db.user.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase() } }))
    throw new Error("Account exists; provisioning will not overwrite it.");
  await db.organization.create({
    data: {
      name: GALLERY_NAME,
      demo: false,
      config: { create: {} },
      galleries: { create: { name: GALLERY_NAME } },
      users: {
        create: {
          email: ADMIN_EMAIL.toLowerCase(),
          name: "Gallery administrator",
          role: "ADMIN",
          passwordHash: await hash(ADMIN_PASSWORD, 12),
        },
      },
    },
  });
  console.log(
    "Production organization and administrator provisioned. No sample measurements created.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
