// ============================================================
// AI Fitness OS — 数据模型（Data Models）
// 所有类型映射到 localStorage 持久化存储，同时为将来迁移到
// 后端数据库(Postgres/Supabase)与真实 AI API 预留结构。
// ============================================================

export type Goal = 'bulk' | 'cut' | 'maintain' | 'strength'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface UserProfile {
  name: string
  sex: 'male' | 'female'
  goal: Goal
  yearsExperience: number
  age: number
  heightCm: number
  weightKg: number // 当前体重（建档时初始，随变化追踪更新）
  targetWeightKg?: number // 目标体重
  targetDate?: string // 期望达成目标的日期 YYYY-MM-DD
  activityLevel: ActivityLevel
  daysPerWeek: number
  minutesPerSession: number
  equipment: string[]
  focusMuscles: string[]
  currentTopWeights: Record<string, number> // exerciseId -> kg
  // 器械最小重量增量配置（kg）：key = 器械名（Barbell/Dumbbells/Machine/Cable），缺省用默认规则
  weightIncrements?: Record<string, number>
  // 教练偏好
  dislikedExercises: string[]
  preferredExercises: string[]
  notes: string
}

export interface BodyMeasurement {
  id: string
  date: string // YYYY-MM-DD
  weightKg: number | null
  waistCm: number | null
  chestCm: number | null
  armsCm: number | null
  thighCm: number | null
}

export type BodyPhotoAngle = 'front' | 'back' | 'left' | 'right'

export interface BodyPhoto {
  angle: BodyPhotoAngle
  dataUrl: string | null // 本地以 dataURL 存储（隐私：仅本机）
}

export interface MuscleAssessment {
  muscle: string
  stars: number // 1-5
  note?: string
}

export interface BodyScan {
  id: string
  date: string
  photos: Partial<Record<BodyPhotoAngle, string>>
  analysis: BodyAnalysis | null
  aiGenerated: boolean
}

export interface BodyAnalysis {
  overall: string
  muscles: MuscleAssessment[]
  strengths: string[]
  priorities: string[]
  nextFocus: string
  bodyFat?: { range: string; confidence: number } // 估算范围+置信度，非精确测量
  symmetry: string
  proportions: string
}

// ---------------- Nutrition ----------------

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodEntry {
  id: string
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number // 0-1 热量估算可信度
  aiSuggested: boolean
}

export interface Meal {
  id: string
  date: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  entries: FoodEntry[]
  photo: string | null
  createdAt: string
}

export interface NutritionPlan extends Macros {
  goal: Goal
  targetDate?: string
  basis: string // 说明目标如何得出
  history: NutritionAdjustment[]
}

export interface NutritionAdjustment {
  id: string
  date: string
  reason: string
  changed: Partial<Macros>
}

// ---------------- Training ----------------

export interface Exercise {
  id: string
  name: string
  nameCn: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  type: 'compound' | 'isolation' | 'machine'
  level: ExperienceLevel
  instructions: string
  tips: string
  commonErrors: string
  repRange: string
}

export interface PlannedSet {
  weight: number
  reps: number
  rir: number
}

export interface PlannedExercise {
  id: string
  exerciseId: string
  sets: number
  plannedSets: PlannedSet[]
  targetReps: string
  restSec: number
}

export interface DayPlan {
  dayIndex: number // 0-6 (周一=0)
  label: string
  focus: string
  exercises: PlannedExercise[]
  estimatedMin: number
  note?: string
  active: boolean
}

export interface TrainingPlan {
  id: string
  createdAt: string
  name: string
  goal: Goal
  days: DayPlan[] // 7 天
  basis: string
}

export interface WorkoutSet {
  weight: number
  reps: number
  rir: number
  done: boolean
  completedAt?: string
}

export interface WorkoutExerciseRecord {
  id: string
  exerciseId: string
  sets: WorkoutSet[]
  targetSets: number
  restSec?: number // 组间休息秒数（该动作计划设定）
}

export interface WorkoutSession {
  id: string
  date: string
  dayIndex: number
  planName: string
  planLabel?: string
  exerciseRecords: WorkoutExerciseRecord[]
  durationMin: number | null
  summaryGenerated: boolean
  status?: 'completed' | 'partial' // 完整训练 / 提前结束
  notes?: string
  prs: string[]
}

// 进行中的训练（刷新/离开后可恢复）
export interface ActiveWorkout {
  session: WorkoutSession & { start: number }
  activeIdx: number
  // 休息计时持久化：刷新后未结束继续倒计时，已结束显示「休息完成」
  rest?: { startedAt: number; duration: number; endsAt: number }
}

// ---------------- 身体记录 / 进度 ----------------

export interface ProgressDay {
  id: string
  date: string
  workoutLog: boolean
  calorieIntake: number | null
  caloriesTarget: number | null
  proteinIntake: number | null
  sleepHours: number | null
  fatigue: number | null // 0-10
  muscleSoreness: Record<string, number>
  weightKg: number | null
  notes: string
}

// ---------------- AI Coach / Memory ----------------

export interface CoachMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  at: string
  cited?: string // 引用的用户数据摘要
}

export interface CoachThread {
  id: string
  title: string
  messages: CoachMessage[]
  createdAt: string
  updatedAt: string
}

// 长期个人档案（AI Memory）
export interface FitnessMemory {
  insights: string[] // AI 长期积累的洞察
  customRules: string[] // 用户设定的规则/偏好
  foodPrefs: string[]
  habits: string[]
  updatedAt: string
}

// ---------------- 全局 Store ----------------

export interface AppState {
  profile: UserProfile | null
  bodyMeasurements: BodyMeasurement[]
  bodyScans: BodyScan[]
  meals: Meal[]
  nutritionPlan: NutritionPlan | null
  trainingPlan: TrainingPlan | null
  workoutHistory: WorkoutSession[]
  activeWorkout: ActiveWorkout | null
  progressLog: ProgressDay[]
  coachThreads: CoachThread[]
  memory: FitnessMemory
  streakStart: string | null
  onboarded: boolean
}
