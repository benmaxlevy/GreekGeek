import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('AuthService refresh rotation', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars',
  });
  const auth = new AuthService(prisma as never, passwords, jwt);

  const email = `refresh-${Date.now()}@example.com`;
  let userId = '';

  beforeAll(async () => {
    const passwordHash = await passwords.hash('RefreshTest123!');
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Refresh Tester',
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('rotates refresh tokens and rejects reused/revoked tokens', async () => {
    const first = await auth.login({
      id: userId,
      email,
      name: 'Refresh Tester',
      role: 'USER',
      status: 'ACTIVE',
      requestedOrganizationId: null,
    });

    const rotated = await auth.refresh(first.refreshToken);
    expect(rotated.tokens.accessToken).toBeTruthy();
    expect(rotated.refreshToken).not.toEqual(first.refreshToken);

    await expect(auth.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    await auth.logout(rotated.refreshToken);
    await expect(auth.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired refresh tokens', async () => {
    const session = await auth.login({
      id: userId,
      email,
      name: 'Refresh Tester',
      role: 'USER',
      status: 'ACTIVE',
      requestedOrganizationId: null,
    });
    const tokenHash = auth.hashRefreshToken(session.refreshToken);
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(auth.refresh(session.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
