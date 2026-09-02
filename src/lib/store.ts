import { useSyncExternalStore } from 'react'
import type { AppState } from '../types'

// ============================================================
// 持久化存储：localStorage
// 说明：Phase 1 使用浏览器 localStorage 作为数据层，
// 数据结构与后端 API 一一对应，后续可无缝迁移到：
//   - REST/GraphQL 后端（Postgres / Supabase）
//   - 增量同步（IndexedDB 或后端）
// 身材照片在本地以 dataURL 保存（隐私：仅本机、不上传）。
// ============================================================

const STORAGE_KEY = 'fitness-os-state-v1'

export const initialAppState: AppState = {
  profile: null,
  bodyMeasurements: [],
  bodyScans: [],
  meals: [],
  nutritionPlan: null,
  trainingPlan: null,
  workoutHistory: [],
  activeWorkout: null,
  progressLog: [],
  coachThreads: [],
  memory: {
    insights: [],
    customRules: [],
    foodPrefs: [],
    habits: [],
    updatedAt: '',
  },
  streakStart: null,
  onboarded: false,
}

// ---- 简单的可订阅 Store（规避多 tab 不一致，采用内存 + 持久化） ----
let state: AppState = load()
const listeners = new Set<() => void>()

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialAppState
    const parsed = JSON.parse(raw)
    // 合并，保证新字段有默认值
    return { ...initialAppState, ...parsed }
  } catch {
    return initialAppState
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    // 存储超出配额（如照片过多）时容错
    console.warn('Persist failed (quota?)', e)
  }
}

function emit() {
  listeners.forEach((l) => l())
}

/** 全局读取 */
export function getState(): AppState {
  return state
}

/** 原子更新：传入 updater，返回新 state，自动持久化 */
export function setState(updater: (s: AppState) => AppState): AppState {
  state = updater(state)
  persist()
  emit()
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** React Hook：在组件中订阅整个全局状态 */
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** 清空所有本地数据（用于重置/退出） */
export function resetAll() {
  state = initialAppState
  localStorage.removeItem(STORAGE_KEY)
  emit()
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 今日 ISO 日期 YYYY-MM-DD */
export function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
