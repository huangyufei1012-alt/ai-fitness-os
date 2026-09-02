import type { Goal } from '../types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function fmtFullDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export const DOW = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '晚安'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

// 肌肉组中文显示映射（逻辑键仍用英文，仅用于界面显示）
export function muscleCn(muscle: string): string {
  const map: Record<string, string> = {
    Chest: '胸',
    'Upper Chest': '上胸',
    'Lower Chest': '下胸',
    'Front Delts': '前束',
    'Side Delts': '中束',
    'Rear Delts': '后束',
    Lats: '背阔肌',
    Traps: '斜方肌',
    'Upper Back': '上背',
    'Lower Back': '下背',
    Biceps: '肱二头肌',
    Triceps: '肱三头肌',
    Forearms: '前臂',
    Abs: '腹肌',
    Obliques: '腹斜肌',
    Glutes: '臀大肌',
    Quads: '股四头肌',
    Hamstrings: '腘绳肌',
    Adductors: '内收肌',
    Calves: '小腿',
    // 复合/宽泛标签
    Back: '背部',
    Shoulders: '肩部',
    Arms: '手臂',
    Legs: '腿部',
    'Back Width': '背部宽度',
    'Back Thickness': '背部厚度',
    Core: '核心',
    Push: '推力日',
    Pull: '拉力日',
    Upper: '上肢',
    Lower: '下肢',
    Rest: '休息',
  }
  return map[muscle] ?? muscle
}

// 器械中文映射
export function equipCn(e: string): string {
  const map: Record<string, string> = {
    'Barbell / Bench': '杠铃 / 卧推凳',
    Dumbbells: '哑铃',
    Machine: '器械',
    Cable: '绳索',
    Barbell: '杠铃',
    Bodyweight: '自重',
    Band: '弹力带',
    'Dumbbell / Bench': '哑铃 / 凳',
  }
  return map[e] ?? e
}

// 动作类型中文映射
export function typeCn(t: string): string {
  const map: Record<string, string> = {
    compound: '复合动作',
    machine: '器械',
    isolation: '孤立动作',
  }
  return map[t] ?? t
}

export const GOAL_LABEL: Record<Goal, string> = {
  bulk: '增肌',
  cut: '减脂',
  maintain: '维持',
  strength: '力量',
}

export function stars(rating: number): string {
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))
}
