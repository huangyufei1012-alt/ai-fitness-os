// Simple static file server for the built dist (SPA, hash routing -> only root needed)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', 'dist')
const port = Number(process.env.PORT || 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (urlPath === '/') urlPath = '/index.html'
  const file = path.join(root, path.normalize(urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA fallback -> index.html
      if (!urlPath.includes('.') || urlPath.endsWith('.html')) {
        fs.readFile(path.join(root, 'index.html'), (e2, d2) => {
          if (e2) {
            res.writeHead(404)
            res.end('not found')
            return
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(d2)
        })
      } else {
        res.writeHead(404)
        res.end('not found')
      }
      return
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  })
})

server.listen(port, () => {
  console.log(`[serve] http://localhost:${port}  ->  ${root}`)
})
