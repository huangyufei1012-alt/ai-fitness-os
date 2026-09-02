import { Flame, Scale } from 'lucide-react'
import { useAppState } from '../../lib/store'
import { todayISO } from '../../lib/store'

export default function Topbar() {
  const state = useAppState()
  const latest = state.bodyMeasurements[state.bodyMeasurements.length - 1]
  const weight = latest?.weightKg ?? null

  // 连续记录天数：最早 streakStart 起
  let streak = 0
  if (state.streakStart) {
    const start = new Date(state.streakStart)
    const now = new Date()
    streak = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1)
  }

  const name = state.profile?.name || '运动员'

  return (
    <header className="flex items-center justify-between px-8 py-5">
      <div className="text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">{todayISO()}</span> — 私人 AI 健身系统
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Flame className="size-4 text-orange-500" />
          <span>{streak} 天</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Scale className="size-4 text-emerald-600" />
          <span>{weight != null ? `${weight.toFixed(1)} kg` : '— kg'}</span>
        </div>
        <div className="flex items-center gap-2.5 border-l pl-5">
          <span className="text-[13px] font-medium text-foreground">{name}</span>
          <div className="size-8 rounded-full bg-foreground text-background grid place-items-center text-[13px] font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  )
}
