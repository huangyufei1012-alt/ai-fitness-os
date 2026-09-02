import type { UserProfile, NutritionPlan } from '../types'
import { EXERCISES } from './exercises'
import { uid, todayISO } from './store'

// 由用户画像生成营养计划（确定性规则，可被后续长期数据动态调整）

const BMR_ACTIVITY: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const ACTIVITY_CN: Record<UserProfile['activityLevel'], string> = {
  sedentary: '久坐(1.2)',
  light: '轻度(1.375)',
  moderate: '中度(1.55)',
  active: '高度(1.725)',
  very_active: '极高(1.9)',
}

function mifflinBMR(profile: UserProfile, weightKg: number) {
  // Mifflin-St Jeor：10×体重 + 6.25×身高 − 5×年龄 + 校正
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * (profile.age || 25)
  return profile.sex === 'female' ? base - 161 : base + 5
}

export function generateNutritionPlan(profile: UserProfile): NutritionPlan {
  // 建档时以 70kg 为基准（建档同时会写入第一条体重，随后可据此重算）；
  // 若用户已填体重则由调用方传入。
  return recalculateNutrition(profile, undefined)
}

export function recalculateNutrition(
  profile: UserProfile,
  weightKg?: number,
  prevPlan?: NutritionPlan,
): NutritionPlan {
  const w = weightKg ?? 70 // 无体重时用 70kg 保守基准（建档必填体重，极少走到这里）
  const bmr = mifflinBMR(profile, w)
  const tdee = bmr * BMR_ACTIVITY[profile.activityLevel]
  const sexCn = profile.sex === 'female' ? '女' : '男'
  const sexCorrect = profile.sex === 'female' ? '−161' : '+5'

  let calories = Math.round(tdee)
  let goalFmt = '维持'
  if (profile.goal === 'cut') {
    calories = Math.round(tdee * 0.85)
    goalFmt = '减脂(热量−15%)'
  } else if (profile.goal === 'bulk') {
    calories = Math.round(tdee * 1.1)
    goalFmt = '增肌(热量+10%)'
  } else if (profile.goal === 'strength') {
    calories = Math.round(tdee * 1.05)
    goalFmt = '力量(热量+5%)'
  }

  const proteinPerKg = profile.goal === 'cut' ? 2.2 : profile.goal === 'maintain' ? 1.8 : 2.0
  const protein = Math.round(proteinPerKg * w)
  const fat = Math.round((0.25 * calories) / 9)
  const carbCal = calories - protein * 4 - fat * 9
  const carbs = Math.round(Math.max(0, carbCal) / 4)

  const basis =
    `基础代谢 BMR（Mifflin-St Jeor，${sexCn}）= 10×${w}kg + 6.25×${profile.heightCm}cm − 5×${profile.age || 25}岁 ${sexCorrect} ≈ ${Math.round(bmr)} kcal；` +
    `每日总消耗 TDEE = BMR × 活动系数 ${ACTIVITY_CN[profile.activityLevel]} ≈ ${Math.round(tdee)} kcal；` +
    `目标(${goalFmt}) → 每日 ${calories} kcal；` +
    `蛋白质按 ${proteinPerKg}g/kg×${w}kg = ${protein}g，脂肪占 25% = ${fat}g，其余由碳水补齐 = ${carbs}g。` +
    `后续将根据7/14日体重周趋势动态微调。`

  const history = prevPlan?.history ? [...prevPlan.history] : []
  if (prevPlan) {
    history.push({
      id: uid('na'),
      date: todayISO(),
      reason: `根据当前体重 ${w}kg 与目标（${goalFmt}）重新计算`,
      changed: { calories, protein, carbs, fat },
    })
  }

  return {
    calories,
    protein,
    carbs,
    fat,
    goal: profile.goal,
    basis,
    history,
  }
}

