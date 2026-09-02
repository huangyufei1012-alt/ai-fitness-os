import { useRef, useState } from 'react'
import { Camera, X, Sparkles, Shield } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState, setState, todayISO, uid } from '../lib/store'
import { analyzeBodyScan } from '../lib/ai'
import { PageHeader } from '../components/ui-kit'
import { stars, muscleCn } from '../lib/utils'
import type { BodyPhotoAngle } from '../types'

const ANGLES: { key: BodyPhotoAngle; label: string; hint: string }[] = [
  { key: 'front', label: '正面', hint: '正面' },
  { key: 'back', label: '背面', hint: '背面' },
  { key: 'left', label: '左侧', hint: '左侧' },
  { key: 'right', label: '右侧', hint: '右侧' },
]

export default function BodyScan() {
  const state = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeAngle, setActiveAngle] = useState<BodyPhotoAngle>('front')
  const [photos, setPhotos] = useState<Partial<Record<BodyPhotoAngle, string>>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)

  const onFile = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhotos((p) => ({ ...p, [activeAngle]: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const hasAny = Object.values(photos).some(Boolean)

  const runAnalysis = () => {
    setAnalyzing(true)
    setTimeout(() => {
      const scan = {
        id: uid('scan'),
        date: todayISO(),
        photos,
        analysis: null,
        aiGenerated: true,
      }
      const analysis = analyzeBodyScan(scan, state)
      setResult(analysis)
      setAnalyzing(false)
      // 保存分析结果，供后续 AI 读取历史
      setState((s) => ({
        ...s,
        bodyScans: [{ ...scan, analysis }, ...s.bodyScans],
      }))
    }, 800)
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader title="身体扫描" subtitle="上传身形照片，AI 分析身体状态与训练重点" />

      <div className="rounded-2xl border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-4">
          <Shield className="size-4 text-emerald-600" />
          照片仅保存在本机浏览器，仅供你本人查看，可随时删除。
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ANGLES.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                setActiveAngle(a.key)
                fileRef.current?.click()
              }}
              onMouseEnter={() => setActiveAngle(a.key)}
              className={`rounded-xl border-2 p-3 transition-colors aspect-[3/4] flex flex-col ${
                activeAngle === a.key ? 'border-foreground' : 'border-dashed'
              }`}
            >
              {photos[a.key] ? (
                <div className="relative flex-1">
                  <img src={photos[a.key]} alt={a.label} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                </div>
              ) : (
                <div className="flex-1 grid place-items-center text-muted-foreground">
                  <Camera className="size-7" />
                </div>
              )}
              <div className="pt-2 text-center">
                <div className="text-[13px] font-medium">{a.label}</div>
                <div className="text-[10px] text-muted-foreground">{a.hint}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button
            size="lg"
            className="flex-1 gap-2"
            disabled={!hasAny}
            onClick={runAnalysis}
          >
            <Sparkles className="size-4" />
            {analyzing ? '分析中…' : 'AI 分析身体状态'}
          </Button>
          {hasAny && (
            <Button variant="ghost" onClick={() => setPhotos({})}>
              <X className="size-4" /> 清空
            </Button>
          )}
        </div>
      </div>

      {/* 历史扫描 */}
      {state.bodyScans.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">历史扫描</h3>
          <div className="flex flex-wrap gap-2">
            {state.bodyScans.slice(0, 5).map((s: any) => (
              <span key={s.id} className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
                {s.date}
              </span>
            ))}
          </div>
        </div>
      )}

      {analyzing && (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground animate-pulse">
          正在基于照片分析身体构成与训练状态…
        </div>
      )}

      {result && !analyzing && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              整体视觉状态
            </div>
            <p className="text-[14px] leading-relaxed text-foreground/90">{result.overall}</p>
            {result.bodyFat && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[12px] text-amber-800">
                体脂：{result.bodyFat.range} · 置信度 {(result.bodyFat.confidence * 100).toFixed(0)}%
                <span className="opacity-70">（仅估算，非测量）</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.muscles.map((m: any) => (
              <div key={m.muscle} className="rounded-2xl border bg-card px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-[14px]">{muscleCn(m.muscle)}</div>
                  <div className="text-[11px] text-muted-foreground">{m.note}</div>
                </div>
                <div className="text-amber-500 tracking-tight">{stars(m.stars)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Conclusion title="优势" items={result.strengths} />
            <Conclusion title="优先级" items={result.priorities} />
            <div className="rounded-2xl border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                下一阶段训练重点
              </div>
              <p className="text-[14px] leading-relaxed">{result.nextFocus}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Conclusion({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-[13px] leading-relaxed flex gap-2">
            <span className="text-emerald-600">✓</span> {t}
          </li>
        ))}
      </ul>
    </div>
  )
}
