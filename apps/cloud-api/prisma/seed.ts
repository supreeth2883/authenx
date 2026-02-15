import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: 'admin@authenx.io', password: 'Admin@2026', role: UserRole.SUPER_ADMIN },
  { email: 'college@cvr.edu', password: 'College@2026', role: UserRole.COLLEGE_ADMIN },
  { email: 'hr@acme.com', password: 'Employer@2026', role: UserRole.EMPLOYER },
];

async function main() {
  console.log('🌱 Seeding users…');

  for (const u of SEED_USERS) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) {
      console.log(`  ⏭  ${u.email} (${u.role}) already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.create({
      data: { email: u.email, passwordHash, role: u.role },
    });
    console.log(`  ✅ ${u.email} (${u.role}) created`);
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
