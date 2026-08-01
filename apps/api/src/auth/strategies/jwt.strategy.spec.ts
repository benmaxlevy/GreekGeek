import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const authService = {
    getPublicUserById: jest.fn(),
  } as unknown as AuthService;

  const config = {
    get: jest.fn().mockReturnValue('test-jwt-secret-min-16-chars'),
  } as unknown as ConfigService;

  const strategy = new JwtStrategy(config as never, authService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing bearer payload fields', async () => {
    await expect(strategy.validate({ sub: '', email: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects payload when user no longer exists', async () => {
    (authService.getPublicUserById as jest.Mock).mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'missing', email: 'gone@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the public user for a valid payload', async () => {
    const user = {
      id: 'user_1',
      email: 'user@example.com',
      name: 'User',
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      requestedOrganizationId: null,
    };
    (authService.getPublicUserById as jest.Mock).mockResolvedValue(user);
    await expect(strategy.validate({ sub: 'user_1', email: 'user@example.com' })).resolves.toEqual(
      user,
    );
  });
});
