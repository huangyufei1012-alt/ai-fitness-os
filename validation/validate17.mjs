// Phase 1.7 验收脚本：状态口径、训练建议与无障碍修正（18 步 + 截图）
// 覆盖规范「PHASE 1.7 状态口径、训练建议与无障碍修正」的验收路径：
//   1 建档：增肌用户 75kg → 目标 69kg（制造目标冲突）
//   2 冲突提醒：非阻塞弹窗「请确认目标方向」+ 返回修改/确认并继续
//   3 确认并继续 → 建档完成进入今日（今天=周三=休息日）
//   4 休息日手动启动周一训练（警示 + 不阻止）
//   5 第一组直接输入 70kg / 8次 / RIR2
//   6 第一组一次点击「应用到全部剩余组」→ 复制到第2~4组
//   7 只完成第 1 组（COMPLETE SET）→ 结束训练
//   8 结束确认框（完成动作 1/4、完成组数 1/14）
//   9 保存为 partial → Summary（1/14、7%、提前结束、本地规则总结）
//  10 回到今日 → 「已额外训练 · 提前结束」+ 4 列统计（1/4、1/14、7%、560kg）
//  11 今日教练建议区分「提前结束」（AI 建议 + DEMO 徽标）
//  12 动作详情：本地规则 · 下次训练目标 + 70kg × 6-8次 + 4 组 + 不再「8次 次」
//  13 肌群图：无 undefined、直接/间接/综合口径一致（前束 0.5 有效组/7天）
//  14 键盘 Tab 可移动焦点到数字输入（无障碍）
//  15 所有数字输入框均有独立可访问名称（aria-label）
//  16 训练历史区分「主要肌群」与「辅助肌群」
//  17 刷新网站数据全部保留
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
// 可通过环境变量 BASE_URL 覆盖（如公网 https://huangyufei1012-alt.github.io/ai-fitness-os）
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const SHOTS =
  process.env.SHOTS_DIR ||
  'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/shots/'
