import { z } from 'zod';

export const TicketSaleStatusSchema = z.enum(['draft', 'on_sale', 'closed']);
export type TicketSaleStatus = z.infer<typeof TicketSaleStatusSchema>;

export const AllocationStatusSchema = z.enum(['active', 'closed']);
export type AllocationStatus = z.infer<typeof AllocationStatusSchema>;

export const TicketStatusSchema = z.enum(['unpaid', 'paid', 'void']);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const EventTicketingSchema = z.object({
  eventId: z.string(),
  ticketingEnabled: z.boolean(),
  ticketCapacity: z.number().int().positive().nullable(),
  ticketSaleStatus: TicketSaleStatusSchema.nullable(),
  ticketSalesOpenAt: z.string().datetime().nullable(),
  ticketSalesCloseAt: z.string().datetime().nullable(),
});
export type EventTicketing = z.infer<typeof EventTicketingSchema>;

export const PatchEventTicketingSchema = z
  .object({
    ticketingEnabled: z.boolean().optional(),
    ticketCapacity: z.number().int().positive().nullable().optional(),
    ticketSaleStatus: TicketSaleStatusSchema.nullable().optional(),
    ticketSalesOpenAt: z.string().datetime().nullable().optional(),
    ticketSalesCloseAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (v) =>
      v.ticketingEnabled !== undefined ||
      v.ticketCapacity !== undefined ||
      v.ticketSaleStatus !== undefined ||
      v.ticketSalesOpenAt !== undefined ||
      v.ticketSalesCloseAt !== undefined,
    { message: 'At least one field is required' },
  );
export type PatchEventTicketing = z.infer<typeof PatchEventTicketingSchema>;

export const TicketAllocationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().min(0).nullable(),
  status: AllocationStatusSchema,
  issuedCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TicketAllocation = z.infer<typeof TicketAllocationSchema>;

export const TicketAllocationListSchema = z.array(TicketAllocationSchema);
export type TicketAllocationList = z.infer<typeof TicketAllocationListSchema>;

export const CreateTicketAllocationSchema = z
  .object({
    organizationId: z.string().min(1).nullable().optional(),
    allOrgs: z.boolean().optional(),
    quantity: z.number().int().positive(),
    priceCents: z.number().int().min(0).optional(),
  })
  .refine(
    (v) => {
      const hasOrg = v.organizationId !== undefined;
      const hasAllOrgs = v.allOrgs === true;
      if (hasAllOrgs && hasOrg) return false;
      if (!hasAllOrgs && !hasOrg) return false;
      return true;
    },
    {
      message:
        'Provide organizationId (or null for public) or set allOrgs to true',
    },
  );
export type CreateTicketAllocation = z.infer<typeof CreateTicketAllocationSchema>;

export const UpdateTicketAllocationSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    priceCents: z.number().int().min(0).nullable().optional(),
    status: AllocationStatusSchema.optional(),
  })
  .refine(
    (v) =>
      v.quantity !== undefined ||
      v.priceCents !== undefined ||
      v.status !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateTicketAllocation = z.infer<typeof UpdateTicketAllocationSchema>;

export const TicketSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  allocationId: z.string(),
  organizationId: z.string().nullable(),
  status: TicketStatusSchema,
  credentialToken: z.string(),
  holderUserId: z.string().nullable(),
  purchaseId: z.string().nullable(),
  paidAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  checkedIn: z.boolean(),
  checkedInAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const TicketListSchema = z.array(TicketSchema);
export type TicketList = z.infer<typeof TicketListSchema>;

export const IssueTicketSchema = z.object({
  holderUserId: z.string().min(1).optional(),
});
export type IssueTicket = z.infer<typeof IssueTicketSchema>;

export const ListTicketsQuerySchema = z.object({
  allocationId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  status: TicketStatusSchema.optional(),
});
export type ListTicketsQuery = z.infer<typeof ListTicketsQuerySchema>;

export const GuestListEntrySchema = z.object({
  id: z.string(),
  holderUserId: z.string().nullable(),
  holderName: z.string().nullable(),
  allocationLabel: z.string(),
  purchaseId: z.string().nullable(),
  status: z.literal('paid'),
  paidAt: z.string().datetime(),
  checkedIn: z.boolean(),
  checkedInAt: z.string().datetime().nullable(),
});
export type GuestListEntry = z.infer<typeof GuestListEntrySchema>;

export const GuestListSchema = z.array(GuestListEntrySchema);
export type GuestList = z.infer<typeof GuestListSchema>;

export const MyTicketSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  allocationId: z.string(),
  organizationId: z.string().nullable(),
  allocationLabel: z.string(),
  purchaseId: z.string().nullable(),
  status: TicketStatusSchema,
  credentialToken: z.string(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type MyTicket = z.infer<typeof MyTicketSchema>;

export const MyTicketListSchema = z.array(MyTicketSchema);
export type MyTicketList = z.infer<typeof MyTicketListSchema>;

export const PublicClaimResponseSchema = TicketSchema;
export type PublicClaimResponse = z.infer<typeof PublicClaimResponseSchema>;

export const CheckInTicketSchema = z.object({
  credentialToken: z.string().min(1),
});
export type CheckInTicket = z.infer<typeof CheckInTicketSchema>;

export const CheckInTicketResponseSchema = z.object({
  ticketId: z.string(),
  eventId: z.string(),
  organizationId: z.string().nullable(),
  holderUserId: z.string().nullable(),
  checkedInAt: z.string().datetime(),
});
export type CheckInTicketResponse = z.infer<typeof CheckInTicketResponseSchema>;

export const TicketCheckInErrorCodeSchema = z.enum([
  'TICKET_NOT_FOUND',
  'TICKET_UNPAID',
  'TICKET_VOID',
  'TICKET_ALREADY_CHECKED_IN',
  'EVENT_AT_CAPACITY',
  'FORBIDDEN',
]);
export type TicketCheckInErrorCode = z.infer<typeof TicketCheckInErrorCodeSchema>;

/** Paid allocation / on_sale blocked until host org Stripe Connect charges enabled. */
export const TicketSaleGateErrorCodeSchema = z.enum(['CONNECT_REQUIRED']);
export type TicketSaleGateErrorCode = z.infer<typeof TicketSaleGateErrorCodeSchema>;
