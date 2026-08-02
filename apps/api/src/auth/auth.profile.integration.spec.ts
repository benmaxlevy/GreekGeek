import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { ProfileSummarySchema, UpdateDisplayNameRequestSchema } from '@rally/contracts';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('Profile contracts', () => {
  it('trims and bounds display-name updates while rejecting unknown fields', () => {
    expect(UpdateDisplayNameRequestSchema.parse({ name: '  New Name  ' })).toEqual({
      name: 'New Name',
    });
    expect(() => UpdateDisplayNameRequestSchema.parse({ name: '' })).toThrow();
    expect(() => UpdateDisplayNameRequestSchema.parse({ name: '   ' })).toThrow();
    expect(() => UpdateDisplayNameRequestSchema.parse({ name: 'x'.repeat(121) })).toThrow();
    expect(() =>
      UpdateDisplayNameRequestSchema.parse({ name: 'New Name', email: 'changed@example.com' }),
    ).toThrow();
    expect(() =>
      UpdateDisplayNameRequestSchema.parse({ name: 'New Name', role: 'ADMIN' }),
    ).toThrow();
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)('Profile API integration', () => {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars',
  });
  const auth = new AuthService(prisma as never, passwords, jwt);
  const suffix = Date.now();
  const eventIds: string[] = [];
  const userIds: string[] = [];
  let universityId = '';
  let organizationId = '';

  async function createEvent(name: string, startsAt: Date, location: string | null = null) {
    const event = await prisma.event.create({
      data: {
        organizationId,
        name,
        type: 'Profile Test',
        maxHeadcount: 100,
        startsAt,
        location,
      },
    });
    eventIds.push(event.id);

    const allocation = await prisma.ticketAllocation.create({
      data: {
        eventId: event.id,
        organizationId: null,
        quantity: 10,
      },
    });
    return allocation.id;
  }

  async function createTicket(
    allocationId: string,
    holderUserId: string,
    status: 'unpaid' | 'paid' | 'void',
    credentialToken: string,
  ) {
    return prisma.ticket.create({
      data: {
        allocationId,
        holderUserId,
        status,
        credentialToken,
        ...(status === 'paid' ? { paidAt: new Date() } : {}),
        ...(status === 'void' ? { voidedAt: new Date() } : {}),
      },
    });
  }

  beforeAll(async () => {
    const university = await prisma.university.create({
      data: { name: `Profile Test University ${suffix}` },
    });
    universityId = university.id;

    const organization = await prisma.organization.create({
      data: {
        name: `Profile Test Organization ${suffix}`,
        type: 'FRATERNITY',
        universityId,
      },
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { allocation: { eventId: { in: eventIds } } },
    });
    await prisma.ticketAllocation.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.university.delete({ where: { id: universityId } });
    await prisma.$disconnect();
  });

  it('updates active display name without changing session tokens', async () => {
    const user = await prisma.user.create({
      data: {
        email: `profile-update-${suffix}@example.com`,
        name: 'Before Update',
        passwordHash: await passwords.hash('ProfilePass123!'),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    userIds.push(user.id);

    const session = await auth.login(auth.toPublicUser(user));
    const body = UpdateDisplayNameRequestSchema.parse({ name: '  After Update  ' });
    const updated = await auth.updateDisplayName(auth.toPublicUser(user), body.name);

    expect(updated.name).toBe('After Update');
    expect(session.tokens.accessToken).toBeTruthy();
    expect(
      await prisma.refreshToken.findFirst({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toMatchObject({ tokenHash: auth.hashRefreshToken(session.refreshToken) });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
      name: 'After Update',
    });
  });

  it('returns only caller-owned non-void future ticket summary', async () => {
    const caller = await prisma.user.create({
      data: {
        email: `profile-summary-${suffix}@example.com`,
        name: 'Summary Caller',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        email: `profile-other-${suffix}@example.com`,
        name: 'Other User',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    userIds.push(caller.id, otherUser.id);

    const now = Date.now();
    const earliestAllocationId = await createEvent(
      'Earliest Profile Event',
      new Date(now + 60 * 60 * 1000),
      'Main Hall',
    );
    const laterAllocationId = await createEvent(
      'Later Profile Event',
      new Date(now + 2 * 60 * 60 * 1000),
    );
    const pastAllocationId = await createEvent(
      'Past Profile Event',
      new Date(now - 60 * 60 * 1000),
    );
    const voidAllocationId = await createEvent(
      'Void Profile Event',
      new Date(now + 30 * 60 * 1000),
    );
    const otherAllocationId = await createEvent('Other User Event', new Date(now + 45 * 60 * 1000));

    await createTicket(earliestAllocationId, caller.id, 'paid', `profile-paid-${suffix}`);
    await createTicket(earliestAllocationId, caller.id, 'unpaid', `profile-unpaid-${suffix}`);
    await createTicket(laterAllocationId, caller.id, 'paid', `profile-later-${suffix}`);
    await createTicket(pastAllocationId, caller.id, 'paid', `profile-past-${suffix}`);
    await createTicket(voidAllocationId, caller.id, 'void', `profile-void-${suffix}`);
    await createTicket(otherAllocationId, otherUser.id, 'paid', `profile-other-${suffix}`);

    const summary = ProfileSummarySchema.parse(
      await auth.getProfileSummary(auth.toPublicUser(caller)),
    );

    expect(summary).toEqual({
      ticketCount: 4,
      upcomingEventCount: 2,
      nextEvent: {
        eventId: eventIds[0],
        eventName: 'Earliest Profile Event',
        startsAt: expect.any(String),
        location: 'Main Hall',
        ticketCount: 2,
      },
    });
    expect(JSON.stringify(summary)).not.toContain('credentialToken');
    expect(JSON.stringify(summary)).not.toContain(otherUser.id);
    expect(JSON.stringify(summary)).not.toContain('holderUserId');
  });

  it('returns an empty summary and forbids non-active callers', async () => {
    const noTickets = await prisma.user.create({
      data: {
        email: `profile-empty-${suffix}@example.com`,
        name: 'Empty Summary',
        passwordHash: 'x',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    const pending = await prisma.user.create({
      data: {
        email: `profile-pending-${suffix}@example.com`,
        name: 'Pending Summary',
        passwordHash: 'x',
        role: 'USER',
        status: 'PENDING',
      },
    });
    const inactive = await prisma.user.create({
      data: {
        email: `profile-inactive-${suffix}@example.com`,
        name: 'Inactive Summary',
        passwordHash: 'x',
        role: 'USER',
        status: 'INACTIVE',
      },
    });
    userIds.push(noTickets.id, pending.id, inactive.id);

    await expect(auth.getProfileSummary(auth.toPublicUser(pending))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      auth.updateDisplayName(auth.toPublicUser(inactive), 'Should Not Save'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await auth.getProfileSummary(auth.toPublicUser(noTickets))).toEqual({
      ticketCount: 0,
      upcomingEventCount: 0,
      nextEvent: null,
    });
  });
});
