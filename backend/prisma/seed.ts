import bcrypt from 'bcryptjs';
import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const username = process.env.ADMIN_USERNAME || 'hr';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Admin user '${username}' already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const admin = await prisma.adminUser.create({
    data: { username, passwordHash, role: 'HR' },
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded admin user: id=${admin.id} username=${admin.username}`);

  // Default allowed networks if none configured
  const count = await prisma.allowedNetwork.count();
  if (count === 0) {
    await prisma.allowedNetwork.createMany({
      data: [
        { networkName: 'Localhost', publicIpOrCidr: '127.0.0.1', isActive: true },
        { networkName: 'IPv6 Loopback', publicIpOrCidr: '::1', isActive: true },
      ],
    });
    // eslint-disable-next-line no-console
    console.log('Seeded default allowed networks.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });