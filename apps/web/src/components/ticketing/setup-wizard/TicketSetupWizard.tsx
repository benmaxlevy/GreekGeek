import { useState } from 'react';
import type { Event, Organization } from '@greekgeek/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAllocation, patchEventTicketing } from '@/lib/ticketing-api';
import { AllocateStep, validateAllocateStep } from './AllocateStep';
import { EnableStep, validateEnableStep } from './EnableStep';
import { PriceStep, validatePriceStep } from './PriceStep';
import { VerifyStep } from './VerifyStep';
import {
  fromLocalDatetime,
  toLocalDatetime,
  WIZARD_STEP_LABELS,
  type WizardState,
  type WizardStepIndex,
} from './types';

type Props = {
  eventId: string;
  event: Event | null | undefined;
  organizations: Organization[];
  hostOrgId: string | undefined;
  chargesEnabled: boolean;
  canManageHostPayments: boolean;
  onComplete: () => void;
};

function initialState(event: Event | null | undefined): WizardState {
  return {
    ticketingEnabled: event?.ticketingEnabled ?? false,
    capacity: event?.ticketCapacity ?? 0,
    salesOpenAt: toLocalDatetime(event?.ticketSalesOpenAt ?? null),
    salesCloseAt: toLocalDatetime(event?.ticketSalesCloseAt ?? null),
    pools: [],
  };
}

function stepValidator(
  step: WizardStepIndex,
  state: WizardState,
  maxHeadcount: number | null | undefined,
): string | null {
  if (step === 0) return validateEnableStep(state, maxHeadcount);
  if (step === 1) return validateAllocateStep(state);
  if (step === 2) return validatePriceStep(state);
  return null;
}

export function TicketSetupWizard({
  eventId,
  event,
  organizations,
  hostOrgId,
  chargesEnabled,
  canManageHostPayments,
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStepIndex>(0);
  const [state, setState] = useState<WizardState>(() => initialState(event));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function patchState(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    const validationError = stepValidator(step, state, event?.maxHeadcount);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (step < 3) {
      setStep((prev) => (prev + 1) as WizardStepIndex);
    }
  }

  function goBack() {
    setError(null);
    if (step > 0) {
      setStep((prev) => (prev - 1) as WizardStepIndex);
    }
  }

  async function finalize(saleStatus: 'draft' | 'on_sale') {
    const validationError = stepValidator(1, state, event?.maxHeadcount);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await patchEventTicketing(eventId, {
        ticketingEnabled: true,
        ticketCapacity: state.capacity,
        ticketSaleStatus: 'draft',
        ticketSalesOpenAt: fromLocalDatetime(state.salesOpenAt),
        ticketSalesCloseAt: fromLocalDatetime(state.salesCloseAt),
      });

      for (const pool of state.pools) {
        if (pool.quantity <= 0) continue;
        const priceCents = pool.priceUsd.trim()
          ? Math.round(Number(pool.priceUsd) * 100)
          : undefined;
        await createAllocation(eventId, {
          organizationId: pool.organizationId,
          quantity: pool.quantity,
          priceCents,
        });
      }

      if (saleStatus === 'on_sale') {
        await patchEventTicketing(eventId, {
          ticketingEnabled: true,
          ticketCapacity: state.capacity,
          ticketSaleStatus: 'on_sale',
          ticketSalesOpenAt: fromLocalDatetime(state.salesOpenAt),
          ticketSalesCloseAt: fromLocalDatetime(state.salesCloseAt),
        });
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const nextDisabled =
    step === 1 && (validateAllocateStep(state) != null || state.pools.length === 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border-subtle pb-5">
        <p className="rl-eyebrow">Guided setup</p>
        <CardTitle className="display-sm font-display mt-2">Ticket setup</CardTitle>
        <ol className="mt-4 flex flex-wrap gap-2">
          {WIZARD_STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                index === step
                  ? 'bg-white text-black'
                  : index < step
                    ? 'bg-surface-raised text-ink-300'
                    : 'border border-border-subtle text-ink-500'
              }`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}

        {step === 0 ? <EnableStep event={event} state={state} onChange={patchState} /> : null}
        {step === 1 ? (
          <AllocateStep organizations={organizations} state={state} onChange={patchState} />
        ) : null}
        {step === 2 ? (
          <PriceStep
            state={state}
            hostOrgId={hostOrgId}
            chargesEnabled={chargesEnabled}
            canManageHostPayments={canManageHostPayments}
            onChange={patchState}
          />
        ) : null}
        {step === 3 ? (
          <VerifyStep
            state={state}
            hostOrgId={hostOrgId}
            chargesEnabled={chargesEnabled}
            canManageHostPayments={canManageHostPayments}
            isSubmitting={isSubmitting}
            onFinalize={finalize}
          />
        ) : null}

        {step < 3 ? (
          <div className="flex flex-wrap gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
            ) : null}
            <Button type="button" onClick={goNext} disabled={nextDisabled}>
              Next
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting}>
            Back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
