/**
 * MapView – Leaflet map
 * Changes from previous version:
 *   1. Circular navy job markers (replaces text-label markers)
 *   2. Collapsible + draggable Route Optimization panel
 *   3. Clearer visual hierarchy: navy=job, green=user, blue-thin=road graph, green-thick=Dijkstra path
 *
 * UNCHANGED: all Dijkstra logic, graph loading/rendering, snap computation,
 *            distance scoring, graph toggle, zoom-based node visibility.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Job } from '../types'
import { loadRoadGraph, snapToGraph, type RoadGraph } from '../lib/roadGraph'
import { dijkstra, pathToPolyline } from '../lib/dijkstra'
import { computeDistanceScore } from '../config/geo'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../config/geo'

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface RouteInfo {
  found: boolean
  distanceKm: number
  nodesEvaluated: number
  edgesRelaxed: number
  executionMs: number
  sourceNodeId: string
  targetNodeId: string
  snapUserKm: number
  snapJobKm: number
  distanceScore: number
}

interface MapViewProps {
  jobs: Job[]
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
  userLat?: number | null
  userLng?: number | null
  onRouteComputed?: (jobId: string, info: RouteInfo) => void
}

// ─── Marker icons ──────────────────────────────────────────────────────────────

/**
 * Circular navy marker with white briefcase icon.
 * Normal: 30 px circle  |  Selected: 38 px with glow ring
 * Visual hierarchy: navy = job destination (distinct from green user + blue roads)
 */
function makeJobIcon(
  L: typeof import('leaflet'),
  _job: Job,
  isSelected: boolean
): ReturnType<typeof L.divIcon> {
  if (isSelected) {
    return L.divIcon({
      className: '',
      iconAnchor: [19, 19] as [number, number],
      html: `<div style="
        width:38px;height:38px;
        background:#0f2044;
        border:3px solid #ffffff;
        border-radius:50%;
        box-shadow:0 3px 14px rgba(15,32,68,0.55),0 0 0 6px rgba(15,32,68,0.18);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;position:relative;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="17"/>
          <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
        </svg>
      </div>`,
    })
  }
  return L.divIcon({
    className: '',
    iconAnchor: [15, 15] as [number, number],
    html: `<div style="
      width:30px;height:30px;
      background:#0f2044;
      border:2.5px solid #ffffff;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    </div>`,
  })
}

/** Green circular marker for user location — visually distinct from navy job markers */
function makeUserIcon(L: typeof import('leaflet')): ReturnType<typeof L.divIcon> {
  return L.divIcon({
    className: '',
    iconAnchor: [14, 14] as [number, number],
    html: `<div style="
      width:28px;height:28px;
      background:#16a34a;
      border:3px solid #ffffff;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(22,163,74,0.45),0 0 0 4px rgba(22,163,74,0.15);
      display:flex;align-items:center;justify-content:center;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round">
        <circle cx="12" cy="10" r="3"/>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
    </div>`,
  })
}

// ─── Graph rendering (unchanged) ──────────────────────────────────────────────

function buildEdgeLayer(
  L: typeof import('leaflet'),
  graph: RoadGraph,
  renderer: import('leaflet').Canvas
): import('leaflet').LayerGroup {
  const group = L.layerGroup()
  const edges = graph.edges
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    if (!e.g || e.g.length < 2) continue
    L.polyline(e.g as [number, number][], {
      renderer, color: '#3b82f6', weight: 1.2, opacity: 0.45, interactive: false,
    }).addTo(group)
  }
  return group
}

const NODE_ZOOM_THRESHOLD = 15

