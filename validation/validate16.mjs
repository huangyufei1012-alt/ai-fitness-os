// Phase 1.6 验收脚本：日常训练体验与数据逻辑修正（13 步行进 + 9 张截图）
// 覆盖：
//  1 建档目标体重默认为空
//  2 休息日手动启动周一训练（警示 + 不阻止）
//  3 直接输入 70kg/8次/RIR2
//  4 复制上一组 / 应用到剩余组
//  5 完成一组 → 刷新后确认组次 + 休息计时恢复
//  6 只完成 1 组 → 结束训练 → 出现完成度提示（动作1/4、组数1/14）
//  7 保存为 partial
//  8 Summary 显示 组数 1/14、完成率 7%
//  9 返回 Today 显示额外完成训练
// 10 肌群数据区分直接组 / 间接组
// 11 动作建议不出现 2.6kg（取整到器械增量）
// 12 训练历史可打开 partial workout
// 13 刷新网站数据保留
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://localhost:4173'
const SHOTS = 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/shots/'
const USER_DIR = 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile16'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(SHOTS, { recursive: true })

let browser, page
const results = {}

async function launch() {
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: USER_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1280,1000'],
    defaultViewport: { width: 1280, height: 1000, deviceScaleFactor: 2 },
  })
  page = await browser.newPage()
}

async function goto(hash) {
  await page.goto(BASE + '/' + (hash || ''), { waitUntil: 'networkidle0' })
  await sleep(450)
}

async function shot(name) {
  await sleep(400)
  await page.screenshot({ path: SHOTS + name, fullPage: true })
  console.log('[shot]', name)
}

// 点击文本完全匹配的唯一按钮 / 链接
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

// 兼容 React 受控输入
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

// 向第 nth 个 number input 直接输入数值（组内的重量/次数/RIR）
async function typeNumberNth(nth, value) {
  await page.evaluate(({ nth, value }) => {
    const els = document.querySelectorAll('input[type="number"]')
    const el = els[nth]
    if (!el) throw new Error('no number input #' + nth)
    const proto = HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }, { nth, value })
  await sleep(150)
}

// 读某 aria-label 按钮的文本（用于判断某个 SetInput 当前值）
async function setInputValue(nth) {
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

// 检查页面是否包含某片段
const has = (t, s) => t.includes(s)

console.log('=== 1. 建档 · 目标体重默认为空 ===')
fs.rmSync(USER_DIR, { recursive: true, force: true })
await launch()
await goto('')
await sleep(700)
// 目标体重输入框默认应为空
const defaultTW = await page.evaluate(() => {
  const el = document.querySelector('input[placeholder="如 70"]')
  return el ? el.value : 'MISSING'
})
results['1 目标体重默认空'] = defaultTW === ''
await shot('p16_1_onboarding_targetWeight_empty.png')
// 填目标体重 70 + 每周4天
await typeText('input[placeholder="如 70"]', '70')
await clickText('4 天')
await clickText('继续')
await clickText('继续')
await sleep(400)
await clickText('生成我的计划')
await sleep(900)
results['1 建档完成进入今日'] = has(await text(), '你好')
console.log('  -> 目标体重默认值 =', JSON.stringify(defaultTW))

console.log('=== 2. 休息日手动启动周一训练 ===')
// 直接进入周一训练选择页（今天=周三=休息日）
await goto('#/training/workout?day=0')
await sleep(600)
const selText = await text()
results['2 休息日警示出现'] = selText.includes('今天原计划为') && selText.includes('休息日')
results['2 手动选择周一提示'] = selText.includes('手动选择了')
results['2 未阻止可选开始'] = selText.includes('开始训练')
await shot('p16_2_workout_select_restday_monday.png')
console.log('  URL=', page.url())
await clickText('开始训练', { exact: true })
await sleep(500)

console.log('=== 3. 直接输入 70kg / 8次 / RIR2 ===')
// 第一动作 = 卧推（bench-press），共 4 组；第一组输入框 [0]=重量 [1]=次数 [2]=RIR
await typeNumberNth(0, 70)
await typeNumberNth(1, 8)
await typeNumberNth(2, 2)
await sleep(300)
const w0 = await setInputValue(0)
const r0 = await setInputValue(1)
const ri0 = await setInputValue(2)
results['3 重量=70'] = w0 === '70'
results['3 次数=8'] = r0 === '8'
results['3 RIR=2'] = ri0 === '2'
await shot('p16_3_workout_direct_input.png')
console.log('  直接输入 ->', w0, 'kg x', r0, '次 RIR', ri0)

console.log('=== 4. 复制上一组 + 应用到剩余组 ===')
// 先完成第1组（触发休息计时）
const doneSet1 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('完成本组'))
  if (!btn) return false
  btn.click()
  return true
})
if (!doneSet1) throw new Error('未找到 完成本组')
await sleep(500)
// 第2组：先用「复制上一组」带入第1组值
await clickText('复制上一组', { nth: 0, exact: true })
await sleep(300)
// 再用「应用到剩余组」覆盖第2~4组
await clickText('应用到剩余组', { nth: 0, exact: true })
await sleep(400)
const w1 = await setInputValue(3) // 第2组重量
results['4 复制上一组带入重量'] = w1 === '70'
await shot('p16_4_workout_copy_apply.png')
console.log('  复制+应用后第2组重量 =', w1)