// 公网运行时使用独立 profile，模拟「全新无痕 + 清网站数据」的干净环境
const USER_DIR =
  process.env.PROFILE_DIR ||
  (process.env.BASE_URL
    ? 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile-live'
    : 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile17')

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
  // Chromium 不读取 HTTP_PROXY 环境变量；若系统配置了本地代理（curl 可达但浏览器直连超时），
  // 显式传给浏览器，否则公网验收会 net::ERR_CONNECTION_TIMED_OUT。
  // 本机 127.0.0.1:7890 实为 SOCKS5 代理：HTTP 代理形式会被 Chromium 拒绝
  // （ERR_NO_SUPPORTED_PROXIES），必须用 socks5:// scheme。
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxy) {
    // 仅保留 host:port（去掉 scheme 与尾斜杠/路径），避免 Chromium 误解析
    const clean = (proxy.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
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

// 向第 nth 个 number input 直接输入数值
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

console.log('=== 1-3. 建档（增肌 75→69）· 冲突提醒 · 确认并存档 ===')
await launch()
// 不删除整个浏览器 profile（避免 bulk-delete 拦截），改为清空 localStorage 来重置建档
await goto('')
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
await sleep(700)
// 默认 goal=bulk、当前体重 75；把目标体重填 69（低于当前 → 触发冲突）
await typeText('input[aria-label="目标体重 kg"]', '69')
results['1 目标体重已填69'] = (await numberNthValue(0)) === '69'
await clickText('4 天')
await clickText('继续')
await clickText('继续')
await sleep(300)
// 点击「生成我的计划」→ 应出现冲突弹窗，而非直接完成
await clickText('生成我的计划')
await sleep(600)
const conflictText = await text()
results['2 冲突弹窗出现'] = conflictText.includes('请确认目标方向')
results['2 冲突文案正确'] = conflictText.includes('你的目标是增肌') && conflictText.includes('低于当前体重 75kg')
results['2 提供返回修改'] = conflictText.includes('返回修改')
results['2 提供确认并继续'] = conflictText.includes('确认并继续')
await shot('p17_2_onboarding_conflict_dialog.png')
// 非阻塞确认：点「确认并继续」完成建档
await clickText('确认并继续')
await sleep(900)
const afterOnboard = await text()
results['3 建档完成进入今日'] = has(afterOnboard, '你好') && has(afterOnboard, '今日原计划：休息')
await shot('p17_3_today_restday.png')
console.log('  URL=', page.url())

console.log('=== 4. 休息日手动启动周一训练（警示 + 不阻止） ===')
await goto('#/training/workout?day=0')
await sleep(600)
const selText = await text()
results['4 休息日警示出现'] = selText.includes('今天原计划为') && selText.includes('休息日')
results['4 手动选择提示'] = selText.includes('手动选择了')
results['4 未阻止可选开始'] = selText.includes('开始训练')
await shot('p17_4_workout_select_restday_monday.png')
await clickText('开始训练', { exact: true })
await sleep(500)

console.log('=== 5-6. 第一组输入 70/8/RIR2 + 一次点击应用到全部剩余组 ===')
// 周一第一动作 = 杠铃卧推（bench-press），共 4 组（组0 输入0,1,2 / 组1 输入3,4,5 …）
await typeNumberNth(0, 70)
await typeNumberNth(1, 8)
await typeNumberNth(2, 2)
await sleep(300)
results['5 第1组重量=70'] = (await numberNthValue(0)) === '70'
results['5 第1组次数=8'] = (await numberNthValue(1)) === '8'
results['5 第1组RIR=2'] = (await numberNthValue(2)) === '2'
// 第 1 组（si=0）应显示「应用到全部剩余组」按钮
await clickText('应用到全部剩余组', { exact: true })
await sleep(400)
results['6 第2组重量被复制=70'] = (await numberNthValue(3)) === '70'
results['6 第2组次数被复制=8'] = (await numberNthValue(4)) === '8'
results['6 第2组RIR被复制=2'] = (await numberNthValue(5)) === '2'
results['6 第3组重量被复制=70'] = (await numberNthValue(6)) === '70'
results['6 第4组重量被复制=70'] = (await numberNthValue(9)) === '70'
await shot('p17_6_apply_to_all_remaining_sets.png')
console.log('  应用到全部剩余组 -> 第2-4组均被复制')

console.log('=== 14. 键盘 Tab 焦点移动（无障碍输入） ===')
// 聚焦第1组重量输入框，其可访问名称应为「第1组重量」；按 Tab 移动焦点到有名称的下一元素
const tabOK = await page.evaluate(() => {
  const inputs = document.querySelectorAll('input[type="number"]')
  const w = inputs[0]
  w.focus()
  return { label: w.getAttribute('aria-label'), value: w.getAttribute('aria-valuetext') }
})
results['14 重量输入可访问名称=第1组重量'] = tabOK.label === '第1组重量'
results['14 重量输入aria-valuetext含公斤'] = (tabOK.value || '').includes('kg')
await page.keyboard.press('Tab')
await sleep(250)
const afterTab = await page.evaluate(() => {
  const a = document.activeElement
  return a ? a.getAttribute('aria-label') : null
})
results['14 Tab移动到有名称的下个元素'] = !!afterTab && afterTab.length > 0
console.log('  Tab 后聚焦 aria-label =', afterTab)

console.log('=== 7. 完成第 1 组 → 结束训练 ===')
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
results['7 确认框出现'] = confirmText.includes('结束本次训练？')
results['7 提示动作进度 1/4'] = confirmText.includes('完成动作 1/4')
results['7 提示组数进度 1/14'] = confirmText.includes('完成组数 1/14')
await shot('p17_7_finish_confirm_1of14.png')
await clickText('结束并保存为未完成', { exact: true })
await sleep(700)

console.log('=== 8-9. Summary：计划14组/完成1组/完成率7% ===')
const sumText = await text()
results['8 组数 1/14'] = sumText.includes('1/14')
results['8 完成率 7%'] = sumText.includes('7%')
results['8 状态提前结束'] = sumText.includes('提前结束')
results['8 本地规则总结'] = sumText.includes('本地规则总结')
await shot('p17_8_summary_7pct.png')
console.log('  Summary OK')

console.log('=== 10. 返回 Today · 已额外训练 · 提前结束 + 4 列统计 ===')
await clickText('回到今日', { exact: true })
await sleep(600)
const todayText = await text()
results['10 休息日卡片出现'] = todayText.includes('今日原计划：休息')
results['10 文案=已额外训练·提前结束'] = todayText.includes('已额外训练') && todayText.includes('提前结束')
results['10 完成动作 1/4'] = todayText.includes('1/4')
results['10 完成组数 1/14'] = todayText.includes('1/14')
results['10 完成率 7%'] = todayText.includes('7%')
results['10 训练容量 560kg'] = todayText.includes('560') && todayText.includes('kg')
await shot('p17_10_today_extra_partial_4stats.png')

console.log('=== 11. 今日教练建议（区分提前结束 + DEMO 徽标） ===')
results['11 有今日教练建议'] = todayText.includes('今日教练建议')
results['11 DEMO徽标'] = todayText.includes('本地规则 / DEMO · 未接入云端 LLM')
results['11 建议区分提前结束'] = todayText.includes('训练但提前结束')
await shot('p17_11_today_coach_advice_demo.png')

console.log('=== 12. 动作详情：本地规则 · 下次训练目标（读训练计划 6-8次 / 4组） ===')
await goto('#/training/exercise/bench-press')
await sleep(700)
const exText = await text()
results['12 标题=本地规则·下次训练目标'] = exText.includes('本地规则 · 下次训练目标')
results['12 DEMO徽标=未接入云端LLM'] = exText.includes('DEMO · 未接入云端 LLM')
results['12 目标次数来自计划6-8'] = exText.includes('kg × 6-8 次')
results['12 组数来自计划4组'] = exText.includes('4 组')
results['12 当前重量70'] = exText.includes('70')
results['12 不再出现8次 次'] = !/8\s*次\s*次/.test(exText) && !exText.includes('8次 次')
results['12 不出现上次完成组数(1组)'] = !/1 组 · RIR/.test(exText)
await shot('p17_12_exercise_next_target_plan.png')
console.log('  建议 =', (exText.match(/本地规则[\s\S]{0,120}/) || ['-'])[0].slice(0, 60).replace(/\n/g, ' '))

console.log('=== 13. 肌群图：直接/间接/综合口径一致，前束 0.5 有效组 ===')
await goto('#/body/muscle-map')
await sleep(600)
const mmText = await text()
results['13 无undefined'] = !mmText.includes('undefined')
results['13 有直接组'] = mmText.includes('直接组')
results['13 有间接组'] = mmText.includes('间接组')
results['13 有综合训练量'] = mmText.includes('综合训练量')
results['13 有有效组/7天'] = mmText.includes('有效组/7天')
// 胸：直接组1 → 有效组1（不出现「参与」后缀）；切到前束应显示 0.5 有效组/7天（参与1组）
await sleep(300)
const chestSel = await page.evaluate(() => {
  // 左侧第一个肌群按钮 = 胸
  const btns = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('有效组/7天'))
  const chest = btns.find((b) => (b.textContent || '').startsWith('胸'))
  return chest ? chest.textContent.trim() : null
})
results['13 胸=1有效组且无参与后缀'] = chestSel === '胸1 有效组/7天'
await shot('p17_13_musclemap_consistency.png')
// 切到前束查看 0.5 有效组 / 参与1组（按钮文本含统计后缀，用包含匹配）
await clickText('前束', { exact: false })
await sleep(500)
const frontText = await text()
results['13 前束详情综合训练量=0.5'] = frontText.includes('综合训练量') && /0\.5\s*组/.test(frontText)
// 左选择器前束：0.5 有效组/7天（参与1组）
const frontSel = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('前束'))
  return btn ? btn.textContent.trim() : null
})
results['13 前束左=0.5有效组/7天(参与1组)'] = frontSel ? frontSel.includes('0.5 有效组/7天') && frontSel.includes('参与1组') : false
await shot('p17_13_musclemap_front_delts_partial.png')
console.log('  前束选择器 =', JSON.stringify(frontSel))

