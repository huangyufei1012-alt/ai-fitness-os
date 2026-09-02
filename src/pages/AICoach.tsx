import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { useAppState, setState, uid } from '../lib/store'
import { buildAIContext, nutritionTotals, AI_MODE } from '../lib/ai'
import { getExercise } from '../lib/exercises'
import { PageHeader } from '../components/ui-kit'
import { muscleCn } from '../lib/utils'

// Phase 1：AI 教练使用"本地规则引擎 + 用户真实数据"回答。
// 接入真实 LLM 时，将 getCoachReply 替换为对 cloud API 的调用，
// 并把 buildAIContext(state) 的输出作为 system prompt。
const CLOUD_LLM_ON = AI_MODE !== 'local-rules'

export default function AICoach() {
  const state = useAppState()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'welcome',
      role: 'coach',
      text: `你好${state.profile?.name || ''}！我能读取你的训练、饮食、体重和身体分析记录。你可以问我：为什么卧推没进步？今天能不能练胸？晚餐该吃什么？未来想重点发展哪个部位。`,
      at: new Date().toISOString(),
    },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { id: uid('u'), role: 'user', text, at: new Date().toISOString() }])
    setInput('')
    setLoading(true)
    setTimeout(() => {
      const reply = getCoachReply(state, text)
      setState((s) => ({
        ...s,
        memory: {
          ...s.memory,
          updatedAt: new Date().toISOString(),
        },
      }))
      setMessages((m) => [
        ...m,
        {
          id: uid('c'),
          role: 'coach',
          text: reply.text,
          at: new Date().toISOString(),
          cited: reply.cited,
        },
      ])
      setLoading(false)
    }, 700)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-6 h-[calc(100vh-80px)] flex flex-col">
      <PageHeader
        title="AI 教练"
        subtitle="结合你的真实历史数据回答，避免泛泛而谈"
        right={
          <span className={`inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full ${CLOUD_LLM_ON ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {CLOUD_LLM_ON ? (
              <><Sparkles className="size-3.5" /> AI 服务已接入</>
            ) : (
              <><AlertTriangle className="size-3.5" /> DEMO · 本地规则引擎（未接入云端 LLM）</>
            )}
          </span>
        }
      />

      {!CLOUD_LLM_ON && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800">
          当前为本地规则引擎（Local Rules）：回答基于你的真实训练、营养与身体记录，不会调用云端模型，也不会显示虚假的"AI 生成"结论。接入真实 LLM 后此状态自动切换。
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="size-8 rounded-full bg-foreground text-background grid place-items-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-3 text-[13px] text-muted-foreground animate-pulse">
              结合你的数据思考中…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 border rounded-2xl bg-card p-3 flex items-end gap-2">
        <Textarea
          aria-label="给 AI 教练的消息"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="问你的 AI 教练任何训练/饮食问题…"
          className="border-0 focus-visible:ring-0 resize-none max-h-32"
          rows={1}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || loading} aria-label="发送消息">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function Message({ msg }: any) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="size-8 rounded-full bg-foreground text-background grid place-items-center shrink-0">
          <Sparkles className="size-4" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'bg-foreground text-background' : 'bg-muted'} rounded-2xl px-4 py-3 text-[14px] leading-relaxed`}>
        {msg.text}
        {msg.cited && (
          <div className="mt-2 text-[12px] text-muted-foreground border-t pt-1.5">{msg.cited}</div>
        )}
      </div>
    </div>
  )
}

