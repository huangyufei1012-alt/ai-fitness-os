import { Link, useNavigate } from 'react-router-dom'
import { Play, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState, todayISO } from '../lib/store'
import { getTodayPlan } from '../lib/data-plans'
import { nutritionTotals, generateTodayCoachAdvice, sessionVolume, generateWorkoutSummary } from '../lib/ai'
import { fmtVol } from '../components/WorkoutSummaryView'
import { Eyebrow, Stat, MacroBar, SectionLabel } from '../components/ui-kit'
import { fmtFullDate, muscleCn } from '../lib/utils'
import { getExercise } from '../lib/exercises'

export default function Today() {
  const state = useAppState()
  const nav = useNavigate()
  const todayPlan = getTodayPlan(state)
  const nut = nutritionTotals(state)
  const macros = state.nutritionPlan
  const advice = generateTodayCoachAdvice(state)
  const today = todayISO()
  const todayIdx = (new Date().getDay() + 6) % 7
  const progress = state.progressLog.find((p) => p.date === today)

  // 今天全部已保存的训练会话（含计划训练、手动额外训练、完整训练、提前结束训练），
  // 不因 session 不属于当天原计划而隐藏。workoutHistory 按保存先后追加，
  // 倒序即「完成时间新的在前」，满足按时间倒序展示。
  const todaySessions = [...state.workoutHistory].filter((w) => w.date === today).reverse()

  // 今天额外完成的训练（今日原计划为休息日时）
  const extraToday = state.workoutHistory.filter((w) => w.date === today)
  const extraVol = extraToday.reduce((a, w) => a + sessionVolume(w), 0)
  const extraActs = extraToday.reduce(
    (a, w) => a + w.exerciseRecords.filter((r) => r.sets.some((s) => s.done)).length,
    0,
  )
  const extraSets = extraToday.reduce(
    (a, w) => a + w.exerciseRecords.reduce((x, r) => x + r.sets.filter((s) => s.done).length, 0),
    0,
  )
  // 取最近一次额外训练会话，用于区分「完成 / 提前结束」与完成度
  const extraLatest = [...extraToday].sort((a, b) => (a.date < b.date ? 1 : 0))[0]
  const extraSum = extraLatest ? generateWorkoutSummary(extraLatest) : null
  const extraStatus = extraLatest?.status === 'completed' ? 'completed' : 'partial'
  const extraDuration = extraToday.reduce((a, w) => a + (w.durationMin ?? 0), 0)
  const extraMuscles = Array.from(
    new Set(
      extraToday.flatMap((w) =>
        w.exerciseRecords.flatMap((r) => {
          const ex = getExercise(r.exerciseId)
          if (!ex || !r.sets.some((s) => s.done)) return []
          return [ex.primaryMuscle, ...ex.secondaryMuscles]
        }),
      ),
    ),
  ).map(muscleCn)

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      <div>
        <Eyebrow>今日</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          你好，{state.profile?.name || ''} — {fmtFullDate(today)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">今天练什么、吃什么、恢复得怎么样，一目了然。</p>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6">
        {/* 左侧：今日训练 */}
        <div className="col-span-12 lg:col-span-7">
          <SectionLabel>今日训练</SectionLabel>
          {todayPlan && todayPlan.active ? (
            <>
            <Link
              to="/training/workout"
              className="block rounded-2xl border bg-card p-6 hover:border-foreground/40 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {todayPlan.label}
                  </div>
                  <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">{todayPlan.focus}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {todayPlan.exercises.length} 个动作 · 预计 {todayPlan.estimatedMin} min
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-6">
                <Button size="lg" className="w-full gap-2" onClick={(e) => { e.preventDefault(); nav('/training/workout') }}>
                  <Play className="size-4" /> 开始训练
                </Button>
              </div>
            </Link>

            {/* 今日训练记录：当天全部 session（含计划训练、手动额外训练、完整训练、提前结束训练） */}
            {todaySessions.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2">
                  <SectionLabel className="mb-0">今日训练记录</SectionLabel>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {todaySessions.length} 次
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {todaySessions.map((s) => {
                    const sum = generateWorkoutSummary(s)
                    const isPlanned = s.dayIndex === todayIdx
                    const isCompleted = s.status === 'completed'
                    const statusText = isPlanned
                      ? isCompleted
                        ? '今日计划训练 · 已完成'
                        : '今日计划训练 · 提前结束'
                      : isCompleted
                        ? '已额外完成'
                        : '已额外训练 · 提前结束'
                    const muscles = Array.from(
                      new Set(
                        s.exerciseRecords.flatMap((r) => {
                          const ex = getExercise(r.exerciseId)
                          if (!ex || !r.sets.some((st) => st.done)) return []
                          return [ex.primaryMuscle, ...ex.secondaryMuscles]
                        }),
                      ),
                    ).map(muscleCn)
                    return (
                      <Link
                        key={s.id}
                        to={`/training/history/${s.id}`}
                        className="block rounded-2xl border bg-card p-5 hover:border-foreground/40 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[13px] font-semibold">
                            <span>{statusText}</span>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        {(s.planLabel || s.planName) && (
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {s.planLabel || ''} · {s.planName}
                          </div>
                        )}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {muscles.length ? (
                            muscles.map((m) => (
                              <span
                                key={m}
                                className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700"
                              >
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-muted-foreground">无完成动作</span>
                          )}
                        </div>
                        <div className="mt-2.5 text-[13px] text-muted-foreground">
                          {sum.completedExercises}/{sum.plannedExercises} 个动作 · {sum.totalSets}/
                          {sum.totalPlannedSets} 组 · 完成率 {sum.completion}% · 容量 {fmtVol(sessionVolume(s))} kg
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {todayPlan ? todayPlan.label : '—'}
              </div>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">
                今日原计划：休息
                {extraToday.length > 0 &&
                  (extraStatus === 'completed' ? ' · 已额外完成训练' : ' · 已额外训练 · 提前结束')}
              </h2>
              {extraToday.length > 0 ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extraMuscles.map((m) => (
                      <span key={m} className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-4 gap-3 text-center">
                    <Stat
                      label="完成动作"
                      value={extraSum ? `${extraSum.completedExercises}/${extraSum.plannedExercises}` : extraActs}
                    />
                    <Stat
                      label="完成组数"
                      value={extraSum ? `${extraSum.totalSets}/${extraSum.totalPlannedSets}` : extraSets}
                    />
                    <Stat label="完成率" value={extraSum ? `${extraSum.completion}%` : '—'} />
                    <Stat label="训练容量" value={fmtVol(extraVol)} unit="kg" />
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    训练时长约 {extraDuration} min · 额外完成内容已计入你的训练记录与肌群数据。
                  </p>
                  <Button size="lg" className="mt-4 w-full gap-2" onClick={() => nav(`/training/history/${extraToday[0].id}`)}>
                    <CheckCircle2 className="size-4" /> 查看训练总结
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    主动恢复：散步 20-30 分钟或轻度拉伸，有助于改善睡眠与肌肉恢复。
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={() => nav('/training/plan')}>
                      查看训练计划
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI Coach Today */}
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <SectionLabel className="mb-0">今日教练建议</SectionLabel>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                本地规则 / DEMO · 未接入云端 LLM
              </span>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              {advice.length ? (
                <ul className="space-y-3">
                  {advice.map((a, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
                      <span className="mt-1.5 size-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-foreground/90">{a}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  完成一次训练或记录一餐后，我才能基于你的真实数据给出建议。
                </p>
              )}
              <Button variant="ghost" className="mt-3 px-0 text-[13px]" onClick={() => nav('/coach')}>
                与 AI 教练对话 <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 右侧：营养 + 恢复 */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">营养</SectionLabel>
              <button className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => nav('/nutrition/today')}>
                详情
              </button>
            </div>
            {macros ? (
              <div className="mt-4 space-y-4">
                <MacroBar label="热量" value={nut.calories} target={macros.calories} unit="kcal" />
                <MacroBar label="蛋白质" value={nut.protein} target={macros.protein} unit="g" />
                <MacroBar label="碳水" value={nut.carbs} target={macros.carbs} unit="g" />
                <MacroBar label="脂肪" value={nut.fat} target={macros.fat} unit="g" />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">尚未设置营养目标。</p>
            )}
          </div>

          {/* Recovery */}
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">恢复</SectionLabel>
              <button className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => nav('/body/progress')}>
                记录
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat label="睡眠" value={progress && progress.sleepHours != null ? progress.sleepHours.toFixed(1) : '—'} unit="h" />
              <Stat label="疲劳" value={progress && progress.fatigue != null ? progress.fatigue : '—'} unit="/10" />
              <Stat
                label="体重"
                value={latestWeight(state) != null ? latestWeight(state)!.toFixed(1) : '—'}
                unit="kg"
              />
            </div>
            <div className="mt-4 rounded-xl bg-muted/60 p-4 text-[13px] leading-relaxed text-muted-foreground">
              记录睡眠与疲劳值，可以帮我判断今天是否适合加量或需要放松。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function latestWeight(state: any): number | null {
  const arr = state.bodyMeasurements
  let w: number | null = null
  for (const m of arr) if (m.weightKg != null) w = m.weightKg
  return w
}
