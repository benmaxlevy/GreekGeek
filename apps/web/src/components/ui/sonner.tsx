import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast surface-glass-panel !rounded-lg group-[.toaster]:text-ink-100 group-[.toaster]:border-border-strong",
          title: "group-[.toast]:text-ink-100",
          description: "group-[.toast]:text-ink-300",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:hover:bg-white/85 group-[.toast]:focus-visible:ring-2 group-[.toast]:focus-visible:ring-white/50",
          cancelButton:
            "group-[.toast]:bg-surface-raised group-[.toast]:text-ink-100 group-[.toast]:hover:bg-white/10",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-ink-300 group-[.toast]:border-border-subtle group-[.toast]:hover:bg-white/10",
          success: "group-[.toaster]:text-ink-100",
          error: "group-[.toaster]:text-[color:var(--status-overdue)]",
          warning: "group-[.toaster]:text-ink-300",
          info: "group-[.toaster]:text-ink-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
