import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export function Field({ id, label, error, className, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-black">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
        className={cn(
          "min-h-12 rounded-xl border-[1.5px] border-input bg-white px-4 text-base text-black placeholder:text-neutral-800",
          "focus:border-roxo focus:outline-none focus:ring-2 focus:ring-roxo/30",
          error && "border-erro focus:border-erro focus:ring-erro/30",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${id}-erro`} className="text-sm text-black">
          {error}
        </p>
      )}
    </div>
  );
}
