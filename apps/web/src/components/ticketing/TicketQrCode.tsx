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
    <img
      src={dataUrl}
      alt="Ticket QR code"
      width={size}
      height={size}
      className="rounded-md border border-border-subtle bg-white p-2"
    />
  );
}
