import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Plus,
  Minus,
  Dumbbell,
  Play,
  ChevronRight,
  Clock,
  AlertTriangle,
  Copy,
  ListEnd,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { useAppState, setState, todayISO, uid } from '../lib/store'
import { getExercise, getWeightIncrement } from '../lib/exercises'
import { getTodayPlan } from '../lib/data-plans'
import { previousPerformance, detectPRs } from '../lib/ai'
import WorkoutSummaryView from '../components/WorkoutSummaryView'
import { muscleCn, fmtDate } from '../lib/utils'
import type { ActiveWorkout } from '../types'

type Mode = 'select' | 'active' | 'summary'
type ConfirmState = 'none' | 'finish' | 'discard'

export default function Workout() {
  const state = useAppState()
  const nav = useNavigate()
  const [params] = useSearchParams()

  // 训练日来源：优先用户主动选择（?day=），否则按今天星期几
  const plan = state.trainingPlan
  const todayIdx = (new Date().getDay() + 6) % 7
  const dayParam = Number(params.get('day'))
  const hasDayParam = params.get('day') !== null && Number.isFinite(dayParam)
  const selectedPlan =
    hasDayParam && plan?.days[dayParam]?.active ? plan.days[dayParam] : getTodayPlan(state)

  // 进行中会话：从持久化的 activeWorkout 恢复（刷新/离开后可继续）
  const [mode, setMode] = useState<Mode>(() => (state.activeWorkout ? 'active' : 'select'))
  const [activeIdx, setActiveIdx] = useState<number>(() => state.activeWorkout?.activeIdx ?? 0)
  const [session, setSession] = useState<any>(() =>
    state.activeWorkout ? { ...state.activeWorkout.session } : null,
  )
  const [confirm, setConfirm] = useState<ConfirmState>('none')

  // 休息计时：绝对时间持久化到 activeWorkout.rest，刷新后按 endsAt 恢复
  const [rest, setRest] = useState<ActiveWorkout['rest'] | null>(() => state.activeWorkout?.rest ?? null)
  const [restLeft, setRestLeft] = useState<number | null>(() => {
    const r = state.activeWorkout?.rest
    if (!r) return null
    return Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000))
  })

  // 把进行中的训练同步到持久化存储（仅 active 模式，含休息计时）
  useEffect(() => {
    if (mode === 'active' && session) {
      setState((s) => {
        const next = {
          session: { ...session, exerciseRecords: session.exerciseRecords },
          activeIdx,
          rest: rest ?? undefined,
        }
        if (s.activeWorkout && JSON.stringify(s.activeWorkout) === JSON.stringify(next)) return s
        return { ...s, activeWorkout: next }
      })
    }
  }, [session, activeIdx, mode, rest])

  useEffect(() => {
    if (restLeft === null || restLeft <= 0) return
    const t = setTimeout(() => setRestLeft((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [restLeft])

  const startSession = () => {
    if (!selectedPlan || !selectedPlan.active) return
    const records = selectedPlan.exercises.map((pe: any) => {
      // 有动作历史时自动带入上次训练的重量/次数（用户仍可修改，0 值才回填）
      const prev = previousPerformance(state, pe.exerciseId)
      return {
        id: uid('rec'),
        exerciseId: pe.exerciseId,
        targetSets: pe.sets,
        restSec: pe.restSec || 90,
        sets: (pe.plannedSets || []).map((ps: any) => ({
          weight: ps.weight || (prev ? prev.weight : 0),
          reps: ps.reps || (prev ? prev.reps : 0),
          rir: ps.rir ?? 2,
          done: false,
        })),
      }
    })
    const s = {
      id: uid('ws'),
      date: todayISO(),
      dayIndex: selectedPlan.dayIndex,
      planName: selectedPlan.focus,
      planLabel: selectedPlan.label,
      exerciseRecords: records,
      start: Date.now(),
    }
    setSession(s)
    setActiveIdx(0)
    setRest(null)
    setRestLeft(null)
    setMode('active')
  }

  const clearActive = () => {
    setState((s) => (s.activeWorkout ? { ...s, activeWorkout: null } : s))
  }

  const discard = () => {
    clearActive()
    setSession(null)
    setRest(null)
    setRestLeft(null)
    setConfirm('none')
    setMode('select')
  }

  // status：'completed' 完整训练（全部计划组完成）/ 'partial' 提前结束
  const finishSession = (status: 'completed' | 'partial') => {
    if (!session) return
    const durationMin = Math.max(1, Math.round((Date.now() - session.start) / 60000))
    // 保存完整计划记录（不过滤未做动作），完成度交给 Summary 计算
    const rec = session.exerciseRecords
    const prs = detectPRs(state.workoutHistory, rec)
    const finalSession = {
      id: session.id,
      date: session.date,
      dayIndex: session.dayIndex,
      planName: session.planName,
      planLabel: session.planLabel,
      exerciseRecords: rec,
      durationMin,
      status,
      summaryGenerated: true,
      prs,
    }
    // 保存结果并清除「进行中」会话
    setState((s) => ({
      ...s,
      activeWorkout: null,
      workoutHistory: [...s.workoutHistory, finalSession],
      progressLog: upsertProgress(s),
    }))
    setSession({ ...finalSession, start: session.start })
    setRest(null)
    setRestLeft(null)
    setConfirm('none')
    setMode('summary')
  }

  const updateSet = (recIdx: number, setIdx: number, patch: any) => {
    setSession((prev: any) => {
      const records = JSON.parse(JSON.stringify(prev.exerciseRecords))
      records[recIdx].sets[setIdx] = { ...records[recIdx].sets[setIdx], ...patch }
      return { ...prev, exerciseRecords: records }
    })
  }

  const completeSet = (si: number) => {
    updateSet(activeIdx, si, { done: true, completedAt: new Date().toISOString() })
    const rec = session.exerciseRecords[activeIdx]
    const duration = rec?.restSec || 90
    const now = Date.now()
    setRest({ startedAt: now, duration, endsAt: now + duration * 1000 })
    setRestLeft(duration)
  }

  // 复制上一组：把该动作上一组的值带入当前组
  const copyPrevSet = (si: number) => {
    const cur = session?.exerciseRecords[activeIdx]
    const prev = cur?.sets[si - 1]
    if (!prev) return
    updateSet(activeIdx, si, { weight: prev.weight, reps: prev.reps, rir: prev.rir })
  }

  // 应用到剩余组：把当前组的值覆盖到该动作后续所有组
  const applyToRest = (si: number) => {
    const cur = session?.exerciseRecords[activeIdx]
    const src = cur?.sets[si]
    if (!src) return
    setSession((prev: any) => {
      const records = JSON.parse(JSON.stringify(prev.exerciseRecords))
      for (let i = si + 1; i < records[activeIdx].sets.length; i++) {
        records[activeIdx].sets[i] = {
          ...records[activeIdx].sets[i],
          weight: src.weight,
          reps: src.reps,
          rir: src.rir,
        }
      }
      return { ...prev, exerciseRecords: records }
    })
  }

  const addRest30 = () => {
    setRestLeft((r) => (r ?? 0) + 30)
    setRest((r) => (r ? { ...r, endsAt: r.endsAt + 30_000, duration: r.duration + 30 } : r))
  }

  const skipRest = () => {
    setRestLeft(null)
    setRest(null)
  }

  // 跳到下一个尚未开始的动作；全部完成则进入小结
  const advance = () => {
    setRestLeft(null)
    setRest(null)
    for (let i = activeIdx + 1; i < session.exerciseRecords.length; i++) {
      const r = session.exerciseRecords[i]
      if (!r.sets.some((s: any) => s.done)) {
        setActiveIdx(i)
        return
      }
    }
    const allDone = session.exerciseRecords.every((r: any) => r.sets.every((s: any) => s.done))
    finishSession(allDone ? 'completed' : 'partial')
  }

  // 归纳「结束训练」确认框里的进度文案
  const completionSummary = () => {
    const totalActs = session?.exerciseRecords?.length ?? 0
    const doneActs =
      session?.exerciseRecords?.filter((r: any) => r.sets.some((s: any) => s.done)).length ?? 0
    const totalSets =
      session?.exerciseRecords?.reduce((a: number, r: any) => a + (r.targetSets ?? r.sets.length), 0) ?? 0
    const doneSets =
      session?.exerciseRecords?.reduce(
        (a: number, r: any) => a + r.sets.filter((s: any) => s.done).length,
        0,
      ) ?? 0
    return { totalActs, doneActs, totalSets, doneSets }
  }

  const prof = state.profile

  // ---------- 选择页 ----------
  if (mode === 'select') {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <Button
          variant="ghost"
          className="mb-6 -ml-2 text-muted-foreground"
          onClick={() => nav('/training/plan')}
        >
          <ArrowLeft className="size-4" /> 返回计划
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">训练</h1>

        {session && (
          <div className="mt-6 rounded-2xl border-2 border-foreground bg-card p-6">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Dumbbell className="size-4" /> 进行中的训练
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.planLabel || ''} · {session.planName} · 已完成{' '}
              {session.exerciseRecords.filter((r: any) => r.sets.every((s: any) => s.done)).length} /{' '}
              {session.exerciseRecords.length} 个动作
            </p>
            <div className="mt-4 flex gap-3">
              <Button className="flex-1 gap-2" onClick={() => setMode('active')}>
                <Play /> 继续训练
              </Button>
              <Button variant="outline" onClick={discard}>
                放弃
              </Button>
            </div>
          </div>
        )}

        {!session && (
          <>
            {selectedPlan?.active ? (
              <div className="mt-6 rounded-2xl border bg-card p-8">
                {selectedPlan.dayIndex !== todayIdx && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    <div>
                      今天原计划为{' '}
                      <span className="font-medium">
                        {plan?.days[todayIdx]?.active
                          ? `${plan.days[todayIdx].label} ${plan.days[todayIdx].focus}`
                          : '休息日'}
                      </span>
                      ，你手动选择了{' '}
                      <span className="font-medium">
                        {selectedPlan.label} · {selectedPlan.focus}
                      </span>{' '}
                      的训练。
                    </div>
                  </div>
                )}
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {selectedPlan.label}
                </div>
                <h2 className="mt-1.5 text-3xl font-semibold tracking-tight">{selectedPlan.focus}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedPlan.exercises.length} 个动作 · 预计 {selectedPlan.estimatedMin} min
                </p>
                <div className="mt-6 space-y-1.5">
                  {selectedPlan.exercises.map((pe: any, i: number) => {
                    const ex = getExercise(pe.exerciseId)
                    return (
                      <div key={pe.id} className="flex items-center gap-3 rounded-xl border px-4 py-3">
                        <span className="size-6 rounded-lg bg-muted grid place-items-center text-[12px] font-medium">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-[14px] font-medium">{ex?.nameCn || ex?.name}</div>
                          <div className="text-[12px] text-muted-foreground">
                            {pe.sets} 组 · {pe.targetReps} 次 · {ex ? muscleCn(ex.primaryMuscle) : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button size="lg" className="mt-6 w-full gap-2" onClick={startSession}>
                  <Play /> 开始训练
                </Button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
                <Dumbbell className="size-10 mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  请从训练计划中选择一个训练日开始。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ---------- 进行中 ----------
  if (mode === 'active' && session) {
    const rec = session.exerciseRecords[activeIdx]
    const ex = rec && getExercise(rec.exerciseId)
    const doneSets = rec ? rec.sets.filter((s: any) => s.done).length : 0
    const prevPerf = previousPerformance(state, rec?.exerciseId)
    const doneActs = session.exerciseRecords.filter((r: any) => r.sets.every((s: any) => s.done)).length
    const weightIncrement = getWeightIncrement(ex?.equipment || '', prof?.weightIncrements)
    const cp = completionSummary()

    if (!rec) return null

    return (
      <div className="mx-auto max-w-2xl px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => setMode('select')}>
            <ArrowLeft className="size-4" /> 退出
          </Button>
          <div className="text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{session.planName}</span> · 动作 {activeIdx + 1} /{' '}
            {session.exerciseRecords.length} · 已完成 {doneActs} 个
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {ex ? muscleCn(ex.primaryMuscle) : ''} · {doneSets} / {rec.targetSets} 组完成
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{ex?.nameCn || ex?.name}</h1>
            {prevPerf ? (
              <div className="mt-1 text-[13px] text-muted-foreground">
                上次（{fmtDate(prevPerf.date)}）：{' '}
                <span className="font-medium text-foreground">
                  {prevPerf.weight} kg × {prevPerf.reps} 次
                </span>{' '}
                · {prevPerf.sets} 组
              </div>
            ) : (
              <div className="mt-1 text-[13px] text-muted-foreground">这是你第一次做这个动作</div>
            )}
          </div>

          {/* 休息计时器（含刷新后恢复与「休息完成」状态） */}
          {restLeft !== null ? (
            restLeft > 0 ? (
              <div className="mt-6 rounded-xl border-2 border-foreground bg-muted/40 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="size-5 text-foreground" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      组间休息
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">{restLeft}s</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addRest30}>
                    <Plus className="size-4" /> 30秒
                  </Button>
                  <Button size="sm" onClick={skipRest}>
                    跳过休息
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border-2 border-emerald-400/60 bg-emerald-50/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="size-5 text-emerald-600" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      组间休息
                    </div>
                    <div className="text-lg font-semibold text-emerald-700">休息完成</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={skipRest}>
                  开始下一组
                </Button>
              </div>
            )
          ) : (
            <p className="mt-6 text-[12px] text-center text-muted-foreground">
              完成一组后会自动开始休息计时（该动作 {rec.restSec || 90}s）
            </p>
          )}

          <div className="mt-6 space-y-3">
            {rec.sets.map((set: any, si: number) => (
              <div
                key={si}
                className={`rounded-xl border p-4 ${set.done ? 'border-emerald-500/50 bg-emerald-50' : ''}`}
              >
                {set.done ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-emerald-500 text-white grid place-items-center">
                        <Check className="size-4" />
                      </span>
                      <span className="text-[14px] font-medium">第 {si + 1} 组 · 已记录</span>
                    </div>
                    <span className="text-[14px] text-muted-foreground">
                      {set.weight} kg × {set.reps} 次 · RIR {set.rir}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="text-[13px] font-medium mb-3">第 {si + 1} 组</div>
                    <div className="grid grid-cols-3 gap-3">
                      <SetInput
                        label="重量"
                        unit="kg"
                        step={weightIncrement}
                        value={set.weight}
                        ariaLabel={`第${si + 1}组重量`}
                        onChange={(v) => updateSet(activeIdx, si, { weight: v })}
                      />
                      <SetInput
                        label="次数"
                        unit="次"
                        step={1}
                        value={set.reps}
                        ariaLabel={`第${si + 1}组次数`}
                        onChange={(v) => updateSet(activeIdx, si, { reps: v })}
                      />
                      <SetInput
                        label="RIR"
                        unit=""
                        step={1}
                        value={set.rir}
                        ariaLabel={`第${si + 1}组RIR`}
                        onChange={(v) => updateSet(activeIdx, si, { rir: v })}
                      />
                    </div>
                    {si === 0 && rec.sets.length > 1 && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 text-[12px]"
                          onClick={() => applyToRest(si)}
                        >
                          <ListEnd className="size-3.5" /> 应用到全部剩余组
                        </Button>
                        <p className="mt-1 text-[11px] text-muted-foreground text-center">
                          将第 1 组的重量 / 次数 / RIR 复制到第 2-{rec.sets.length} 组
                        </p>
                      </div>
                    )}
                    {si > 0 && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => copyPrevSet(si)}
                        >
                          <Copy className="size-3.5" /> 复制上一组
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          disabled={si >= rec.sets.length - 1}
                          onClick={() => applyToRest(si)}
                        >
                          <ListEnd className="size-3.5" /> 应用到剩余组
                        </Button>
                      </div>
                    )}
                    <Button
                      className="mt-3 w-full gap-1.5"
                      disabled={set.weight <= 0 && set.reps <= 0}
                      onClick={() => completeSet(si)}
                    >
                      <Check className="size-4" /> COMPLETE SET · 完成本组
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            {doneSets > 0 && (
              <Button variant="outline" onClick={advance}>
                {doneSets >= rec.targetSets ? '下一动作' : '跳过本动作'} <ChevronRight />
              </Button>
            )}
            {doneSets > 0 && (
              <Button size="lg" className="flex-1" variant="destructive" onClick={() => setConfirm('finish')}>
                结束训练
              </Button>
            )}
          </div>
        </div>

        {/* 提前结束确认框：显示当前训练进度 + 三选项 */}
        <AlertDialog open={confirm === 'finish'} onOpenChange={(o) => !o && setConfirm('none')}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>结束本次训练？</AlertDialogTitle>
              <AlertDialogDescription>
                当前训练进度：完成动作 {cp.doneActs}/{cp.totalActs}、完成组数 {cp.doneSets}/
                {cp.totalSets}。未完成的训练可保存为「提前结束」，也可不保存直接放弃。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm('none')}>继续训练</AlertDialogCancel>
              <AlertDialogAction onClick={() => finishSession('partial')}>
                结束并保存为未完成
              </AlertDialogAction>
              <Button variant="outline" className="text-red-600" onClick={() => setConfirm('discard')}>
                放弃本次训练
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 放弃二次确认：删除行为不可逆 */}
        <AlertDialog open={confirm === 'discard'} onOpenChange={(o) => !o && setConfirm('none')}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>放弃本次训练？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作会删除本次训练（已完成 {cp.doneSets} 组）的所有记录，且不可恢复。确定要放弃吗？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm('none')}>取消</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={discard}>
                确认放弃
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ---------- 小结（复用统一样式组件） ----------
  if (mode === 'summary' && session) {
    return (
      <WorkoutSummaryView
        session={session}
        onLibrary={() => nav('/training/library')}
        onDone={() => nav('/')}
      />
    )
  }

  return null
}

// ------------------------------------------------------------
// 数值录入：点击数字直接输入 + 按器械增量步进的 ± 快捷按钮
// 移动端调用数字键盘（inputMode decimal/numeric）
// ------------------------------------------------------------
function SetInput({
  label,
  unit,
  step,
  value,
  onChange,
  ariaLabel,
}: {
  label: string
  unit: string
  step: number
  value: number
  onChange: (v: number) => void
  ariaLabel?: string
}) {
  const [text, setText] = useState<string>(`${value}`)
  const [focused, setFocused] = useState(false)

  // 外部值变化时同步（复制上一组 / 应用到剩余组 / 历史回填）
  useEffect(() => {
    if (!focused) setText(fmt(value))
  }, [value, focused])

  const commit = (v: number) => {
    const n = Number.isFinite(v) ? Math.max(0, v) : 0
    onChange(n)
    setText(fmt(n))
  }

  return (
    <div className="rounded-xl border p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <button
          className="size-7 rounded-lg bg-muted grid place-items-center hover:bg-accent shrink-0"
          onClick={() => commit(roundValue(value - step, step))}
          aria-label={`减少${label}`}
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          inputMode={step % 1 === 0 ? 'numeric' : 'decimal'}
          min={0}
          step={step}
          aria-label={ariaLabel || label}
          aria-valuetext={`${value}${unit}`}
          className="w-16 bg-transparent text-center text-xl font-semibold tabular-nums outline-none"
          value={focused ? text : fmt(value)}
          onFocus={() => {
            setFocused(true)
            setText(fmt(value))
          }}
          onBlur={() => {
            setFocused(false)
            const n = parseFloat(text)
            commit(n)
          }}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseFloat(e.target.value)
            if (Number.isFinite(n)) onChange(n)
          }}
        />
        <button
          className="size-7 rounded-lg bg-muted grid place-items-center hover:bg-accent shrink-0"
          onClick={() => commit(roundValue(value + step, step))}
          aria-label={`增加${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {unit && <div className="mt-0.5 text-[10px] text-muted-foreground">{unit}</div>}
    </div>
  )
}

function fmt(v: number) {
  if (v % 1 === 0) return String(v)
  return String(Math.round(v * 10) / 10)
}

// 步进后取整到器械增量，保证不出现 71.8kg 这类不可执行数值
function roundValue(v: number, step: number) {
  if (!step || step <= 0) return Math.max(0, Math.round(v * 10) / 10)
  return Math.max(0, Math.round(v / step) * step)
}

function upsertProgress(s: any) {
  const today = todayISO()
  const exists = s.progressLog.find((p: any) => p.date === today)
  if (exists) {
    return s.progressLog.map((p: any) => (p.date === today ? { ...p, workoutLog: true } : p))
  }
  return [
    ...s.progressLog,
    {
      id: uid('pg'),
      date: today,
      workoutLog: true,
      calorieIntake: null,
      caloriesTarget: null,
      proteinIntake: null,
      sleepHours: null,
      fatigue: null,
      muscleSoreness: {},
      weightKg: null,
      notes: '',
    },
  ]
}
