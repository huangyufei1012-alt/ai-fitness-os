import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useAppState, setState, todayISO, uid } from '../lib/store'
import { PageHeader, Stat } from '../components/ui-kit'
import { fmtDate } from '../lib/utils'

export default function Progress() {
  const state = useAppState()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ weight: '', waist: '', chest: '', arms: '', thigh: '' })

  const me = state.bodyMeasurements
  const weights = me.filter((m) => m.weightKg != null).map((m) => ({ date: m.date, v: m.weightKg! }))
  const latest = me[me.length - 1]

  const save = () => {
    setState((s) => ({
      ...s,
      bodyMeasurements: [
        ...s.bodyMeasurements,
        {
          id: uid('m'),
          date: todayISO(),
          weightKg: form.weight ? Number(form.weight) : null,
          waistCm: form.waist ? Number(form.waist) : null,
          chestCm: form.chest ? Number(form.chest) : null,
          armsCm: form.arms ? Number(form.arms) : null,
          thighCm: form.thigh ? Number(form.thigh) : null,
        },
      ],
    }))
    setShow(false)
    setForm({ weight: '', waist: '', chest: '', arms: '', thigh: '' })
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader
        title="变化追踪"
        subtitle="身体变化追踪 · 围度与体重的长期趋势"
        right={
          <Button onClick={() => setShow(true)}>
            <Plus className="size-4" /> 记录围度
          </Button>
        }
      />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Stat label="体重" value={latest?.weightKg?.toFixed(1) ?? '—'} unit="kg" />
        <Stat label="腰围" value={latest?.waistCm?.toFixed(1) ?? '—'} unit="cm" />
        <Stat label="胸围" value={latest?.chestCm?.toFixed(1) ?? '—'} unit="cm" />
        <Stat label="臂围" value={latest?.armsCm?.toFixed(1) ?? '—'} unit="cm" />
        <Stat label="腿围" value={latest?.thighCm?.toFixed(1) ?? '—'} unit="cm" />
      </div>

      {show && (
        <div className="rounded-2xl border bg-card p-6 mb-6">
          <h3 className="font-semibold mb-3">记录今日身体围度</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="体重 kg" val={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
            <Field label="腰围 cm" val={form.waist} onChange={(v) => setForm({ ...form, waist: v })} />
            <Field label="胸围 cm" val={form.chest} onChange={(v) => setForm({ ...form, chest: v })} />
            <Field label="臂围 cm" val={form.arms} onChange={(v) => setForm({ ...form, arms: v })} />
            <Field label="腿围 cm" val={form.thigh} onChange={(v) => setForm({ ...form, thigh: v })} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>保存</Button>
            <Button variant="ghost" onClick={() => setShow(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 体重趋势 */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold mb-4">体重趋势</h3>
        {weights.length >= 2 ? (
          <>
            <div className="flex items-end gap-1 h-36">
              {weights.slice(-30).map((w, i) => {
                const min = Math.min(...weights.slice(-30).map((x) => x.v))
                const max = Math.max(...weights.slice(-30).map((x) => x.v))
                const h = max === min ? 8 : ((w.v - min) / (max - min)) * 120 + 8
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${w.date}: ${w.v}kg`}>
                    <div className="w-full rounded-t bg-foreground/80" style={{ height: `${h}px` }} />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{fmtDate(weights.slice(-30)[0].date)}</span>
              <span>{fmtDate(weights[weights.length - 1].date)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">记录至少 2 次体重后即可查看趋势。（体重变化请参考周趋势，勿因单日波动紧张）</p>
        )}
      </div>

      {/* 历史记录 */}
      <div className="mt-6">
        <h3 className="font-semibold mb-3">历史记录</h3>
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-[11px] uppercase text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">日期</th>
                <th className="px-4 py-2.5 font-medium">体重</th>
                <th className="px-4 py-2.5 font-medium">腰围</th>
                <th className="px-4 py-2.5 font-medium">胸围</th>
                <th className="px-4 py-2.5 font-medium">臂围</th>
                <th className="px-4 py-2.5 font-medium">腿围</th>
              </tr>
            </thead>
            <tbody>
              {[...me].reverse().slice(0, 15).map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(m.date)}</td>
                  <td className="px-4 py-2.5">{m.weightKg ?? '—'}</td>
                  <td className="px-4 py-2.5">{m.waistCm ?? '—'}</td>
                  <td className="px-4 py-2.5">{m.chestCm ?? '—'}</td>
                  <td className="px-4 py-2.5">{m.armsCm ?? '—'}</td>
                  <td className="px-4 py-2.5">{m.thighCm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Field({ label, val, onChange }: { label: string; val: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <Input type="number" aria-label={label} value={val} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  )
}