// 训练计划生成：
// 简单三级分法（Push/Pull/Legs）或上下分化，依据用户每周天数
export function generateTrainingPlan(profile: UserProfile) {
  const days = profile.daysPerWeek
  const pick = (muscle: string): string[] => {
    return EXERCISES.filter(
      (e) =>
        e.primaryMuscle === muscle ||
        (e.secondaryMuscles.includes(muscle) && e.level !== 'advanced'),
    ).map((e) => e.id)
  }

  const chest = pick('Chest')
  const back = pick('Lats')

  const fallback = (arr: string[], ex: string) => (arr.length ? arr : [ex])

  const mkExercise = (exId: string, sets: number, reps: string) => {
    return {
      id: uid('pe'),
      exerciseId: exId,
      sets,
      targetReps: reps,
      restSec: 120,
      plannedSets: Array.from({ length: sets }, (_, si) => ({
        weight: 0,
        reps: parseInt(reps.split('-')[1] || reps),
        rir: si === 0 ? 2 : 1,
      })),
    }
  }

  // Push / Pull / Legs 拆分
  const pushDay = {
    dayIndex: 0,
    label: '周一',
    focus: '胸 / 肩 / 肱三头肌',
    active: true,
    estimatedMin: 65,
    exercises: [
      mkExercise(fallback(chest, 'bench-press')[0], 4, '6-8'),
      mkExercise('incline-db-press', 3, '8-12'),
      mkExercise('db-lateral-raise', 4, '12-15'),
      mkExercise('triceps-pushdown', 3, '10-12'),
    ],
  }
  const pullDay = {
    dayIndex: 1,
    label: '周二',
    focus: '背 / 肱二头肌',
    active: true,
    estimatedMin: 60,
    exercises: [
      mkExercise(fallback(back, 'lat-pulldown')[0], 4, '8-12'),
      mkExercise('seated-row', 4, '8-12'),
      mkExercise('rear-delt-fly', 3, '12-15'),
      mkExercise('barbell-curl', 3, '8-12'),
    ],
  }
  const legDay = {
    dayIndex: 2,
    label: '周三',
    focus: '股四头 / 腘绳 / 小腿',
    active: true,
    estimatedMin: 70,
    exercises: [
      mkExercise(squatOrPress(profile), 4, '5-8'),
      mkExercise('romanian-deadlift', 3, '8-12'),
      mkExercise('leg-extension', 3, '12-15'),
      mkExercise('standing-calf-raise', 4, '12-20'),
    ],
  }

  const rest = (dayIndex: number, label: string) => ({
    dayIndex,
    label,
    focus: '休息',
    active: false,
    estimatedMin: 0,
    exercises: [],
  })

  let week: any[]
  if (days <= 3) {
    week = [pushDay, rest(1, '周二'), pullDay, rest(3, '周四'), legDay, rest(5, '周六'), rest(6, '周日')]
  } else {
    // 4天：Push / Pull / Legs / Upper
    week = [
      pushDay,
      pullDay,
      rest(2, '周三'),
      legDay,
      {
        dayIndex: 4,
        label: '周五',
        focus: '上肢',
        active: true,
        estimatedMin: 55,
        exercises: [
          mkExercise(fallback(chest, 'bench-press')[0], 3, '8-10'),
          mkExercise(fallback(back, 'lat-pulldown')[0], 3, '8-12'),
          mkExercise('db-lateral-raise', 3, '12-15'),
          mkExercise('triceps-pushdown', 2, '12'),
        ],
      },
      rest(5, '周六'),
      rest(6, '周日'),
    ]
  }

  return {
    id: uid('plan'),
    createdAt: new Date().toISOString(),
    name: `每周${days}练 · ${profile.goal === 'bulk' ? '增肌' : profile.goal === 'cut' ? '减脂' : profile.goal === 'strength' ? '力量' : '维持'}计划`,
    goal: profile.goal,
    basis: `根据你的训练频率（每周${profile.daysPerWeek}天）、目标与重点肌群自动生成。可随时在训练计划页手动调整。`,
    days: week,
  }
}

function squatOrPress(profile: UserProfile): string {
  return profile.equipment.includes('Barbell') !== false ? 'squat' : 'leg-press'
}

export function getTodayPlan(state: any) {
  const dayIdx = (new Date().getDay() + 6) % 7
  const plan = state.trainingPlan
  if (!plan) return null
  return plan.days[dayIdx]
}
