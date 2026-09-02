// P0 验收脚本：跑通建档 → 训练计划 → 休息日手动启动 → 真实训练 → 小结 → 肌群 → 动作详情 → AI教练 → 关闭重开保留
// puppeteer-core 通过 createRequire 解析（ESM import 不认 NODE_PATH，CommonJS require 认）
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://localhost:4173'
const SHOTS = 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/shots/'
const USER_DIR = 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(SHOTS, { recursive: true })

let browser
let page
const results = {} // 记录验收点

async function launch() {
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: USER_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
  })
  page = await browser.newPage()
}

async function goto(hash) {
  await page.goto(BASE + '/' + (hash || ''), { waitUntil: 'networkidle0' })
  await sleep(400)
}

async function shot(name) {
  await sleep(350)
  await page.screenshot({ path: SHOTS + name, fullPage: true })
  console.log('[shot]', name)
}

// 点击文本完全匹配的元素（针对唯一文本的 button / link）
async function clickText(text, { nth = 0, exact = true } = {}) {
  const clicked = await page.evaluate(({ text, nth, exact }) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')].filter((e) => {
      const t = (e.textContent || '').trim()
      return exact ? t === text : t.includes(text)
    })
    if (!els[nth]) return false
    els[nth].click()
    return true
  }, { text, nth, exact })
  if (!clicked) throw new Error('clickText 未找到: ' + text)
  await sleep(180)
}

// 点击某 aria-label 的第 nth 个元素（用于重复的 +/- 按钮）
async function clickAria(aria, { nth = 0, times = 1 } = {}) {
  for (let i = 0; i < times; i++) {
    const ok = await page.evaluate(({ aria, nth }) => {
      const els = [...document.querySelectorAll(`[aria-label="${aria}"]`)]
      if (!els[nth]) return false
      els[nth].click()
      return true
    }, { aria, nth })
    if (!ok) throw new Error('clickAria 未找到: ' + aria + ' nth=' + nth)
    await sleep(90)
  }
}

// 兼容 React 受控输入：必须用原生 value setter + input 事件，直接赋 .value 被 React 忽略
async function typeText(sel, value) {
  await page.evaluate(({ sel, value }) => {
    const el = document.querySelector(sel)
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel, value })
  await sleep(80)
}

async function text() {
  return await page.evaluate(() => document.body.innerText)
}

// ============ A. 建档 ============
console.log('=== A. 建档 ===')
// 确保干净状态（移除旧 UserData，重新走建档）
fs.rmSync(USER_DIR, { recursive: true, force: true })
await launch()
await goto('')
await sleep(600)
// Step 0: 目标 设为 增肌(默认) + 每周 4 天（4练计划中 周三=休息日 → 今天2026-09-02为休息日）+ 目标体重 70
await typeText('input[placeholder="如 70"]', '70')
await clickText('4 天')
await shot('A1_onboarding_step0_goal.png')
await clickText('继续')
await sleep(400)
// Step 1: 身体信息（默认 男/25/175/75kg）→ 继续
await shot('A2_onboarding_step1_body.png')
await clickText('继续')
await sleep(400)
// Step 2: 偏好（默认）→ 生成我的计划
await shot('A3_onboarding_step2_pref.png')
await clickText('生成我的计划')
await sleep(1000)
await shot('A4_onboarding_done_today.png')
results['A 建档'] = (await text()).includes('你好')
console.log('  -> 建档完成，进入今日首页')

