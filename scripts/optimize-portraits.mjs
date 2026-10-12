// Converts downloaded portraits to square 320px WebP, cropped around the face.
import sharp from 'sharp'
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const jsonPath = path.join(root, 'src/data/portraits.json')
const portraits = JSON.parse(await readFile(jsonPath, 'utf8'))

for (const kingdom of ['england', 'france', 'spain']) {
  const dir = path.join(root, 'public/portraits', kingdom)
  for (const file of await readdir(dir)) {
    if (file.endsWith('.webp')) continue
    const id = `${kingdom}/${file.replace(/\.[^.]+$/, '')}`
    const input = path.join(dir, file)
    try {
      await sharp(input, { limitInputPixels: false })
        .rotate()
        .flatten({ background: '#ece6da' })
        .resize(320, 320, { fit: 'cover', position: 'attention' })
        .webp({ quality: 82 })
        .toFile(path.join(root, 'public/portraits', `${id}.webp`))
      if (portraits[id]) portraits[id].src = `portraits/${id}.webp`
      await unlink(input)
      console.log(`→ ${id}.webp`)
    } catch (e) {
      console.log(`✗ ${id}: ${e.message}`)
    }
  }
}

await writeFile(jsonPath, JSON.stringify(portraits, null, 2) + '\n')
console.log('Updated portraits.json')
