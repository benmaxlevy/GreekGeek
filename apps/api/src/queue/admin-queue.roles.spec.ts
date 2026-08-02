import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { PublicUser } from '../auth/types/auth.dto';

function mockContext(user?: PublicUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('Admin queue prove endpoint roles', () => {
  const rolesGuard = new RolesGuard({
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) {
        return ['ADMIN'];
      }
      return undefined;
    },
  } as unknown as Reflector);

  const adminUser: PublicUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    requestedOrganizationId: null,
    membership: null,
    permissions: [],
  };

  const memberUser: PublicUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'USER',
    status: 'ACTIVE',
    requestedOrganizationId: null,
    membership: null,
    permissions: [],
  };

  it('allows ADMIN to pass RolesGuard for prove enqueue', () => {
    expect(rolesGuard.canActivate(mockContext(adminUser))).toBe(true);
  });

  it('rejects non-ADMIN with 403 for prove enqueue', () => {
    expect(() => rolesGuard.canActivate(mockContext(memberUser))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects unauthenticated caller with 403', () => {
    expect(() => rolesGuard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
