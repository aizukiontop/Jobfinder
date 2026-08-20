/**
 * JobFinder – Road Graph Loader
 *
 * The road graph (public/data/roadGraph.json) is lazy-loaded via dynamic
 * import only when the map or a route is requested, keeping the initial
 * bundle fast.
 *
 * Graph structure:
 *   nodes: { [nodeId: string]: [lat, lon] }
 *   edges: { f, t, w, ow, g }[]
 *     f  = from nodeId
 *     t  = to nodeId
 *     w  = weight in km (haversine sum over all OSM shape points)
 *     ow = oneway tag ('yes'|'-1'|null)
 *     g  = geometry [[lat,lon],...] for Leaflet polyline
 */

import { haversine } from './geo'
import { MAX_SNAP_KM } from '../config/geo'

export interface RoadGraphMeta {
  osmExtractDate: string
  builtDate: string
  totalNodes: number
  totalEdges: number
  totalRoadKm: number
  largestComponentNodes: number
  orphanComponents: number
  maxReferenceDistanceKm: number
  maxReferenceDistancePair: [string, string]
  maxReferenceDistanceMethod: string
  license: string
}

export interface RawEdge {
  f: string
  t: string
  w: number
  ow: string | null
  g: number[][]  // [[lat,lon],...]
}

export interface RoadGraph {
  meta: RoadGraphMeta
  nodes: Record<string, [number, number]>
  edges: RawEdge[]
  /** Directed adjacency list: nodeId → [(neighbourId, weightKm, edgeIndex)] */
  adj: Map<string, Array<[string, number, number]>>
}

let _graph: RoadGraph | null = null
let _loading: Promise<RoadGraph> | null = null

/** Lazy-load and build the road graph exactly once. */
export async function loadRoadGraph(): Promise<RoadGraph> {
  if (_graph) return _graph
  if (_loading) return _loading

  _loading = (async () => {
    const base = import.meta.env.BASE_URL ?? '/'
    const url = `${base}data/roadGraph.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load road graph: ${res.status}`)
    const raw = await res.json()

    const adj = new Map<string, Array<[string, number, number]>>()
    const edges: RawEdge[] = raw.edges

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const ow = e.ow

      if (!adj.has(e.f)) adj.set(e.f, [])
      if (!adj.has(e.t)) adj.set(e.t, [])

      if (ow === 'yes' || ow === '1' || ow === 'true') {
        adj.get(e.f)!.push([e.t, e.w, i])
      } else if (ow === '-1') {
        adj.get(e.t)!.push([e.f, e.w, i])
      } else {
        adj.get(e.f)!.push([e.t, e.w, i])
        adj.get(e.t)!.push([e.f, e.w, i])
      }
    }

    _graph = { meta: raw.meta, nodes: raw.nodes, edges, adj }
    return _graph
  })()

  return _loading
}

export interface SnapResult {
  nodeId: string
  snapDistKm: number
  nodeLat: number
  nodeLng: number
}

/**
 * Snap a [lat, lng] coordinate to the nearest road-graph node.
 * Returns null if the nearest node is farther than MAX_SNAP_KM.
 */
export function snapToGraph(
  lat: number,
  lng: number,
  graph: RoadGraph
): SnapResult | null {
  let bestId = ''
  let bestDist = Infinity

  for (const [id, [nlat, nlng]] of Object.entries(graph.nodes)) {
    const d = haversine([lat, lng], [nlat, nlng])
    if (d < bestDist) { bestDist = d; bestId = id }
  }

  if (bestDist > MAX_SNAP_KM) return null

  const [nodeLat, nodeLng] = graph.nodes[bestId]
  return { nodeId: bestId, snapDistKm: bestDist, nodeLat, nodeLng }
}
