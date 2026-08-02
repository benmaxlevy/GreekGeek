import type { Event } from '@rally/contracts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardState } from './types';
import { ToggleSwitch } from './ToggleSwitch';

type Props = {
  event: Event | null | undefined;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
};

export function EnableStep({ event, state, onChange }: Props) {
  const maxHeadcount = event?.maxHeadcount;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ToggleSwitch
        id="wizard-ticketing-enabled"
        label="Enable ticketing"
        checked={state.ticketingEnabled}
        onCheckedChange={(checked) => onChange({ ticketingEnabled: checked })}
        className="sm:col-span-2"
      />

      {state.ticketingEnabled ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="wizard-capacity">
              Ticket capacity
              {maxHeadcount ? ` (event max ${maxHeadcount})` : ''}
            </Label>
            <Input
              id="wizard-capacity"
              type="number"
              min={1}
              max={maxHeadcount}
              value={state.capacity > 0 ? String(state.capacity) : ''}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onChange({
                  capacity: Number.isFinite(parsed) ? parsed : 0,
                });
              }}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-sales-open">Sales open (optional)</Label>
            <Input
              id="wizard-sales-open"
              type="datetime-local"
              value={state.salesOpenAt}
              onChange={(e) => onChange({ salesOpenAt: e.target.value })}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-sales-close">Sales close (optional)</Label>
            <Input
              id="wizard-sales-close"
              type="datetime-local"
              value={state.salesCloseAt}
              onChange={(e) => onChange({ salesCloseAt: e.target.value })}
              className="min-h-11"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function validateEnableStep(
  state: WizardState,
  maxHeadcount: number | null | undefined,
): string | null {
  if (!state.ticketingEnabled) {
    return 'Enable ticketing to continue.';
  }
  if (!Number.isInteger(state.capacity) || state.capacity < 1) {
    return 'Enter a positive ticket capacity.';
  }
  if (maxHeadcount != null && state.capacity > maxHeadcount) {
    return `Capacity cannot exceed event max headcount (${maxHeadcount}).`;
  }
  return null;
}
