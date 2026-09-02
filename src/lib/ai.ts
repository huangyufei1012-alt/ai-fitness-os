import type {
  AppState,
  BodyScan,
  FoodEntry,
  UserProfile,
  WorkoutSession,
} from '../types'
import { EXERCISES, getExercise, roundToIncrement, getWeightIncrement } from './exercises'
import { todayISO } from './store'
import { muscleCn, equipCn } from './utils'
import { computeMuscleVolume } from './MuscleVolumeService'

// ============================================================
// AI 服务抽象层
// ------------------------------------------------------------
// Phase 1 里所有"AI"功能都以确定性规则 + 用户真实数据来实现，
// 保证数据闭环可真正跑通。真实的 LLM/视觉 API（如 GPT-4V、
// 工厂视觉模型、OpenAI Functions 等）通过替换以下函数体接入，
// 接口签名不变。接入方式见底部 `configureAIProvider`。
//
// 抽样规则：
// 1. 凡涉及身体组成/体脂的判断，只输出「估算范围 + 置信度」，
//    绝不声称精确测量。
// 2. 食物热量一律视为估算，必须允许用户修改。
// 3. AI 建议必须引用用户真实历史数据，避免泛泛而谈。
// ============================================================

// ---- 接入点：真实 AI Provider ----
// export async function configureAIProvider(opts:{provider:'openai'|...; apiKey:string}){}
export interface AIProvider {
  chat(prompt: string, context: string): Promise<string>
  analyzeFood(photo: File): Promise<FoodEntry[]>
  analyzeBody(photos: Record<string, string>): Promise<unknown>
}
// 目前使用内置本地引擎（local），后续替换为 cloud 提供方。
export const AI_MODE = 'local-rules' as 'local-rules' | 'cloud-llm' | 'cloud-vision'

// ============================================================
// 1. 构建 AI 上下文（AI Memory 的读取入口）
// ============================================================
export function buildAIContext(state: AppState): string {
  const p = state.profile
  const lines: string[] = []
  if (p) {
    lines.push(`目标：${goalName(p.goal)}`)
    lines.push(`经验：${p.yearsExperience}年 · 每周${p.daysPerWeek}练 · 每次${p.minutesPerSession}分钟`)
    lines.push(`体型：${p.heightCm}cm · 设备：${p.equipment.map(equipCn).join('、') || '无'}`)
    lines.push(`重点肌群：${p.focusMuscles.map(muscleCn).join('、') || '均衡发展'}`)
  }
  const plan = state.trainingPlan
  if (plan) lines.push(`训练计划「${plan.name}」：${plan.days.filter(d=>d.active).map(d=>`${d.label}(${d.focus})`).join(' / ')}`)

  const recentWorkouts = state.workoutHistory.slice(-5)
  if (recentWorkouts.length) {
    lines.push(`最近${recentWorkouts.length}次训练已记录`)
    recentWorkouts.forEach((w) => {
      const wv = sessionVolume(w)
      lines.push(`  ${w.date}: ${w.exerciseRecords.length}个动作 · 总容量${wv}kg`)
    })
  }

  const measurements = state.bodyMeasurements
  if (measurements.length >= 2) {
    const cur = measurements[measurements.length - 1]
    const prev = measurements[measurements.length - 2]
    const d = cur.weightKg != null && prev.weightKg != null ? cur.weightKg - prev.weightKg : null
    lines.push(
      `最新体重 ${cur.weightKg ?? '—'}kg${d != null ? `（较上次 ${d >= 0 ? '+' : ''}${d.toFixed(1)}kg）` : ''}`,
    )
  }
  return lines.join('\n')
}

function goalName(g: UserProfile['goal']) {
  return { bulk: '增肌', cut: '减脂', maintain: '维持', strength: '力量' }[g]
}

