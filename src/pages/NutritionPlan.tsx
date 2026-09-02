import { useAppState } from '../lib/store'
import { PageHeader, MacroBar } from '../components/ui-kit'
import { GOAL_LABEL } from '../lib/utils'

export default function NutritionPlan() {
  const state = useAppState()
  const plan = state.nutritionPlan

  // 7日平均体重
  const weights = state.bodyMeasurements
    .slice(-7)
    .filter((m) => m.weightKg != null)
    .map((m) => m.weightKg!)

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <PageHeader title="营养计划" subtitle="动态营养计划 · 依据周趋势调整，而非单日波动" />

      {plan ? (
        <>
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  每日目标
                </div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">
                  {plan.calories} <span className="text-base text-muted-foreground">kcal</span>
                </div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  目标 · {GOAL_LABEL[plan.goal]}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-muted-foreground">蛋白质</div>
                <div className="text-xl font-semibold">{plan.protein}g</div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <MacroBar label="蛋白质" value={plan.protein} target={plan.protein} unit="g" />
              <MacroBar label="碳水" value={plan.carbs} target={plan.carbs} unit="g" />
              <MacroBar label="脂肪" value={plan.fat} target={plan.fat} unit="g" />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              计划依据
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/85">{plan.basis}</p>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          尚未设置营养目标。
        </div>
      )}

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          体重趋势（近7天）
        </div>
        {weights.length >= 2 ? (
          <>
            <div className="flex items-end gap-1 h-20">
              {weights.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-accent"
                    style={{ height: `${((w - Math.min(...weights) + 1) / (Math.max(...weights) - Math.min(...weights) + 1)) * 64}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{w.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              当前 7 日均值：<span className="font-semibold text-foreground">{(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)} kg</span>
              ，系统将按周趋势判断，不因单日波动调整计划。
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            记录更多体重数据后，这里会展示 7 日趋势。
          </p>
        )}
      </div>
    </div>
  )
}
