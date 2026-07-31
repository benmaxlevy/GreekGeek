import { Controller, Get } from '@nestjs/common';
import { HealthResponseSchema, type HealthResponse } from '@rally/contracts';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const payload = await this.healthService.check();
    return HealthResponseSchema.parse(payload);
  }
}