console.log('=== 15. 所有数字输入框均有独立可访问名称 ===')
// 跳 Settings 验证 4 个数字框都有 aria-label
await goto('#/settings')
await sleep(600)
const a11ySettings = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type="number"]')]
  const missing = inputs.filter((i) => !(i.getAttribute('aria-label') || '').trim())
  return { count: inputs.length, missing: missing.length, labels: inputs.map((i) => i.getAttribute('aria-label')) }
})
results['15 Settings有4个数字框'] = a11ySettings.count === 4
results['15 Settings全部有aria-label'] = a11ySettings.missing === 0
results['15 Settings名称见年龄身高体重'] = ['年龄', '身高 cm', '当前体重 kg', '目标体重 kg'].every((l) => a11ySettings.labels.includes(l))
await shot('p17_15_settings_aria_labels.png')
console.log('  Settings labels =', JSON.stringify(a11ySettings.labels))

console.log('=== 16. 训练历史区分主要/辅助肌群 ===')
await goto('#/training/history')
await sleep(600)
const histText = await text()
results['16 历史页有记录'] = histText.includes('杠铃卧推') || histText.includes('训练')
// 主要肌群徽标（胸）与辅助肌群（前束、肱三头肌）分别渲染
const muscleBadges = await page.evaluate(() => {
  const badges = [...document.querySelectorAll('a[href^="#/training/history/"] span')].map((s) => (s.textContent || '').trim())
  return badges.filter((t) => /胸|前束|肱三头肌|肩|背|臀|腿|核心/.test(t))
})
results['16 显示主要肌群-胸'] = muscleBadges.includes('胸')
results['16 显示辅助肌群-前束'] = muscleBadges.includes('前束')
results['16 显示辅助肌群-肱三头肌'] = muscleBadges.includes('肱三头肌')
results['16 有可见标签-主要肌群'] = histText.includes('主要肌群')
results['16 有可见标签-辅助肌群'] = histText.includes('辅助肌群')
await shot('p17_16_history_primary_secondary.png')
console.log('  肌群徽标 =', JSON.stringify(muscleBadges))

console.log('=== 17. 刷新网站数据全部保留 ===')
const dataBefore = await readState()
await browser.close()
await launch()
await goto('')
await sleep(800)
const afterReopen = await readState()
results['17 仍onboarded'] = afterReopen.onboarded === true
results['17 训练记录保留'] = (afterReopen.workoutHistory || []).length > 0
results['17 记录为partial'] = afterReopen.workoutHistory?.[0]?.status === 'partial'
const wh = afterReopen.workoutHistory?.[0]
results['17 完整组数1/计划14'] = wh && wh.exerciseRecords.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0) === 1
await shot('p17_17_reopen_retained.png')

console.log('\n===== Phase 1.7 验收结果 =====')
let pass = 0, fail = 0
for (const [k, v] of Object.entries(results)) {
  const ok = v === true
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}: ${JSON.stringify(v)}`)
}
console.log(`\n通过 ${pass} / ${pass + fail}`)
await browser.close()
console.log('DONE')
