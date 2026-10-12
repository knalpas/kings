// Downloads each person's lead image from Wikipedia into public/portraits.
// Existing portraits are kept; pass --refresh to download everything again.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const UA = 'SceptreKings/2.0 (https://github.com/knalpas/kings; educational genealogy)'
const refresh = process.argv.includes('--refresh')

function parsePeople(kingdom, source) {
  const entries = []
  const re = /\n {4}id: '([^']+)',[\s\S]*?\n {4}wikipedia: '([^']+)'/g
  let m
  while ((m = re.exec(source))) entries.push({ key: `${kingdom}/${m[1]}`, wiki: m[2] })
  return entries
}

const entries = [
  ...parsePeople('england', await readFile(path.join(root, 'src/data/england.ts'), 'utf8')),
  ...parsePeople('france', await readFile(path.join(root, 'src/data/france.ts'), 'utf8')),
  ...parsePeople('spain', await readFile(path.join(root, 'src/data/spain.ts'), 'utf8')),
]

const outDir = path.join(root, 'public/portraits')
const jsonPath = path.join(root, 'src/data/portraits.json')
await mkdir(path.join(outDir, 'england'), { recursive: true })
await mkdir(path.join(outDir, 'france'), { recursive: true })
await mkdir(path.join(outDir, 'spain'), { recursive: true })

let previous = {}
try {
  previous = JSON.parse(await readFile(jsonPath, 'utf8'))
} catch {
  previous = {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function get(url, as = 'json') {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } })
    if (res.ok) return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer())
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * (attempt + 1))
      continue
    }
    throw new Error(`${res.status} ${url}`)
  }
  throw new Error(`gave up ${url}`)
}

function cleanUrl(u) {
  if (!u) return null
  try {
    const url = new URL(u)
    return `${url.origin}${url.pathname}`
  } catch {
    return u.split('?')[0]
  }
}

/** Commons thumbnail URL at a given width for an original Commons file URL. */
function commonsSized(original, width) {
  const clean = cleanUrl(original)
  if (!clean || !clean.includes('/wikipedia/commons/')) return clean
  if (clean.includes('/thumb/')) return clean.replace(/\/\d+px-/, `/${width}px-`)
  const marker = '/wikipedia/commons/'
  const rest = clean.slice(clean.indexOf(marker) + marker.length)
  const file = rest.split('/').pop()
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${rest}/${width}px-${file}`
}

const result = {}
let fetched = 0
let kept = 0
let failed = 0

for (const { key: id, wiki } of entries) {
  const webp = path.join(outDir, `${id}.webp`)
  if (!refresh && previous[id]?.wiki === wiki && (await exists(webp))) {
    result[id] = { src: `portraits/${id}.webp`, wiki }
    kept++
    continue
  }
  try {
    const summary = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`)
    const original = summary.originalimage?.source
    const candidates = [commonsSized(original, 500), cleanUrl(summary.thumbnail?.source), cleanUrl(original)].filter(Boolean)
    let buf = null
    let used = null
    for (const url of candidates) {
      try {
        buf = await get(url, 'bin')
        used = url
        break
      } catch {
        /* try the next candidate */
      }
    }
    if (!buf) {
      console.log(`✗ ${id}: no image`)
      failed++
      continue
    }
    const ext = /\.png$/i.test(used) ? 'png' : /\.gif$/i.test(used) ? 'gif' : /\.webp$/i.test(used) ? 'webp' : 'jpg'
    const rel = `portraits/${id}.${ext}`
    await writeFile(path.join(root, 'public', rel), buf)
    result[id] = { src: rel, wiki }
    console.log(`✓ ${id}`)
    fetched++
    await sleep(120)
  } catch (e) {
    console.log(`✗ ${id}: ${e.message}`)
    failed++
  }
}

await writeFile(jsonPath, JSON.stringify(result, null, 2) + '\n')
console.log(`\nfetched=${fetched} kept=${kept} failed=${failed} total=${Object.keys(result).length}`)
