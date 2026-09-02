import { useRef, useState } from 'react'
import { ArrowLeft, Camera, Plus, X, Check, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { setState, todayISO, uid } from '../lib/store'
import { analyzeFoodByName, AI_MODE } from '../lib/ai'
import { PageHeader } from '../components/ui-kit'
import type { FoodEntry } from '../types'

const TYPES = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

// 视觉识别是否已接入
const VISION_ENABLED = AI_MODE === 'cloud-vision'

export default function Meals() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState('lunch')
  const [photo, setPhoto] = useState<string | null>(null)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [pickedName, setPickedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onPhoto = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  // 模拟 AI 识别：从照片文件名/手动输入的食物名推算
  const runAI = () => {
    const name = pickedName.trim() || '米饭'
    const found = analyzeFoodByName(name)
    if (found.length) {
      setEntries((prev) => [...prev, ...found])
    } else {
      // 未知食物 -> 添加待确认条目，标记低置信度
      setEntries((prev) => [
        ...prev,
        {
          id: uid('e'),
          name,
          grams: 100,
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 4,
          confidence: 0.3,
          aiSuggested: true,
        },
      ])
    }
    setPickedName('')
  }

  const updateEntry = (id: string, patch: Partial<FoodEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id))

  const saveMeal = () => {
    setSaving(true)
    setState((s) => ({
      ...s,
      meals: [
        ...s.meals,
        {
          id: uid('meal'),
          date: todayISO(),
          type: type as any,
          entries,
          photo,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
    setSaved(true)
    setSaving(false)
  }

  const reset = () => {
    setPhoto(null)
    setEntries([])
    setPickedName('')
    setSaved(false)
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-lg px-8 py-10 text-center">
        <div className="mx-auto size-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
          <Check className="size-7" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">餐食已记录</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {entries.length} 项食物 · {Math.round(entries.reduce((a, e) => a + e.calories, 0))} kcal
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={reset}>再记一餐</Button>
          <Button variant="outline" onClick={() => (location.hash = '#/nutrition/today')}>
            查看今日营养
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <button onClick={() => (location.hash = '#/nutrition/today')} className="mb-6 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 返回
      </button>

      <PageHeader title="记录一餐" subtitle="拍照或手动记录，热量数值为估算、可修改后确认" />

      {/* AI 服务状态提示：诚实标示当前未接入真实视觉 AI */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {VISION_ENABLED ? 'AI 视觉识别已接入' : 'AI Service Not Configured — 视觉识别未接入'}
            </div>
            <p className="mt-1 leading-relaxed">
              {VISION_ENABLED
                ? '食物照片将被发送到视觉模型进行识别。'
                : '当前未连接真实视觉 AI 服务，照片不会进行 AI 分析。你可以输入食物名称，由本机规则引擎（DEMO）估算热量，结果仅供参考，请逐项核对后确认。'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`flex-1 rounded-lg border py-2 text-[13px] font-medium ${
              type === t.key ? 'border-foreground bg-accent' : ''
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 拍照 */}
      <div className="rounded-2xl border bg-card p-6">
        <Label>食物照片</Label>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        {photo ? (
          <div className="mt-3 relative">
            <img src={photo} alt="food" className="w-full max-h-56 object-cover rounded-xl" />
            <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white grid place-items-center">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 w-full border-2 border-dashed rounded-xl py-10 text-center hover:bg-muted/40"
          >
            <Camera className="size-8 mx-auto text-muted-foreground" />
            <span className="mt-2 block text-sm text-muted-foreground">上传或拍摄食物照片</span>
          </button>
        )}
      </div>

      {/* AI 识别 / 手动添加 */}
      <div className="mt-4 rounded-2xl border bg-card p-6">
        <Label>食物识别（DEMO 引擎）</Label>
        <p className="text-[12px] text-muted-foreground mt-1">
          输入食物名称（如「鸡胸肉」）由本机规则引擎估算各项营养；每项数值都可修改，确认后才会计入今日摄入。
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={pickedName}
            onChange={(e) => setPickedName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAI()}
            placeholder="例如：鸡胸肉、米饭、西兰花"
          />
          <Button variant="secondary" onClick={runAI}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>
      </div>

      {/* 条目列表（可编辑） */}
      {entries.length > 0 && (
        <div className="mt-4 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">已识别食物</span>
            <span className="text-[12px] text-muted-foreground">
              {Math.round(entries.reduce((a, e) => a + e.calories, 0))} kcal ·{' '}
              {Math.round(entries.reduce((a, e) => a + e.protein, 0))}g 蛋白质
            </span>
          </div>
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{e.name}</span>
                    {e.aiSuggested && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        DEMO 估算 · {(e.confidence * 100).toFixed(0)}% 可信度
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeEntry(e.id)} className="text-muted-foreground">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2 text-[13px]">
                  <EditNum label="克" value={e.grams} onChange={(v) => updateEntry(e.id, { grams: v })} />
                  <EditNum label="kcal" value={Math.round(e.calories)} onChange={(v) => updateEntry(e.id, { calories: v })} />
                  <EditNum label="蛋白质" value={Math.round(e.protein)} onChange={(v) => updateEntry(e.id, { protein: v })} />
                  <EditNum label="碳水" value={Math.round(e.carbs)} onChange={(v) => updateEntry(e.id, { carbs: v })} />
                  <EditNum label="脂肪" value={Math.round(e.fat)} onChange={(v) => updateEntry(e.id, { fat: v })} />
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full gap-2" size="lg" onClick={saveMeal} disabled={saving}>
            <Check className="size-4" /> CONFIRM MEAL · 确认这一餐
          </Button>
        </div>
      )}
    </div>
  )
}

function EditNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 mt-0.5"
      />
    </div>
  )
}
