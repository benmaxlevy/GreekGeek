import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  OrganizationListSchema,
  OrganizationSchema,
  UpdateOrganizationSchema,
  type CreateOrganization,
  type ListOrganizationsQuery,
  type Organization,
  type OrganizationList,
  type UpdateOrganization,
} from './types/organizations.dto';

@Controller('organizations')
@Roles('ADMIN')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListOrganizationsQuerySchema))
    query: ListOrganizationsQuery,
  ): Promise<OrganizationList> {
    return OrganizationListSchema.parse(
      await this.organizationsService.list(query),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Organization> {
    return OrganizationSchema.parse(await this.organizationsService.get(id));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateOrganizationSchema))
    body: CreateOrganization,
  ): Promise<Organization> {
    return OrganizationSchema.parse(
      await this.organizationsService.create(body),
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrganizationSchema))
    body: UpdateOrganization,
  ): Promise<Organization> {
    return OrganizationSchema.parse(
      await this.organizationsService.update(id, body),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.organizationsService.remove(id);
  }
}
