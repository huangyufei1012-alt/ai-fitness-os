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
  // 目标次数上限：从动作 repRange（如 "8-12"）解析上界，用于进阶判断
  const repUpper = parseRepUpper(ex.repRange)
  const next = suggestNextTarget(history, {
    exerciseId: ex.id,
    targetRepsUpper: repUpper,
    profile: state.profile,
  })

  // ---- 汇总统计（仅基于真实已完成的组） ----
  const doneHist = history
    .map((h: any) => {
      const done = h.records?.sets.filter((s: any) => s.done) ?? []
      if (!done.length) return null
      const topW = Math.max(...done.map((s: any) => s.weight))
      const rm = Math.max(...done.map((s: any) => est1RM(s.weight, s.reps)))
      const vol = done.reduce((a: number, s: any) => a + s.weight * s.reps, 0)
      return { date: h.date, done, topW, rm, vol, sets: done.length }
    })
    .filter(Boolean) as { date: string; done: any[]; topW: number; rm: number; vol: number; sets: number }[]

  const recent = doneHist[doneHist.length - 1] ?? null
  const best = doneHist.length
    ? doneHist.reduce((a, b) => (b.rm >= a.rm ? b : a), doneHist[0])
    : null
  const bestRM = best ? Math.round(best.rm) : 0
  const volSeries = doneHist.slice(-8).map((d) => d.vol)
  const maxVol = volSeries.length ? Math.max(...volSeries) : 0

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

      <div className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-3">训练数据</h2>

        {doneHist.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed bg-card p-6 text-sm text-muted-foreground">
            尚无训练记录。完成一次包含该动作的训练后，这里会展示你的过往表现、最佳数据与容量趋势。
          </div>
        ) : (
          <>
            {next && (
              <div
                className={`rounded-2xl border-2 bg-card p-5 mb-4 ${
                  next.keep ? 'border-amber-300/70' : 'border-emerald-300/70'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  AI · 下次训练目标
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight">{next.weight}</span>
                  <span className="text-sm text-muted-foreground">kg × {next.reps} 次</span>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      next.keep ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {next.keep ? '保持当前重量' : '可考虑加重'}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {next.sets} 组 · RIR {next.rir}
                </div>
                <div className="mt-3 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed text-foreground/90">
                  {next.note}
                </div>
              </div>
            )}

            {/* Recent / Best / 1RM 概览 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <OverviewCard
                label="最近表现"
                value={recent ? `${recent.topW} kg` : '—'}
                hint={recent ? `${fmtDate(recent.date)} · ${recent.sets} 组` : '暂无'}
              />
              <OverviewCard
                label="最佳表现"
                value={best ? `${best.topW} kg` : '—'}
                hint={best ? `${fmtDate(best.date)} · ${best.sets} 组` : '暂无'}
              />
              <OverviewCard
                label="估算 1RM"
                value={bestRM ? `${bestRM} kg` : '—'}
                hint="基于历史最佳组（Epley 公式）"
              />
            </div>

            {/* 容量趋势 */}
            <div className="rounded-2xl border bg-card p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  容量趋势（近 8 次，kg）
                </div>
                <span className="text-[11px] text-muted-foreground">
                  单次总容量 = Σ 重量 × 次数
                </span>
              </div>
              {volSeries.length === 1 ? (
                <p className="text-[13px] text-muted-foreground">
                  已有 1 次记录（上次容量 {Math.round(volSeries[0])} kg）。再完成几次训练即可看到趋势。
                </p>
              ) : (
                <div className="flex items-end gap-1.5 h-24">
                  {volSeries.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-foreground/80"
                        style={{ height: maxVol ? `${Math.max(8, (v / maxVol) * 80)}px` : 8 }}
                        title={`${fmtDate(doneHist[i].date)}: ${Math.round(v)} kg`}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {fmtDate(doneHist[i].date).slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 历史明细表 */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                历史记录明细
              </div>
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
                  {doneHist.slice(-8).reverse().map((h) => {
                    return (
                      <tr key={h.date} className="border-b last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(h.date)}</td>
                        <td className="px-4 py-3 font-medium">{h.topW} kg</td>
                        <td className="px-4 py-3">{h.done[h.done.length - 1]?.reps}</td>
                        <td className="px-4 py-3">{h.sets}</td>
                        <td className="px-4 py-3">{Math.round(h.rm)}</td>
                        <td className="px-4 py-3">{Math.round(h.vol)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
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

function OverviewCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

// 从 repRange 字符串（如 "6-8" / "8-12" / "10-15"）解析目标次数上界
function parseRepUpper(repRange: string): number | undefined {
  const nums = (repRange.match(/\d+/g) || []).map(Number)
  if (nums.length === 0) return undefined
  return Math.max(...nums)
}
