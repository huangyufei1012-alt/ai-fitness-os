import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Sparkles, Save, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PageHeader } from '../components/ui-kit'
import { useAppState, setState, resetAll, todayISO } from '../lib/store'
import { generateTrainingPlan, recalculateNutrition } from '../lib/data-plans'
import { muscleCn, equipCn } from '../lib/utils'
import type { ActivityLevel, Goal, UserProfile } from '../types'

const GOALS: { key: Goal; label: string }[] = [
  { key: 'bulk', label: '增肌' },
  { key: 'cut', label: '减脂' },
  { key: 'maintain', label: '维持' },
  { key: 'strength', label: '力量' },
]

const EXPERIENCE: { key: 'beginner' | 'intermediate' | 'advanced'; label: string }[] = [
  { key: 'beginner', label: '新手 (<1年)' },
  { key: 'intermediate', label: '中级 (1-3年)' },
  { key: 'advanced', label: '高级 (3年+)' },
]

const ACTIVITY: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: '久坐少动' },
  { key: 'light', label: '轻度活动' },
  { key: 'moderate', label: '中度活动' },
  { key: 'active', label: '高度活跃' },
  { key: 'very_active', label: '极高活跃' },
]

const EQUIPMENT = ['Barbell', 'Dumbbells', 'Machine', 'Cable', 'Bodyweight']

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes']

const SESSION_MINUTES = [45, 60, 75, 90]

interface Draft extends UserProfile {}

