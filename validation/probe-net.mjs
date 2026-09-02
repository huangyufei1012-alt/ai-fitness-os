// 快速探测：headless Edge 能否访问公网 github.io（用于排查 --proxy-server 配置）
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE_URL || 'https://huangyufei1012-alt.github.io/ai-fitness-os/'
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY

const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
if (proxy) {
  // 与 validate17.mjs 相同逻辑：仅保留 host:port，127.0.0.1:7890 用 socks5
  const clean = proxy.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const useSocks = /127\.0\.0\.1:7890/.test(clean) || /localhost:7890/.test(clean)
  args.push('--proxy-server=' + (useSocks ? 'socks5://' : 'http://') + clean)
}

console.log('proxy =', JSON.stringify(proxy))
console.log('args  =', JSON.stringify(args))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  userDataDir: 'C:/Users/h/RunMateAI beta/HARNESS/fitness-os/validation/probe-profile',
  args,
  defaultViewport: { width: 1280, height: 900 },
})
try {
  const page = await browser.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const title = await page.title()
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 80) : '')
  console.log('OK  title=', JSON.stringify(title))
  console.log('OK  body=', JSON.stringify(body))
} catch (e) {
  console.log('FAIL', e.message && e.message.slice(0, 200))
} finally {
  await browser.close()
}
console.log('DONE')
