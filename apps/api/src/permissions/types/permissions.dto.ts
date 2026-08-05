import {
  GrantPermissionSchema,
  MemberPermissionListSchema,
  MemberPermissionSchema,
  PermissionListSchema,
  PermissionSchema,
  type GrantPermission,
  type MemberPermission,
  type MemberPermissionList,
  type Permission,
  type PermissionList,
} from '@greekgeek/contracts';

export {
  GrantPermissionSchema,
  MemberPermissionListSchema,
  MemberPermissionSchema,
  PermissionListSchema,
  PermissionSchema,
};

export type {
  GrantPermission,
  MemberPermission,
  MemberPermissionList,
  Permission,
  PermissionList,
};

export function toPermissionDto(row: {
  id: string;
  key: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}): Permission {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMemberPermissionDto(row: {
  id: string;
  membershipId: string;
  permissionId: string;
  createdAt: Date;
  permission: { key: string };
}): MemberPermission {
  return {
    id: row.id,
    membershipId: row.membershipId,
    permissionId: row.permissionId,
    permissionKey: row.permission.key,
    createdAt: row.createdAt.toISOString(),
  };
}
