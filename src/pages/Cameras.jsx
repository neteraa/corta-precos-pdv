/**
 * /cameras — ZS Analytics de Câmera
 *
 * Detecção de pessoas + dwell time por zona via TF.js COCO-SSD.
 * Roda 100% no browser — zero custo de infra adicional.
 * Padrão visual e de auth igual ao ScanMobile.
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
import { Video, Settings, Save, Link2, X, Plus } from 'lucide-react'
import { getConfiguredStoreId } from '../utils/auth.js'
import { getMktStoreId, getMktStoreToken } from '../utils/tenantStorage.js'

/* ── Constants ─────────────────────────────────────────────── */
const ZONE_COLORS   = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4']
const MIN_DWELL_MS  = 5_000   // visitas < 5s são passagens, não contam
const DETECT_INTERVAL_MS = 500
const PERSON_SCORE_MIN   = 0.5
const IOU_MATCH_THRESH   = 0.35

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

function loadZones(storeId) {
  try {
    return JSON.parse(localStorage.getItem(`zs_camera_zones_${storeId}`) || '[]')
  } catch { return [] }
}

function saveZones(storeId, zones) {
  try { localStorage.setItem(`zs_camera_zones_${storeId}`, JSON.stringify(zones)) } catch {}
}

/* ── Canvas drawing ─────────────────────────────────────────── */
function drawOverlay(canvas, persons, zones, configMode, drawingRect) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  // Draw defined zones
  for (const z of zones) {
    const rx = z.x * W, ry = z.y * H, rw = z.w * W, rh = z.h * H
    ctx.fillStyle = z.color + '1a'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = z.color
    ctx.lineWidth = 2.5
    ctx.setLineDash([])
    ctx.strokeRect(rx, ry, rw, rh)
    // Zone label
    ctx.fillStyle = z.color
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(z.name, rx + 6, ry + 18)
  }

  // Draw in-progress zone
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

  // Draw person bboxes
  if (!configMode) {
    for (const p of persons) {
      const [px, py, pw, ph] = p.bbox
      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 2
      ctx.strokeRect(px, py, pw, ph)
      ctx.fillStyle = '#4ade80cc'
      ctx.font = 'bold 11px system-ui'
      ctx.fillText(`pessoa`, px, Math.max(py - 4, 14))
    }
  }
}

