import { loadStripe, type Stripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

/** Shared Stripe.js promise for Elements; missing key rejects. */
export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) {
    return Promise.reject(
      new Error('VITE_STRIPE_PUBLISHABLE_KEY is not configured'),
    );
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
