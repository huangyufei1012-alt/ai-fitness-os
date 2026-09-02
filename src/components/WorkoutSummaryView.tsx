import { Trophy } from 'lucide-react'
import { Button } from './ui/button'
import { generateWorkoutSummary, est1RM, sessionVolume } from '../lib/ai'
import { getExercise } from '../lib/exercises'
import { muscleCn, fmtDate } from '../lib/utils'
import type { WorkoutSession } from '../types'

// ============================================================
// 训练小结视图（Workout Summary）
// 供「本次训练结束」与「训练历史详情」复用，保证口径一致：
//  - 计划动作数 / 完成动作数 / 计划组数 / 完成组数 / 完成率 / 训练状态
//  - 只有完成 ≥2 个动作才做动作表现比较
//  - 本地规则引擎生成的总结标题统一为「本地规则总结」
// ============================================================

export default function WorkoutSummaryView({
  session,
  onDone,
  onLibrary,
  backTo,
}: {
  session: WorkoutSession
  onDone?: () => void
  onLibrary?: () => void
  backTo?: React.ReactNode
}) {
  const s = generateWorkoutSummary(session)
  const perf = session.exerciseRecords
    .map((r) => {
      const ex = getExercise(r.exerciseId)
      const done = r.sets.filter((x) => x.done)
      const topW = done.length ? Math.max(...done.map((x) => x.weight)) : 0
      const rm = done.length ? Math.max(...done.map((x) => est1RM(x.weight, x.reps))) : 0
      const vol = done.reduce((a, x) => a + x.weight * x.reps, 0)
      return { ex, done: done.length, topW, rm, vol }
    })
    .filter((p) => p.done > 0)

  const isCompleted = s.status === 'completed'

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      {backTo}
      <div className="rounded-2xl border bg-card p-8">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {isCompleted ? '训练完成' : '训练已保存 · 未完成'}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isCompleted ? '已完成' : '提前结束'}
          </span>
        </div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">
          {isCompleted ? '训练完成 🎉' : '训练记录 · 未完成'}
        </h1>

        {/* 完成度：计划 vs 完成 */}
        <div className="mt-7 grid grid-cols-4 gap-4 text-center">
          <Statv label="时长" value={`${s.duration ?? '—'}`} unit="min" />
          <Statv label="动作 (完成/计划)" value={`${s.completedExercises}/${s.plannedExercises}`} />
          <Statv label="组数 (完成/计划)" value={`${s.totalSets}/${s.totalPlannedSets}`} />
          <Statv label="容量" value={fmtVol(s.volume)} unit="kg" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              完成率
            </div>
            <div className="mt-1 text-2xl font-semibold">{s.completion}%</div>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              训练状态
            </div>
            <div className={`mt-1 text-xl font-semibold ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isCompleted ? '完成训练' : '提前结束'}
            </div>
          </div>
        </div>

        {session.prs && session.prs.length > 0 && (
          <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-800">
              <Trophy className="size-4" /> 新纪录（PR）
            </div>
            <ul className="mt-2 space-y-1">
              {session.prs.map((p, i) => (
                <li key={i} className="text-[13px] text-amber-800">· {p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 动作表现明细（真实记录） */}
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            动作表现 Exercise Performance
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">动作</th>
                  <th className="text-left px-3 py-2 font-medium">组数</th>
                  <th className="text-left px-3 py-2 font-medium">最高重量</th>
                  <th className="text-left px-3 py-2 font-medium">估算1RM</th>
                </tr>
              </thead>
              <tbody>
                {perf.length ? (
                  perf.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-medium">{p.ex?.nameCn || p.ex?.name}</td>
                      <td className="px-3 py-2.5">{p.done}</td>
                      <td className="px-3 py-2.5">{p.topW} kg</td>
                      <td className="px-3 py-2.5">{Math.round(p.rm)} kg</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                      本次没有完成的组。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            训练到的肌群
          </div>
          <div className="flex flex-wrap gap-2">
            {s.muscles.length ? (
              s.muscles.map((m) => (
                <span key={m} className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium">
                  {muscleCn(m)}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-muted-foreground">无</span>
            )}
          </div>
        </div>

        {/* 本地规则总结（DEMO，非云端 LLM） */}
        <div className="mt-6 rounded-xl bg-muted/60 p-4 text-[13px] leading-relaxed">
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            本地规则总结
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              DEMO · 未接入云端 LLM
            </span>
          </div>
          {coachLine(s, perf)}
        </div>

        <div className="mt-8 flex gap-3">
          {onLibrary && (
            <Button variant="outline" onClick={onLibrary}>
              查看动作库
            </Button>
          )}
          {onDone && (
            <Button className="flex-1" onClick={onDone}>
              回到今日
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// 基于真实数据、按新规则生成小结文案
function coachLine(
  s: ReturnType<typeof generateWorkoutSummary>,
  perf: { ex: ReturnType<typeof getExercise>; done: number; topW: number; rm: number; vol: number }[],
): string {
  const parts: string[] = []
  parts.push(
    `本次计划 ${s.plannedExercises} 个动作 / ${s.totalPlannedSets} 组，实际完成 ${s.completedExercises} 个动作 / ${s.totalSets} 组，完成率 ${s.completion}%。`,
  )
  if (s.status === 'partial') {
    parts.push('训练已按「提前结束」保存，未完成的组不会计入训练量，建议下次优先补齐全部目标组。')
  }
  if (perf.length >= 2) {
    const top = [...perf].sort((a, b) => b.topW - a.topW)[0]
    parts.push(`表现最好的动作是${top.ex?.nameCn || top.ex?.name}，最高${top.topW}kg。`)
    parts.push(`已完成：${perf.slice(0, 3).map((p) => p.ex?.nameCn || p.ex?.name).join('、')}。`)
  } else if (perf.length === 1) {
    const p = perf[0]
    parts.push(
      `已完成动作：${p.ex?.nameCn || p.ex?.name}（${p.done} 组，最高 ${p.topW}kg）。完成 ≥2 个动作后即可对比动作表现。`,
    )
  } else {
    parts.push('本次没有完成任一组，建议从较低的重量与较短时长开始恢复节奏。')
  }
  parts.push(`下次训练建议优先完成计划内未做满的全部动作，并给相关肌群 48-72 小时恢复。`)
  return parts.join('')
}

function Statv({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">
        {value}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  )
}

export function fmtVol(v: number) {
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return String(Math.round(v))
}

// 供训练历史列表使用：单次训练汇总
export function summarizeHistorySession(w: WorkoutSession) {
  const s = generateWorkoutSummary(w)
  return {
    ...s,
    volume: sessionVolume(w),
    status: s.status,
    volText: fmtVol(s.volume),
  }
}

export { fmtDate }
