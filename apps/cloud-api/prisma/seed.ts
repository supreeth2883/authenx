import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: 'admin@authenx.io', password: 'Admin@2026', role: UserRole.SUPER_ADMIN, issuerCode: null as string | null },
  { email: 'college@cvr.edu', password: 'College@2026', role: UserRole.COLLEGE_ADMIN, issuerCode: 'CVR' as string | null },
  { email: 'hr@acme.com', password: 'Employer@2026', role: UserRole.EMPLOYER, issuerCode: null as string | null },
];

async function main() {
  console.log('🌱 Seeding users…');

  for (const u of SEED_USERS) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) {
      // Ensure issuerCode is set for existing users
      if (u.issuerCode && exists.issuerCode !== u.issuerCode) {
        await prisma.user.update({ where: { email: u.email }, data: { issuerCode: u.issuerCode } });
        console.log(`  🔄 ${u.email} issuerCode updated to ${u.issuerCode}`);
      } else {
        console.log(`  ⏭  ${u.email} (${u.role}) already exists`);
      }
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.create({
      data: { email: u.email, passwordHash, role: u.role, issuerCode: u.issuerCode },
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
