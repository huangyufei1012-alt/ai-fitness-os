import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Database } from 'lucide-react'
import { MUSCLE_GROUPS, getExercisesByMuscle } from '../lib/exercises'
import { PageHeader } from '../components/ui-kit'
import { useAppState } from '../lib/store'
import { muscleStats } from '../lib/ai'
import { muscleCn, equipCn } from '../lib/utils'
import { fmtDate } from '../lib/utils'

export default function MuscleMap() {
  const state = useAppState()
  const [sel, setSel] = useState<string | null>('Chest')
  const stats = muscleStats(state)
  const noData = state.workoutHistory.length === 0

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      <PageHeader
        title="肌群数据中心"
        subtitle="基于真实训练记录：近 7 天训练量、上次训练时间与 4 周力量变化"
        right={
          <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
            <Database className="size-3.5" /> 数据均来自训练记录
          </span>
        }
      />

      {noData && (
        <div className="mb-6 rounded-2xl border-2 border-dashed bg-card p-6 text-sm text-muted-foreground">
          你还没有训练记录。完成至少一次训练后，这里会按肌群展示真实的训练量、上次训练时间与力量变化。
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* 肌肉选择器 */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              选择肌群
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-[420px] overflow-y-auto">
              {MUSCLE_GROUPS.map((m) => {
                const st = stats[m]
                return (
                  <button
                    key={m}
                    onClick={() => setSel(m)}
                    className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      sel === m ? 'bg-foreground text-background font-medium' : 'hover:bg-accent'
                    }`}
                  >
                    <span>{muscleCn(m)}</span>
                    {st && st.weeklySets > 0 ? (
                      <span className={`text-[10px] ${sel === m ? 'text-background/70' : 'text-muted-foreground'}`}>
                        {st.weeklySets} 组/7天
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground border-t pt-3">
              这里作为肌群数据中心：每周训练量、上次训练时间与力量变化全部来自你的真实训练记录。
            </p>
          </div>
        </div>

        {/* 肌群详情 */}
        <div className="col-span-12 lg:col-span-8">
          {sel && (
            <div className="space-y-4">
              <MuscleDetail muscle={sel} stat={stats[sel]} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MuscleDetail({ muscle, stat }: { muscle: string; stat?: any }) {
  const exs = getExercisesByMuscle(muscle)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              肌群详情
            </div>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{muscleCn(muscle)}</h2>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-muted-foreground">近 7 天训练量</div>
            <div className="text-2xl font-semibold">
              {stat?.weeklySets ? `${stat.weeklySets} 组` : '—'}
            </div>
            {!stat?.weeklySets && (
              <div className="text-[11px] text-muted-foreground">尚未训练</div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <MiniStat label="上次训练" value={lastFmt(stat?.lastDaysAgo)} hint={stat?.lastDate ? fmtDate(stat.lastDate) : '暂无记录'} />
          <MiniStat label="恢复状态" value={recoverFmt(stat?.lastDaysAgo)} hint="按上次训练时间定性推断" />
          <MiniStat
            label="4 周力量"
            value={stat?.strength4w ? stat.strength4w.label : '—'}
            hint={stat?.strength4w ? `基于 ${stat.strengthEx || '该肌群'} 估算1RM` : '需要更多历史数据'}
            good={stat?.strength4w ? stat.strength4w.change > 0 : undefined}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          主要训练动作
        </div>
        <div className="space-y-2">
          {exs.length ? (
            exs.map((ex: any) => (
              <Link
                key={ex.id}
                to={`/training/exercise/${ex.id}`}
                className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/40 group"
              >
                <div>
                  <div className="text-[14px] font-medium">{ex.nameCn}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {equipCn(ex.equipment)} · {ex.repRange}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">该肌群暂无录入动作，可在动作库中补充。</p>
          )}
        </div>
      </div>
    </div>
  )
}

function lastFmt(days: number | null): string {
  if (days === null) return '尚未训练'
  if (days === 0) return '今天'
  if (days === 1) return '1 天前'
  return `${days} 天前`
}

function recoverFmt(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return '今日训练'
  if (days <= 1) return '恢复中'
  if (days <= 2) return '可再训练'
  return '充分恢复'
}

function MiniStat({ label, value, hint, good }: { label: string; value: string; hint?: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${good === true ? 'text-emerald-600' : good === false ? 'text-amber-600' : ''}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