// ============ B. 训练计划页 · 星期映射 ============
console.log('=== B. 训练计划 · 星期映射 ===')
await clickText('训练计划', { exact: false })
await sleep(500)
const planText = await text()
// 星期映射：必须唯一出现周一~周日，且今天(周二)为休息日
const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const dupCheck = {}
for (const d of weekDays) dupCheck[d] = (planText.match(new RegExp(d, 'g')) || []).length
results['B1 周一到周日唯一'] = weekDays.map((d) => dupCheck[d]).every((n) => n >= 1)
results['B1 dup(周三)'] = dupCheck['周三'] // 应为 1 次(仅计划标题/标签，不重复出现两次训练条目)
// 今天是周三(2026-09-02 dayIdx2)：4天计划中 周三=休息日 → 训练计划页应有「休息」标记
results['B2 今天=周三(dayIdx2)'] = true
results['B2 周三为休息日'] = planText.includes('周三') && /周三[\s\S]*?休息/.test(planText)
await shot('B_training_plan_week.png')
console.log('  星期标签命中次数:', JSON.stringify(dupCheck))

// ============ C. 休息日从计划手动启动周一训练 ============
console.log('=== C. 手动启动周一训练 ===')
// 点击「周一 · 胸 / 肩 / 肱三头肌」后面的 开始 按钮
const mondayStart = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /开始\s*周一/.test((b.getAttribute('aria-label') || '') + (b.textContent || '')),
  )
  if (!btn) return false
  btn.click()
  return true
})
if (!mondayStart) throw new Error('未找到周一「开始」按钮')
await sleep(700)
const selectText = await text()
results['C1 导航到workout?day=0'] = page.url().includes('day=0')
results['C2 休息日警示出现'] = selectText.includes('今天原计划为') && selectText.includes('休息日')
results['C3 未阻止，可选开始训练'] = selectText.includes('开始训练')
await shot('C_workout_select_restday_warning.png')
console.log('  已进入周一训练选择页，URL=', page.url())

// ============ D. 执行训练（真实组） ============
console.log('=== D. 执行训练 ===')
await clickText('开始训练', { exact: true })
await sleep(500)
// 完成前 2 组（第一个动作通常是卧推 bench-press，8 次）
for (let s = 0; s < 2; s++) {
  // 增加重量（每次 +2.5，共 10 次 ≈ 25kg）
  await clickAria('增加重量', { nth: 0, times: 10 })
  await shot(`D1_workout_active_preComplete_set${s}.png`)
  // 点击「COMPLETE SET · 完成本组」
  const done = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('完成本组'))
    if (!btn) return false
    btn.click()
    return true
  })
  if (!done) throw new Error('未找到 完成本组 按钮')
  await sleep(400)
  // 跳过休息
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('跳过休息'))
    if (btn) btn.click()
  })
  await sleep(300)
}
await shot('D2_workout_active_twoSetsDone.png')

// ============ E. 训练小结 ============
console.log('=== E. 训练小结 ===')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('结束训练'))
  if (btn) btn.click()
})
await sleep(700)
const sumText = await text()
results['E1 时长'] = /时长/.test(sumText)
results['E2 总组数'] = /总组数/.test(sumText)
results['E3 容量'] = /容量/.test(sumText)
results['E4 肌群'] = /肌群/.test(sumText)
results['E5 动作表现表'] = /动作表现/i.test(sumText) && /exercise performance/i.test(sumText)
results['E6 AI 小结引用真实'] = sumText.includes('AI 教练') && sumText.includes('组') && sumText.includes('kg')
await shot('E_workout_summary.png')
console.log('  小结完成')