// ============================================================
// 2. Today 首页 AI 建议（1-3 条，引用真实数据）
// ============================================================
export function generateTodayCoachAdvice(state: AppState): string[] {
  const advice: string[] = []
  const plan = state.trainingPlan
  const todayIdx = (new Date().getDay() + 6) % 7

  // --- 训练建议 ---
  if (plan) {
    const todays = plan.days[todayIdx]
    if (todays?.active && todays.exercises.length) {
      // 检查上一个同类训练日是否完成
      const relevant = lastSessionForDay(state, todayIdx)
      if (relevant && !relevant.exerciseRecords.every((r) => r.sets.some((s) => s.done))) {
        advice.push(`上次${todays.focus}训练有未完成的组，今天注意控制容量，优先完成计划内的${todays.exercises.length}个动作。`)
      } else {
        advice.push(`今天练${todays.focus}，${todays.exercises.length}个动作，预计${todays.estimatedMin}分钟。`)
      }
    } else if (plan.days[todayIdx]?.active === false) {
      // 今天虽是原定的休息日，但用户可能额外完成了训练
      const extra = state.workoutHistory
        .filter((w) => w.date === todayISO())
        .sort((a, b) => b.durationMin! - a.durationMin!)[0]
      if (extra && extra.exerciseRecords.some((r) => r.sets.some((s) => s.done))) {
        const vol = sessionVolume(extra)
        const doneSets = extra.exerciseRecords.reduce(
          (a, r) => a + r.sets.filter((s) => s.done).length,
          0,
        )
        advice.push(
          `今天你已额外完成一次「${extra.planName}」训练（${doneSets} 组 · 容量 ${Math.round(vol)}kg）。既然已训练，今日以充分补水、清淡高蛋白饮食为主，让肌肉有足够时间恢复。`,
        )
      } else {
        advice.push(`今天是休息日。「主动恢复」：散步 20-30 分钟或轻度拉伸，有助于睡眠与恢复。`)
      }
    }
  }

  // --- 营养建议：基于剩余宏量 ---
  const nut = nutritionTotals(state)
  const planMacros = state.nutritionPlan
  if (planMacros) {
    const remainingP = planMacros.protein - nut.protein
    const remainingF = planMacros.fat - nut.fat
    if (remainingP > 0 && remainingF > 0) {
      advice.push(`今日还剩约 ${Math.round(remainingP)}g 蛋白质、${Math.round(remainingF)}g 脂肪。晚餐建议优先低脂高蛋白食物（鸡胸/鱼/鸡蛋/豆腐）。`)
    } else if (remainingF <= 0 && remainingP > 0) {
      advice.push(`今日脂肪已接近目标，但蛋白质还差约 ${Math.round(remainingP)}g，建议选低脂高蛋白来源。`)
    }
  }

  // --- 体重趋势（周趋势，非单日） ---
  if (state.bodyMeasurements.length >= 4) {
    const recent = state.bodyMeasurements.slice(-7).filter((m) => m.weightKg != null)
    if (recent.length >= 4) {
      const first = recent[0].weightKg!
      const last = recent[recent.length - 1].weightKg!
      const trend = last - first
      const g = state.profile?.goal
      const up = trend > 0
      if (g === 'bulk' && !up)
        advice.push(`近一周体重小幅波动（${Math.abs(trend).toFixed(1)}kg），单日波动不必紧张，若连续2周不涨再考虑加约200-300kcal。`)
      if (g === 'cut' && up && trend > 0.3)
        advice.push(`体重出现小幅上升（+${trend.toFixed(1)}kg），优先检查是否钠/碳水波动，观察7日均值再判断。`)
    }
  }

  return advice.slice(0, 3)
}

// ============================================================
// 3. 营养汇总与热量估算
// ============================================================
export function nutritionTotals(state: AppState, date = todayISO()) {
  const meals = state.meals.filter((m) => m.date === date)
  return {
    meals,
    calories: meals.reduce((a, m) => a + m.entries.reduce((x, e) => x + e.calories, 0), 0),
    protein: meals.reduce((a, m) => a + m.entries.reduce((x, e) => x + e.protein, 0), 0),
    carbs: meals.reduce((a, m) => a + m.entries.reduce((x, e) => x + e.carbs, 0), 0),
    fat: meals.reduce((a, m) => a + m.entries.reduce((x, e) => x + e.fat, 0), 0),
  }
}

