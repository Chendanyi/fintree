import type { ReactNode } from 'react'
import clsx from 'clsx'

type BadgeTone = 'neutral' | 'positive' | 'negative' | 'locked' | 'info'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  positive: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
  negative: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
  locked: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
  info: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
}

interface StatusBadgeProps {
  label: string
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
}

export function StatusBadge({
  label,
  tone = 'neutral',
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )
}

export function inferImpactTone(value: string): BadgeTone {
  const lower = value.toLowerCase()
  if (
    value.startsWith('+') ||
    lower.includes('增长') ||
    lower.includes('bull') ||
    lower.includes('高效')
  ) {
    return 'positive'
  }
  if (
    value.startsWith('-') ||
    lower.includes('压缩') ||
    lower.includes('下滑') ||
    lower.includes('断崖') ||
    lower.includes('bear')
  ) {
    return 'negative'
  }
  return 'info'
}