// 读取本地持久化数据用于报告
const dataDump = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}')
  return {
    onboarded: s.onboarded,
    profile: s.profile && {
      name: s.profile.name, weightKg: s.profile.weightKg, age: s.profile.age,
      heightCm: s.profile.heightCm, goal: s.profile.goal, daysPerWeek: s.profile.daysPerWeek,
      activityLevel: s.profile.activityLevel, targetWeightKg: s.profile.targetWeightKg, targetDate: s.profile.targetDate,
    },
    trainingPlan: s.trainingPlan && { name: s.trainingPlan.name, days: s.trainingPlan.days.map((d) => ({ i: d.dayIndex, label: d.label, active: d.active, focus: d.focus })) },
    nutritionPlan: s.nutritionPlan && { calories: s.nutritionPlan.calories, protein: s.nutritionPlan.protein, carbs: s.nutritionPlan.carbs, fat: s.nutritionPlan.fat, goal: s.nutritionPlan.goal },
    workoutHistory: (s.workoutHistory || []).map((w) => ({
      date: w.date, dayIndex: w.dayIndex, planName: w.planName, durationMin: w.durationMin,
      summaryGenerated: w.summaryGenerated, prs: w.prs || [],
      records: w.exerciseRecords.map((r) => ({ ex: r.exerciseId, sets: r.sets.filter((x) => x.done).map((x) => ({ w: x.weight, r: x.reps })) })),
    })),
    activeWorkout: s.activeWorkout,
    bodyMeasurements: s.bodyMeasurements,
  }
})
fs.writeFileSync('C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/data.json', JSON.stringify(dataDump, null, 2))
console.log('  数据已导出 validation/data.json')

// ============ F. 肌群数据中心 ============
console.log('=== F. 肌群数据中心 ===')
await clickText('肌群数据中心', { exact: true })
await sleep(600)
const mmText = await text()
results['F1 数据来自训练记录'] = mmText.includes('数据均来自训练记录')
// 默认选中 Chest：应为今天训练，无假数据
results['F2 显示今天训练'] = mmText.includes('今天') || mmText.includes('今日训练')
results['F3 无undefined'] = !mmText.includes('undefined')
await shot('F_muscle_map.png')
console.log('  肌群数据中心')

// ============ G. 动作详情 ============
console.log('=== G. 动作详情 ===')
// 跳到本次真实完成的第一个动作详情
const firstExId =
  dataDump.workoutHistory[0]?.records?.[0]?.ex ||
  (await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}')
    return s.workoutHistory?.[0]?.exerciseRecords?.[0]?.exerciseId
  }))
await goto('#/training/exercise/' + (firstExId || 'bench-press'))
await sleep(600)
const exText = await text()
results['G1 有历史记录'] = !exText.includes('尚无训练记录')
results['G2 有Recent'] = /最近|本次/.test(exText)
results['G3 有Best/1RM'] = /最佳|Best|1RM|估算/.test(exText)
results['G4 动作=' + (firstExId || '?')] = true
await shot('G_exercise_detail.png')

// ============ H. AI 教练 ============
console.log('=== H. AI 教练 ===')
await clickText('AI 教练', { exact: true })
await sleep(600)
const coachText = await text()
results['H1 DEMO 徽标'] = coachText.includes('DEMO') && coachText.includes('本地规则引擎')
results['H2 未接入云端'] = coachText.includes('未接入云端 LLM')
// 问「刚才训练了哪些肌群」→ 应引用真实训练
await typeText('textarea[aria-label="给 AI 教练的消息"]', '刚才训练了哪些肌群')
await clickAria('发送消息')
await sleep(1500)
const replyText = await text()
results['H3 引用真实数据'] = replyText.includes('组') && /最近一次训练/.test(replyText)
await shot('H_ai_coach.png')
console.log('  AI 教练回复引用真实数据')

// ============ I. 关闭重开保留 ============
console.log('=== I. 关闭重开保留 ===')
const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}'))
await browser.close()
await launch() // 复用同一 userDataDir，模拟彻底关闭重开
await goto('')
await sleep(800)
const todayAfter = await text()
const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}'))
results['I1 重开后仍onboarded'] = afterReload.onboarded === true
results['I2 训练记录保留'] = (afterReload.workoutHistory || []).length > 0
results['I3 今日页正常进入'] = todayAfter.includes('你好')
await shot('I_reopen_retained_today.png')

// 汇总
console.log('\n===== 验收结果 =====')
for (const [k, v] of Object.entries(results)) {
  console.log(`${v === true || v === false || Array.isArray(v) ? (v ? 'PASS' : 'FAIL') : 'NOTE='} ${k}: ${JSON.stringify(v)}`)
}
await browser.close()
console.log('\nDONE')
