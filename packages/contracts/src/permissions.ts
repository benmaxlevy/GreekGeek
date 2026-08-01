import { z } from 'zod';

export const PermissionSchema = z.object({
  id: z.string(),
  key: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const PermissionListSchema = z.array(PermissionSchema);
export type PermissionList = z.infer<typeof PermissionListSchema>;

export const MemberPermissionSchema = z.object({
  id: z.string(),
  membershipId: z.string(),
  permissionId: z.string(),
  permissionKey: z.string(),
  createdAt: z.string().datetime(),
});
export type MemberPermission = z.infer<typeof MemberPermissionSchema>;

export const GrantPermissionSchema = z.object({
  permissionKey: z.string().min(1),
});
export type GrantPermission = z.infer<typeof GrantPermissionSchema>;

export const MemberPermissionListSchema = z.array(MemberPermissionSchema);
export type MemberPermissionList = z.infer<typeof MemberPermissionListSchema>;
