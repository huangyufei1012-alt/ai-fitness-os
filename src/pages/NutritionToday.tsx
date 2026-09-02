import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState, todayISO } from '../lib/store'
import { nutritionTotals, generateTodayCoachAdvice } from '../lib/ai'
import { PageHeader, MacroBar } from '../components/ui-kit'
import { fmtDate } from '../lib/utils'

export default function NutritionToday() {
  const state = useAppState()
  const nav = useNavigate()
  const macros = state.nutritionPlan
  const nut = nutritionTotals(state)
  const day = todayISO()
  const meals = state.meals
    .filter((m) => m.date === day)
    .sort((a, b) => (a.type < b.type ? -1 : 1))

  const typeLabel: any = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader title="营养 · 今日" subtitle={`${fmtDate(day)} · 当前摄入`} />

      {macros ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <MacroBar label="热量" value={nut.calories} target={macros.calories} unit="kcal" />
            <MacroBar label="蛋白质" value={nut.protein} target={macros.protein} unit="g" />
            <MacroBar label="碳水" value={nut.carbs} target={macros.carbs} unit="g" />
            <MacroBar label="脂肪" value={nut.fat} target={macros.fat} unit="g" />
          </div>
          <div className="mt-5 flex gap-6 text-[13px]">
            <span className="text-muted-foreground">
              已摄入 <span className="font-semibold text-foreground">{Math.round(nut.calories)}</span> kcal
            </span>
            <span className="text-muted-foreground">
              剩余 <span className="font-semibold text-emerald-600">{Math.max(0, Math.round(macros.calories - nut.calories))}</span> kcal
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          尚未设置营养目标。
        </div>
      )}

      {/* AI 晚餐/剩余建议 */}
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          AI 教练 · 营养
        </div>
        {generateTodayCoachAdvice(state).filter((a) => a.includes('蛋白') || a.includes('脂肪') || a.includes('kcal')).slice(0, 1).map((a, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-foreground/90">{a}</p>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">今日餐食</h2>
          <Button onClick={() => nav('/nutrition/meals')} className="gap-2">
            <Camera className="size-4" /> 拍照记录一餐
          </Button>
        </div>
        {meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            今天还没有记录餐食。拍照或手动记录，AI 会帮你估算热量。
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((m) => (
              <div key={m.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {typeLabel[m.type] || m.type}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {Math.round(m.entries.reduce((a, e) => a + e.calories, 0))} kcal
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {m.entries.map((e) => (
                    <div key={e.id} className="flex justify-between text-[13px]">
                      <span>
                        {e.name}
                        <span className="text-muted-foreground"> · {e.grams}g</span>
                      </span>
                      <span className="text-muted-foreground">{Math.round(e.calories)} kcal</span>
                    </div>
                  ))}
                </div>
                {m.photo && (
                  <img src={m.photo} alt="" className="mt-3 h-24 w-24 rounded-xl object-cover" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
