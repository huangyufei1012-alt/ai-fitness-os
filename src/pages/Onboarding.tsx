import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { setState, todayISO } from '../lib/store'
import { generateTrainingPlan, recalculateNutrition } from '../lib/data-plans'
import { muscleCn, equipCn } from '../lib/utils'
import type { Goal } from '../types'

const GOALS: { key: Goal; label: string; desc: string }[] = [
  { key: 'bulk', label: '增肌', desc: '增加肌肉量与维度' },
  { key: 'cut', label: '减脂', desc: '降低体脂、更清晰线条' },
  { key: 'maintain', label: '维持', desc: '保持当前体型水平' },
  { key: 'strength', label: '力量', desc: '提升大重量力量表现' },
]

const EXPERIENCE: { key: string; label: string }[] = [
  { key: 'beginner', label: '新手 (<1年)' },
  { key: 'intermediate', label: '中级 (1-3年)' },
  { key: 'advanced', label: '高级 (3年+)' },
]

const ACTIVITY: { key: string; label: string }[] = [
  { key: 'sedentary', label: '久坐少动' },
  { key: 'light', label: '轻度活动' },
  { key: 'moderate', label: '中度活动' },
  { key: 'active', label: '高度活跃' },
]

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes']

const SESSION_MINUTES = [45, 60, 75, 90]

export default function Onboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '运动员',
    sex: 'male' as 'male' | 'female',
    goal: 'bulk' as Goal,
    age: 25,
    heightCm: 175,
    weightKg: 75,
    experience: 'beginner',
    activity: 'moderate',
    daysPerWeek: 4,
    minutesPerSession: 60,
    equipment: ['Barbell', 'Dumbbells', 'Machine', 'Cable'],
    focus: [] as string[],
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const finish = () => {
    const profile = {
      name: form.name || '运动员',
      sex: form.sex,
      goal: form.goal,
      age: form.age,
      heightCm: form.heightCm,
      activityLevel: form.activity as never,
      daysPerWeek: form.daysPerWeek,
      minutesPerSession: form.minutesPerSession,
      equipment: form.equipment,
      focusMuscles: form.focus,
      yearsExperience: form.experience === 'beginner' ? 1 : form.experience === 'intermediate' ? 2 : 5,
      currentTopWeights: {},
      dislikedExercises: [],
      preferredExercises: [],
      notes: '',
    }
    const trainingPlan = generateTrainingPlan(profile)
    const nutritionPlan = recalculateNutrition(profile, form.weightKg)
    setState((s) => ({
      ...s,
      onboarded: true,
      profile,
      trainingPlan,
      nutritionPlan,
      streakStart: todayISO(),
      bodyMeasurements: [
        {
          id: 'm-' + Date.now().toString(36),
          date: todayISO(),
          weightKg: form.weightKg,
          waistCm: null,
          chestCm: null,
          armsCm: null,
          thighCm: null,
        },
      ],
    }))
    nav('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="mx-auto size-12 rounded-2xl bg-foreground text-background grid place-items-center font-semibold text-lg mb-3">
            AF
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">建立你的私人 AI 健身档案</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            只需一次设置，系统会基于你的目标持续生成并动态调整训练与营养计划。
          </p>
        </div>

        <div className="border rounded-2xl p-6 bg-card">
          {step === 0 && (
            <div className="space-y-5">
              <StepTitle n="1/3" title="训练目标" />
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => set({ goal: g.key })}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      form.goal === g.key ? 'border-foreground bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="font-semibold">{g.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>

              <div>
                <Label>每周可训练天数</Label>
                <div className="flex gap-2 mt-1.5">
                  {[3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={() => set({ daysPerWeek: d })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                        form.daysPerWeek === d ? 'border-foreground bg-accent' : ''
                      }`}
                    >
                      {d} 天
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>每次训练时长</Label>
                <div className="flex gap-2 mt-1.5">
                  {SESSION_MINUTES.map((m) => (
                    <button
                      key={m}
                      onClick={() => set({ minutesPerSession: m })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                        form.minutesPerSession === m ? 'border-foreground bg-accent' : ''
                      }`}
                    >
                      {m} 分钟
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  当前每节约 {form.minutesPerSession} 分钟，将影响每日估时与计划动作数。
                </p>
              </div>
              <FormButtons onNext={() => setStep(1)} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepTitle n="2/3" title="身体信息" />
              <div>
                <Label>性别</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {[
                    { key: 'male', label: '男' },
                    { key: 'female', label: '女' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => set({ sex: s.key as 'male' | 'female' })}
                      className={`rounded-lg border py-2 text-sm font-medium ${
                        form.sex === s.key ? 'border-foreground bg-accent' : ''
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">性别用于基础代谢（BMR）的 Mifflin-St Jeor 计算。</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="年龄" value={form.age} onChange={(v) => set({ age: v })} />
                <NumberField label="身高 cm" value={form.heightCm} onChange={(v) => set({ heightCm: v })} />
                <NumberField label="当前体重 kg" value={form.weightKg} onChange={(v) => set({ weightKg: v })} />
              </div>
              <div>
                <Label>训练经验</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {EXPERIENCE.map((e) => (
                    <button
                      key={e.key}
                      onClick={() => set({ experience: e.key })}
                      className={`rounded-lg border py-2 text-[13px] ${
                        form.experience === e.key ? 'border-foreground bg-accent' : ''
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>日常活动水平</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {ACTIVITY.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => set({ activity: a.key })}
                      className={`rounded-lg border py-2 text-[13px] ${
                        form.activity === a.key ? 'border-foreground bg-accent' : ''
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <FormButtons onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepTitle n="3/3" title="训练偏好" />
              <div>
                <Label>可用器械</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Barbell', 'Dumbbells', 'Machine', 'Cable', 'Bodyweight'].map((e) => (
                    <button
                      key={e}
                      onClick={() =>
                        set({
                          equipment: form.equipment.includes(e)
                            ? form.equipment.filter((x) => x !== e)
                            : [...form.equipment, e],
                        })
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                        form.equipment.includes(e) ? 'border-foreground bg-accent font-medium' : ''
                      }`}
                    >
                      {equipCn(e)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>希望重点发展的肌群</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MUSCLES.map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        set({
                          focus: form.focus.includes(m)
                            ? form.focus.filter((x) => x !== m)
                            : [...form.focus, m],
                        })
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                        form.focus.includes(m) ? 'border-foreground bg-accent font-medium' : ''
                      }`}
                    >
                      {muscleCn(m)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>你的名字</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="mt-1.5"
                  placeholder="如何称呼你"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  上一步
                </Button>
                <Button className="flex-1" size="lg" onClick={finish}>
                  生成我的计划
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          所有数据仅保存在你的本机浏览器中，不会上传到任何服务器。
        </p>
      </div>
    </div>
  )
}

function StepTitle({ n, title }: { n: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {n} · 完成设置
      </div>
      <h2 className="text-lg font-semibold mt-1">{title}</h2>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5"
      />
    </div>
  )
}

function FormButtons({ onBack, onNext }: { onBack?: () => void; onNext: () => void }) {
  return (
    <div className="pt-1 flex gap-3">
      {onBack && (
        <Button variant="outline" onClick={onBack}>
          上一步
        </Button>
      )}
      <Button className="flex-1" size="lg" onClick={onNext}>
        继续
      </Button>
    </div>
  )
}
