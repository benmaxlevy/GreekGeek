import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: (config) => envSchema.parse(config),
});
