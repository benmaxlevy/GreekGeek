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
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateUniversitySchema,
  UniversityListSchema,
  UniversitySchema,
  UpdateUniversitySchema,
  type CreateUniversity,
  type University,
  type UniversityList,
  type UpdateUniversity,
} from './types/universities.dto';
import { UniversitiesService } from './universities.service';

@Controller('universities')
@Roles('ADMIN')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  async list(): Promise<UniversityList> {
    return UniversityListSchema.parse(await this.universitiesService.list());
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<University> {
    return UniversitySchema.parse(await this.universitiesService.get(id));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateUniversitySchema)) body: CreateUniversity,
  ): Promise<University> {
    return UniversitySchema.parse(await this.universitiesService.create(body));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUniversitySchema)) body: UpdateUniversity,
  ): Promise<University> {
    return UniversitySchema.parse(await this.universitiesService.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.universitiesService.remove(id);
  }
}
