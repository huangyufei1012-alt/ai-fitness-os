// ============================================================
// 肌群训练量服务（Muscle Volume Service）
// ------------------------------------------------------------
// 所有「直接组 / 间接组 / 综合训练量」的计算都集中在此处，
// 页面组件（MuscleMap 等）只负责展示，不重复计算。
//
// 定义：
// - 直接组 directSets   ：该肌群作为 active 主动作（primaryMuscle）时的完成组数
// - 间接组 indirectSets ：该肌群仅作为辅助肌群（secondaryMuscles）时的完成组数
// - 综合训练量 weightedSets = 直接组 + 0.5 × 间接组
// - 总组数 totalSets      = 直接组 + 间接组
//
// 数据全部来自 workoutHistory 中的真实完成组（set.done === true）。
// ============================================================

import type { WorkoutSession } from '../types'
import { getExercise } from './exercises'

export interface MuscleVolumeEntry {
  directSets: number
  indirectSets: number
  weightedSets: number
  totalSets: number
}

export interface MuscleVolumeMap {
  [muscle: string]: MuscleVolumeEntry
}

/**
 * 统计每个肌群的直接/间接/综合训练量。
 * @param history  训练历史（按日期排序由调用方保证）
 * @param opts.withinDays 若提供，只统计最近 N 天内的组数
 * @param opts.asOf 统计基准时间（默认当前时间）
 */
export function computeMuscleVolume(
  history: WorkoutSession[],
  opts?: { withinDays?: number; asOf?: Date },
): MuscleVolumeMap {
  const now = (opts?.asOf ?? new Date())
  now.setHours(0, 0, 0, 0)
  const dayMs = 86400000
  const cutoff = opts?.withinDays ? now.getTime() - opts.withinDays * dayMs : 0

  const acc: Record<string, { direct: number; indirect: number }> = {}

  const bump = (muscle: string, kind: 'direct' | 'indirect', n: number) => {
    const obj = (acc[muscle] ??= { direct: 0, indirect: 0 })
    obj[kind] += n
  }

  for (const w of history) {
    if (opts?.withinDays) {
      const d = new Date(w.date + 'T00:00:00')
      if (d.getTime() < cutoff) continue
    }
    for (const rec of w.exerciseRecords) {
      const ex = getExercise(rec.exerciseId)
      if (!ex) continue
      const done = rec.sets.filter((s) => s.done).length
      if (!done) continue
      // active 主动作 → 直接组
      bump(ex.primaryMuscle, 'direct', done)
      // 辅助肌群 → 间接组
      for (const m of ex.secondaryMuscles) bump(m, 'indirect', done)
    }
  }

  const out: MuscleVolumeMap = {}
  for (const [muscle, v] of Object.entries(acc)) {
    out[muscle] = {
      directSets: v.direct,
      indirectSets: v.indirect,
      weightedSets: round2(v.direct + 0.5 * v.indirect),
      totalSets: v.direct + v.indirect,
    }
  }
  return out
}

/**
 * 汇总单次训练直接/间接刺激（供 AI 教练回复「练了哪些肌群」等引用）。
 * 返回每个肌群被直接/间接刺激到的完成组数。
 */
export function summarizeSessionMuscles(w: WorkoutSession): {
  direct: Record<string, number>
  indirect: Record<string, number>
} {
  const direct: Record<string, number> = {}
  const indirect: Record<string, number> = {}
  for (const rec of w.exerciseRecords) {
    const ex = getExercise(rec.exerciseId)
    if (!ex) continue
    const done = rec.sets.filter((s) => s.done).length
    if (!done) continue
    direct[ex.primaryMuscle] = (direct[ex.primaryMuscle] ?? 0) + done
    for (const m of ex.secondaryMuscles) {
      indirect[m] = (indirect[m] ?? 0) + done
    }
  }
  return { direct, indirect }
}

function round2(n: number): number {
  return Math.round(n * 10) / 10
}