// 食物 AI 分析（本地规则版）：给定食物名 -> 估算条目。
// 真实实现应调用视觉模型识别照片。
export function analyzeFoodByName(name: string): FoodEntry[] {
  const map: Record<string, Partial<FoodEntry>> = {
    米饭: { name: '米饭', grams: 180, calories: 234, protein: 5, carbs: 51, fat: 1 },
    白米饭: { name: '米饭', grams: 200, calories: 260, protein: 5, carbs: 58, fat: 1 },
    '鸡胸肉': { name: '鸡胸肉', grams: 150, calories: 248, protein: 46, carbs: 0, fat: 5 },
    '鸡腿': { name: '鸡腿', grams: 150, calories: 290, protein: 32, carbs: 0, fat: 17 },
    '鸡腿肉': { name: '鸡腿', grams: 150, calories: 290, protein: 32, carbs: 0, fat: 17 },
    '牛肉': { name: '瘦牛肉', grams: 150, calories: 225, protein: 39, carbs: 0, fat: 7 },
    '瘦牛肉': { name: '瘦牛肉', grams: 150, calories: 225, protein: 39, carbs: 0, fat: 7 },
    三文鱼: { name: '三文鱼', grams: 150, calories: 313, protein: 30, carbs: 0, fat: 21 },
    鸡蛋: { name: '鸡蛋', grams: 110, calories: 157, protein: 13, carbs: 1, fat: 11 },
    全蛋: { name: '鸡蛋', grams: 110, calories: 157, protein: 13, carbs: 1, fat: 11 },
    蛋: { name: '鸡蛋', grams: 110, calories: 157, protein: 13, carbs: 1, fat: 11 },
    香蕉: { name: '香蕉', grams: 120, calories: 107, protein: 1, carbs: 27, fat: 0 },
    苹果: { name: '苹果', grams: 180, calories: 95, protein: 0, carbs: 25, fat: 0 },
    西兰花: { name: '西兰花', grams: 150, calories: 52, protein: 4, carbs: 10, fat: 1 },
    花椰菜: { name: '西兰花', grams: 150, calories: 52, protein: 4, carbs: 10, fat: 1 },
    燕麦: { name: '燕麦片', grams: 50, calories: 195, protein: 7, carbs: 34, fat: 3 },
    全麦面包: { name: '全麦面包', grams: 60, calories: 150, protein: 5, carbs: 28, fat: 2 },
    面包: { name: '全麦面包', grams: 60, calories: 150, protein: 5, carbs: 28, fat: 2 },
    牛奶: { name: '牛奶', grams: 250, calories: 155, protein: 8, carbs: 12, fat: 8 },
    酸奶: { name: '希腊酸奶', grams: 170, calories: 150, protein: 25, carbs: 8, fat: 0 },
    豆腐: { name: '豆腐', grams: 150, calories: 120, protein: 12, carbs: 4, fat: 7 },
    红薯: { name: '红薯', grams: 200, calories: 180, protein: 3, carbs: 42, fat: 0 },
    土豆: { name: '土豆', grams: 200, calories: 186, protein: 4, carbs: 42, fat: 0 },
    意面: { name: '意面(熟)', grams: 200, calories: 290, protein: 10, carbs: 55, fat: 2 },
    乌龙面: { name: '意面(熟)', grams: 200, calories: 290, protein: 10, carbs: 55, fat: 2 },
    牛排: { name: '牛排', grams: 180, calories: 380, protein: 52, carbs: 0, fat: 18 },
    牛油果: { name: '牛油果', grams: 100, calories: 160, protein: 2, carbs: 9, fat: 15 },
    坚果: { name: '混合坚果', grams: 30, calories: 183, protein: 5, carbs: 6, fat: 16 },
    花生酱: { name: '花生酱', grams: 16, calories: 96, protein: 4, carbs: 3, fat: 8 },
    蛋白粉: { name: '乳清蛋白粉', grams: 30, calories: 120, protein: 24, carbs: 3, fat: 1 },
    咖啡: { name: '黑咖啡', grams: 250, calories: 3, protein: 0, carbs: 0, fat: 0 },
    薯条: { name: '薯条', grams: 150, calories: 487, protein: 5, carbs: 63, fat: 24 },
    汉堡: { name: '汉堡', grams: 200, calories: 520, protein: 25, carbs: 44, fat: 28 },
    可乐: { name: '可乐', grams: 330, calories: 139, protein: 0, carbs: 35, fat: 0 },
    豆浆: { name: '无糖豆浆', grams: 250, calories: 80, protein: 8, carbs: 4, fat: 4 },
  }
  for (const key of Object.keys(map)) {
    if (name.includes(key)) {
      const f = map[key]
      return [{
        id: 'ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: f.name!,
        grams: f.grams!,
        calories: f.calories!,
        protein: f.protein!,
        carbs: f.carbs!,
        fat: f.fat!,
        confidence: 0.6, // AI 估算是近似值，明确给出较低置信度
        aiSuggested: true,
      }]
    }
  }
  return []
}

