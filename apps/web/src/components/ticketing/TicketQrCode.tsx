import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Props = {
  credentialToken: string;
  size?: number;
};

export function TicketQrCode({ credentialToken, size = 200 }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);

    QRCode.toDataURL(credentialToken, { width: size, margin: 2 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError('Could not render QR code.');
      });

    return () => {
      cancelled = true;
    };
  }, [credentialToken, size]);

  if (error) {
    return <p className="text-sm text-[color:var(--error)]">{error}</p>;
  }

  if (!dataUrl) {
    return <p className="text-sm text-ink-500">Loading QR…</p>;
  }

  return (
    <div className="inline-flex rounded-[var(--radius-lg)] border border-white/[0.16] bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <img
        src={dataUrl}
        alt="Ticket QR code"
        width={size}
        height={size}
        className="rounded-md border border-border-subtle bg-white p-2"
      />
    </div>
  );
}
