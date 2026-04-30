import { Button } from './button'

type UpgradePromptModalProps = {
  open: boolean
  title: string
  message: string
  detail: string
  groupId: string
  returnTo?: string
  ctaLabel?: string
  onClose: () => void
}

export default function UpgradePromptModal({
  open,
  title,
  message,
  detail,
  groupId,
  returnTo,
  ctaLabel = 'Upgrade group',
  onClose,
}: UpgradePromptModalProps) {
  if (!open) return null

  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close upgrade prompt"
        className="absolute inset-0 bg-[#122038]/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-[#122038]/14 bg-[#f8f7f2] p-6 shadow-[0_24px_64px_rgba(18,32,56,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/55">Subscription policy</p>
        <h3 className="mt-3 text-2xl font-semibold text-[#122038]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#122038]/68">{message}</p>
        <p className="mt-2 rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink/70">{detail}</p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} variant="nav-secondary" size="sm">Keep editing</Button>
          <Button href={`/groups/${groupId}/billing${query}`} variant="primary" size="sm">{ctaLabel}</Button>
        </div>
      </div>
    </div>
  )
}
