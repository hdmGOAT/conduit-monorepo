type ConfirmModalProps = {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  eyebrow = "Confirm action",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isSubmitting = false,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#122038]/45 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#122038]/14 bg-[#f8f7f2] p-6 shadow-[0_24px_64px_rgba(18,32,56,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/55">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-[#122038]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#122038]/68">
          {description}
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full border border-[#122038]/12 bg-white px-4 py-2 text-sm font-semibold text-[#122038] transition hover:bg-[#eef1ec] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-full bg-[#122038] px-4 py-2 text-sm font-semibold text-[#f8f7f2] transition hover:bg-[#0b1f4b] disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
