import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Plus,
  Minus,
  Dumbbell,
  Play,
  ChevronRight,
  Trophy,
  Clock,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState, setState, todayISO, uid } from '../lib/store'
import { getExercise } from '../lib/exercises'
import { getTodayPlan } from '../lib/data-plans'
import { generateWorkoutSummary, previousPerformance, detectPRs } from '../lib/ai'
import { muscleCn } from '../lib/utils'
import { fmtDate } from '../lib/utils'

type Mode = 'select' | 'active' | 'summary'

export default function Workout() {
  const state = useAppState()
  const nav = useNavigate()
  const todayPlan = getTodayPlan(state)
  const [mode, setMode] = useState<Mode>('select')
  const [activeIdx, setActiveIdx] = useState(0)
  const [session, setSession] = useState<any>(null)
  // 休息计时器（秒），null 表示未启用
  const [restLeft, setRestLeft] = useState<number | null>(null)

  useEffect(() => {
    if (restLeft === null || restLeft <= 0) return
    const t = setTimeout(() => setRestLeft((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [restLeft])

  const startSession = () => {
    if (!todayPlan || !todayPlan.active) return
    const records = todayPlan.exercises.map((pe: any) => ({
      id: uid('rec'),
      exerciseId: pe.exerciseId,
      targetSets: pe.sets,
      restSec: pe.restSec || 90,
      sets: pe.plannedSets.map((ps: any) => ({
        weight: ps.weight,
        reps: ps.reps,
        rir: ps.rir,
        done: false,
      })),
    }))
    const s = {
      id: uid('ws'),
      date: todayISO(),
      dayIndex: todayPlan.dayIndex,
      planName: todayPlan.focus,
      exerciseRecords: records,
      start: Date.now(),
    }
    setSession(s)
    setActiveIdx(0)
    setMode('active')
  }

  const finishSession = () => {
    if (!session) return
    const durationMin = Math.max(1, Math.round((Date.now() - session.start) / 60000))
    const rec = session.exerciseRecords.filter((r: any) => r.sets.some((x: any) => x.done))
    const summary = generateWorkoutSummary({ ...session, durationMin, exerciseRecords: rec })
    const prs = detectPRs(state.workoutHistory, rec)
    const finalSession = {
      id: session.id,
      date: session.date,
      dayIndex: session.dayIndex,
      planName: session.planName,
      exerciseRecords: rec,
      durationMin,
      summaryGenerated: true,
      prs,
    }
    setState((s) => ({
      ...s,
      workoutHistory: [...s.workoutHistory, finalSession],
      progressLog: upsertProgress(s),
    }))
    setSession({ ...finalSession, summary })
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
    setRestLeft(rec?.restSec || 90)
  }

  // 跳到下一个未完成的动作；全部完成则结束
  const advance = () => {
    setRestLeft(null)
    for (let i = activeIdx + 1; i < session.exerciseRecords.length; i++) {
      if (!session.exerciseRecords[i].sets.some((s: any) => s.done)) {
        setActiveIdx(i)
        return
      }
    }
    finishSession()
  }

  if (mode === 'select') {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground" onClick={() => nav(-1)}>
          <ArrowLeft className="size-4" /> 返回
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">今日训练</h1>
        {todayPlan?.active ? (
          <div className="mt-6 rounded-2xl border bg-card p-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {todayPlan.label}
            </div>
            <h2 className="mt-1.5 text-3xl font-semibold tracking-tight">{todayPlan.focus}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {todayPlan.exercises.length} 个动作 · 预计 {todayPlan.estimatedMin} min
            </p>
            <div className="mt-6 space-y-1.5">
              {todayPlan.exercises.map((pe: any, i: number) => {
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
            <p className="mt-3 text-sm text-muted-foreground">今天是休息日，没有训练安排。</p>
          </div>
        )}
      </div>
    )
  }

  if (mode === 'active' && session) {
    const rec = session.exerciseRecords[activeIdx]
    const ex = rec && getExercise(rec.exerciseId)
    const doneSets = rec ? rec.sets.filter((s: any) => s.done).length : 0
    const prevPerf = previousPerformance(state, rec?.exerciseId)

    if (!rec) return null

    return (
      <div className="mx-auto max-w-2xl px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => setMode('select')}>
            <ArrowLeft className="size-4" /> 退出
          </Button>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>动作 {activeIdx + 1} / {session.exerciseRecords.length}</span>
            <span>·</span>
            <span>已完成 {session.exerciseRecords.filter((r: any) => r.sets.every((s: any) => s.done)).length} 个</span>
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
                上次（{fmtDate(prevPerf.date)}）：<span className="font-medium text-foreground">{prevPerf.weight} kg × {prevPerf.reps} 次</span> · {prevPerf.sets} 组
              </div>
            ) : (
              <div className="mt-1 text-[13px] text-muted-foreground">这是你第一次做这个动作</div>
            )}
          </div>

          {/* 休息计时器 */}
          {restLeft !== null && restLeft > 0 ? (
            <div className="mt-6 rounded-xl border-2 border-foreground bg-muted/40 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-foreground" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">组间休息</div>
                  <div className="text-2xl font-semibold tabular-nums">{restLeft}s</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRestLeft((r) => (r ?? 0) + 30)}>
                  <Plus className="size-4" /> 30秒
                </Button>
                <Button size="sm" onClick={() => setRestLeft(null)}>跳过休息</Button>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-[12px] text-center text-muted-foreground">
              完成一组后会自动开始休息计时
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
                      <SetInput label="重量" unit="kg" value={set.weight} onChange={(v) => updateSet(activeIdx, si, { weight: v })} />
                      <SetInput label="次数" unit="" value={set.reps} onChange={(v) => updateSet(activeIdx, si, { reps: v })} />
                      <SetInput label="RIR" unit="" value={set.rir} onChange={(v) => updateSet(activeIdx, si, { rir: v })} />
                    </div>
                    <Button
                      className="mt-3 w-full gap-1.5"
                      disabled={set.weight <= 0 && set.reps <= 0}
                      onClick={() => completeSet(si)}
                    >
                      <Check className="size-4" /> 完成本组
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            {doneSets > 0 && (
              <Button variant="outline" onClick={advance}>
                {doneSets >= rec.targetSets ? '下一个动作' : '跳过本动作'} <ChevronRight />
              </Button>
            )}
            {doneSets > 0 && (
              <Button size="lg" className="flex-1" onClick={finishSession}>
                结束训练
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // summary
  if (mode === 'summary' && session) {
    const s = session.summary
    return (
      <div className="mx-auto max-w-2xl px-8 py-6">
        <div className="rounded-2xl border bg-card p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            训练完成
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">训练完成 🎉</h1>

          <div className="mt-8 grid grid-cols-4 gap-4 text-center">
            <Statv label="时长" value={`${s.duration}`} unit="min" />
            <Statv label="总组数" value={s.totalSets} />
            <Statv label="容量" value={fmtVol(s.volume)} unit="kg" />
            <Statv label="肌群" value={s.muscles.length} />
          </div>

          {session.prs && session.prs.length > 0 && (
            <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-800">
                <Trophy className="size-4" /> 新纪录（PR）
              </div>
              <ul className="mt-2 space-y-1">
                {session.prs.map((p: string, i: number) => (
                  <li key={i} className="text-[13px] text-amber-800">· {p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
              训练到的肌群
            </div>
            <div className="flex flex-wrap gap-2">
              {s.muscles.map((m: string) => (
                <span key={m} className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium">{muscleCn(m)}</span>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-muted/60 p-4 text-[13px] leading-relaxed">
            <span className="font-semibold">AI 教练：</span>
            今天完成了 {s.totalSets} 组训练，总容量 {fmtVol(s.volume)}kg。保持这个强度，明天关注{'> ' + muscleCn(s.muscles[0] || '目标肌群')}的恢复。
          </div>

          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => nav('/training/library')}>查看动作库</Button>
            <Button className="flex-1" onClick={() => nav('/')}>回到今日</Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function upsertProgress(s: any) {
  const today = todayISO()
  const exists = s.progressLog.find((p: any) => p.date === today)
  if (exists) {
    return s.progressLog.map((p: any) => (p.date === today ? { ...p, workoutLog: true } : p))
  }
  return [
    ...s.progressLog,
    { id: uid('pg'), date: today, workoutLog: true, calorieIntake: null, caloriesTarget: null, proteinIntake: null, sleepHours: null, fatigue: null, muscleSoreness: {}, weightKg: null, notes: '' },
  ]
}

function SetInput({ label, unit, value, onChange }: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button className="size-7 rounded-lg bg-muted grid place-items-center" onClick={() => onChange(Math.max(0, value - (label === '重量' ? 2.5 : 1)))}>
          <Minus className="size-4" />
        </button>
        <span className="text-xl font-semibold w-14 text-center">{value}{unit}</span>
        <button className="size-7 rounded-lg bg-muted grid place-items-center" onClick={() => onChange(value + (label === '重量' ? 2.5 : 1))}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

function Statv({ label, value, unit }: any) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></div>
    </div>
  )
}

function fmtVol(v: number) {
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return String(Math.round(v))
}
