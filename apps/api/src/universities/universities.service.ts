import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toUniversityDto,
  type CreateUniversity,
  type University,
  type UpdateUniversity,
} from './types/universities.dto';

@Injectable()
export class UniversitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<University[]> {
    const rows = await this.prisma.university.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toUniversityDto);
  }

  async get(id: string): Promise<University> {
    const row = await this.prisma.university.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('University not found');
    }
    return toUniversityDto(row);
  }

  async create(input: CreateUniversity): Promise<University> {
    const row = await this.prisma.university.create({
      data: { name: input.name },
    });
    return toUniversityDto(row);
  }

  async update(id: string, input: UpdateUniversity): Promise<University> {
    await this.get(id);
    const row = await this.prisma.university.update({
      where: { id },
      data: { name: input.name },
    });
    return toUniversityDto(row);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    const orgCount = await this.prisma.organization.count({
      where: { universityId: id },
    });
    if (orgCount > 0) {
      throw new ConflictException(
        'Cannot delete university with existing organizations',
      );
    }
    await this.prisma.university.delete({ where: { id } });
  }
}
