import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@aidraft.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log(`Admin user already exists: ${adminEmail}`);
        return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            passwordHash,
        },
    });

    // Create default project for admin
    await prisma.project.create({
        data: {
            name: "Mi Primer Proyecto",
            ownerId: admin.id,
        },
    });

    console.log(`Created admin user: ${adminEmail}`);
    console.log(`Created default project for admin`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