function buildNodeLayer(
  L: typeof import('leaflet'),
  graph: RoadGraph,
  renderer: import('leaflet').Canvas
): import('leaflet').LayerGroup {
  const group = L.layerGroup()
  const entries = Object.entries(graph.nodes)
  for (let i = 0; i < entries.length; i++) {
    const [, coords] = entries[i]
    L.circleMarker([coords[0], coords[1]], {
      renderer, radius: 2, color: '#1d4ed8', fillColor: '#93c5fd',
      fillOpacity: 0.9, weight: 0.8, opacity: 0.8, interactive: false,
    }).addTo(group)
  }
  return group
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MapView({
  jobs, selectedJobId, onSelectJob, userLat, userLng, onRouteComputed,
}: MapViewProps) {
  // Map + Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null)
  const snapMarkersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const canvasRendererRef = useRef<import('leaflet').Canvas | null>(null)
  const edgeLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const nodeLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const graphCacheRef = useRef<RoadGraph | null>(null)
  const routeKeyRef = useRef<string>('')

  // Map state
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [isLoadingGraph, setIsLoadingGraph] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [graphLoaded, setGraphLoaded] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_MAP_ZOOM)

  // Panel state
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({ x: 12, y: 12 }) // left, bottom offset
  const dragRef = useRef<{ active: boolean; startMX: number; startMY: number; startX: number; startY: number }>({
    active: false, startMX: 0, startMY: 0, startX: 12, startY: 12,
  })

  // ── Drag handlers for panel ───────────────────────────────────────────────
  const onPanelDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragRef.current = { active: true, startMX: clientX, startMY: clientY, startX: panelPos.x, startY: panelPos.y }
    e.preventDefault()
  }, [panelPos])

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const dx = clientX - dragRef.current.startMX
      const dy = clientY - dragRef.current.startMY
      const container = mapContainerRef.current
      const panel = panelRef.current
      const cW = container?.clientWidth ?? 500
      const cH = container?.clientHeight ?? 400
      const pW = panel?.offsetWidth ?? 260
      const pH = panel?.offsetHeight ?? 40
      const newX = Math.max(0, Math.min(cW - pW, dragRef.current.startX + dx))
      const newY = Math.max(0, Math.min(cH - pH, dragRef.current.startY - dy))
      setPanelPos({ x: newX, y: newY })
    }
    function onUp() { dragRef.current.active = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  // ── Initialise map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false

    async function init() {
      const L = await import('leaflet')
      LRef.current = L
      if (cancelled || !mapContainerRef.current) return

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM, zoomControl: true, preferCanvas: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      canvasRendererRef.current = L.canvas({ padding: 0.5 })
      map.on('zoomend', () => setCurrentZoom(map.getZoom()))
      mapRef.current = map

      jobs.forEach(job => {
        if (!job.lat || !job.lng) return
        const marker = L.marker([job.lat, job.lng], {
          icon: makeJobIcon(L, job, job.id === selectedJobId),
          zIndexOffset: 500,
        })
        marker.on('click', () => onSelectJob(job.id))
        marker.addTo(map)
        markersRef.current.set(job.id, marker)
      })
    }

    init()
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove(); mapRef.current = null
        markersRef.current.clear()
        canvasRendererRef.current = null; edgeLayerRef.current = null
        nodeLayerRef.current = null; graphCacheRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update job markers ────────────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current; if (!L || !mapRef.current) return
    markersRef.current.forEach((marker, jobId) => {
      const job = jobs.find(j => j.id === jobId); if (!job) return
      marker.setIcon(makeJobIcon(L, job, jobId === selectedJobId))
    })
    if (selectedJobId) {
      const job = jobs.find(j => j.id === selectedJobId)
      if (job?.lat && job?.lng) {
        mapRef.current.setView([job.lat, job.lng], Math.max(mapRef.current.getZoom(), 14), { animate: true })
      }
    }
  }, [selectedJobId, jobs])

  // ── User location marker ──────────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current; if (!L || !mapRef.current) return
    userMarkerRef.current?.remove(); userMarkerRef.current = null
    if (userLat != null && userLng != null) {
      userMarkerRef.current = L.marker([userLat, userLng], {
        icon: makeUserIcon(L), zIndexOffset: 1000,
      }).bindTooltip('Your Location', { permanent: false }).addTo(mapRef.current)
    }
  }, [userLat, userLng])

  // ── Load and render graph overlay (unchanged) ─────────────────────────────
  const loadAndRenderGraph = useCallback(async () => {
    const L = LRef.current; const map = mapRef.current; const canvas = canvasRendererRef.current
    if (!L || !map || !canvas) return
    setIsLoadingGraph(true)
    try {
      const graph = graphCacheRef.current ?? await loadRoadGraph()
      graphCacheRef.current = graph
      if (!edgeLayerRef.current) edgeLayerRef.current = buildEdgeLayer(L, graph, canvas)
      if (!nodeLayerRef.current) nodeLayerRef.current = buildNodeLayer(L, graph, canvas)
      edgeLayerRef.current.addTo(map)
      if (map.getZoom() >= NODE_ZOOM_THRESHOLD) nodeLayerRef.current.addTo(map)
      setGraphLoaded(true)
    } catch (err) { console.error('[MapView] Graph load error:', err) }
    finally { setIsLoadingGraph(false) }
  }, [])

  // ── Toggle graph visibility (unchanged) ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    if (showGraph) {
      if (!graphLoaded) loadAndRenderGraph()
      else {
        edgeLayerRef.current?.addTo(map)
        if (map.getZoom() >= NODE_ZOOM_THRESHOLD) nodeLayerRef.current?.addTo(map)
      }
    } else {
      edgeLayerRef.current?.remove(); nodeLayerRef.current?.remove()
    }
  }, [showGraph, graphLoaded, loadAndRenderGraph])

  // ── Zoom-based node visibility (unchanged) ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !graphLoaded || !showGraph) return
    if (currentZoom >= NODE_ZOOM_THRESHOLD) nodeLayerRef.current?.addTo(map)
    else nodeLayerRef.current?.remove()
  }, [currentZoom, graphLoaded, showGraph])

  // ── Dijkstra route computation (unchanged) ────────────────────────────────
  const computeRoute = useCallback(async () => {
    const L = LRef.current; const map = mapRef.current
    if (!L || !map || !selectedJobId || userLat == null || userLng == null) return
    const job = jobs.find(j => j.id === selectedJobId)
    if (!job?.lat || !job?.lng) return
    const key = `${selectedJobId}|${userLat.toFixed(6)}|${userLng.toFixed(6)}`
    if (routeKeyRef.current === key) return
    routeKeyRef.current = key

    routeLayerRef.current?.remove(); routeLayerRef.current = null
    snapMarkersRef.current?.remove(); snapMarkersRef.current = null
    setRouteInfo(null); setIsLoadingRoute(true)

    try {
      // ── Boundary check: reject outside-city user coordinates ────────────────
      // Do NOT snap an outside-city user to the road graph. Snapping would start
      // Dijkstra from the nearest boundary node, not from the user's actual location,
      // producing a misleading route and incorrect DistanceScore.
      const { isWithinAngelesCity } = await import('../lib/geo')
      if (!isWithinAngelesCity(userLat, userLng)) {
        const info: RouteInfo = {
          found: false, distanceKm: Infinity, nodesEvaluated: 0, edgesRelaxed: 0, executionMs: 0,
          sourceNodeId: 'OUTSIDE_ANGELES_CITY', targetNodeId: 'N/A',
          snapUserKm: Infinity, snapJobKm: 0, distanceScore: 0,
        }
        setRouteInfo(info); onRouteComputed?.(selectedJobId, info); return
      }

      const graph = graphCacheRef.current ?? await loadRoadGraph()
      graphCacheRef.current = graph
      const snapUser = snapToGraph(userLat, userLng, graph)
      const snapJob = snapToGraph(job.lat, job.lng, graph)

      if (!snapUser || !snapJob) {
        const info: RouteInfo = {
          found: false, distanceKm: Infinity, nodesEvaluated: 0, edgesRelaxed: 0, executionMs: 0,
          sourceNodeId: snapUser?.nodeId ?? 'N/A', targetNodeId: snapJob?.nodeId ?? 'N/A',
          snapUserKm: snapUser?.snapDistKm ?? Infinity, snapJobKm: snapJob?.snapDistKm ?? Infinity, distanceScore: 0,
        }
        setRouteInfo(info); onRouteComputed?.(selectedJobId, info); return
      }

      const result = dijkstra(graph, snapUser.nodeId, snapJob.nodeId)
      const totalDist = result.found ? result.distanceKm + snapUser.snapDistKm + snapJob.snapDistKm : Infinity
      const info: RouteInfo = {
        found: result.found,
        distanceKm: result.found ? totalDist : Infinity,
        nodesEvaluated: result.nodesEvaluated,
        edgesRelaxed: result.edgesRelaxed,
        executionMs: result.executionMs,
        sourceNodeId: snapUser.nodeId,
        targetNodeId: snapJob.nodeId,
        snapUserKm: snapUser.snapDistKm,
        snapJobKm: snapJob.snapDistKm,
        distanceScore: result.found ? computeDistanceScore(totalDist) : 0,
      }
      setRouteInfo(info); onRouteComputed?.(selectedJobId, info)

      if (result.found && result.path.length >= 2) {
        const coords = pathToPolyline(result.path, graph)
        if (coords.length > 0) {
          routeLayerRef.current = L.polyline(coords, {
            color: '#16a34a', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
          }).addTo(map)

          const snapGroup = L.layerGroup()
          const [sLat, sLng] = graph.nodes[snapUser.nodeId]
          const [tLat, tLng] = graph.nodes[snapJob.nodeId]
          L.circleMarker([sLat, sLng], {
            radius: 7, color: '#fff', weight: 2, fillColor: '#16a34a', fillOpacity: 1,
          }).bindTooltip(`Source: ${snapUser.nodeId}`, { permanent: false }).addTo(snapGroup)
          L.circleMarker([tLat, tLng], {
            radius: 7, color: '#fff', weight: 2, fillColor: '#0f2044', fillOpacity: 1,
          }).bindTooltip(`Target: ${snapJob.nodeId}`, { permanent: false }).addTo(snapGroup)
          snapMarkersRef.current = snapGroup.addTo(map)

          map.fitBounds(
            L.latLngBounds([[userLat, userLng], [job.lat, job.lng], ...coords]),
            { padding: [50, 50], animate: true }
          )
        }
      }
    } catch (err) { console.error('[MapView] Dijkstra error:', err) }
    finally { setIsLoadingRoute(false) }
  }, [selectedJobId, userLat, userLng, jobs, onRouteComputed])

  useEffect(() => {
    if (selectedJobId && userLat != null && userLng != null) computeRoute()
    if (!selectedJobId) {
      routeKeyRef.current = ''
      routeLayerRef.current?.remove(); routeLayerRef.current = null
      snapMarkersRef.current?.remove(); snapMarkersRef.current = null
      setRouteInfo(null)
    }
  }, [selectedJobId, userLat, userLng, computeRoute])

  // ── Derived display values ────────────────────────────────────────────────
  const showPanel = !!selectedJobId && (!!routeInfo || isLoadingRoute)
  const roadKm = routeInfo
    ? routeInfo.distanceKm - routeInfo.snapUserKm - routeInfo.snapJobKm
    : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Leaflet canvas */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', minHeight: 400, zIndex: 0, background: '#e5e7eb' }}
      />

      {/* ── "Show Road Graph" toggle ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 10, left: 50, zIndex: 900, fontFamily: 'Inter, sans-serif' }}>
        <button
          onClick={() => setShowGraph(v => !v)}
          title={showGraph
            ? 'Hide OSM road graph overlay'
            : 'Show OSM road graph overlay (8,282 nodes / 11,199 edges)'}
          style={{
            background: showGraph ? '#1d4ed8' : 'rgba(255,255,255,0.97)',
            color: showGraph ? '#fff' : '#374151',
            border: `1.5px solid ${showGraph ? '#1d4ed8' : '#d1d5db'}`,
            borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
            <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
          </svg>
          {isLoadingGraph ? 'Loading…' : showGraph ? 'Road Graph ON' : 'Show Road Graph'}
        </button>

        {showGraph && !isLoadingGraph && (
          <div style={{
            marginTop: 3, background: 'rgba(255,255,255,0.93)', borderRadius: 5,
            padding: '3px 7px', fontSize: 10, color: '#6b7280',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}>
            {currentZoom < NODE_ZOOM_THRESHOLD
              ? `Nodes visible at zoom ≥ ${NODE_ZOOM_THRESHOLD} (current: ${currentZoom})`
              : `Nodes + edges · zoom ${currentZoom}`}
          </div>
        )}
      </div>

      {/* ── Legend (top-right) ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        background: 'rgba(255,255,255,0.97)', borderRadius: 6, padding: '6px 10px',
        fontSize: 11, fontFamily: 'Inter, sans-serif',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 900,
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 128,
        pointerEvents: 'none',
      }}>
        <LegendRow color="#0f2044" circle label="Job location" />
        {userLat != null && userLng != null && <LegendRow color="#16a34a" circle label="Your location" />}
        {routeInfo?.found && <LegendRow color="#16a34a" line thick label="Dijkstra route" />}
        {showGraph && !isLoadingGraph && <LegendRow color="#3b82f6" line label="Road network" />}
      </div>

      {/* ── Route Optimization panel — collapsible + draggable ────────────── */}
      {showPanel && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            left: panelPos.x,
            bottom: panelPos.y,
            zIndex: 950,
            width: 'clamp(220px, 90%, 300px)',
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 8,
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            overflow: 'hidden',
            // Don't let the panel capture scroll/zoom from the map
            touchAction: 'none',
          }}
          // Stop map events leaking through the panel
          onMouseDown={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          {/* ── Drag handle / header ──────────────────────────────────────── */}
          <div
            onMouseDown={onPanelDragStart}
            onTouchStart={onPanelDragStart}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#0f2044',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Route Optimization
              {isLoadingRoute && (
                <span style={{ color: '#93c5fd', fontWeight: 400, fontSize: 10 }}>Computing…</span>
              )}
            </span>

            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {/* Drag hint icon */}
              <span title="Drag to move" style={{ color: '#93c5fd', fontSize: 14, lineHeight: 1, cursor: 'grab', padding: '0 2px' }}>⠿</span>
              {/* Collapse toggle */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setPanelCollapsed(v => !v)}
                title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
                style={{
                  background: 'none', border: 'none', color: '#fff',
                  cursor: 'pointer', padding: '2px 4px', fontSize: 14, lineHeight: 1,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {panelCollapsed ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {/* ── Panel body (hidden when collapsed) ───────────────────────── */}
          {!panelCollapsed && (
            <div style={{ padding: '10px 12px' }}>
              {isLoadingRoute ? (
                <div style={{ color: '#6b7280', padding: '4px 0' }}>Running Dijkstra's Algorithm…</div>
              ) : routeInfo ? (
                <>
                  <PRow label="Algorithm" value={<strong>Dijkstra's Algorithm</strong>} />
                  <PRow label="Graph" value={
                    <span>Angeles City OSM Road Network
                      <br /><span style={{ color: '#9ca3af', fontSize: 10 }}>8,282 nodes · 11,199 edges · 879 km</span>
                    </span>
                  } />
                  <PRow label="Route Found" value={
                    routeInfo.sourceNodeId === 'OUTSIDE_ANGELES_CITY'
                      ? <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ Location outside Angeles City</span>
                      : <span style={{ color: routeInfo.found ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {routeInfo.found ? '✓ Yes' : '✗ No (snap failed)'}
                        </span>
                  } />
                  {routeInfo.found && (
                    <>
                      <PRow label="Shortest Distance" value={
                        <span>
                          <strong>{routeInfo.distanceKm.toFixed(3)} km</strong>
                          {(routeInfo.snapUserKm + routeInfo.snapJobKm) > 0.01 && (
                            <span style={{ color: '#9ca3af', fontSize: 10 }}>
                              {' '}(road {roadKm.toFixed(3)} + snap {(routeInfo.snapUserKm + routeInfo.snapJobKm).toFixed(3)})
                            </span>
                          )}
                        </span>
                      } />
                      <PRow label="Distance Score G(a,j)" value={routeInfo.distanceScore.toFixed(4)} />
                    </>
                  )}
                  <PRow label="Source Node" value={
                    <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
                      {routeInfo.sourceNodeId}
                    </code>
                  } />
                  <PRow label="Target Node" value={
                    <code style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
                      {routeInfo.targetNodeId}
                    </code>
                  } />
                  <PRow label="Nodes Evaluated" value={routeInfo.nodesEvaluated.toLocaleString()} />
                  <PRow label="Edges Relaxed" value={routeInfo.edgesRelaxed.toLocaleString()} />
                  <PRow label="Execution Time" value={`${routeInfo.executionMs.toFixed(2)} ms`} />

                  <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid #f3f4f6', color: '#9ca3af', fontSize: 10 }}>
                    OSM © OpenStreetMap contributors (ODbL) · 2026-08-15
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Prompt: select location to run Dijkstra ───────────────────────── */}
      {selectedJobId && userLat == null && !isLoadingRoute && !routeInfo && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'rgba(255,255,255,0.96)', borderRadius: 7,
          padding: '9px 13px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#374151',
          zIndex: 900, maxWidth: 270, pointerEvents: 'none',
        }}>
          <strong>Tap "My Location"</strong> in the search bar to run Dijkstra's algorithm and see the shortest route.
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function PRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ color: '#374151', marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 4px' }}>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>{label}:</span>
      <span style={{ flex: 1, minWidth: 0 }}>{value}</span>
    </div>
  )
}

function LegendRow({
  color, circle, line, thick, label,
}: { color: string; circle?: boolean; line?: boolean; thick?: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {circle && (
        <div style={{
          width: 11, height: 11, background: color,
          borderRadius: '50%', border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0,
        }} />
      )}
      {line && (
        <div style={{
          width: 18, height: thick ? 4 : 2,
          background: color, borderRadius: 2, flexShrink: 0, opacity: thick ? 1 : 0.65,
        }} />
      )}
      <span style={{ color: '#374151' }}>{label}</span>
    </div>
  )
}
