import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { EXERCISES, MUSCLE_GROUPS } from '../lib/exercises'
import { PageHeader } from '../components/ui-kit'
import { Input } from '../components/ui/input'
import { muscleCn, equipCn, typeCn } from '../lib/utils'

export default function ExerciseLibrary() {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')

  let list = EXERCISES.filter((e) => {
    const matchQ = !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.nameCn.includes(q)
    const matchM = !muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)
    return matchQ && matchM
  })

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <PageHeader title="动作库" subtitle={`${EXERCISES.length} 个动作 · 全部动作与目标肌群相关联`} />

      <div className="flex flex-col gap-4 mb-6">
        <div className="relative max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索动作名称…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(muscle === m ? '' : m)}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                muscle === m ? 'border-foreground bg-accent font-medium' : ''
              }`}
            >
              {muscleCn(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map((ex) => (
          <Link
            key={ex.id}
            to={`/training/exercise/${ex.id}`}
            className="rounded-2xl border bg-card p-5 hover:border-foreground/40 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{ex.nameCn}</div>
                <div className="text-[12px] text-muted-foreground">{ex.name}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium">
                {muscleCn(ex.primaryMuscle)}
              </span>
              {ex.secondaryMuscles.slice(0, 2).map((m) => (
                <span key={m} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {muscleCn(m)}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {equipCn(ex.equipment)} · {typeCn(ex.type)} · {ex.repRange}
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">没有匹配的动作。</p>
      )}
    </div>
  )
}
