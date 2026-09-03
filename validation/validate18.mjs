// Phase 1.8 验收脚本：Today 当日训练聚合 —— 计划日（周四）下显示当天全部训练记录
// 用户 bug：非计划日手动训练「结束并保存为未完成」后写入 workoutHistory，
// 但 Today（周四=计划日=腿部）首页不显示这条当天记录。
// 本脚本在「周四」场景真实执行：原定腿部卡仍可开始 + 额外胸训练显示「提前结束」+
//   指标 1/4 个动作 · 1/14 组 · 完成率 7% · 容量 560kg + 点击进详情 + 刷新保留。
// 用法（BASE_URL 可覆盖为公网做「修复前」对比，本地产物为「修复后」）：
//   BASE_URL=http://localhost:4173 PROFILE_DIR=... SHOTS_DIR=... node validate18.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const SHOTS =
  process.env.SHOTS_DIR ||
  'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/shots/'
const USER_DIR =
  process.env.PROFILE_DIR ||
  'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile18-live'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(SHOTS, { recursive: true })

let browser, page
const results = {}

async function launch() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,1000',
  ]
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxy) {
    const clean = proxy.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const useSocks = /127\.0\.0\.1:7890/.test(clean) || /localhost:7890/.test(clean)
    args.push('--proxy-server=' + (useSocks ? 'socks5://' : 'http://') + clean)
  }
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: USER_DIR,
    args,
    defaultViewport: { width: 1280, height: 1000, deviceScaleFactor: 2 },
  })
  page = await browser.newPage()
}

async function goto(hash) {
  await page.goto(BASE + '/' + (hash || ''), { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(450)
}

async function shot(name) {
  await sleep(400)
  await page.screenshot({ path: SHOTS + name, fullPage: true })
  console.log('[shot]', name)
}

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
  await sleep(250)
}

async function typeText(sel, value) {
  await page.evaluate(({ sel, value }) => {
    const el = document.querySelector(sel)
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel, value })
  await sleep(120)
}

async function typeNumberNth(nth, value) {
  await page.evaluate(({ nth, value }) => {
    const els = document.querySelectorAll('input[type="number"]')
    const el = els[nth]
    if (!el) throw new Error('no number input #' + nth)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }, { nth, value })
  await sleep(150)
}

async function numberNthValue(nth) {
  return await page.evaluate((nth) => {
    const el = document.querySelectorAll('input[type="number"]')[nth]
    return el ? el.value : null
  }, nth)
}

async function text() {
  return await page.evaluate(() => document.body.innerText)
}

async function readState() {
  return await page.evaluate(() => JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}'))
}

const has = (t, s) => t.includes(s)
const hasRe = (t, re) => re.test(t)

console.log('=== 1. 建档（无冲突：目标体重 80 > 当前 75）→ 进入今日（今天=周四=计划日）===')
await launch()
await goto('')
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
await sleep(700)
await typeText('input[aria-label="目标体重 kg"]', '80')
await clickText('4 天')
await clickText('继续')
await clickText('继续')
await clickText('生成我的计划')
await sleep(900)
const onbText = await text()
results['1 建档完成进入今日'] = has(onbText, '你好') && has(onbText, '今日训练')
results['1 今天是计划日(周四)』'] = has(onbText, '周四')
results['1 今日原定训练卡可开始'] = has(onbText, '开始训练')
await shot('v18_1_today_thursday_plan.png')
// 记录今天原定训练卡文案（周四腿部），用于「未误标已完成」对比
const topCardBefore = await page.evaluate(() => {
  const h2s = [...document.querySelectorAll('h2')].map((h) => (h.textContent || '').trim())
  return h2s.slice(0, 3).join(' | ')
})
console.log('  原定卡 =', JSON.stringify(topCardBefore))

console.log('=== 2. 周四手动启动周一（胸）训练：警示 + 不阻止，完成第 1 组 ===')
await goto('#/training/workout?day=0')
await sleep(600)
const selText = await text()
results['2 警示=今天原计划'] = has(selText, '今天原计划为')
results['2 警示=周四/腿部'] = has(selText, '周四') && (has(selText, '腿'))
results['2 手动选择提示'] = has(selText, '手动选择')
results['2 可选开始（不阻止）'] = has(selText, '开始训练')
await shot('v18_2_workout_select_thursday_monday.png')
await clickText('开始训练', { exact: true })
await sleep(500)
// 周一第一动作 = 杠铃卧推，4 组；只完成第 1 组 70kg×8×RIR2
await typeNumberNth(0, 70)
await typeNumberNth(1, 8)
await typeNumberNth(2, 2)
results['2 第1组重量=70'] = (await numberNthValue(0)) === '70'
results['2 第1组次数=8'] = (await numberNthValue(1)) === '8'
results['2 第1组RIR=2'] = (await numberNthValue(2)) === '2'
const doneSet1 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('完成本组'))
  if (!btn) return false
  btn.click()
  return true
})
if (!doneSet1) throw new Error('未找到 完成本组')
await sleep(500)
await clickText('结束训练', { exact: true })
await sleep(500)
const confirmText = await text()
results['2 确认框出现'] = has(confirmText, '结束本次训练？')
results['2 确认框动作 1/4'] = has(confirmText, '完成动作 1/4')
results['2 确认框组数 1/14'] = has(confirmText, '完成组数 1/14')
await shot('v18_2_finish_confirm_1of14.png')
await clickText('结束并保存为未完成', { exact: true })
await sleep(700)

