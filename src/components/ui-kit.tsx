import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

// 统一的页面标题区：强层级、大而明显
export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode
  subtitle?: string
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4 pb-6', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// 顶部小标签（如 TODAY / RECOVERY）
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

// 大数字统计块
export function Stat({ label, value, unit, hint, tone = 'default' }: {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 flex items-baseline gap-1',
          tone === 'good' && 'text-emerald-600',
          tone === 'warn' && 'text-amber-600',
        )}
      >
        <span className="text-[28px] leading-none font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-3', className)}>
      {children}
    </div>
  )
}

// 进度条（宏量营养等）
export function MacroBar({
  label,
  value,
  target,
  unit,
}: {
  label: string
  value: number
  target: number
  unit: string
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(value)}</span> / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
