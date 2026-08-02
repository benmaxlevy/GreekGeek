import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkInTicket } from '@/lib/ticketing-api';
import {
  TicketCheckInError,
  scannerStateFromErrorCode,
  type ScannerResultState,
} from '@/lib/ticketing/types/check-in';

type Props = {
  eventId: string;
};

const STATE_COPY: Record<
  Exclude<ScannerResultState, 'idle'>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  success: { label: 'Checked in', variant: 'default' },
  already_in: { label: 'Already checked in', variant: 'secondary' },
  unpaid: { label: 'Unpaid ticket', variant: 'destructive' },
  void: { label: 'Void ticket', variant: 'destructive' },
  invalid: { label: 'Invalid ticket', variant: 'destructive' },
  at_capacity: { label: 'Event at capacity', variant: 'destructive' },
  forbidden: { label: 'Not allowed to scan', variant: 'destructive' },
  error: { label: 'Check-in failed', variant: 'destructive' },
};

export function TicketScanner({ eventId }: Props) {
  const queryClient = useQueryClient();
  const regionId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [resultState, setResultState] = useState<ScannerResultState>('idle');
  const [resultDetail, setResultDetail] = useState<string | null>(null);

  const checkInMutation = useMutation({
    mutationFn: (credentialToken: string) => checkInTicket(credentialToken.trim()),
    onSuccess: async (data) => {
      setResultState('success');
      setResultDetail(
        data.holderUserId
          ? `Ticket ${data.ticketId.slice(0, 8)}… checked in.`
          : 'Guest checked in.',
      );
      setPasteValue('');
      await queryClient.invalidateQueries({ queryKey: ['ticketing', 'guests', eventId] });
    },
    onError: (err: Error) => {
      if (err instanceof TicketCheckInError) {
        setResultState(scannerStateFromErrorCode(err.code));
        setResultDetail(err.message);
        return;
      }
      setResultState('error');
      setResultDetail(err.message);
    },
  });

  const submitCredential = useCallback(
    (credentialToken: string) => {
      const trimmed = credentialToken.trim();
      if (!trimmed || checkInMutation.isPending) return;
      setResultState('idle');
      setResultDetail(null);
      checkInMutation.mutate(trimmed);
    },
    [checkInMutation],
  );

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setCameraOn(false);
      setCameraStarting(false);
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore teardown errors
    }
    setCameraOn(false);
    setCameraStarting(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    await stopCamera();
    setCameraStarting(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          void stopCamera();
          submitCredential(decoded);
        },
        () => {
          // scan attempt — no match yet
        },
      );
      setCameraOn(true);
      setCameraStarting(false);
    } catch {
      setCameraError('Camera unavailable. Paste credential below.');
      scannerRef.current = null;
      setCameraOn(false);
      setCameraStarting(false);
    }
  }, [regionId, stopCamera, submitCredential]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const showResult = resultState !== 'idle';
  const resultCopy = showResult ? STATE_COPY[resultState] : null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border-subtle pb-5">
          <p className="rl-eyebrow">Door operations</p>
          <CardTitle className="display-sm font-display mt-2">Scan ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <p className="text-sm text-ink-500">
            Point the camera at a paid ticket QR, or paste the credential token.
          </p>

          {cameraError ? <p className="text-sm text-[color:var(--error)]">{cameraError}</p> : null}

          <div
            id={regionId}
            className={`overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.16] bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${cameraOn || cameraStarting ? 'min-h-[280px]' : 'hidden'} [&_video]:h-full [&_video]:w-full [&_video]:object-cover`}
          />

          <div className="flex flex-wrap gap-2">
            {cameraOn ? (
              <Button type="button" variant="outline" onClick={() => void stopCamera()}>
                Stop camera
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={checkInMutation.isPending || cameraStarting}
                onClick={() => void startCamera()}
              >
                {cameraStarting ? 'Starting camera…' : 'Start camera'}
              </Button>
            )}
          </div>

          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitCredential(pasteValue);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="credential-paste">Credential token</Label>
              <Input
                id="credential-paste"
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="Paste code from QR"
                className="min-h-11 font-mono text-sm"
                autoComplete="off"
              />
            </div>
            <Button type="submit" isLoading={checkInMutation.isPending}>
              Check in
            </Button>
          </form>
        </CardContent>
      </Card>

      {showResult && resultCopy ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Badge variant={resultCopy.variant}>{resultCopy.label}</Badge>
              {resultDetail ? <p className="text-sm text-ink-500">{resultDetail}</p> : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setResultState('idle');
                setResultDetail(null);
              }}
            >
              Scan another
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
