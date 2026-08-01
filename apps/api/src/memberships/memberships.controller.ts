import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MembershipsService } from './memberships.service';
import {
  AssignMembershipSchema,
  MembershipListSchema,
  MembershipSchema,
  type AssignMembership,
  type Membership,
  type MembershipList,
} from './types/memberships.dto';

@Controller('memberships')
@Roles('ADMIN')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(): Promise<MembershipList> {
    return MembershipListSchema.parse(await this.membershipsService.list());
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Membership> {
    return MembershipSchema.parse(await this.membershipsService.get(id));
  }

  @Post()
  async assign(
    @Body(new ZodValidationPipe(AssignMembershipSchema)) body: AssignMembership,
  ): Promise<Membership> {
    return MembershipSchema.parse(await this.membershipsService.assign(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.membershipsService.remove(id);
  }
}
