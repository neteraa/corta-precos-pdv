/**
 * /cameras — ZS Analytics de Câmera (v2)
 *
 * TF.js COCO-SSD: person detection + object detection, IoU tracking,
 * dwell time por zona, timer individual por pessoa, heatmap acumulado,
 * log de eventos, alerta WhatsApp, auto-save 5min, export CSV.
 * Mobile full-screen. 100% browser — zero nova infra.
 */

/* ── IIFE auth — executa antes do React montar ─────────────── */
;(() => {
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('storeId')
  const tok = params.get('t')
  if (!sid || !tok) return
  try {
    localStorage.setItem('cp_store_id', sid)
    const s = JSON.parse(localStorage.getItem('cp_session') || '{}')
    const ROLE_RANK = { admin: 4, gerente: 3, caixa: 2, scanner: 1 }
    const existingRank = ROLE_RANK[s.role] || 0
    const grantedRole = existingRank >= 2 ? s.role : 'scanner'
    localStorage.setItem('cp_session', JSON.stringify({
      ...s, storeId: sid, storeToken: tok, loggedIn: true, role: grantedRole,
    }))
  } catch {}
})()

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Video, Settings, Save, Link2, X, Plus, Download, Thermometer, List } from 'lucide-react'
import { getConfiguredStoreId } from '../utils/auth.js'
import { getMktStoreId, getMktStoreToken } from '../utils/tenantStorage.js'

/* ── Constants ─────────────────────────────────────────────── */
const ZONE_COLORS        = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4']
const MIN_DWELL_MS       = 5_000
const DETECT_INTERVAL_MS = 500
const PERSON_SCORE_MIN   = 0.45   // pessoas: threshold razoável
const OBJ_SCORE_MIN      = 0.30   // objetos: 0.30 capta oclusão parcial e ângulos difíceis
const IOU_MATCH_THRESH   = 0.35
const OBJ_FLOOD_MS       = 8_000  // anti-flood: não re-logar mesmo obj+zona antes de 8s
const AUTO_SAVE_MS       = 300_000
const HEAT_RENDER_MS     = 3_000
const LOG_RENDER_MS      = 2_000
const EVENT_LOG_MAX      = 200

// Todas as 79 classes COCO-SSD (exceto 'person') com emoji representativo
const OBJECT_EMOJI = {
  // Alimentos e bebidas
  bottle:'🍶', 'wine glass':'🥂', cup:'☕', bowl:'🥣',
  banana:'🍌', apple:'🍎', sandwich:'🥪', orange:'🍊',
  broccoli:'🥦', carrot:'🥕', 'hot dog':'🌭', pizza:'🍕',
  donut:'🍩', cake:'🎂', fork:'🍴', knife:'🔪', spoon:'🥄',
  // Eletrônicos
  'cell phone':'📱', laptop:'💻', tv:'📺', keyboard:'⌨️',
  mouse:'🖱️', remote:'🎮',
  // Eletrodomésticos
  microwave:'🫙', oven:'♨️', toaster:'🍞', refrigerator:'🧊', sink:'🚰',
  // Acessórios / vestuário
  backpack:'🎒', handbag:'👜', umbrella:'☂️', suitcase:'🧳', tie:'👔',
  // Móveis / decoração
  chair:'🪑', couch:'🛋️', bed:'🛏️', 'dining table':'🪑',
  'potted plant':'🌿', vase:'🏺', clock:'🕐', book:'📚',
  // Brinquedos / esportes
  'teddy bear':'🧸', 'sports ball':'⚽', 'tennis racket':'🎾',
  frisbee:'🥏', skis:'🎿', snowboard:'🏂', kite:'🪁',
  'baseball bat':'🏏', 'baseball glove':'🧤', skateboard:'🛹',
  surfboard:'🏄', scissors:'✂️',
  // Higiene
  'hair drier':'💨', toothbrush:'🪥',
  // Outros objetos
  toilet:'🚽', bench:'🪑', 'traffic light':'🚦',
  'fire hydrant':'🚒', 'stop sign':'🛑', 'parking meter':'🅿️',
  // Animais
  bird:'🐦', cat:'🐱', dog:'🐶', horse:'🐴', sheep:'🐑',
  cow:'🐄', elephant:'🐘', bear:'🐻', zebra:'🦓', giraffe:'🦒',
  // Veículos (útil em estacionamentos/entradas)
  bicycle:'🚲', car:'🚗', motorcycle:'🏍️', airplane:'✈️',
  bus:'🚌', train:'🚂', truck:'🚚', boat:'⛵',
}

