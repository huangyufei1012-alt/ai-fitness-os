import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAppState } from '../lib/store'
import { getExercise } from '../lib/exercises'
import { PageHeader } from '../components/ui-kit'
import { muscleCn } from '../lib/utils'

export default function TrainingPlan() {
  const state = useAppState()
  const nav = useNavigate()
  const plan = state.trainingPlan

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader
        title="训练计划"
        subtitle="你的周训练计划 · 持续训练系统会根据表现动态调整"
      />

      {plan ? (
        <>
          <div className="rounded-2xl border bg-card p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold tracking-tight">{plan.name}</div>
                <p className="mt-1 text-sm text-muted-foreground max-w-xl">{plan.basis}</p>
              </div>
              <button className="text-[12px] text-muted-foreground hover:text-foreground underline">
                重新生成
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {plan.days.map((day: any, i: number) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-2 rounded-full ${
                        day.active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`}
                    />
                    <div>
                      <div className="font-medium">{day.label}</div>
                      {day.active && (
                        <div className="text-[12px] text-muted-foreground">{day.focus}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {day.active && (
                      <>
                        <span className="text-[12px] text-muted-foreground">
                          {day.exercises.length} 动作 · {day.estimatedMin}min
                        </span>
                        <button
                          onClick={() => nav('/training/workout')}
                          className="text-[12px] font-medium text-foreground flex items-center gap-0.5 hover:underline"
                        >
                          开始 <ChevronRight className="size-3.5" />
                        </button>
                      </>
                    )}
                    {!day.active && <span className="text-[12px] text-muted-foreground">休息</span>}
                  </div>
                </div>
                {day.active && (
                  <div className="border-t divide-y">
                    {day.exercises.map((pe: any, j: number) => {
                      const ex = getExercise(pe.exerciseId)
                      return (
                        <button
                          key={pe.id}
                          onClick={() => nav(`/training/exercise/${pe.exerciseId}`)}
                          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40"
                        >
                          <span className="text-[12px] font-medium text-muted-foreground w-6">
                            {String(j + 1).padStart(2, '0')}
                          </span>
                          <div className="flex-1">
                            <div className="text-[14px] font-medium">{ex?.nameCn || ex?.name}</div>
                            <div className="text-[12px] text-muted-foreground">
                              {pe.sets} 组 × {pe.targetReps} · {ex ? muscleCn(ex.primaryMuscle) : ''}
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">尚未生成训练计划。</p>
          <p className="mt-1 text-sm text-muted-foreground">完成初始设置后系统会自动为你生成。</p>
        </div>
      )}
    </div>
  )
}