console.log('=== 5. 完成一组刷新 · 组次与休息计时恢复 ===')
// 第一组已 done；刷新后应保留 1 个完成组 + 休息计时恢复（120s 内）
await page.reload({ waitUntil: 'networkidle0' })
await sleep(800)
const rlText = await text()
results['5 刷新后仍在进行中'] = rlText.includes('进行中的训练') || rlText.includes('退出')
// 刷新后直接进入 active（activeWorkout 存在）→ 检查「组间休息」计时恢复
if (!rlText.includes('组间休息')) {
  // 若回到 select 有「进行中的训练」，点继续
  await clickText('继续训练')
  await sleep(500)
}
const afterReload = await text()
results['5 已完成第1组标记'] = afterReload.includes('第 1 组 · 已记录')
results['5 休息计时器恢复'] = afterReload.includes('组间休息') && /\d+s/.test(afterReload)
await shot('p16_5_workout_rest_resume_after_reload.png')
console.log('  刷新后休息计时 =', (afterReload.match(/\d+s/) || ['-'])[0])

console.log('=== 6. 只完成 1 组 → 结束训练 → 完成度提示 ===')
await clickText('结束训练', { exact: true })
await sleep(500)
const confirmText = await text()
results['6 确认框出现'] = confirmText.includes('结束本次训练？')
results['6 提示动作进度'] = confirmText.includes('完成动作 1/4')
results['6 提示组数进度'] = confirmText.includes('完成组数 1/14')
await shot('p16_6_workout_finish_confirm.png')
console.log('  确认框包含：', confirmText.includes('完成动作 1/4') && confirmText.includes('完成组数 1/14'))

console.log('=== 7. 保存为 partial ===')
await clickText('结束并保存为未完成', { exact: true })
await sleep(700)
results['7 进入小结'] = has(await text(), '训练已保存 · 未完成') || has(await text(), '提前结束')
await shot('p16_7_summary_partial.png')

console.log('=== 8. Summary 计划/完成组数与完成率 ===')
const sumText = await text()
results['8 组数 1/14'] = sumText.includes('1/14')
results['8 完成率 7%'] = sumText.includes('7%')
results['8 状态提前结束'] = sumText.includes('提前结束')
results['8 本地规则总结'] = sumText.includes('本地规则总结')
await shot('p16_8_summary_counts.png')
console.log('  Summary 完成率/组数 OK')

console.log('=== 9. 返回 Today · 休息日额外完成训练 ===')
await clickText('回到今日', { exact: true })
await sleep(600)
const todayText = await text()
results['9 休息日卡片出现'] = todayText.includes('今日原计划：休息') && todayText.includes('已额外完成训练')
results['9 显示完成统计'] = todayText.includes('完成动作') && todayText.includes('完成组数') && todayText.includes('训练容量')
results['9 查看训练总结按钮'] = todayText.includes('查看训练总结')
await shot('p16_9_today_extra_training.png')
console.log('  Today 额外训练 OK')

console.log('=== 10. 肌群数据 · 直接组 / 间接组 ===')
await goto('#/body/muscle-map')
await sleep(600)
const mmText = await text()
results['10 直接组'] = mmText.includes('直接组')
results['10 间接组'] = mmText.includes('间接组')
results['10 综合训练量'] = mmText.includes('综合训练量')
results['10 无undefined'] = !mmText.includes('undefined')
await shot('p16_10_musclemap_direct_indirect.png')

console.log('=== 11. 动作建议不出现 2.6kg（取整到器械增量） ===')
await goto('#/training/exercise/bench-press')
await sleep(700)
const exText = await text()
results['11 有历史记录'] = exText.includes('训练数据')
// 卧推：只完成1组<目标4组 → 保持当前重量；70kg → 取整后仍 70，绝不含 2.6 / 71.8
results['11 不出现2.6'] = !/2\.6/.test(exText)
results['11 不出现分数重量(71.8)'] = !/71\.8|72\.5/.test(exText)
results['11 显示保持当前重量'] = exText.includes('保持当前重量')
await shot('p16_11_exercise_next_target.png')
console.log('  动作建议无 2.6kg OK')

console.log('=== 12. 训练历史可打开 partial workout ===')
await goto('#/training/history')
await sleep(600)
const histText = await text()
results['12 历史页有记录'] = histText.includes('胸 / 肩 / 肱三头肌') || histText.includes('提前结束')
results['12 显示提前结束徽章'] = histText.includes('提前结束')
await shot('p16_12_history_list.png')
// 点击第一个历史卡进入详情
const opened = await page.evaluate(() => {
  const a = document.querySelector('a[href^="#/training/history/"]')
  if (!a) return false
  a.click()
  return true
})
if (opened) {
  await sleep(700)
  const detailText = await text()
  results['12 详情可打开'] = detailText.includes('训练已保存 · 未完成') || detailText.includes('训练记录')
  await shot('p16_12_history_detail_partial.png')
} else {
  results['12 详情可打开'] = false
  console.log('  !!! 未找到历史卡链接')
}
console.log('  历史详情可打开 =', results['12 详情可打开'])

console.log('=== 13. 刷新网站数据保留 ===')
const dataBefore = await readState()
await browser.close()
await launch()
await goto('')
await sleep(800)
const afterReopen = await readState()
results['13 仍onboarded'] = afterReopen.onboarded === true
results['13 训练记录保留'] = (afterReopen.workoutHistory || []).length > 0
results['13 记录为partial'] = afterReopen.workoutHistory?.[0]?.status === 'partial'
await shot('p16_13_reopen_retained.png')

console.log('\n===== Phase 1.6 验收结果 =====')
let pass = 0, fail = 0
for (const [k, v] of Object.entries(results)) {
  const ok = v === true
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}: ${JSON.stringify(v)}`)
}
console.log(`\n通过 ${pass} / ${pass + fail}`)
await browser.close()
console.log('DONE')
