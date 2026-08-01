import { z } from 'zod';

export const MembershipSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const AssignMembershipSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
});
export type AssignMembership = z.infer<typeof AssignMembershipSchema>;

export const MembershipListSchema = z.array(MembershipSchema);
export type MembershipList = z.infer<typeof MembershipListSchema>;