/* ── Helpers ───────────────────────────────────────────────── */
function iou([ax, ay, aw, ah], [bx, by, bw, bh]) {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx))
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by))
  const inter = ix * iy
  const union = aw * ah + bw * bh - inter
  return union > 0 ? inter / union : 0
}

function centerInRect(bbox, zone, vw, vh) {
  const [bx, by, bw, bh] = bbox
  const cx = bx + bw / 2, cy = by + bh / 2
  const zx = zone.x * vw, zy = zone.y * vh
  const zw = zone.w * vw, zh = zone.h * vh
  return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
}

function fmtDuration(ms) {
  if (!ms || ms < 1000) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function loadZones(storeId) {
  try { return JSON.parse(localStorage.getItem(`zs_camera_zones_${storeId}`) || '[]') }
  catch { return [] }
}

function saveZones(storeId, zones) {
  try { localStorage.setItem(`zs_camera_zones_${storeId}`, JSON.stringify(zones)) } catch {}
}

function pushEvent(logRef, ev) {
  logRef.current.unshift({ ts: Date.now(), ...ev })
  if (logRef.current.length > EVENT_LOG_MAX) logRef.current.length = EVENT_LOG_MAX
}

function timerColor(ms) {
  const s = ms / 1000
  if (s < 60)  return '#4ade80'
  if (s < 180) return '#facc15'
  if (s < 300) return '#fb923c'
  return '#f87171'
}

/* ── Canvas drawing (v2: timers + objects) ──────────────────── */
function drawOverlay(canvas, persons, objects, zones, configMode, drawingRect) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  // Zones
  for (const z of zones) {
    const rx = z.x * W, ry = z.y * H, rw = z.w * W, rh = z.h * H
    ctx.fillStyle = z.color + '1a'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = z.color
    ctx.lineWidth = 2.5
    ctx.setLineDash([])
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.fillStyle = z.color
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(z.name, rx + 6, ry + 18)
  }

  // In-progress zone draw
  if (configMode && drawingRect) {
    const { x, y, w, h } = drawingRect
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x, y, w, h)
    ctx.setLineDash([])
  }

  if (configMode) return

  // Person bboxes + individual timer
  const now = Date.now()
  for (const p of persons) {
    const [px, py, pw] = p.bbox
    const elapsed = now - (p.entryTime || now)
    const color = timerColor(elapsed)
    const label = elapsed < 60000
      ? `${Math.floor(elapsed / 1000)}s`
      : `${Math.floor(elapsed / 60000)}m${Math.floor((elapsed % 60000) / 1000)}s`

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(...p.bbox)

    // Timer badge
    const badgeW = ctx.measureText(label).width + 10
    const badgeY = Math.max(p.bbox[1] - 22, 0)
    ctx.fillStyle = color + 'cc'
    ctx.fillRect(px, badgeY, badgeW, 18)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 12px system-ui'
    ctx.fillText(label, px + 5, badgeY + 13)
  }

  // Object bboxes (orange dashed + emoji + classe + score)
  for (const obj of objects) {
    const [ox, oy, ow, oh] = obj.bbox
    ctx.strokeStyle = '#fb923c'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    ctx.strokeRect(ox, oy, ow, oh)
    ctx.setLineDash([])
    // Badge: emoji + nome + score
    const scoreStr = `${obj.emoji} ${obj.class} ${Math.round(obj.score * 100)}%`
    const badgeW = ctx.measureText(scoreStr).width + 12
    const badgeY = Math.max(oy - 20, 0)
    ctx.fillStyle = 'rgba(251,146,60,0.85)'
    ctx.fillRect(ox, badgeY, badgeW, 18)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px system-ui'
    ctx.fillText(scoreStr, ox + 6, badgeY + 13)
  }
}

