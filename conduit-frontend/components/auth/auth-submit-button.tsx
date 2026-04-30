type AuthSubmitButtonProps = {
  submitting: boolean;
  idleLabel: string;
  busyLabel: string;
};

export function AuthSubmitButton({ submitting, idleLabel, busyLabel }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-2xl bg-[#122038] px-5 py-3.5 text-sm font-semibold text-[#f8f7f2] transition-all hover:bg-[#0f6f61] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {submitting ? busyLabel : idleLabel}
    </button>
  );
}