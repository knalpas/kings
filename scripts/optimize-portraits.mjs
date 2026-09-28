import sharp from 'sharp'
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'public/portraits')
const jsonPath = path.join(root, 'src/data/portraits.json')
const portraits = JSON.parse(await readFile(jsonPath, 'utf8'))

const files = await readdir(dir)
for (const file of files) {
  if (file.endsWith('.webp')) continue
  const id = file.replace(/\.[^.]+$/, '')
  const input = path.join(dir, file)
  const out = path.join(dir, `${id}.webp`)
  try {
    await sharp(input)
      .rotate()
      .resize(280, 280, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toFile(out)
    if (portraits[id]) portraits[id].src = `portraits/${id}.webp`
    await unlink(input)
    console.log(`→ ${id}.webp`)
  } catch (e) {
    console.log(`✗ ${id}: ${e.message}`)
  }
}

await writeFile(jsonPath, JSON.stringify(portraits, null, 2) + '\n')
console.log('Updated portraits.json')
