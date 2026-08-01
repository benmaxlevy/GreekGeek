import {
  AssignMembershipSchema,
  MembershipListSchema,
  MembershipSchema,
  type AssignMembership,
  type Membership,
  type MembershipList,
} from '@rally/contracts';

export {
  AssignMembershipSchema,
  MembershipListSchema,
  MembershipSchema,
};

export type { AssignMembership, Membership, MembershipList };

export function toMembershipDto(row: {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}): Membership {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