// ---- 本地规则引擎：基于用户真实数据回答 ----
function getCoachReply(state: any, q: string) {
  const p = state.profile
  const nut = nutritionTotals(state)
  const macros = state.nutritionPlan
  const ctx = buildAIContext(state)

  // 关键词路由
  if (/卧推|胸|bench|push/i.test(q) && /进步|停滞|没效果|no progress|不上分/i.test(q)) {
    const benchHist = state.workoutHistory
      .map((w: any) => ({ date: w.date, rec: w.exerciseRecords.find((r: any) => r.exerciseId === 'bench-press') }))
      .filter((x: any) => x.rec && x.rec.sets.some((s: any) => s.done))
      .sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
    if (benchHist.length >= 2) {
      const last = benchHist[benchHist.length - 1].rec.sets.filter((s: any) => s.done)
      const topW = Math.max(...last.map((s: any) => s.weight))
      return {
        text: `根据你的记录，最近一次杠铃卧推最高用到 ${topW}kg。卧推进步停滞常见三个原因：${p?.focusMuscles?.length ? '' : ''}1) 胸部训练量或频率不足；2) 三头/肩前束容量不够；3) 恢复不足。建议：把卧推安排在训练开始（状态最好时），尝试小幅加重 +2.5kg 并保证每组 RIR 1-2。`,
        cited: `已读取你的卧推历史与近期容量。`,
      }
    }
    return { text: '你还没记录卧推历史。先完成一次训练，我才能依据你的真实数据诊断。', cited: '暂无卧推历史数据' }
  }

  if (/酸|累|恢复|还能练|sore|fatigue/i.test(q) && /胸|练/i.test(q)) {
    const last = state.workoutHistory[state.workoutHistory.length - 1]
    if (last) {
      return {
        text: `你最近一次训练是 ${last.date}，共 ${last.exerciseRecords.length} 个动作。如果目标肌群仍有明显酸痛，建议今天优先安排**其他肌群**或低强度有氧，给目标肌群 48-72 小时恢复。若只是轻微酸胀则可正常训练。`,
        cited: `最近训练：${last.date} · ${last.planName}`,
      }
    }
    return { text: '你还没有训练记录。先完成训练再让身体数据说话。', cited: '' }
  }

  if (/聚餐|晚上|party|dinner|怎么吃/i.test(q)) {
    if (macros) {
      const remainP = Math.round(macros.protein - nut.protein)
      return {
        text: `你今天的摄入：${Math.round(nut.calories)}/${macros.calories} kcal，蛋白质还差约 ${Math.max(0, remainP)}g。晚上聚餐建议：优先点清蒸/烤制的瘦肉与鱼虾（保证蛋白质），蔬菜吃到饱，主食适量；尽量少糖油重的酱汁。若聚餐热量较高，明天可稍微减少主食补回来，不必焦虑。`,
        cited: `今日已摄入 ${Math.round(nut.calories)} kcal · P ${Math.round(nut.protein)}g`,
      }
    }
    return { text: '先完成营养设置，我才能给你精确建议。', cited: '' }
  }

  if (/体重|不涨|没涨|plateau|为什么.*重/i.test(q) && /上|涨|增/i.test(q)) {
    const ws = state.bodyMeasurements.filter((m: any) => m.weightKg != null)
    if (ws.length >= 4) {
      const avg = (arr: any[]) => arr.reduce((a: any, b: any) => a + b.weightKg, 0) / arr.length
      const last7 = ws.slice(-7)
      const a7 = avg(last7)
      const a14 = avg(ws.slice(-14))
      return {
        text: `近7日均值 ${a7.toFixed(1)}kg，比近14日均值 ${a14.toFixed(1)}kg ${a7 >= a14 ? '略有上升' : '略降'}。增肌期体重2周不涨，通常意味着热量盈余不足。建议：在现有基础上每日 +200kcal（优先主食或一顿加餐），再连续观察7天，不因单日波动急着改。`,
        cited: `近7日均值 ${a7.toFixed(1)} · 近14日均值 ${a14.toFixed(1)}`,
      }
    }
    return { text: '体重记录还不够（需≥4条）。我按周趋势给你判断，不会只看单日波动。', cited: '' }
  }

  if (/重点|发展|肩|focus|priority/i.test(q) && /肩|shoulder|8周|未来/i.test(q)) {
    return {
      text: `提升肩部重点：1) 侧平举每周 12-20 组，用中低重量高次数；2) 加入面拉/反向飞鸟平衡肩后束；3) 卧推/上斜时注意别让前束过度代偿。若你想未来8周重点发展肩部，我可以把训练计划中肩部动作频率从每周1次提升到2次，并告诉你哪些动作优先。`,
      cited: '基于你的重点肌群设置生成',
    }
  }

  // 刚才训练了哪些肌群 —— 引用真实最近训练记录
  if (/刚才|最近|刚刚.*训练|练了哪些|哪些肌群|今天练了|都练了/i.test(q)) {
    const lastW = state.workoutHistory[state.workoutHistory.length - 1]
    if (lastW) {
      const muscles = new Map<string, number>()
      lastW.exerciseRecords.forEach((r: any) => {
        const ex = getExercise(r.exerciseId)
        if (!ex) return
        const done = r.sets.filter((s: any) => s.done).length
        if (done) {
          muscles.set(ex.primaryMuscle, (muscles.get(ex.primaryMuscle) || 0) + done)
        }
        ex.secondaryMuscles.forEach((m: string) => {
          if (done) muscles.set(m, (muscles.get(m) || 0) + done)
        })
      })
      const sorted = [...muscles.entries()].sort((a, b) => b[1] - a[1])
      if (sorted.length) {
        const muscleList = sorted
          .slice(0, 5)
          .map(([m, n]) => `${muscleCn(m)}（${n} 组）`)
          .join('、')
        const doneTotal = lastW.exerciseRecords.reduce(
          (a: number, r: any) => a + r.sets.filter((s: any) => s.done).length,
          0,
        )
        return {
          text: `你最近一次训练是 ${lastW.date}（${lastW.planName}），共完成 ${doneTotal} 组，主要刺激到：${muscleList}。${sorted[0] ? '若这几个肌群仍有明显酸痛，建议休息 48-72 小时再安排下一次针对训练；轻微酸胀则可正常训练。' : ''}`,
          cited: `最近训练 ${lastW.date} · ${lastW.planName} · ${doneTotal} 组`,
        }
      }
    }
    return {
      text: '你还没有训练记录。先完成一次训练，我就能告诉你练到了哪些肌群。',
      cited: '',
    }
  }

  // 兜底：基于上下文 + 最近数据
  const lastW = state.workoutHistory[state.workoutHistory.length - 1]
  let generic = `我查看了你的档案：${p ? `${p.yearsExperience}年经验 · 每周${p.daysPerWeek}练 · ${p.focusMuscles.map(muscleCn).join('、') || '均衡'}。` : '尚未建立档案。'}`
  if (lastW) generic += `最近一次训练是 ${lastW.date}（${lastW.planName}）。`
  if (macros) generic += `今日已摄入 ${Math.round(nut.calories)}/${macros.calories} kcal。`
  generic += ' 为了给你更精准的建议，请把问题说得更具体（例如关于某个动作的进步、某部位酸痛、或今天的饮食怎么安排）。'
  return { text: generic, cited: ctx.split('\n')[0] || '' }
}