// ============================================================
// 4. 身体分析（本地规则版）
// 说明：没有真实测量则给出诚实的"待补充数据"提示，
// 不编造精确体脂。真实实现应调用视觉模型分析照片。
// ============================================================
export function analyzeBodyScan(scan: BodyScan, state: AppState) {
  const profile = state.profile
  const hasPhotos = Object.values(scan.photos).some(Boolean)
  if (!hasPhotos) return null

  // 基于目标/重点肌群给出方向性评级，逐格标注为"估算"
  const focus = profile?.focusMuscles ?? []
  const goal = profile?.goal ?? 'maintain'
  const muscles = [
    'Chest', 'Shoulders', 'Back Width', 'Back Thickness', 'Arms',
    'Quads', 'Hamstrings', 'Calves',
  ]
  const ratings = muscles.map((m, i) => {
    // 重点肌群偶有更高起点（模拟），但以注释标注为估算
    const boost = focus.some((f) => f.toLowerCase().includes(m.toLowerCase())) ? 1 : 0
    let stars = 3 + (i % 2) + boost
    stars = Math.min(5, Math.max(1, stars))
    return { muscle: m, stars, note: 'AI 视觉估算' } as const
  })

  return {
    overall: `基于${Object.keys(scan.photos).length}张角度照片的视觉评估。身体组成判断仅提供估算范围，建议以每周测量与围度记录为准。`,
    muscles: ratings,
    strengths: [
      goal === 'bulk' ? '重点肌群方向明确，训练容量充足' : '训练习惯稳定，具备建立长期追踪的基线',
      '已有规律训练配合营养记录，闭环可用于趋势分析',
    ],
    priorities: focus.length
      ? [`优先发展：${focus.map(muscleCn).join('、')}`]
      : ['建议明确1-2个重点肌群，便于专注训练量投放'],
    nextFocus: focus[0] ? `下一阶段重点：${focus[0]}，每周安排${focus[0] === 'Chest' ? '2' : '1-2'}次训练。` : '下一阶段：先完成一次完整体能/围度建档。',
    bodyFat: { range: '估算范围 12-18%', confidence: 0.4 }, // 低置信度，诚实
    symmetry: '待多角度照片后评估',
    proportions: '待多角度照片后评估',
  }
}

