import { CreateEventSchema, EventSchema, UpdateEventSchema } from '@greekgeek/contracts';

describe('event date contracts', () => {
  const base = {
    organizationId: 'org_1',
    name: 'Formal',
    type: 'social',
    maxHeadcount: 100,
    startsAt: '2026-08-10T18:00:00.000Z',
  };

  it('requires startsAt on create and update', () => {
    expect(CreateEventSchema.safeParse({ ...base, startsAt: undefined }).success).toBe(false);
    expect(UpdateEventSchema.safeParse({ name: 'Updated' }).success).toBe(false);
  });

  it('accepts nullable endsAt and rejects an earlier end', () => {
    expect(CreateEventSchema.safeParse({ ...base, endsAt: null }).success).toBe(true);
    expect(
      CreateEventSchema.safeParse({
        ...base,
        endsAt: '2026-08-09T18:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('requires dates in event responses', () => {
    const result = EventSchema.safeParse({
      id: 'event_1',
      ...base,
      endsAt: null,
      location: null,
      ticketingEnabled: false,
      ticketCapacity: null,
      ticketSaleStatus: null,
      ticketSalesOpenAt: null,
      ticketSalesCloseAt: null,
      heldAt: null,
      heldByUserId: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});
