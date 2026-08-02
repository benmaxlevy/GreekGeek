import { z } from 'zod';
import { TicketSaleStatusSchema } from './ticketing';

export const EventSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  type: z.string(),
  maxHeadcount: z.number().int(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  location: z.string().nullable(),
  ticketingEnabled: z.boolean(),
  ticketCapacity: z.number().int().positive().nullable(),
  ticketSaleStatus: TicketSaleStatusSchema.nullable(),
  ticketSalesOpenAt: z.string().datetime().nullable(),
  ticketSalesCloseAt: z.string().datetime().nullable(),
  heldAt: z.string().datetime().nullable(),
  heldByUserId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = z
  .object({
    organizationId: z.string().min(1),
    name: z.string().min(1).max(200),
    type: z.string().min(1).max(100),
    maxHeadcount: z.number().int().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    location: z.string().min(1).max(300).nullable().optional(),
  })
  .refine(
    (value) =>
      value.endsAt === undefined ||
      value.endsAt === null ||
      new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime(),
    { path: ['endsAt'], message: 'endsAt must be on or after startsAt' },
  );
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    type: z.string().min(1).max(100).optional(),
    maxHeadcount: z.number().int().min(1).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    location: z.string().min(1).max(300).nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.type !== undefined ||
      v.maxHeadcount !== undefined ||
      v.startsAt !== undefined ||
      v.endsAt !== undefined ||
      v.location !== undefined,
    { message: 'At least one field is required' },
  )
  .refine(
    (value) =>
      value.endsAt === undefined ||
      value.endsAt === null ||
      new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime(),
    { path: ['endsAt'], message: 'endsAt must be on or after startsAt' },
  );
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

export const ListEventsQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  /** When true, only events with ticketingEnabled. */
  ticketingEnabled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

export const EventListSchema = z.array(EventSchema);
export type EventList = z.infer<typeof EventListSchema>;

/** On-sale event the caller can buy, with the allocation checkout/claim should use. */
export const ClaimableEventSchema = EventSchema.extend({
  allocationId: z.string(),
  priceCents: z.number().int().min(0).nullable(),
});
export type ClaimableEvent = z.infer<typeof ClaimableEventSchema>;

export const ClaimableEventListSchema = z.array(ClaimableEventSchema);
export type ClaimableEventList = z.infer<typeof ClaimableEventListSchema>;
