import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  ScanLine,
  PersonStanding,
  TrendingUp,
  CalendarRange,
  Dumbbell,
  Library,
  History,
  Salad,
  Utensils,
  ClipboardList,
  MessageSquareText,
  Settings as SettingsIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV = [
  {
    section: '01 今日',
    items: [{ to: '/', label: '今日', icon: Home }],
  },
  {
    section: '02 身体',
    items: [
      { to: '/body/scan', label: '身体扫描', icon: ScanLine },
      { to: '/body/muscle-map', label: '肌群数据中心', icon: PersonStanding },
      { to: '/body/progress', label: '变化追踪', icon: TrendingUp },
    ],
  },
  {
    section: '03 训练',
    items: [
      { to: '/training/plan', label: '训练计划', icon: CalendarRange },
      { to: '/training/workout', label: '今日训练', icon: Dumbbell },
      { to: '/training/history', label: '训练历史', icon: History },
      { to: '/training/library', label: '动作库', icon: Library },
    ],
  },
  {
    section: '04 营养',
    items: [
      { to: '/nutrition/today', label: '今日营养', icon: Salad },
      { to: '/nutrition/meals', label: '餐食记录', icon: Utensils },
      { to: '/nutrition/plan', label: '营养计划', icon: ClipboardList },
    ],
  },
  {
    section: '05 AI 教练',
    items: [{ to: '/coach', label: 'AI 教练', icon: MessageSquareText }],
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  return (
    <aside className="w-[220px] shrink-0 border-r bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="size-9 rounded-2xl bg-foreground text-background grid place-items-center font-semibold text-sm tracking-tight">
            AF
          </span>
          <div className="leading-tight">
            <div className="font-semibold text-[15px] tracking-tight">AI Fitness OS</div>
            <div className="text-[11px] text-muted-foreground">私人 AI 教练系统</div>
          </div>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-2 pb-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              {group.section}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-4" strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )
          }
        >
          <SettingsIcon className="size-4" strokeWidth={1.8} />
          <span className="flex-1">设置</span>
        </NavLink>
      </div>

      <div className="px-5 py-4 border-t text-[11px] leading-relaxed text-muted-foreground">
        <div className="font-medium text-foreground">隐私模式</div>
        照片与数据仅保存在本机浏览器
      </div>
    </aside>
  )
}