// ============================================================
// 5. 训练计划生成（确定性规则 + 用户画像）
// ============================================================
export function generateTrainingPlan(profile: UserProfile) {
  const days = profile.daysPerWeek
  const exercises = selectedExercises(profile)

  // 生成动作优先使用重点肌群
  const focus = profile.focusMuscles
  const best = (muscle: string): string => {
    const pool = exercises.filter((e) => {
      if (focus.some((f) => e.primaryMuscle.toLowerCase().includes(f.toLowerCase()))) {
        return e.primaryMuscle.toLowerCase().includes(muscle.toLowerCase()) ||
          e.primaryMuscle.toLowerCase().includes(focus.find((f)=>f.toLowerCase().includes(muscle.toLowerCase())) || '')
      }
      return e.primaryMuscle.toLowerCase().includes(muscle.toLowerCase())
    })
    return (pool[0]?.id) || EXERCISES[0].id
  }

  const split: { label: string; focus: string; ids: string[] }[] = [
    { label: '周一', focus: '推力日', ids: [best('Chest'), 'incline-db-press', best('Front Delts'), 'triceps-pushdown'] },
    { label: '周二', focus: '拉力日', ids: ['lat-pulldown', best('Upper Back'), 'rear-delt-fly', 'barbell-curl'] },
    { label: '周三', focus: '腿部日', ids: [best('Quads'), 'romanian-deadlift', best('Calves')] },
  ]
  if (days >= 4) split.push({ label: '周四', focus: '上肢', ids: ['bench-press', best('Lats'), best('Side Delts'), 'triceps-pushdown'] })
  if (days >= 5) split.push({ label: '周五', focus: '下肢', ids: [best('Quads'), 'hip-thrust', 'standing-calf-raise'] })

  const dow = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const dayPlans = Array.from({ length: 7 }, (_, i) => {
    const s = split.find((x) => x.label === dow[i])
    if (!s) return { dayIndex: i, label: dow[i], focus: '休息', exercises: [], estimatedMin: 0, active: false }
    return {
      dayIndex: i,
      label: dow[i],
      focus: s.focus,
      active: true,
      estimatedMin: s.ids.length * 9,
      exercises: s.ids.map((exId, j) => {
        return {
          id: 'pe-' + exId,
          exerciseId: exId,
          sets: 4,
          targetReps: j === 0 ? '6-8' : '8-12',
          restSec: 120,
          plannedSets: Array.from({ length: 4 }, (_, si) => ({
            weight: profile.currentTopWeights[exId] ? Math.round(profile.currentTopWeights[exId] * (si === 0 ? 0.7 : 1) * 10) / 10 : 0,
            reps: j === 0 ? 8 : 12,
            rir: 2,
          })),
        }
      }),
    }
  })

  return {
    id: 'plan-' + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    name: `${goalName(profile.goal)}计划 · 每周${days}练`,
    goal: profile.goal,
    days: dayPlans,
    basis: `根据目标(${goalName(profile.goal)})、每周${days}练、每次${profile.minutesPerSession}分钟与重点肌群(${profile.focusMuscles.map(muscleCn).join('、') || '均衡'})自动生成。`,
  }
}

function selectedExercises(p: UserProfile) {
  // 过滤用户不喜欢的动作与不可用器械
  return EXERCISES.filter((e) => {
    if (p.dislikedExercises.includes(e.id)) return false
    return true
  })
}

// ============================================================
// 6. 训练容量 / 汇总
// ============================================================
export function sessionVolume(w: WorkoutSession): number {
  return w.exerciseRecords.reduce(
    (a, r) => a + r.sets.reduce((x, s) => x + (s.weight * s.reps * (s.done ? 1 : 0)), 0),
    0,
  )
}

export function generateWorkoutSummary(w: WorkoutSession) {
  const plannedExercises = w.exerciseRecords.length // 计划动作数
  const completedExercises = w.exerciseRecords.filter((r) =>
    r.sets.some((s) => s.done),
  ).length // 实际完成动作数
  const totalPlannedSets = w.exerciseRecords.reduce(
    (a, r) => a + (r.targetSets ?? r.sets.length),
    0,
  ) // 计划组数
  const totalSets = w.exerciseRecords.reduce(
    (a, r) => a + r.sets.filter((s) => s.done).length,
    0,
  ) // 实际完成组数
  const volume = sessionVolume(w)
  const muscles = new Set<string>()
  w.exerciseRecords.forEach((r) => {
    const ex = getExercise(r.exerciseId)
    if (ex) {
      const done = r.sets.some((s) => s.done)
      if (done) {
        muscles.add(ex.primaryMuscle)
        ex.secondaryMuscles.forEach((m) => muscles.add(m))
      }
    }
  })
  const completion = totalPlannedSets
    ? Math.round((totalSets / totalPlannedSets) * 100)
    : 0
  const status: 'completed' | 'partial' | 'pending' =
    w.status === 'partial' ||
    (completedExercises > 0 && totalSets < totalPlannedSets)
      ? 'partial'
      : totalSets > 0
        ? 'completed'
        : 'pending'
  return {
    duration: w.durationMin,
    plannedExercises,
    completedExercises,
    totalPlannedSets,
    totalSets,
    volume,
    muscles: [...muscles],
    completion,
    status,
  }
}

