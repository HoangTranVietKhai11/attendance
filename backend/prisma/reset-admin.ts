import bcrypt from 'bcryptjs';
import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';

/**
 * Đặt lại mật khẩu một tài khoản quản trị (dùng khi quên mật khẩu).
 *
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='...' npx tsx prisma/reset-admin.ts
 *
 * Khác với seed.ts: luôn ghi đè mật khẩu của tài khoản đang tồn tại.
 */
async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Cần đặt ADMIN_USERNAME và ADMIN_PASSWORD trước khi chạy.');
  }
  if (password.length < 8) {
    throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (!existing) {
    throw new Error(`Không tìm thấy tài khoản '${username}'.`);
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  await prisma.adminUser.update({ where: { username }, data: { passwordHash } });

  // eslint-disable-next-line no-console
  console.log(`Đã đặt lại mật khẩu cho tài khoản '${username}'.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
