import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used inside <Dialog>.");
  }
  return context;
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function Dialog({ open, onOpenChange, children }: DialogProps): React.JSX.Element {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(({ className, children, ...props }, ref) => {
  const { open, onOpenChange } = useDialogContext();
  if (!open) return <></>;

  if (typeof document === "undefined") return <></>;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex h-dvh w-screen items-center justify-center bg-slate-950/60 backdrop-blur-[1.5px]">
      <div
        ref={ref}
        className={cn("relative grid w-full max-w-lg gap-4 rounded-lg border bg-card p-6 shadow-lg", className)}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        {children}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>,
    document.body
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
);
DialogDescription.displayName = "DialogDescription";

type DialogCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function DialogClose({ className, ...props }: DialogCloseProps): React.JSX.Element {
  const { onOpenChange } = useDialogContext();
  return <button type="button" className={className} onClick={() => onOpenChange(false)} {...props} />;
}

function DialogTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return <button type="button" {...props} />;
}

function DialogOverlay(): React.JSX.Element {
  return <></>;
}

function DialogPortal({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