export default function Settings() {
  const nav = useNavigate()
  const state = useAppState()
  const profile = state.profile

  // 草稿：未保存前不写入全局，避免静默覆盖
  const [draft, setDraft] = useState<Draft>(() => ({
    name: profile?.name ?? '运动员',
    sex: profile?.sex ?? 'male',
    goal: profile?.goal ?? 'bulk',
    yearsExperience: profile?.yearsExperience ?? 1,
    age: profile?.age ?? 25,
    heightCm: profile?.heightCm ?? 175,
    weightKg: profile?.weightKg ?? 75,
    targetWeightKg: profile?.targetWeightKg,
    targetDate: profile?.targetDate,
    activityLevel: profile?.activityLevel ?? 'moderate',
    daysPerWeek: profile?.daysPerWeek ?? 4,
    minutesPerSession: profile?.minutesPerSession ?? 60,
    equipment: profile?.equipment ?? ['Barbell', 'Dumbbells', 'Machine', 'Cable'],
    focusMuscles: profile?.focusMuscles ?? [],
    currentTopWeights: profile?.currentTopWeights ?? {},
    dislikedExercises: profile?.dislikedExercises ?? [],
    preferredExercises: profile?.preferredExercises ?? [],
    notes: profile?.notes ?? '',
  }))

  const [notice, setNotice] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <p className="text-sm text-muted-foreground">尚未创建健身档案。</p>
      </div>
    )
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  // 判断是否触发营养重算（体重/目标/活动水平 变更）
  const nutritionAffected =
    draft.weightKg !== profile.weightKg ||
    draft.goal !== profile.goal ||
    draft.activityLevel !== profile.activityLevel

  const [recalcChoice, setRecalcChoice] = useState<'recalc' | 'keep' | null>(
    nutritionAffected ? 'keep' : null,
  )

  const save = () => {
    const nextProfile: UserProfile = {
      ...draft,
      currentTopWeights: profile.currentTopWeights,
      dislikedExercises: profile.dislikedExercises,
      preferredExercises: profile.preferredExercises,
      notes: draft.notes,
    }

    // 构建营养计划：仅当用户选择重算或尚无计划时才重算，否则保留原计划
    let nutritionPlan = state.nutritionPlan
    if (recalcChoice === 'recalc' || !state.nutritionPlan) {
      nutritionPlan = recalculateNutrition(nextProfile, nextProfile.weightKg, state.nutritionPlan ?? undefined)
    }

    // 训练计划跟随天数/性别/经验/器械/重点肌群变化
    const trainingPlan = generateTrainingPlan(nextProfile)

    setState((s) => ({
      ...s,
      profile: nextProfile,
      nutritionPlan,
      trainingPlan,
      ...(draft.weightKg !== profile.weightKg
        ? {
            bodyMeasurements: s.bodyMeasurements.map((m, i) =>
              i === 0 ? { ...m, weightKg: draft.weightKg } : m,
            ),
          }
        : {}),
    }))

    // 轻量验证提示：只提醒、不阻止保存
    const warnings: string[] = []
    const tw = nextProfile.targetWeightKg
    if (nextProfile.goal === 'bulk' && tw != null && tw < nextProfile.weightKg)
      warnings.push('目标设为增肌，但目标体重低于当前体重，请确认目标方向。')
    if (nextProfile.goal === 'cut' && tw != null && tw > nextProfile.weightKg)
      warnings.push('目标设为减脂，但目标体重高于当前体重，请确认目标方向。')
    if (nextProfile.targetDate && nextProfile.targetDate < todayISO())
      warnings.push('目标日期早于今天，请检查是否填写有误。')
    if (
      nextProfile.targetDate &&
      tw != null &&
      (new Date(nextProfile.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 30
    )
      warnings.push('目标日期距今天不足 30 天，目标周期较短，请合理设定。')

    const base =
      recalcChoice === 'recalc'
        ? '已保存并重新计算每日营养目标。'
        : nutritionAffected
          ? '已保存。因你修改了影响营养摄入的字段，建议重新计算营养目标（可在下方点击「重算营养」）。'
          : '已保存。'

    setNotice(warnings.length ? `${base}\n${warnings.join('\n')}` : base)
    setWarnings(warnings)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <PageHeader
        title="Fitness Profile"
        subtitle="管理你的身体数据、训练目标与营养依据。所有数据仅保存在本机浏览器。"
        right={
          <Button variant="outline" size="sm" onClick={() => nav(-1)}>
            <ArrowLeft className="size-4" /> 返回
          </Button>
        }
      />

      {notice && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1.5">以下设置需要留意（仅提醒，不影响保存）：</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {/* 基本信息 */}
        <Section title="基本信息">
          <div className="grid grid-cols-2 gap-4">
            <Field label="昵称">
              <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="性别">
              <Segmented
                options={[
                  { key: 'male', label: '男' },
                  { key: 'female', label: '女' },
                ]}
                value={draft.sex}
                onChange={(v) => set({ sex: v as 'male' | 'female' })}
              />
            </Field>
            <Field label="年龄">
              <Input type="number" value={draft.age} onChange={(e) => set({ age: Number(e.target.value) })} />
            </Field>
            <Field label="身高 (cm)">
              <Input type="number" value={draft.heightCm} onChange={(e) => set({ heightCm: Number(e.target.value) })} />
            </Field>
            <Field label="当前体重 (kg)" hint="会影响营养目标">
              <Input type="number" value={draft.weightKg} onChange={(e) => set({ weightKg: Number(e.target.value) })} />
            </Field>
            <Field label="训练经验">
              <select
                value={draft.yearsExperience === 1 ? 'beginner' : draft.yearsExperience === 2 ? 'intermediate' : 'advanced'}
                onChange={(e) => {
                  const k = e.target.value
                  set({
                    yearsExperience: k === 'beginner' ? 1 : k === 'intermediate' ? 2 : 5,
                  })
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {EXPERIENCE.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* 目标与计划 */}
        <Section title="目标与营养">
          <div className="grid grid-cols-2 gap-4">
            <Field label="训练目标" hint="影响每日热量基准">
              <Segmented
                options={GOALS.map((g) => ({ key: g.key, label: g.label }))}
                value={draft.goal}
                onChange={(v) => set({ goal: v as Goal })}
              />
            </Field>
            <Field label="活动水平" hint="影响热量消耗计算">
              <select
                value={draft.activityLevel}
                onChange={(e) => set({ activityLevel: e.target.value as ActivityLevel })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {ACTIVITY.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="目标体重 (kg)">
              <Input
                type="number"
                value={draft.targetWeightKg ?? ''}
                onChange={(e) => set({ targetWeightKg: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </Field>
            <Field label="目标日期">
              <Input
                type="date"
                value={draft.targetDate ?? ''}
                onChange={(e) => set({ targetDate: e.target.value || undefined })}
              />
            </Field>
            <Field label="每周训练天数">
              <Segmented
                options={[3, 4, 5].map((d) => ({ key: String(d), label: `${d} 天` }))}
                value={String(draft.daysPerWeek)}
                onChange={(v) => set({ daysPerWeek: Number(v) })}
              />
            </Field>
            <Field label="每次训练时长">
              <Segmented
                options={SESSION_MINUTES.map((m) => ({ key: String(m), label: `${m} 分钟` }))}
                value={String(draft.minutesPerSession)}
                onChange={(v) => set({ minutesPerSession: Number(v) })}
              />
            </Field>
          </div>

          {nutritionAffected && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2 text-amber-800">
                <Sparkles className="size-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">你修改了影响营养摄入的字段（体重 / 目标 / 活动水平）。</p>
                  <p className="mt-0.5 text-amber-700">
                    重新计算会让每日热量与宏量营养匹配新的身体数据。
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setRecalcChoice('recalc')}>
                  <Sparkles className="size-3.5" />
                  {recalcChoice === 'recalc' ? '将重算 ✓' : '保存并重新计算'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRecalcChoice('keep')}
                  className={recalcChoice !== 'recalc' ? 'border-amber-300 text-amber-800' : ''}
                >
                  保留当前营养目标
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* 训练偏好 */}
        <Section title="训练偏好">
          <div className="space-y-5">
            <div>
              <Label>可用器械</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {EQUIPMENT.map((e) => {
                  const on = draft.equipment.includes(e)
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() =>
                        set({
                          equipment: on ? draft.equipment.filter((x) => x !== e) : [...draft.equipment, e],
                        })
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                        on ? 'border-foreground bg-accent font-medium' : ''
                      }`}
                    >
                      {equipCn(e)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>重点发展肌群</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {MUSCLES.map((m) => {
                  const on = draft.focusMuscles.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        set({
                          focusMuscles: on
                            ? draft.focusMuscles.filter((x) => x !== m)
                            : [...draft.focusMuscles, m],
                        })
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                        on ? 'border-foreground bg-accent font-medium' : ''
                      }`}
                    >
                      {muscleCn(m)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>教练备注</Label>
              <textarea
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
                className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="如：优先练背、膝盖有旧伤……"
              />
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button onClick={save}>
            <Save className="size-4" /> 保存更改
          </Button>
        </div>

        {/* 危险操作 */}
        <div className="rounded-2xl border border-destructive/30 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-destructive">重置应用数据</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                清空所有本地数据（档案、训练、营养、聊天记录），此操作不可撤销。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive"
              onClick={() => {
                if (window.confirm('确定清空所有本地数据？此操作不可撤销。')) {
                  resetAll()
                  nav('/')
                }
              }}
            >
              <Trash2 className="size-4" /> 重置
            </Button>
          </div>
        </div>

        {/* 快捷工具 */}
        <div className="rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">重新计算营养目标</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                基于当前体重、目标与活动水平重新生成每日热量与宏量营养。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const np = recalculateNutrition(draft, draft.weightKg, state.nutritionPlan ?? undefined)
                setState((s) => ({ ...s, nutritionPlan: np }))
                setNotice('已基于当前档案重新计算营养目标。')
              }}
            >
              <RotateCcw className="size-4" /> 重算营养
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
            value === o.key ? 'border-foreground bg-accent' : ''
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
