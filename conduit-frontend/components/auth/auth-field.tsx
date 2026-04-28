import Link from "next/link";
import { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  trailingContent?: ReactNode;
  error?: string;
};

export function AuthField({
  label,
  id,
  trailingContent,
  error,
  className = "",
  ...inputProps
}: AuthFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label
          className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/55"
          htmlFor={id}
        >
          {label}
        </label>
        {trailingContent ? <div>{trailingContent}</div> : null}
      </div>
      <input
        id={id}
        className={`w-full rounded-2xl border transition outline-none placeholder:text-[#122038]/30 focus:bg-white px-4 py-3.5 text-[#122038] ${
          error
            ? "border-rose-300 bg-rose-50 focus:border-rose-400"
            : "border-[#122038]/10 bg-white focus:border-[#122038]/25"
        } ${className}`}
        {...inputProps}
      />
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

type AuthLinkProps = {
  href: string;
  label: string;
};

export function AuthInlineLink({ href, label }: AuthLinkProps) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/45 transition hover:text-[#122038]"
    >
      {label}
    </Link>
  );
}