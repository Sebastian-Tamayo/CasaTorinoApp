/**
 * GitHub Actions: PNG → Instagram Stories + MP4 → TikTok.
 * No corre en Vercel. Secretos solo en GitHub Secrets / entorno.
 *
 * Instagram Graph: media_type STORIES (el valor que acepta la API; "STORY" lo rechaza).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { renderMenuStory } = require('./render-menu-story')

const GRAPH = 'https://graph.facebook.com/v19.0'

function mustEnv(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error('Falta ' + name)
  return v
}

async function uploadStoryPng(pngPath) {
  const base = mustEnv('SUPABASE_URL').replace(/\/$/, '')
  const key = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const object = `stories/menu-${Date.now()}.png`
  const bytes = fs.readFileSync(pngPath)
  const r = await fetch(`${base}/storage/v1/object/menu_images/${object}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: bytes,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error('Supabase storage ' + r.status + ' ' + text.slice(0, 300))
  }
  return `${base}/storage/v1/object/public/menu_images/${object}`
}

async function publishInstagramStory(imageUrl) {
  const igUser = mustEnv('IG_USER_ID')
  const token = mustEnv('IG_ACCESS_TOKEN')
  const create = await fetch(`${GRAPH}/${encodeURIComponent(igUser)}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      media_type: 'STORIES',
      access_token: token,
    }),
  })
  const created = await create.json().catch(() => ({}))
  if (!create.ok || !created.id) {
    throw new Error('IG media ' + create.status + ' ' + JSON.stringify(created).slice(0, 400))
  }
  const pub = await fetch(`${GRAPH}/${encodeURIComponent(igUser)}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: created.id,
      access_token: token,
    }),
  })
  const published = await pub.json().catch(() => ({}))
  if (!pub.ok) {
    throw new Error('IG publish ' + pub.status + ' ' + JSON.stringify(published).slice(0, 400))
  }
  return published
}

function pngToMp4(pngPath, mp4Path) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-i', pngPath,
      '-c:v', 'libx264',
      '-t', '5',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1080:1920',
      '-r', '30',
      mp4Path,
    ],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) throw new Error('ffmpeg falló')
  return mp4Path
}

async function publishTikTokVideo(mp4Path, caption) {
  const token = mustEnv('TIKTOK_ACCESS_TOKEN')
  const stat = fs.statSync(mp4Path)
  const size = stat.size
  const privacy = String(process.env.TIKTOK_PRIVACY || 'SELF_ONLY').trim()
  const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: privacy,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    }),
  })
  const initBody = await init.json().catch(() => ({}))
  const uploadUrl = initBody?.data?.upload_url
  const publishId = initBody?.data?.publish_id
  if (!init.ok || !uploadUrl) {
    throw new Error('TikTok init ' + init.status + ' ' + JSON.stringify(initBody).slice(0, 500))
  }
  const video = fs.readFileSync(mp4Path)
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: video,
  })
  if (!put.ok) {
    const text = await put.text().catch(() => '')
    throw new Error('TikTok upload ' + put.status + ' ' + text.slice(0, 300))
  }
  return { publishId }
}

async function main() {
  const raw = process.env.MENU_STORY_JSON || process.argv[2] || '{}'
  let payload = {}
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('MENU_STORY_JSON no es JSON')
  }
  const png = path.join(os.tmpdir(), `menu-story-${Date.now()}.png`)
  const mp4 = png.replace(/\.png$/, '.mp4')
  await renderMenuStory(payload, png)
  console.log('png', png)

  const imageUrl = await uploadStoryPng(png)
  console.log('image', imageUrl)
  const ig = await publishInstagramStory(imageUrl)
  console.log('instagram', JSON.stringify(ig))

  pngToMp4(png, mp4)
  const caption = `Menú del día · ${payload.primero || ''} / ${payload.segundo || ''}`.trim()
  const tt = await publishTikTokVideo(mp4, caption || 'Menú del día Casa Torino')
  console.log('tiktok', JSON.stringify(tt))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
