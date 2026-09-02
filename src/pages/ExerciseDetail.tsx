import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAppState } from '../lib/store'
import { getExercise } from '../lib/exercises'
import { exerciseHistory, suggestNextTarget, est1RM } from '../lib/ai'
import { fmtDate, muscleCn, equipCn, typeCn } from '../lib/utils'

export default function ExerciseDetail() {
  const { id } = useParams()
  const state = useAppState()
  const nav = useNavigate()
  const ex = getExercise(id || '')

  if (!ex) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <p className="text-sm text-muted-foreground">未找到该动作。</p>
      </div>
    )
  }

  const history = exerciseHistory(state, ex.id)
  const next = suggestNextTarget(history)

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <ButtonBack onClick={() => nav('/training/library')} />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {muscleCn(ex.primaryMuscle)} · {typeCn(ex.type)}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{ex.nameCn}</h1>
          <p className="text-muted-foreground">{ex.name}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {[ex.primaryMuscle, ...ex.secondaryMuscles].map((m) => (
          <button
            key={m}
            onClick={() => nav('/body/muscle-map')}
            className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium hover:bg-accent/70"
          >
            {muscleCn(m)}
          </button>
        ))}
        <span className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
          {equipCn(ex.equipment)}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
          {ex.repRange}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        <InfoBlock title="教程">{ex.instructions}</InfoBlock>
        <InfoBlock title="要点">{ex.tips}</InfoBlock>
        <InfoBlock title="常见错误">{ex.commonErrors}</InfoBlock>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight mb-3">历史表现</h2>

          {next && (
            <div className="rounded-2xl border-2 border-foreground bg-card p-5 mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                AI · 下次目标
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{next.weight}</span>
                <span className="text-sm text-muted-foreground">kg × {next.reps} 次</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {next.sets} 组 · RIR {next.rir}· 在完成目标次数后小幅加重 (+2.5%)
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">日期</th>
                  <th className="text-left px-4 py-2.5 font-medium">重量</th>
                  <th className="text-left px-4 py-2.5 font-medium">次数</th>
                  <th className="text-left px-4 py-2.5 font-medium">组数</th>
                  <th className="text-left px-4 py-2.5 font-medium">估算1RM</th>
                  <th className="text-left px-4 py-2.5 font-medium">容量</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-8).reverse().map((h: any) => {
                  const rec = h.records
                  if (!rec) return null
                  const done = rec.sets.filter((s: any) => s.done)
                  const topW = done.length ? Math.max(...done.map((s: any) => s.weight)) : 0
                  const rm = done.length
                    ? Math.max(...done.map((s: any) => est1RM(s.weight, s.reps)))
                    : 0
                  const vol = done.reduce((a: number, s: any) => a + s.weight * s.reps, 0)
                  return (
                    <tr key={h.date} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(h.date)}</td>
                      <td className="px-4 py-3 font-medium">{topW} kg</td>
                      <td className="px-4 py-3">{done[done.length - 1]?.reps}</td>
                      <td className="px-4 py-3">{done.length}</td>
                      <td className="px-4 py-3">{Math.round(rm)}</td>
                      <td className="px-4 py-3">{Math.round(vol)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ButtonBack({ onClick }: any) {
  const nav = useNavigate()
  return (
    <button onClick={onClick || (() => nav(-1))} className="mb-6 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> 返回
    </button>
  )
}

function InfoBlock({ title, children }: any) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
        {title}
      </div>
      <p className="text-[14px] leading-relaxed text-foreground/90">{children}</p>
    </div>
  )
}
