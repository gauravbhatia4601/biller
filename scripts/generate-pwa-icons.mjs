/**
 * PWA icon generator.
 *
 * By default draws a placeholder icon (navy background, white invoice sheet).
 * Pass a logo image to composite it onto the icon backgrounds instead:
 *
 *   npm run icons                      # placeholder glyphs
 *   npm run icons -- ./public/logo.png # your logo (recommended: square, >=512px)
 *
 * Outputs to public/icons/:
 *   icon-32.png, icon-192.png, icon-512.png      (purpose: any)
 *   icon-maskable-192.png, icon-maskable-512.png (purpose: maskable)
 *   apple-touch-icon.png                         (180x180, iOS)
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/icons')
const NAVY = '#0f172a'

mkdirSync(OUT_DIR, { recursive: true })

const logoArg = process.argv[2]
const logoPath = logoArg ? resolve(process.cwd(), logoArg) : null
if (logoArg && !existsSync(logoPath)) {
  console.error(`Logo not found: ${logoPath}`)
  process.exit(1)
}

// White invoice-sheet glyph: rounded page with text lines, drawn as shapes
// (no fonts — deterministic across environments).
const sheetGlyph = (scale) => {
  // scale: fraction of the canvas the glyph's bounding box occupies
  const w = 512
  const s = w * scale
  const x = (w - s) / 2
  const y = (w - s) / 2
  const pageW = s * 0.62
  const pageH = s
  const px = x + (s - pageW) / 2
  const py = y
  const lineX = px + pageW * 0.18
  const lineW = pageW * 0.64
  const lineH = Math.max(8, pageH * 0.035)
  return `
    <rect x="${px}" y="${py}" width="${pageW}" height="${pageH}" rx="${pageW * 0.1}" fill="#ffffff"/>
    <rect x="${lineX}" y="${py + pageH * 0.2}" width="${lineW}" height="${lineH}" rx="${lineH / 2}" fill="${NAVY}"/>
    <rect x="${lineX}" y="${py + pageH * 0.38}" width="${lineW}" height="${lineH}" rx="${lineH / 2}" fill="${NAVY}"/>
    <rect x="${lineX}" y="${py + pageH * 0.56}" width="${lineW * 0.6}" height="${lineH}" rx="${lineH / 2}" fill="${NAVY}"/>
  `
}

const svgFor = (size, { maskable }) => {
  // Maskable icons need the artwork inside the middle 80% safe zone,
  // full-bleed background to the edges.
  const glyphScale = maskable ? 0.5 : 0.62
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${NAVY}"/>
    ${logoPath ? '' : sheetGlyph(glyphScale)}
  </svg>`
}

async function render(name, size, { maskable = false, logoScale = 0.72 } = {}) {
  const svg = Buffer.from(svgFor(size, { maskable }))
  let image = sharp(svg, { density: 300 })

  if (logoPath) {
    const logo = await sharp(logoPath)
      .resize(Math.round(size * logoScale), Math.round(size * logoScale), {
        fit: 'inside',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    image = sharp(svg).composite([{ input: logo, gravity: 'centre' }])
  }

  await image.png().toFile(resolve(OUT_DIR, name))
  console.log(`✓ ${name} (${size}x${size}${maskable ? ', maskable' : ''})`)
}

await render('icon-32.png', 32)
await render('icon-192.png', 192)
await render('icon-512.png', 512)
await render('icon-maskable-192.png', 192, { maskable: true })
await render('icon-maskable-512.png', 512, { maskable: true })
await render('apple-touch-icon.png', 180, { logoScale: 0.78 })

console.log(`\nIcons written to public/icons/${logoPath ? ' (from logo)' : ' (placeholder — run with a logo path to brand them)'}`)