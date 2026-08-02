import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

function makeConfig(): ConfigService<Env, true> {
  return {
    get: (key: string) => {
      if (key === 'REDIS_URL') {
        return 'redis://localhost:6379';
      }
      return undefined;
    },
  } as unknown as ConfigService<Env, true>;
}

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    service = new HealthService(
      prisma as unknown as PrismaService,
      makeConfig(),
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('reports ok when database and redis are up', async () => {
    const redis = (
      service as unknown as {
        redis: {
          status: string;
          connect: jest.Mock;
          ping: jest.Mock;
        };
      }
    ).redis;
    Object.defineProperty(redis, 'status', { value: 'ready', configurable: true });
    redis.ping = jest.fn().mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.database).toBe('up');
    expect(result.redis).toBe('up');
    expect(result.status).toBe('ok');
  });

  it('reports degraded when redis is down', async () => {
    const redis = (
      service as unknown as {
        redis: {
          status: string;
          connect: jest.Mock;
          ping: jest.Mock;
        };
      }
    ).redis;
    Object.defineProperty(redis, 'status', { value: 'wait', configurable: true });
    redis.connect = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.check();

    expect(result.database).toBe('up');
    expect(result.redis).toBe('down');
    expect(result.status).toBe('degraded');
  });

  it('reports degraded when database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    const redis = (
      service as unknown as {
        redis: {
          status: string;
          ping: jest.Mock;
        };
      }
    ).redis;
    Object.defineProperty(redis, 'status', { value: 'ready', configurable: true });
    redis.ping = jest.fn().mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.database).toBe('down');
    expect(result.redis).toBe('up');
    expect(result.status).toBe('degraded');
  });
});
