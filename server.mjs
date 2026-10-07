import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)))
const root = existsSync(join(projectRoot, 'dist')) ? join(projectRoot, 'dist') : projectRoot
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const port = Number(process.env.PORT ?? 4173)

createServer((request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^[/\\]+/, '')
  const filePath = normalize(join(root, relativePath))

  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Recurso no encontrado')
    return
  }

  response.writeHead(200, { 'Content-Type': types[extname(filePath)] ?? 'application/octet-stream' })
  createReadStream(filePath).pipe(response)
}).listen(port, () => {
  console.log(`SimulaEdu disponible en http://localhost:${port} (${root})`)
})
