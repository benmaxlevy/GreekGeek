import type { TicketCheckInErrorCode } from '@greekgeek/contracts';

export type ScannerResultState =
  | 'idle'
  | 'success'
  | 'already_in'
  | 'unpaid'
  | 'void'
  | 'invalid'
  | 'at_capacity'
  | 'forbidden'
  | 'error';

export function scannerStateFromErrorCode(
  code: TicketCheckInErrorCode,
): Exclude<ScannerResultState, 'idle' | 'success' | 'error'> {
  switch (code) {
    case 'TICKET_ALREADY_CHECKED_IN':
      return 'already_in';
    case 'TICKET_UNPAID':
      return 'unpaid';
    case 'TICKET_VOID':
      return 'void';
    case 'TICKET_NOT_FOUND':
      return 'invalid';
    case 'EVENT_AT_CAPACITY':
      return 'at_capacity';
    case 'FORBIDDEN':
      return 'forbidden';
  }
}

export class TicketCheckInError extends Error {
  readonly code: TicketCheckInErrorCode;

  constructor(code: TicketCheckInErrorCode, message: string) {
    super(message);
    this.name = 'TicketCheckInError';
    this.code = code;
  }
}
