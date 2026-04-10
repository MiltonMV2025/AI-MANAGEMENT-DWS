import { CheckCircle2 } from "lucide-react";

type SimpleToastProps = {
  open: boolean;
  message: string;
};

export function SimpleToast({ open, message }: SimpleToastProps): React.JSX.Element {
  if (!open) return <></>;

  return (
    <div className="fixed bottom-5 right-5 z-[60] rounded-lg border bg-card px-4 py-3 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        {message}
      </p>
    </div>
  );
}