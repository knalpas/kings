// Downloads each monarch's lead image from Wikipedia into public/portraits.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const UA = 'SceptreKings/1.0 (https://github.com/knalpas/kings; educational genealogy)'

function parsePeople(source) {
  const entries = []
  for (const block of source.split(/\n  \{\n/)) {
    const id = block.match(/^\s*id: '([^']+)'/)?.[1]
    const wiki = block.match(/wikipedia: '([^']+)'/)?.[1]
    if (id && wiki) entries.push({ id, wiki })
  }
  return entries
}

const entries = [
  ...parsePeople(await readFile(path.join(root, 'src/data/england.ts'), 'utf8')),
  ...parsePeople(await readFile(path.join(root, 'src/data/france.ts'), 'utf8')),
]

const outDir = path.join(root, 'public/portraits')
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function cleanUrl(u) {
  if (!u) return null
  try {
    const url = new URL(u)
    // Drop tracking params; keep path only
    return `${url.origin}${url.pathname}`
  } catch {
    return u.split('?')[0]
  }
}

async function get(url, as = 'json') {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } })
    if (res.ok) return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer())
    if (res.status === 429 || res.status >= 500) {
      await sleep(1200 * (attempt + 1))
      continue
    }
    throw new Error(`${res.status} ${url}`)
  }
  throw new Error(`gave up ${url}`)
}

/** Build a Commons thumbnail URL from an original commons file URL. */
function commonsSized(original, width = 440) {
  const clean = cleanUrl(original)
  if (!clean || !clean.includes('/wikipedia/commons/')) return clean
  // Already a thumb
  if (clean.includes('/thumb/')) {
    return clean.replace(/\/\d+px-/, `/${width}px-`)
  }
  // https://upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg
  // → .../commons/thumb/a/ab/File.jpg/440px-File.jpg
  const marker = '/wikipedia/commons/'
  const i = clean.indexOf(marker)
  const rest = clean.slice(i + marker.length) // a/ab/File.jpg
  const file = rest.split('/').pop()
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${rest}/${width}px-${file}`
}

const result = {}
let ok = 0
let fail = 0

for (const { id, wiki } of entries) {
  try {
    const summary = await get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`,
    )
    const original = summary.originalimage?.source
    const thumb = summary.thumbnail?.source
    const candidates = [
      commonsSized(original, 440),
      cleanUrl(thumb),
      cleanUrl(original),
    ].filter(Boolean)

    let buf = null
    let used = null
    for (const url of candidates) {
      try {
        buf = await get(url, 'bin')
        used = url
        break
      } catch {
        /* try next */
      }
    }
    if (!buf || !used) {
      console.log(`✗ ${id}: no downloadable image`)
      fail++
      continue
    }
    const ext = /\.png$/i.test(used) ? 'png' : /\.gif$/i.test(used) ? 'gif' : /\.webp$/i.test(used) ? 'webp' : 'jpg'
    const rel = `portraits/${id}.${ext}`
    await writeFile(path.join(root, 'public', rel), buf)
    result[id] = { src: rel, wiki }
    console.log(`✓ ${id}`)
    ok++
    await sleep(60)
  } catch (e) {
    console.log(`✗ ${id}: ${e.message}`)
    fail++
  }
}

await writeFile(path.join(root, 'src/data/portraits.json'), JSON.stringify(result, null, 2) + '\n')
console.log(`\nDone. ok=${ok} fail=${fail} total=${Object.keys(result).length}`)