/* ── Stats panel (fora do Cameras para evitar re-mount) ──────── */
function StatsPanel({ zones, liveStats, totalPersons, configMode, removeZone, setConfigMode }) {
  return (
    <>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #e5e7eb', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>SESSÃO AO VIVO</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#8b5cf6' }}>{totalPersons}</div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>pessoas agora</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#374151' }}>{Object.values(liveStats).reduce((s, z) => s + z.visits, 0)}</div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>visitas totais</div>
          </div>
        </div>
      </div>
      {zones.length === 0 ? (
        <div style={{ background: '#faf5ff', border: '1.5px dashed #d8b4fe', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#7c3aed', marginBottom: 4 }}>Nenhuma zona definida</div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>Clique em <strong>Configurar zonas</strong> e arraste sobre a câmera para definir áreas de interesse (ex: Bebidas, Corredor A, Frios).</div>
        </div>
      ) : zones.map(z => {
        const s = liveStats[z.id] || {}
        const fmtMs = ms => { if (!ms || ms < 1000) return '0s'; const sec = Math.floor(ms/1000); return sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m ${sec%60}s` }
        return (
          <div key={z.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', border: `1.5px solid ${z.color}33`, borderLeft: `4px solid ${z.color}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{z.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {z.alertThreshold > 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>🚨{z.alertThreshold}</span>}
                <button onClick={() => removeZone(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><X style={{ width: 14, height: 14 }} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: 'Agora', value: `${s.count || 0} pessoa${s.count !== 1 ? 's' : ''}`, color: s.count > 0 ? z.color : '#9ca3af' },
                { label: 'Visitas', value: s.visits || 0, color: '#374151' },
                { label: 'Média', value: fmtMs(s.avgMs), color: '#374151' },
                { label: 'Máx', value: fmtMs(s.maxMs), color: '#374151' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {zones.length < 6 && (
        <button onClick={() => setConfigMode(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 12, border: '1.5px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%', marginTop: 4 }}>
          <Plus style={{ width: 14, height: 14 }} />Nova zona ({zones.length}/6)
        </button>
      )}
    </>
  )
}

/* ── Log panel (fora do Cameras para evitar re-mount) ───────── */
function LogPanel({ logState }) {
  const evIcon = (e) => ({ zone_entry: '🟢', zone_exit: '🔴', object: e.emoji || '📦', alert: '🚨' }[e.type] || '•')
  const evText = (e) => {
    const fmtMs = ms => { if (!ms || ms < 1000) return '0s'; const s = Math.floor(ms/1000); return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s` }
    const t = e.ts ? new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
    if (e.type === 'zone_entry') return `${t} — #${e.personId} entrou em ${e.zone}`
    if (e.type === 'zone_exit')  return `${t} — #${e.personId} saiu de ${e.zone}${e.dwell ? ' — ' + fmtMs(e.dwell) : ''}`
    if (e.type === 'object')     return `${t} — ${e.emoji} ${e.objectClass} em ${e.zone}`
    if (e.type === 'alert')      return `${t} — 🚨 alerta: ${e.zone} lotada`
    return t
  }
  return (
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      {logState.length === 0
        ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24, fontSize: 13 }}>Nenhum evento ainda.<br />Entre em uma zona para registrar.</div>
        : logState.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 18, flexShrink: 0 }}>{evIcon(e)}</span>
            <span style={{ color: '#374151', lineHeight: 1.4 }}>{evText(e)}</span>
          </div>
        ))
      }
    </div>
  )
}

/* ── Zone config modal ──────────────────────────────────────── */
function ZoneConfigModal({ pending, onSave, onCancel }) {
  const [name, setName]           = useState('')
  const [threshold, setThreshold] = useState(0)
  const [phone, setPhone]         = useState('')
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:18, padding:24, width:'100%', maxWidth:360, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight:900, fontSize:17, marginBottom:16 }}>📍 Nova zona</div>
        <label style={{ fontSize:13, fontWeight:700, color:'#374151' }}>Nome da zona *</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder="ex: Corredor A, Bebidas, Frios"
          style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 12px', fontSize:14, marginTop:4, marginBottom:14, boxSizing:'border-box', outline:'none' }} />
        <label style={{ fontSize:13, fontWeight:700, color:'#374151' }}>🚨 Alertar quando mais de N pessoas (0 = desativado)</label>
        <input type="number" min="0" max="50" value={threshold} onChange={e => setThreshold(+e.target.value)}
          style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 12px', fontSize:14, marginTop:4, marginBottom:14, boxSizing:'border-box' }} />
        <label style={{ fontSize:13, fontWeight:700, color:'#374151' }}>📱 WhatsApp do responsável (com DDD)</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+55 15 99999-9999"
          style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 12px', fontSize:14, marginTop:4, marginBottom:20, boxSizing:'border-box' }} />
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontWeight:700, cursor:'pointer' }}>Cancelar</button>
          <button disabled={!name.trim()} onClick={() => name.trim() && onSave({ name:name.trim(), threshold, phone:phone.replace(/\D/g,'') })}
            style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background: name.trim() ? '#8b5cf6' : '#e5e7eb', color: name.trim() ? '#fff' : '#9ca3af', fontWeight:800, cursor: name.trim() ? 'pointer' : 'default' }}>
            Criar zona
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main component (v2) ────────────────────────────────────── */
export default function Cameras() {
  const storeId = getMktStoreId() || getConfiguredStoreId()

  // ── State ───────────────────────────────────────────────────
  const [modelState, setModelState]     = useState('idle')
  const [cameraError, setCameraError]   = useState(null)
  const [zones, setZones]               = useState(() => loadZones(storeId))
  const [configMode, setConfigMode]     = useState(false)
  const [pendingZone, setPendingZone]   = useState(null) // normalized rect waiting for modal
  const [liveStats, setLiveStats]       = useState({})
  const [logState, setLogState]         = useState([])
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [totalPersons, setTotalPersons] = useState(0)
  const [showLog, setShowLog]           = useState(false)
  const [showHeatmap, setShowHeatmap]   = useState(false)
  const [nextSaveIn, setNextSaveIn]     = useState(AUTO_SAVE_MS / 1000)
  const [isMobile, setIsMobile]         = useState(window.innerWidth <= 640)
  const [activeTab, setActiveTab]       = useState('stats') // 'stats' | 'log'

  // Zone drawing
  const [drawingRect, setDrawingRect] = useState(null)
  const drawStart = useRef(null)

  // ── Refs ────────────────────────────────────────────────────
  const videoRef          = useRef(null)
  const canvasRef         = useRef(null)
  const heatCanvasRef     = useRef(null)
  const modelRef          = useRef(null)
  const streamRef         = useRef(null)
  const personsRef        = useRef([])   // [{id, bbox, lastSeen, entryTime}]
  const nextIdRef         = useRef(1)
  const zonesRef          = useRef(zones)
  const zoneDataRef       = useRef({})
  const eventLogRef       = useRef([])
  const heatPositionsRef  = useRef([])   // [{x,y}] normalized 0-1
  const lastObjEventRef   = useRef(new Map()) // 'class:zoneId' → ts
  const sessionStart      = useRef(new Date().toISOString())
  const nextSaveAtRef     = useRef(Date.now() + AUTO_SAVE_MS)

  // ── Mobile resize ────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  // ── Sync zones to ref + init zoneData ───────────────────────
  useEffect(() => {
    zonesRef.current = zones
    for (const z of zones) {
      if (!zoneDataRef.current[z.id]) {
        zoneDataRef.current[z.id] = {
          activePersonIds: new Set(), entryTimes: new Map(),
          visits: 0, totalDwellMs: 0, maxDwellMs: 0, peakCount: 0,
          lastAlertSent: 0,
        }
      }
    }
  }, [zones])

  // ── Model loading
  useEffect(() => {
    setModelState('loading')
    let cancelled = false
    import('@tensorflow/tfjs').then(() =>
      import('@tensorflow-models/coco-ssd').then(cocoSsd =>
        cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(model => {
          if (cancelled) return
          modelRef.current = model
          setModelState('ready')
        })
      )
    ).catch(err => { if (!cancelled) { console.error('TF.js:', err); setModelState('error') } })
    return () => { cancelled = true }
  }, [])

  // ── Camera start
  useEffect(() => {
    let active = true
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          const v = videoRef.current
          const sync = (c) => { if (c) { c.width = v.videoWidth; c.height = v.videoHeight } }
          sync(canvasRef.current); sync(heatCanvasRef.current)
        }
      }
    }).catch(err => { if (active) setCameraError(err.message || 'Câmera não autorizada') })
    return () => { active = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── Detection loop
  useEffect(() => {
    if (modelState !== 'ready') return
    const detect = async () => {
      const video = videoRef.current, canvas = canvasRef.current
      if (!video || video.readyState < 2 || !modelRef.current) return
      let rawAll = []
      try { rawAll = await modelRef.current.detect(video) } catch { return }

      const detections = rawAll.filter(d => d.class === 'person' && d.score >= PERSON_SCORE_MIN).map(d => ({ bbox: d.bbox }))
      // Detecta TODOS os objetos não-pessoa com emoji mapeado — threshold 0.30 capta oclusão parcial
      const detectedObjects = rawAll
        .filter(d => d.class !== 'person' && d.score >= OBJ_SCORE_MIN && OBJECT_EMOJI[d.class])
        .map(d => ({ class: d.class, bbox: d.bbox, emoji: OBJECT_EMOJI[d.class], score: d.score }))

      const now = Date.now(), prev = personsRef.current, matched = [], usedPrev = new Set()
      for (const det of detections) {
        let bestIdx = -1, bestScore = IOU_MATCH_THRESH
        for (let i = 0; i < prev.length; i++) {
          if (usedPrev.has(i)) continue
          const s = iou(prev[i].bbox, det.bbox)
          if (s > bestScore) { bestScore = s; bestIdx = i }
        }
        if (bestIdx >= 0) {
          matched.push({ id: prev[bestIdx].id, bbox: det.bbox, lastSeen: now, entryTime: prev[bestIdx].entryTime || now })
          usedPrev.add(bestIdx)
        } else {
          matched.push({ id: nextIdRef.current++, bbox: det.bbox, lastSeen: now, entryTime: now })
        }
      }
      personsRef.current = matched
      setTotalPersons(matched.length)

      const vw = video.videoWidth, vh = video.videoHeight
      for (const p of matched) {
        const [bx, by, bw, bh] = p.bbox
        heatPositionsRef.current.push({ x: (bx + bw / 2) / vw, y: (by + bh / 2) / vh })
        if (heatPositionsRef.current.length > 5000) heatPositionsRef.current.splice(0, 1000)
      }

      for (const z of zonesRef.current) {
        const zd = zoneDataRef.current[z.id]; if (!zd) continue
        const personsInZone = new Set(matched.filter(p => centerInRect(p.bbox, z, vw, vh)).map(p => p.id))
        for (const id of personsInZone) {
          if (!zd.activePersonIds.has(id)) { zd.activePersonIds.add(id); zd.entryTimes.set(id, now); pushEvent(eventLogRef, { type: 'zone_entry', zone: z.name, personId: id }) }
        }
        for (const id of [...zd.activePersonIds]) {
          if (!personsInZone.has(id)) {
            const dwell = now - (zd.entryTimes.get(id) || now)
            if (dwell >= MIN_DWELL_MS) { zd.visits++; zd.totalDwellMs += dwell; zd.maxDwellMs = Math.max(zd.maxDwellMs, dwell); pushEvent(eventLogRef, { type: 'zone_exit', zone: z.name, personId: id, dwell }) }
            zd.activePersonIds.delete(id); zd.entryTimes.delete(id)
          }
        }
        zd.peakCount = Math.max(zd.peakCount, personsInZone.size)
        if (z.alertThreshold > 0 && z.alertPhone && personsInZone.size >= z.alertThreshold && now - (zd.lastAlertSent || 0) > 300_000) {
          zd.lastAlertSent = now
          const msg = `🚨 *Zona lotada: ${z.name}*\n${personsInZone.size} pessoas agora.\n📍 ${new Date().toLocaleTimeString('pt-BR')}`
          fetch('/api/wa-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance: storeId, number: z.alertPhone, text: msg }) }).catch(() => {})
          pushEvent(eventLogRef, { type: 'alert', zone: z.name })
        }
        for (const obj of detectedObjects) {
          if (!centerInRect(obj.bbox, z, vw, vh)) continue
          const key = `${obj.class}:${z.id}`
          if (now - (lastObjEventRef.current.get(key) || 0) > OBJ_FLOOD_MS) { lastObjEventRef.current.set(key, now); pushEvent(eventLogRef, { type: 'object', zone: z.name, objectClass: obj.class, emoji: obj.emoji }) }
        }
      }
      if (canvas) {
        if (canvas.width !== vw) canvas.width = vw
        if (canvas.height !== vh) canvas.height = vh
        drawOverlay(canvas, matched, detectedObjects, zonesRef.current, false, null)
      }
    }
    const timer = setInterval(detect, DETECT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [modelState, storeId])

  // ── Live stats 1s
  useEffect(() => {
    const timer = setInterval(() => {
      const stats = {}
      for (const z of zonesRef.current) {
        const zd = zoneDataRef.current[z.id]; if (!zd) continue
        stats[z.id] = { count: zd.activePersonIds.size, visits: zd.visits, avgMs: zd.visits > 0 ? zd.totalDwellMs / zd.visits : 0, maxMs: zd.maxDwellMs, peak: zd.peakCount }
      }
      setLiveStats(stats)
    }, 1_000)
    return () => clearInterval(timer)
  }, [])

  // ── Log sync 2s
  useEffect(() => {
    const timer = setInterval(() => setLogState([...eventLogRef.current]), LOG_RENDER_MS)
    return () => clearInterval(timer)
  }, [])

  // ── Heatmap render 3s
  useEffect(() => {
    if (!showHeatmap) return
    const timer = setInterval(() => {
      const canvas = heatCanvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const { x, y } of heatPositionsRef.current) {
        const cx = x * canvas.width, cy = y * canvas.height
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50)
        g.addColorStop(0, 'rgba(255,0,0,0.04)'); g.addColorStop(1, 'rgba(255,0,0,0)')
        ctx.fillStyle = g; ctx.fillRect(cx - 50, cy - 50, 100, 100)
      }
    }, HEAT_RENDER_MS)
    return () => clearInterval(timer)
  }, [showHeatmap])

  useEffect(() => {
    if (!showHeatmap && heatCanvasRef.current) {
      const ctx = heatCanvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, heatCanvasRef.current.width, heatCanvasRef.current.height)
    }
  }, [showHeatmap])

  // ── Auto-save + countdown
  useEffect(() => {
    if (modelState !== 'ready') return
    nextSaveAtRef.current = Date.now() + AUTO_SAVE_MS
    const autoTimer = setInterval(() => handleSave({ silent: true }), AUTO_SAVE_MS)
    const countTimer = setInterval(() => setNextSaveIn(Math.max(0, Math.round((nextSaveAtRef.current - Date.now()) / 1000))), 10_000)
    return () => { clearInterval(autoTimer); clearInterval(countTimer) }
  }, [modelState]) // eslint-disable-line

  // ── Zone draw pointer events
  const onPointerDown = useCallback((e) => {
    if (!configMode) return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height
    drawStart.current = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
    setDrawingRect({ ...drawStart.current, w: 0, h: 0 })
  }, [configMode])

  const onPointerMove = useCallback((e) => {
    if (!configMode || !drawStart.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height
    const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy
    const dr = { x: Math.min(drawStart.current.x, x), y: Math.min(drawStart.current.y, y), w: Math.abs(x - drawStart.current.x), h: Math.abs(y - drawStart.current.y) }
    setDrawingRect(dr); drawOverlay(canvas, personsRef.current, [], zonesRef.current, true, dr)
  }, [configMode])

  const onPointerUp = useCallback((e) => {
    if (!configMode || !drawStart.current || !drawingRect) return
    const { x, y, w, h } = drawingRect; drawStart.current = null
    if (w < 20 || h < 20) { setDrawingRect(null); return }
    const canvas = canvasRef.current
    const vw = canvas?.width || 1, vh = canvas?.height || 1
    setPendingZone({ x: x / vw, y: y / vh, w: w / vw, h: h / vh })
    setDrawingRect(null); setConfigMode(false)
  }, [configMode, drawingRect])

  const handleZoneSave = useCallback(({ name, threshold, phone }) => {
    const pz = pendingZone; if (!pz) return
    const updated = [...zonesRef.current, {
      id: `z_${Date.now()}`, name,
      x: pz.x, y: pz.y, w: pz.w, h: pz.h,
      color: ZONE_COLORS[zonesRef.current.length % ZONE_COLORS.length],
      alertThreshold: threshold || 0, alertPhone: phone || '',
    }]
    setZones(updated); saveZones(storeId, updated); setPendingZone(null)
  }, [pendingZone, storeId])

  const removeZone = useCallback((id) => {
    const updated = zonesRef.current.filter(z => z.id !== id)
    setZones(updated); saveZones(storeId, updated); delete zoneDataRef.current[id]
  }, [storeId])

  // ── Save session (silent mode for auto-save)
  const handleSave = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSaving(true)
    nextSaveAtRef.current = Date.now() + AUTO_SAVE_MS; setNextSaveIn(AUTO_SAVE_MS / 1000)
    try {
      const res = await fetch('/api/cameras-analytics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, sessionId: `sess_${Date.now()}`,
          startedAt: sessionStart.current, endedAt: new Date().toISOString(),
          topEvents: eventLogRef.current.slice(0, 50),
          zones: zonesRef.current.map(z => {
            const zd = zoneDataRef.current[z.id] || {}; const v = zd.visits || 0
            return { name: z.name, visits: v, avgDwellSec: +(v > 0 ? (zd.totalDwellMs || 0) / v / 1000 : 0).toFixed(1), maxDwellSec: +((zd.maxDwellMs || 0) / 1000).toFixed(1), peakCount: zd.peakCount || 0 }
          }),
        }),
      })
      if (!silent && (await res.json()).ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch (err) { console.error('Save:', err) }
    if (!silent) setSaving(false)
  }, [storeId])

  // ── Export CSV
  const handleExportCSV = useCallback(() => {
    const rows = [
      ['timestamp', 'tipo', 'zona', 'pessoa_id', 'tempo_segundos', 'objeto'].join(','),
      ...eventLogRef.current.map(e => [new Date(e.ts).toLocaleString('pt-BR'), e.type, e.zone || '', e.personId || '', e.dwell ? Math.floor(e.dwell / 1000) : '', e.objectClass || ''].join(',')),
      '', 'RESUMO POR ZONA',
      ['zona', 'visitas', 'media_seg', 'max_seg', 'pico_pessoas'].join(','),
      ...zonesRef.current.map(z => { const zd = zoneDataRef.current[z.id] || {}; return [z.name, zd.visits || 0, zd.visits ? Math.floor((zd.totalDwellMs || 0) / zd.visits / 1000) : 0, Math.floor((zd.maxDwellMs || 0) / 1000), zd.peakCount || 0].join(',') }),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `zs-cameras-${storeId}-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }, [storeId])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/cameras?storeId=${storeId}&t=${getMktStoreToken() || ''}`
    navigator.clipboard?.writeText(url).then(() => alert('Link copiado! Envie pelo WhatsApp para abrir a câmera no celular dedicado.'))
  }, [storeId])

  const autoLabel = nextSaveIn > 60 ? `⏰ auto em ${Math.ceil(nextSaveIn / 60)}min` : nextSaveIn <= 10 ? '⏰ salvando...' : `⏰ ${nextSaveIn}s`

  /* cameraBlock — inlinado nos dois returns para manter identidade do <video> */
  const cameraBlockMobile = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#000', overflow: 'hidden' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <canvas ref={heatCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: showHeatmap ? 0.75 : 0, pointerEvents: 'none', transition: 'opacity 0.3s' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: configMode ? 'crosshair' : 'default' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      {modelState === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Carregando modelo COCO-SSD...</span>
        </div>
      )}
      {configMode && <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(139,92,246,0.9)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 5 }}>✏️ Arraste para definir uma zona</div>}
    </div>
  )

  const cameraBlockDesktop = (
    <div style={{ position: 'relative', background: '#000', overflow: 'hidden', borderRadius: 16, aspectRatio: '16/9' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <canvas ref={heatCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: showHeatmap ? 0.75 : 0, pointerEvents: 'none', transition: 'opacity 0.3s' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: configMode ? 'crosshair' : 'default' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      {modelState === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Carregando modelo COCO-SSD...</span>
        </div>
      )}
      {configMode && <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(139,92,246,0.9)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 5 }}>✏️ Arraste para definir uma zona</div>}
    </div>
  )

  if (cameraError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
      <Video style={{ width: 48, height: 48, color: '#ef4444' }} />
      <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>Câmera não disponível</div>
      <div style={{ color: '#6b7280', fontSize: 14, maxWidth: 360 }}>{cameraError}<br /><br />Verifique as permissões de câmera no browser e recarregue a página.</div>
      <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 12, background: '#ea580c', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Tentar novamente</button>
    </div>
  )

  /* ── MOBILE ─────────────────────────────────────────────────── */
  if (isMobile) return (
    <>
      {pendingZone && <ZoneConfigModal pending={pendingZone} onSave={handleZoneSave} onCancel={() => setPendingZone(null)} />}
      {cameraBlockMobile}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Video style={{ width: 16, height: 16, color: '#a78bfa' }} /> Analytics
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { icon: <Settings style={{ width: 18, height: 18 }} />, onClick: () => setConfigMode(c => !c), active: configMode },
            { icon: <Thermometer style={{ width: 18, height: 18 }} />, onClick: () => setShowHeatmap(h => !h), active: showHeatmap },
            { icon: <List style={{ width: 18, height: 18 }} />, onClick: () => setShowLog(l => !l), active: showLog },
            { icon: <Download style={{ width: 18, height: 18 }} />, onClick: handleExportCSV, active: false },
            { icon: <Save style={{ width: 18, height: 18 }} />, onClick: () => handleSave(), active: false },
          ].map(({ icon, onClick, active }, i) => (
            <button key={i} onClick={onClick} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: active ? 'rgba(139,92,246,0.85)' : 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>{icon}</button>
          ))}
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', padding: '12px 16px', maxHeight: '40vh', overflowY: 'auto' }}>
        {showLog ? (
          <><div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>📋 Eventos</div><LogPanel logState={logState} /></>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
              <div style={{ color: '#fff' }}><span style={{ fontSize: 24, fontWeight: 900, color: '#a78bfa' }}>{totalPersons}</span><span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>agora</span></div>
              <div style={{ color: '#fff' }}><span style={{ fontSize: 24, fontWeight: 900 }}>{Object.values(liveStats).reduce((s, z) => s + z.visits, 0)}</span><span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>visitas</span></div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>{autoLabel}</div>
            </div>
            {zones.map(z => { const s = liveStats[z.id] || {}; return (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: z.color, fontWeight: 700, fontSize: 13 }}>{z.name}</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{s.count || 0} 👥</span>
                  <span style={{ color: '#9ca3af' }}>{s.visits || 0} visitas</span>
                  <span style={{ color: '#9ca3af' }}>{fmtDuration(s.avgMs)} médio</span>
                </div>
              </div>
            )})}
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )

  /* ── DESKTOP ────────────────────────────────────────────────── */
  return (
    <div>
      {pendingZone && <ZoneConfigModal pending={pendingZone} onSave={handleZoneSave} onCancel={() => setPendingZone(null)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video style={{ width: 22, height: 22, color: '#8b5cf6' }} /> Analytics de Câmera
            {modelState === 'ready' && totalPersons > 0 && (
              <span style={{ fontSize: 13, fontWeight: 900, background: '#22c55e', color: '#fff', padding: '2px 10px', borderRadius: 100 }}>{totalPersons} pessoa{totalPersons !== 1 ? 's' : ''}</span>
            )}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            {modelState === 'loading' ? '⏳ Carregando COCO-SSD...' : modelState === 'ready' ? `🟢 Detecção ativa — ${autoLabel}` : modelState === 'error' ? '🔴 Erro ao carregar modelo' : 'Iniciando...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer' }}><Link2 style={{ width: 13, height: 13 }} />Compartilhar</button>
          <button onClick={() => setShowHeatmap(h => !h)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: showHeatmap ? '#ef4444' : '#fee2e2', color: showHeatmap ? '#fff' : '#dc2626', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}><Thermometer style={{ width: 13, height: 13 }} />{showHeatmap ? '🌡️ Heatmap ON' : 'Heatmap'}</button>
          {showHeatmap && (
            <button onClick={() => { heatPositionsRef.current = []; const c = heatCanvasRef.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height) }} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑 Limpar</button>
          )}
          <button onClick={() => setConfigMode(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: configMode ? '#8b5cf6' : '#ede9fe', color: configMode ? '#fff' : '#7c3aed', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}><Settings style={{ width: 13, height: 13 }} />{configMode ? 'Desenhando...' : 'Configurar zonas'}</button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer' }}><Download style={{ width: 13, height: 13 }} />CSV</button>
          <button onClick={() => handleSave()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: saved ? '#22c55e' : '#8b5cf6', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}><Save style={{ width: 13, height: 13 }} />{saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar sessão'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {cameraBlockDesktop}
        <div>
          <div style={{ display: 'flex', marginBottom: 12, background: '#f3f4f6', borderRadius: 12, padding: 3 }}>
            {[{ id: 'stats', label: '📊 Stats' }, { id: 'log', label: '📋 Eventos' }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', background: activeTab === t.id ? '#fff' : 'transparent', fontWeight: activeTab === t.id ? 800 : 600, fontSize: 13, color: activeTab === t.id ? '#111827' : '#6b7280', cursor: 'pointer', boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{t.label}</button>
            ))}
          </div>
          {activeTab === 'stats'
            ? <StatsPanel zones={zones} liveStats={liveStats} totalPersons={totalPersons} configMode={configMode} removeZone={removeZone} setConfigMode={setConfigMode} />
            : <LogPanel logState={logState} />
          }
        </div>
      </div>
      <div style={{ marginTop: 16, padding: '12px 16px', background: '#faf5ff', borderRadius: 12, border: '1px solid #e9d5ff', fontSize: 13, color: '#7c3aed' }}>
        <strong>💡 Dica:</strong> Para usar como câmera dedicada (celular fixo na loja), clique em <strong>Compartilhar link</strong> → envie pelo WhatsApp → abra no celular dedicado. A câmera traseira ativa automaticamente.
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
