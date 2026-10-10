"use client";

import { type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertCircle, CheckCircle2, HelpCircle, Send } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "primary" | "success" | "danger" | "send";
  isLoading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  tone = "primary",
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const iconByTone = {
    primary: <HelpCircle className="h-7 w-7 text-roxo" />,
    success: <CheckCircle2 className="h-7 w-7 text-emerald-600" />,
    danger: <AlertCircle className="h-7 w-7 text-rose-600" />,
    send: <Send className="h-7 w-7 text-roxo" />,
  }[tone];

  const iconBgByTone = {
    primary: "bg-roxo-50 border-roxo-100",
    success: "bg-emerald-50 border-emerald-100",
    danger: "bg-rose-50 border-rose-100",
    send: "bg-roxo-50 border-roxo-100",
  }[tone];

  return (
    <Modal open={open} onClose={onClose} maxWidth="md" showCloseButton={!isLoading}>
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl border ${iconBgByTone}`}
        >
          {iconByTone}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-black">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{description}</p>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {cancelText}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? "Processando..." : confirmText}
        </Button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
