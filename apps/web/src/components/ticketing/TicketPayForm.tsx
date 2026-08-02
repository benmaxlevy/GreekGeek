import { useState, type FormEvent } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

type Props = {
  amountCents: number;
  onSuccess: () => void;
};

export function TicketPayForm({ amountCents, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || processing) return;

    setProcessing(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed');
      setProcessing(false);
      return;
    }

    onSuccess();
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-5 rounded-[var(--radius-md)] border border-border-subtle bg-white/[0.025] p-4"
    >
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elements || processing}
        isLoading={processing}
      >
        {processing ? (
          'Processing…'
        ) : (
          <>
            Pay <span className="num">${(amountCents / 100).toFixed(2)}</span>
          </>
        )}
      </Button>
    </form>
  );
}