/* ── Main component ─────────────────────────────────────────── */
export default function Cameras() {
  const storeId = getMktStoreId() || getConfiguredStoreId()

  // Core state
  const [modelState, setModelState] = useState('idle') // idle | loading | ready | error
  const [cameraError, setCameraError] = useState(null)
  const [zones, setZones]             = useState(() => loadZones(storeId))
  const [configMode, setConfigMode]   = useState(false)
  const [liveStats, setLiveStats]     = useState({})   // { [zoneId]: {count, visits, avgMs, maxMs} }
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [totalPersons, setTotalPersons] = useState(0)

  // Zone drawing
  const [drawingRect, setDrawingRect] = useState(null)
  const drawStart = useRef(null)

  // Refs (avoid stale closures in intervals)
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const modelRef   = useRef(null)
  const streamRef  = useRef(null)
  const personsRef = useRef([])  // [{id, bbox, lastSeen}]
  const nextIdRef  = useRef(1)
  const zonesRef   = useRef(zones)
  const zoneDataRef = useRef({})  // { [zoneId]: {activePersonIds, entryTimes, visits, totalDwellMs, maxDwellMs, peakCount} }
  const sessionStart = useRef(new Date().toISOString())
  const detectTimer  = useRef(null)
  const statsTimer   = useRef(null)

  // Keep zonesRef in sync
  useEffect(() => {
    zonesRef.current = zones
    // Init zoneData for new zones
    for (const z of zones) {
      if (!zoneDataRef.current[z.id]) {
        zoneDataRef.current[z.id] = {
          activePersonIds: new Set(),
          entryTimes: new Map(),
          visits: 0, totalDwellMs: 0, maxDwellMs: 0, peakCount: 0,
        }
      }
    }
  }, [zones])

  // Load TF.js model
  useEffect(() => {
    setModelState('loading')
    let cancelled = false

    import('@tensorflow/tfjs').then(tf =>
      import('@tensorflow-models/coco-ssd').then(cocoSsd => {
        if (cancelled) return
        return cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(model => {
          if (cancelled) return
          modelRef.current = model
          setModelState('ready')
        })
      })
    ).catch(err => {
      if (!cancelled) { console.error('TF.js load error:', err); setModelState('error') }
    })

    return () => { cancelled = true }
  }, [])

  // Start camera
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
          if (canvasRef.current) {
            canvasRef.current.width  = v.videoWidth
            canvasRef.current.height = v.videoHeight
          }
        }
      }
    }).catch(err => {
      if (active) setCameraError(err.message || 'Câmera não autorizada')
    })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Detection loop
  useEffect(() => {
    if (modelState !== 'ready') return

    const detect = async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || video.readyState < 2 || !modelRef.current) return

      let detections = []
      try {
        const raw = await modelRef.current.detect(video)
        detections = raw.filter(d => d.class === 'person' && d.score >= PERSON_SCORE_MIN)
          .map(d => ({ bbox: d.bbox }))
      } catch { return }

      // IoU tracking: match new detections to existing tracked persons
      const prev = personsRef.current
      const matched = []
      const usedPrev = new Set()

      for (const det of detections) {
        let bestIdx = -1, bestScore = IOU_MATCH_THRESH
        for (let i = 0; i < prev.length; i++) {
          if (usedPrev.has(i)) continue
          const score = iou(prev[i].bbox, det.bbox)
          if (score > bestScore) { bestScore = score; bestIdx = i }
        }
        if (bestIdx >= 0) {
          matched.push({ id: prev[bestIdx].id, bbox: det.bbox, lastSeen: Date.now() })
          usedPrev.add(bestIdx)
        } else {
          matched.push({ id: nextIdRef.current++, bbox: det.bbox, lastSeen: Date.now() })
        }
      }
      personsRef.current = matched
      setTotalPersons(matched.length)

      // Dwell time per zone
      const now = Date.now()
      const vw = video.videoWidth, vh = video.videoHeight
      for (const z of zonesRef.current) {
        const zd = zoneDataRef.current[z.id]
        if (!zd) continue

        const personsInZone = new Set(
          matched.filter(p => centerInRect(p.bbox, z, vw, vh)).map(p => p.id)
        )

        // Entering zone
        for (const id of personsInZone) {
          if (!zd.activePersonIds.has(id)) {
            zd.activePersonIds.add(id)
            zd.entryTimes.set(id, now)
          }
        }

        // Leaving zone
        for (const id of [...zd.activePersonIds]) {
          if (!personsInZone.has(id)) {
            const dwell = now - (zd.entryTimes.get(id) || now)
            if (dwell >= MIN_DWELL_MS) {
              zd.visits++
              zd.totalDwellMs += dwell
              zd.maxDwellMs = Math.max(zd.maxDwellMs, dwell)
            }
            zd.activePersonIds.delete(id)
            zd.entryTimes.delete(id)
          }
        }

        zd.peakCount = Math.max(zd.peakCount, personsInZone.size)
      }

      // Draw overlay
      if (canvas) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
        drawOverlay(canvas, matched, zonesRef.current, false, null)
      }
    }

    detectTimer.current = setInterval(detect, DETECT_INTERVAL_MS)
    return () => clearInterval(detectTimer.current)
  }, [modelState])

  // Live stats refresh (every second)
  useEffect(() => {
    statsTimer.current = setInterval(() => {
      const stats = {}
      const now = Date.now()
      for (const z of zonesRef.current) {
        const zd = zoneDataRef.current[z.id]
        if (!zd) continue
        const activeCount = zd.activePersonIds.size
        // Ongoing dwells count towards average
        const ongoingMs = [...zd.entryTimes.values()].reduce((s, t) => s + (now - t), 0)
        const totalVisits = zd.visits + (activeCount > 0 ? 0 : 0)
        const avgMs = zd.visits > 0 ? zd.totalDwellMs / zd.visits : 0
        stats[z.id] = { count: activeCount, visits: zd.visits, avgMs, maxMs: zd.maxDwellMs, peak: zd.peakCount }
      }
      setLiveStats(stats)
    }, 1_000)
    return () => clearInterval(statsTimer.current)
  }, [])

  // Zone configuration — canvas pointer events
  const onPointerDown = useCallback((e) => {
    if (!configMode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top)  * scaleY
    drawStart.current = { x, y }
    setDrawingRect({ x, y, w: 0, h: 0 })
  }, [configMode])

  const onPointerMove = useCallback((e) => {
    if (!configMode || !drawStart.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top)  * scaleY
    const dr = {
      x: Math.min(drawStart.current.x, x),
      y: Math.min(drawStart.current.y, y),
      w: Math.abs(x - drawStart.current.x),
      h: Math.abs(y - drawStart.current.y),
    }
    setDrawingRect(dr)
    drawOverlay(canvas, personsRef.current, zonesRef.current, true, dr)
  }, [configMode])

  const onPointerUp = useCallback((e) => {
    if (!configMode || !drawStart.current || !drawingRect) return
    const { x, y, w, h } = drawingRect
    drawStart.current = null
    if (w < 20 || h < 20) { setDrawingRect(null); return } // too small

    const canvas = canvasRef.current
    const vw = canvas?.width || 1, vh = canvas?.height || 1
    const zoneNorm = { x: x / vw, y: y / vh, w: w / vw, h: h / vh }

    const name = window.prompt('Nome da zona (ex: Corredor A, Bebidas, Frios):')
    if (!name?.trim()) { setDrawingRect(null); return }

    const newZone = {
      id: `z_${Date.now()}`,
      name: name.trim(),
      ...zoneNorm,
      color: ZONE_COLORS[zonesRef.current.length % ZONE_COLORS.length],
    }
    const updated = [...zonesRef.current, newZone]
    setZones(updated)
    saveZones(storeId, updated)
    setDrawingRect(null)
    setConfigMode(false)
  }, [configMode, drawingRect, storeId])

  const removeZone = useCallback((id) => {
    const updated = zonesRef.current.filter(z => z.id !== id)
    setZones(updated)
    saveZones(storeId, updated)
    delete zoneDataRef.current[id]
  }, [storeId])

  // Save session to blob
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload = {
        storeId,
        sessionId: `sess_${Date.now()}`,
        startedAt: sessionStart.current,
        endedAt: new Date().toISOString(),
        zones: zonesRef.current.map(z => {
          const zd = zoneDataRef.current[z.id] || {}
          const visits = zd.visits || 0
          const avgDwellSec = visits > 0 ? (zd.totalDwellMs || 0) / visits / 1000 : 0
          return {
            name: z.name,
            visits,
            avgDwellSec: +avgDwellSec.toFixed(1),
            maxDwellSec: +((zd.maxDwellMs || 0) / 1000).toFixed(1),
            peakCount: zd.peakCount || 0,
          }
        }),
      }
      const res = await fetch('/api/cameras-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if ((await res.json()).ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch (err) { console.error('Save session error:', err) }
    setSaving(false)
  }, [storeId])

  // Shareable link
  const handleCopyLink = useCallback(() => {
    const token = getMktStoreToken() || ''
    const url = `${window.location.origin}/cameras?storeId=${storeId}&t=${token}`
    navigator.clipboard?.writeText(url).then(() => alert('Link copiado! Envie pelo WhatsApp para abrir a câmera no celular dedicado.'))
  }, [storeId])

  /* ── Render ─────────────────────────────────────────────── */

  if (cameraError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
      <Video style={{ width: 48, height: 48, color: '#ef4444' }} />
      <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>Câmera não disponível</div>
      <div style={{ color: '#6b7280', fontSize: 14, maxWidth: 360 }}>{cameraError}<br /><br />Verifique as permissões de câmera no browser e recarregue a página.</div>
      <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 12, background: '#ea580c', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Tentar novamente</button>
    </div>
  )

  return (
    <div>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video style={{ width: 22, height: 22, color: '#8b5cf6' }} />
            Analytics de Câmera
            {modelState === 'ready' && totalPersons > 0 && (
              <span style={{ fontSize: 13, fontWeight: 900, background: '#22c55e', color: '#fff', padding: '2px 10px', borderRadius: 100 }}>
                {totalPersons} pessoa{totalPersons !== 1 ? 's' : ''} detectada{totalPersons !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            {modelState === 'loading' ? '⏳ Carregando modelo de IA (~3s)...'
              : modelState === 'ready'   ? '🟢 Detecção ativa — TF.js COCO-SSD'
              : modelState === 'error'   ? '🔴 Erro ao carregar modelo'
              : 'Iniciando...'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Copy link */}
          <button onClick={handleCopyLink}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            <Link2 style={{ width: 13, height: 13 }} />
            Compartilhar link
          </button>

          {/* Configure zones */}
          <button onClick={() => setConfigMode(c => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: configMode ? '#8b5cf6' : '#ede9fe', color: configMode ? '#fff' : '#7c3aed', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            <Settings style={{ width: 13, height: 13 }} />
            {configMode ? 'Desenhando zona...' : 'Configurar zonas'}
          </button>

          {/* Save session */}
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: saved ? '#22c55e' : '#8b5cf6', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            <Save style={{ width: 13, height: 13 }} />
            {saved ? '✓ Sessão salva!' : saving ? 'Salvando...' : 'Salvar sessão'}
          </button>
        </div>
      </div>

      {/* ── Main layout: camera + stats ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

        {/* Camera + canvas */}
        <div style={{ position: 'relative', background: '#000', borderRadius: 16, overflow: 'hidden', aspectRatio: '16/9' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: configMode ? 'crosshair' : 'default' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />

          {/* Loading overlay */}
          {modelState === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 12 }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Carregando modelo COCO-SSD...</span>
            </div>
          )}

          {/* Config mode hint */}
          {configMode && (
            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(139,92,246,0.9)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ✏️ Clique e arraste para definir uma zona
            </div>
          )}
        </div>

        {/* Stats panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Detection summary */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>SESSÃO AO VIVO</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#8b5cf6' }}>{totalPersons}</div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>pessoas agora</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#374151' }}>
                  {Object.values(liveStats).reduce((s, z) => s + z.visits, 0)}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>visitas totais</div>
              </div>
            </div>
          </div>

          {/* Per-zone stats */}
          {zones.length === 0 ? (
            <div style={{ background: '#faf5ff', border: '1.5px dashed #d8b4fe', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#7c3aed', marginBottom: 4 }}>Nenhuma zona definida</div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                Clique em <strong>Configurar zonas</strong> e arraste sobre a câmera para definir áreas de interesse (ex: Bebidas, Corredor A, Frios).
              </div>
            </div>
          ) : (
            zones.map(z => {
              const s = liveStats[z.id] || {}
              return (
                <div key={z.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', border: `1.5px solid ${z.color}33`, borderLeft: `4px solid ${z.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{z.name}</span>
                    <button onClick={() => removeZone(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Agora',   value: `${s.count || 0} pessoa${s.count !== 1 ? 's' : ''}`, color: s.count > 0 ? z.color : '#9ca3af' },
                      { label: 'Visitas', value: s.visits || 0, color: '#374151' },
                      { label: 'Média',   value: fmtDuration(s.avgMs), color: '#374151' },
                      { label: 'Máx',     value: fmtDuration(s.maxMs), color: '#374151' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color, marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}

          {/* Add zone button (in config mode or zones list) */}
          {zones.length < 6 && (
            <button onClick={() => setConfigMode(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 12, border: '1.5px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%' }}>
              <Plus style={{ width: 14, height: 14 }} />
              Nova zona ({zones.length}/6)
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile: full-screen video mode hint ──────────── */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: '#faf5ff', borderRadius: 12, border: '1px solid #e9d5ff', fontSize: 13, color: '#7c3aed' }}>
        <strong>💡 Dica:</strong> Para usar como câmera dedicada (celular fixo na loja), clique em <strong>Compartilhar link</strong> → envie pelo WhatsApp → abra no celular dedicado. A câmera traseira ativa automaticamente.
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
