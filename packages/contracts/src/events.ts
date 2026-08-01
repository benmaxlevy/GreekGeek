import { z } from 'zod';

export const EventSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  type: z.string(),
  maxHeadcount: z.number().int(),
  location: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  maxHeadcount: z.number().int().min(1),
  location: z.string().min(1).max(300).nullable().optional(),
});
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    type: z.string().min(1).max(100).optional(),
    maxHeadcount: z.number().int().min(1).optional(),
    location: z.string().min(1).max(300).nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.type !== undefined ||
      v.maxHeadcount !== undefined ||
      v.location !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

export const ListEventsQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

export const EventListSchema = z.array(EventSchema);
export type EventList = z.infer<typeof EventListSchema>;
