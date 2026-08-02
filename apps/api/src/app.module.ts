import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PermissionsModule } from './permissions/permissions.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { UniversitiesModule } from './universities/universities.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    UniversitiesModule,
    OrganizationsModule,
    MembershipsModule,
    PermissionsModule,
    EventsModule,
    TicketsModule,
    WebhooksModule,
  ],
})
export class AppModule {}