console.log('=== 3. Summary：1/14 · 7% · 提前结束 ===')
const sumText = await text()
results['3 组数 1/14'] = has(sumText, '1/14')
results['3 完成率 7%'] = has(sumText, '7%')
results['3 状态提前结束'] = has(sumText, '提前结束')
const st = await readState()
const ws = st.workoutHistory || []
results['3 已写入workoutHistory'] = ws.length === 1
results['3 记录为partial'] = ws[0]?.status === 'partial'
results['3 记录dayIndex=0(周一)'] = ws[0]?.dayIndex === 0
results['3 记录today日期'] = ws[0]?.date === new Date().toISOString().slice(0, 10)
await shot('v18_3_summary_7pct_partial.png')

console.log('=== 4. 回到 Today：原定卡仍可开始 + 今日训练记录（额外·提前结束）===')
await clickText('回到今日', { exact: true })
await sleep(600)
const todayText = await text()
const topCardAfter = await page.evaluate(() => {
  const h2s = [...document.querySelectorAll('h2')].map((h) => (h.textContent || '').trim())
  return h2s.slice(0, 3).join(' | ')
})
results['4 原定卡未消失'] = has(todayText, '周四') && has(todayText, '开始训练')
results['4 原定卡未误标已完成'] = !hasRe(todayText, /今日计划训练 · 已完成/) && has(todayText, '开始训练')
console.log('  原定卡(修复后) =', JSON.stringify(topCardAfter))
if (has(todayText, '今日训练记录')) {
  results['4 今日训练记录区出现'] = true
  results['4 文案=已额外训练·提前结束'] = has(todayText, '已额外训练') && has(todayText, '提前结束')
  results['4 肌群 胸/肩/肱三头肌'] = has(todayText, '胸') && has(todayText, '肩') && has(todayText, '肱三头肌')
  results['4 个动作 1/4'] = hasRe(todayText, /1\/4\s*个动作/)
  results['4 组数 1/14'] = hasRe(todayText, /1\/14\s*组/)
  results['4 完成率 7%'] = hasRe(todayText, /完成率 7%/)
  results['4 容量 560kg'] = hasRe(todayText, /560\s?kg/)
  await shot('v18_4_today_record_extra_partial.png')
} else {
  // 修复前：plan 日分支不渲染记录区（Bug 在公网旧版上复现即为此）
  results['4 今日训练记录区出现'] = false
  results['4 隐藏的额外训练'] = !has(todayText, '已额外训练')
  console.log('  [注意] 未出现今日训练记录区 → 旧版 Bug 复现（修复前基线）')
  await shot('v18_4_today_MISSING_RECORD_bug.png')
}

console.log('=== 5. 点击记录进入训练历史详情（/training/history/:id）===')
const recHref = await page.evaluate(() => {
  const a = document.querySelector('a[href^="#/training/history/"]')
  return a ? a.getAttribute('href') : null
})
if (recHref) {
  const recId = recHref.split('/').pop()
  await page.evaluate((href) => {
    document.querySelector('a[href^="#/training/history/"]').click()
  }, recHref)
  await sleep(700)
  const detailText = await text()
  const curHash = await page.evaluate(() => location.hash)
  results['5 路由=训练历史详情'] = curHash.includes('/training/history/')
  results['5 详情id匹配记录'] = curHash.includes(recId)
  results['5 详情显示提前结束'] = has(detailText, '提前结束')
  results['5 详情 1/14'] = has(detailText, '1/14')
  results['5 详情 7%'] = has(detailText, '7%')
  results['5 详情 卧推/胸'] = has(detailText, '杠铃卧推') || has(detailText, '胸')
  await shot('v18_5_history_detail.png')
  await goto('')
  await sleep(500)
} else {
  console.log('  [注意] 无记录链接 → 修复前基线，跳过（预期未实现）')
  await goto('')
  await sleep(500)
}

console.log('=== 6. 刷新后记录不消失 ===')
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
await sleep(800)
const afterReload = await readState()
const todayText2 = await text()
results['6 刷新后workoutHistory保留'] = (afterReload.workoutHistory || []).length === 1
results['6 刷新后仍partial'] = afterReload.workoutHistory?.[0]?.status === 'partial'
results['6 刷新后今日训练记录仍显示'] = has(todayText2, '今日训练记录') && has(todayText2, '已额外训练')
results['6 刷新后原定卡仍可开始'] = has(todayText2, '开始训练')
await shot('v18_6_reload_retained.png')

console.log('\n===== Phase 1.8 验收结果 =====')
let pass = 0, fail = 0
for (const [k, v] of Object.entries(results)) {
  const ok = v === true
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}: ${JSON.stringify(v)}`)
}
console.log(`\n通过 ${pass} / ${pass + fail}`)
await browser.close()
console.log('DONE')
process.exit(fail ? 1 : 0)
