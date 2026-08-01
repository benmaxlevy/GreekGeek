import { SetMetadata } from '@nestjs/common';

/** Allow authenticated non-ACTIVE users (status surfaces / auth maintenance). */
export const ALLOW_NON_ACTIVE_KEY = 'allowNonActive';
export const AllowNonActive = () => SetMetadata(ALLOW_NON_ACTIVE_KEY, true);
