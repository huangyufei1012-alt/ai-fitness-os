// Phase 1.8b 补充验证：当天多次训练「全部展示 + 按时间倒序」
// 复用 edge-profile18-after（已含 1 条 partial 记录），再完成第 2 场周一训练，
// 回到 Today 应显示 2 条记录，且最新完成的排在最上面。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const SHOTS =
  process.env.SHOTS_DIR ||
  'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/shots/t18b/'
const USER_DIR =
  process.env.PROFILE_DIR ||
  'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/edge-profile18-after'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(SHOTS, { recursive: true })

let browser, page
const results = {}

async function launch() {
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: USER_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1000'],
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
async function clickText(text, { exact = true } = {}) {
  const clicked = await page.evaluate(({ text, exact }) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')].filter((e) => {
      const t = (e.textContent || '').trim()
      return exact ? t === text : t.includes(text)
    })
    if (!els.length) return false
    els[0].click()
    return true
  }, { text, exact })
  if (!clicked) throw new Error('clickText 未找到: ' + text)
  await sleep(250)
}
async function typeNumberNth(nth, value) {
  await page.evaluate(({ nth, value }) => {
    const el = document.querySelectorAll('input[type="number"]')[nth]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }, { nth, value })
  await sleep(150)
}
async function text() {
  return await page.evaluate(() => document.body.innerText)
}
async function readState() {
  return await page.evaluate(() => JSON.parse(localStorage.getItem('fitness-os-state-v1') || '{}'))
}

console.log('=== 0. 打开 Today，记录已有条数 N ===')
await launch()
await goto('')
const before = await readState()
results['0 已有记录(N>=1)'] = (before.workoutHistory || []).length >= 1
const recordLinksBefore = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="#/training/history/"]')].map((a) => a.getAttribute('href')),
)
results['0 Today显示N条记录链接'] = recordLinksBefore.length === (before.workoutHistory || []).length
await shot('v18b_0_one_record.png')

console.log('=== 1. 完成第 2 场周一训练（partial）===')
await goto('#/training/workout?day=0')
await sleep(600)
await clickText('开始训练', { exact: true })
await sleep(500)
await typeNumberNth(0, 75)
await typeNumberNth(1, 6)
await typeNumberNth(2, 3)
const doneSet2 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('完成本组'))
  btn && btn.click()
  return !!btn
})
if (!doneSet2) throw new Error('未找到 完成本组')
await sleep(500)
await clickText('结束训练', { exact: true })
await sleep(500)
await clickText('结束并保存为未完成', { exact: true })
await sleep(700)
const st = await readState()
const wArr = st.workoutHistory || []
results['1 workoutHistory=N+1条'] = wArr.length === (before.workoutHistory || []).length + 1
const ids = wArr.map((w) => w.id)
// 新保存的 session 的容量 = Σ(weight×reps)（其中只有已完成组计重；本次只完成 1 组 75×6）
function volOf(w) {
  return w.exerciseRecords.reduce(
    (a, r) => a + r.sets.filter((s) => s.done).reduce((x, s) => x + (s.weight || 0) * (s.reps || 0), 0),
    0,
  )
}
const newVol = Math.round(volOf(wArr[wArr.length - 1]))
results['1 新记录容量=' + newVol + 'kg'] = newVol === 450

console.log('=== 2. 回到 Today：N+1 条全部展示，最新在前 ===')
await clickText('回到今日', { exact: true })
await sleep(600)
const t = await text()
const nAll = wArr.length
results['2 记录区徽标=N次'] = new RegExp('\\n' + nAll + ' 次').test(t)
const links = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="#/training/history/"]')].map((a) => a.getAttribute('href')),
)
results['2 Today显示N条记录链接'] = links.length === nAll
// 最新完成的记录 id（数组尾部）应出现在第一个链接
const latestId = wArr[wArr.length - 1].id
results['2 最新记录排第一'] = links[0].includes(latestId)
// 第一条记录容量应为新训练（450kg），证明倒序正确
const recCardTexts = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="#/training/history/"]')].map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()),
)
// 最强断言：链接顺序 == workoutHistory 倒序（id 一一对应）
results['2 链接顺序=workoutHistory倒序'] =
  links.length === ids.length && links.every((h, i) => h.includes(ids[ids.length - 1 - i]))
console.log('  记录卡顺序 =', JSON.stringify(recCardTexts))
results['2 第一条=新训练容量' + newVol + 'kg'] = (recCardTexts[0] || '').includes(String(newVol) + ' kg')
await shot('v18b_2_two_records_desc.png')

console.log('\n===== Phase 1.8b 结果 =====')
let pass = 0, fail = 0
for (const [k, v] of Object.entries(results)) {
  const ok = v === true
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}: ${JSON.stringify(v)}`)
}
console.log(`\n通过 ${pass} / ${pass + fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
