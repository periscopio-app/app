"use client";

import React, { useState } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCep, fetchAddressByCep, type ViaCepAddress } from "@/data/viacep";
import { cn } from "@/lib/cn";

export interface CepInputProps {
  value?: string;
  onChange?: (val: string) => void;
  onAddressFound?: (address: ViaCepAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CepInput({
  value = "",
  onChange,
  onAddressFound,
  placeholder = "00000-000",
  className,
  disabled = false,
}: CepInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setInternalValue(formatted);
    onChange?.(formatted);

    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 8) {
      setIsLoading(true);
      setStatus("idle");
      const address = await fetchAddressByCep(clean);
      setIsLoading(false);

      if (address) {
        setStatus("success");
        setStatusMessage(`${address.localidade}/${address.uf}`);
        onAddressFound?.(address);
      } else {
        setStatus("error");
        setStatusMessage("CEP não encontrado");
      }
    } else {
      setStatus("idle");
      setStatusMessage("");
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={9}
          disabled={disabled || isLoading}
          className={cn(
            "w-full rounded-xl border border-linha bg-white/90 px-3.5 py-2.5 pr-10 text-sm text-black placeholder:text-neutral-400",
            "focus:border-roxo focus:outline-none focus:ring-2 focus:ring-roxo/20 transition-all",
            status === "error" && "border-vermelho focus:border-vermelho focus:ring-vermelho/20",
            status === "success" && "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
          )}
        />
        <div className="absolute right-3 text-neutral-400 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-roxo" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 text-vermelho" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
      </div>
      {statusMessage && (
        <p
          className={cn(
            "text-[11px] font-medium flex items-center gap-1",
            status === "success" && "text-emerald-600",
            status === "error" && "text-vermelho"
          )}
        >
          {status === "success" ? `✓ ${statusMessage}` : `⚠️ ${statusMessage}`}
        </p>
      )}
    </div>
  );
}
