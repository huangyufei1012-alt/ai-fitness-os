import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, History, CheckCircle2, CircleDashed } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState } from '../lib/store'
import { muscleCn, fmtDate } from '../lib/utils'
import { getExercise } from '../lib/exercises'
import WorkoutSummaryView, { summarizeHistorySession } from '../components/WorkoutSummaryView'
import { PageHeader } from '../components/ui-kit'
import type { WorkoutSession } from '../types'

// 训练历史主页：按日期倒序展示所有完整与未完成训练
export default function TrainingHistory() {
  const state = useAppState()
  const nav = useNavigate()
  const list = [...state.workoutHistory].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <Button variant="ghost" className="mb-4 -ml-2 text-muted-foreground" onClick={() => nav('/training/plan')}>
        <ArrowLeft className="size-4" /> 返回计划
      </Button>
      <PageHeader
        title="训练历史"
        subtitle={`共 ${list.length} 次训练记录，含已完成的完整训练与提前结束的训练`}
      />

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed bg-card p-10 text-center">
          <History className="size-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            还没有训练记录。完成一次训练后，它会出现在这里。
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {list.map((w) => (
            <HistoryCard key={w.id} w={w} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryCard({ w }: { w: WorkoutSession }) {
  const s = summarizeHistorySession(w)
  const doneActs = w.exerciseRecords.filter((r) => r.sets.some((x) => x.done)).length
  return (
    <Link
      to={`/training/history/${w.id}`}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-5 hover:border-foreground/40 transition-colors"
    >
      <div
        className={`size-11 rounded-xl grid place-items-center shrink-0 ${
          s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {s.status === 'completed' ? <CheckCircle2 className="size-5" /> : <CircleDashed className="size-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{w.planName || '训练'}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {s.status === 'completed' ? '已完成' : '提前结束'}
          </span>
        </div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">
          {fmtDate(w.date)} · {doneActs}/{w.exerciseRecords.length} 个动作 · {s.totalSets}/{s.totalPlannedSets} 组 · 容量 {s.volText}kg · {w.durationMin ?? '—'} min
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(() => {
            const { primary, secondary } = sessionMuscleGroups(w)
            return (
              <>
                {primary.slice(0, 4).map((m) => (
                  <span key={`p-${m}`} className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {m}
                  </span>
                ))}
                {secondary.slice(0, 4).map((m) => (
                  <span key={`s-${m}`} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {m}
                  </span>
                ))}
              </>
            )
          })()}
        </div>
      </div>
      <ChevronRight className="size-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </Link>
  )
}

// 区分「主要肌群」与「辅助肌群」：主动作的 primaryMuscle 与所有动作的 secondaryMuscles
function sessionMuscleGroups(w: WorkoutSession): { primary: string[]; secondary: string[] } {
  const primary = new Set<string>()
  const secondary = new Set<string>()
  for (const r of w.exerciseRecords) {
    if (!r.sets.some((x) => x.done)) continue
    const ex = getExercise(r.exerciseId)
    if (!ex) continue
    primary.add(ex.primaryMuscle)
    ex.secondaryMuscles.forEach((m) => secondary.add(m))
  }
  // 一个肌群若同时作为主动作与辅助肌群出现，归入「主要肌群」
  ;[...secondary].forEach((m) => {
    if (primary.has(m)) secondary.delete(m)
  })
  return {
    primary: Array.from(primary).map(muscleCn),
    secondary: Array.from(secondary).map(muscleCn),
  }
}

// 训练历史详情：复用统一的 Workout Summary 视图
export function TrainingHistoryDetail() {
  const state = useAppState()
  const nav = useNavigate()
  const { id } = useParams()
  const w = state.workoutHistory.find((x) => x.id === id)

  if (!w) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <Button variant="ghost" className="mb-4 -ml-2 text-muted-foreground" onClick={() => nav('/training/history')}>
          <ArrowLeft className="size-4" /> 返回训练历史
        </Button>
        <div className="rounded-2xl border-2 border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          未找到该训练记录，可能已被删除。
        </div>
      </div>
    )
  }

  return (
    <WorkoutSummaryView
      session={w}
      backTo={
        <Button variant="ghost" className="mb-4 -ml-2 text-muted-foreground" onClick={() => nav('/training/history')}>
          <ArrowLeft className="size-4" /> 返回训练历史
        </Button>
      }
    />
  )
}
