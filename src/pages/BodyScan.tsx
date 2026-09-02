import { useRef, useState } from 'react'
import { Camera, X, Shield, AlertTriangle, Check } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppState, setState, todayISO, uid } from '../lib/store'
import { AI_MODE } from '../lib/ai'
import { PageHeader } from '../components/ui-kit'

// 视觉分析是否已接入（当前未接入，诚实标示；照片仅本地保存、不出假分析）
const VISION_ENABLED = AI_MODE === 'cloud-vision'

const ANGLES: { key: 'front' | 'back' | 'left' | 'right'; label: string; hint: string }[] = [
  { key: 'front', label: '正面', hint: '正面' },
  { key: 'back', label: '背面', hint: '背面' },
  { key: 'left', label: '左侧', hint: '左侧' },
  { key: 'right', label: '右侧', hint: '右侧' },
]

export default function BodyScan() {
  const state = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeAngle, setActiveAngle] = useState<'front' | 'back' | 'left' | 'right'>('front')
  const [photos, setPhotos] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  // 仅保存照片档案，不生成任何假分析
  const saveScan = () => {
    setSaving(true)
    setState((s) => ({
      ...s,
      bodyScans: [
        {
          id: uid('scan'),
          date: todayISO(),
          photos,
          analysis: null,
          aiGenerated: false,
        },
        ...s.bodyScans,
      ],
    }))
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader title="身体扫描" subtitle="上传身形照片建档，仅保存在本机；AI 分析未接入时不会生成虚假结论" />

      {/* AI 服务状态提示 */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {VISION_ENABLED ? 'AI 视觉分析已接入' : 'AI Service Not Configured — 视觉分析未接入'}
            </div>
            <p className="mt-1 leading-relaxed">
              {VISION_ENABLED
                ? '身形照片将被发送到视觉模型进行分析。'
                : '当前未连接真实视觉 AI 服务。你可以上传照片并在本机保存建档，但系统不会输出任何自动分析结论（如体脂率或肌群星级），避免给出虚假判断。接入服务后此处才会显示分析结果。'}
            </p>
          </div>
        </div>
      </div>

      {saved ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto size-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
            <Check className="size-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">照片已保存</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            照片仅保存在本机浏览器，未进行 AI 分析，后续可在历史扫描中查看。
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => { setPhotos({}); setSaved(false) }}>再传一组</Button>
          </div>
        </div>
      ) : (
        <>
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
                disabled={!hasAny || saving}
                onClick={saveScan}
              >
                {saving ? '保存中…' : '保存照片档案（仅本地）'}
              </Button>
              {hasAny && (
                <Button variant="ghost" onClick={() => setPhotos({})}>
                  <X className="size-4" /> 清空
                </Button>
              )}
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              保存后不会自动生成体脂率、肌群评分等分析结论——未接入真实 AI 服务时不输出假数据。
            </p>
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
              {state.bodyScans.every((s: any) => !s.analysis) && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  均为本地照片存档 · 无 AI 分析结论（服务未接入）
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