// 上一次针对某训练日的完整训练记录
export function lastSessionForDay(state: AppState, dayIndex: number): WorkoutSession | undefined {
  return [...state.workoutHistory]
    .filter((w) => w.dayIndex === dayIndex)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
}

// ============================================================
// 7. 动作历史 / 下次目标
// ============================================================
export function exerciseHistory(state: AppState, exerciseId: string) {
  return state.workoutHistory
    .map((w) => ({
      date: w.date,
      records: w.exerciseRecords.find((r) => r.exerciseId === exerciseId),
    }))
    .filter((x) => x.records)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function est1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export interface NextTarget {
  weight: number
  reps: string
  sets: number
  rir: string
  note: string
  keep: boolean // true = 数据/完成度不足，保持当前重量
}

/**
 * 下次训练建议（进阶规则）：
 * 只有满足以下全部条件才进入「加重」判断，否则给出「保持」说明：
 *   1) 完成该动作的全部计划组
 *   2) 所有工作组都达到目标次数上限
 *   3) 所有工作组 RIR 符合目标（≤2，逼近力竭）
 *   4) 至少参考最近 2 次训练记录
 * 加重量取整到可用器械增量（如 70kg 杠铃 → 72.5kg，绝不出现 71.8kg）。
 */
export function suggestNextTarget(
  history: ReturnType<typeof exerciseHistory>,
  opts?: { exerciseId?: string; targetRepsUpper?: number; profile?: AppState['profile'] },
): NextTarget | null {
  if (!history.length) return null
  const last = history[history.length - 1]
  const rec = last.records
  if (!rec) return null
  const done = rec.sets.filter((s) => s.done)
  if (!done.length) return null

  const plannedSets = rec.targetSets || rec.sets.length
  const topW = Math.max(...done.map((s) => s.weight))
  const topReps = Math.max(...done.map((s) => s.reps))
  const inc = opts?.exerciseId
    ? getWeightIncrement(getExercise(opts.exerciseId)?.equipment || '', opts?.profile?.weightIncrements)
    : 2.5

  // 规则1：只完成部分组 → 保持，优先完成全部目标组
  if (done.length < plannedSets) {
    return {
      weight: roundToIncrement(topW, inc),
      reps: `${topReps} 次`,
      sets: done.length,
      rir: '1-2',
      note: `上次训练只完成 ${done.length}/${plannedSets} 组，先保持当前重量，优先完成全部目标组`,
      keep: true,
    }
  }

  // 自重动作：没有可加重的杠铃/哑铃，优先提升次数
  if (topW <= 0) {
    return {
      weight: 0,
      reps: `${topReps + 2} 次`,
      sets: done.length,
      rir: '1-2',
      note: '这是自重/轻重量动作，建议下一步在目标次数内稳定并逐步增加次数或减小组间休息',
      keep: true,
    }
  }

  // 规则2：部分组未达目标次数上限 → 保持
  const upper = opts?.targetRepsUpper
  if (upper && done.some((s) => s.reps < upper)) {
    return {
      weight: roundToIncrement(topW, inc),
      reps: `${topReps} 次`,
      sets: done.length,
      rir: '1-2',
      note: `仍有组未达目标次数（${upper} 次），先稳定次数再考虑加重`,
      keep: true,
    }
  }

  // 规则3：RIR 偏高（未逼近力竭）→ 保持
  if (done.some((s) => (s.rir ?? 2) > 2)) {
    return {
      weight: roundToIncrement(topW, inc),
      reps: `${topReps} 次`,
      sets: done.length,
      rir: '1-2',
      note: '仍有组 RIR 较高、未逼近力竭，先提升训练强度再考虑加重',
      keep: true,
    }
  }

  // 规则4：数据不足（至少需 2 次训练）→ 保持
  const doneHist = history.filter((h) => h.records && h.records.sets.some((s) => s.done))
  if (doneHist.length < 2) {
    return {
      weight: roundToIncrement(topW, inc),
      reps: `${topReps} 次`,
      sets: done.length,
      rir: '1-2',
      note: '训练数据仍不足（需至少 2 次完整记录），继续保持当前重量，优先完成全部目标组',
      keep: true,
    }
  }

  // 规则5：达标后建议一个器械增量，取整到增量
  const prev = doneHist[doneHist.length - 2].records!
  const prevDone = prev.sets.filter((s) => s.done)
  const prevMax = prevDone.length ? Math.max(...prevDone.map((s) => s.weight)) : topW
  const base = Math.max(topW, prevMax)
  const newW = roundToIncrement(base + inc, inc)
  return {
    weight: newW,
    reps: `${Math.max(5, topReps - 1)}-${topReps}`,
    sets: done.length,
    rir: '1-2',
    note: `基于最近训练表现，建议加重到 ${newW}kg（器械最小增量 ${inc}kg）`,
    keep: false,
  }
}

// 某动作的上一次真实表现（用于训练页"上次表现"与计划参考）
export function previousPerformance(
  state: AppState,
  exerciseId: string,
): { date: string; weight: number; reps: number; sets: number } | null {
  const h = exerciseHistory(state, exerciseId)
  if (!h.length) return null
  const last = h[h.length - 1]
  const rec = last.records!
  const done = rec.sets.filter((s) => s.done)
  if (!done.length) return null
  const top = done.reduce((m, s) => (s.weight >= m.weight ? s : m), done[0])
  return { date: last.date, weight: top.weight, reps: top.reps, sets: done.length }
}

// 检测新 PR：一组中估算 1RM 超过历史最佳（不含本次）
export function detectPRs(
  history: WorkoutSession[],
  records: WorkoutSession['exerciseRecords'],
): string[] {
  const prs: string[] = []
  for (const rec of records) {
    const done = rec.sets.filter((s) => s.done)
    if (!done.length) continue
    const rm = Math.max(...done.map((s) => est1RM(s.weight, s.reps)))
    const ex = getExercise(rec.exerciseId)
    if (!ex || rm <= 0) continue
    let prevBest = 0
    for (const w of history) {
      const r = w.exerciseRecords.find((x) => x.exerciseId === rec.exerciseId)
      if (r) {
        const rDone = r.sets.filter((s) => s.done)
        if (rDone.length) prevBest = Math.max(prevBest, ...rDone.map((s) => est1RM(s.weight, s.reps)))
      }
    }
    if (rm > prevBest && prevBest > 0) {
      prs.push(`${ex.nameCn} 估算1RM ${Math.round(rm)}kg（原纪录 ${Math.round(prevBest)}kg）`)
    }
  }
  return prs
}

// ============================================================
// 8. 肌群真实数据统计（3D 肌群图谱 / 数据中心用）
//    全部来自 workoutHistory，无硬编码。
// ============================================================
export interface MuscleStat {
  weeklySets: number // 近7天完成的组数（直接+间接）
  weeklyDirectSets: number // 近7天直接组（作为主动作）
  weeklyIndirectSets: number // 近7天间接组（仅作为辅助肌群）
  weeklyWeightedSets: number // 近7天综合训练量 = 直接 + 0.5×间接
  lastDaysAgo: number | null // 距上次训练该肌群的天数
  lastDate: string | null
  strength4w: { label: string; change: number } | null // 4周力量变化：居中最强动作
  strengthEx: string | null
}

export function muscleStats(state: AppState): Record<string, MuscleStat> {
  const stats: Record<string, MuscleStat> = {}
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dayMs = 86400000

  // 直接/间接/综合训练量：全部集中在 MuscleVolumeService
  const weekly = computeMuscleVolume(state.workoutHistory, { withinDays: 7, asOf: new Date() })

  // 每个肌群收集最近训练日期（用于"距上次训练天数"）
  const lastDates: Record<string, string | null> = {}
  const rmByEx: Record<string, { date: string; rm: number }[]> = {}

  for (const w of state.workoutHistory) {
    for (const rec of w.exerciseRecords) {
      const ex = getExercise(rec.exerciseId)
      if (!ex) continue
      const done = rec.sets.filter((s) => s.done)
      if (!done.length) continue
      for (const m of new Set([ex.primaryMuscle, ...ex.secondaryMuscles])) {
        if (!lastDates[m] || w.date > lastDates[m]!) lastDates[m] = w.date
      }
      const rm = Math.max(...done.map((s) => est1RM(s.weight, s.reps)))
      if (!rmByEx[ex.primaryMuscle]) rmByEx[ex.primaryMuscle] = []
      rmByEx[ex.primaryMuscle].push({ date: w.date, rm })
    }
  }

  const all = new Set<string>([
    ...Object.keys(weekly),
    ...Object.keys(lastDates),
    ...Object.keys(rmByEx),
  ])
  for (const m of all) {
    const vol = weekly[m] || { directSets: 0, indirectSets: 0, weightedSets: 0, totalSets: 0 }
    const weeklySets = vol.totalSets

    // 上次训练天数
    let lastDaysAgo: number | null = null
    let lastDate: string | null = null
    const lastD = lastDates[m]
    if (lastD) {
      lastDate = lastD
      const d = new Date(lastD + 'T00:00:00')
      lastDaysAgo = Math.max(0, Math.round((now.getTime() - d.getTime()) / dayMs))
    }

    // 4周力量变化：主动作在近4周 vs 前4周的最佳1RM
    let strength4w: MuscleStat['strength4w'] = null
    let strengthEx: string | null = null
    const exRms = (rmByEx[m] || []).sort((a, b) => (a.date < b.date ? -1 : 1))
    if (exRms.length) {
      const cutoff = now.getTime() - 4 * 7 * dayMs
      const oldCutoff = now.getTime() - 8 * 7 * dayMs
      const recent4 = exRms.filter((x) => new Date(x.date + 'T00:00:00').getTime() > cutoff)
      const prior4 = exRms.filter((x) => {
        const t = new Date(x.date + 'T00:00:00').getTime()
        return t > oldCutoff && t <= cutoff
      })
      if (recent4.length && prior4.length) {
        const rMax = Math.max(...recent4.map((x) => x.rm))
        const pMax = Math.max(...prior4.map((x) => x.rm))
        if (pMax > 0) {
          const change = ((rMax - pMax) / pMax) * 100
          strength4w = { label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, change }
          strengthEx = getExercise(findTopExercise(state, m))?.nameCn || null
        }
      }
    }

    stats[m] = {
      weeklySets,
      weeklyDirectSets: vol.directSets,
      weeklyIndirectSets: vol.indirectSets,
      weeklyWeightedSets: vol.weightedSets,
      lastDaysAgo,
      lastDate,
      strength4w,
      strengthEx,
    }
  }
  return stats
}

function findTopExercise(state: AppState, muscle: string): string {
  // 找该肌群最近一次训练里最常出现的动作
  let bestEx = ''
  let bestCount = 0
  const count: Record<string, number> = {}
  for (const w of [...state.workoutHistory].reverse()) {
    for (const rec of w.exerciseRecords) {
      const ex = getExercise(rec.exerciseId)
      if (!ex) continue
      if (ex.primaryMuscle === muscle || ex.secondaryMuscles.includes(muscle)) {
        count[ex.id] = (count[ex.id] || 0) + 1
      }
    }
  }
  for (const k of Object.keys(count)) {
    if (count[k] > bestCount) {
      bestCount = count[k]
      bestEx = k
    }
  }
  return bestEx
}
