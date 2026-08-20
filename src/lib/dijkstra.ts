/**
 * JobFinder – Dijkstra's Shortest-Path Algorithm
 *
 * Thesis §Method (p.24-25):
 *   "JobFinder employs Dijkstra's Algorithm to identify the shortest travel
 *    route from the job seeker to prospective job sites. Each job site is
 *    represented as a separate 'node' on the graph, while the distance or
 *    estimated travel time between nodes is reflected by the 'edge'
 *    connecting those nodes."
 *
 * Implementation details:
 *   • Binary min-heap (no external libraries).
 *   • Operates on the directed adjacency of the road graph's largest
 *     connected component (8,282 nodes, 11,199 edges, OSM 2026-08-15).
 *   • Edge weights = haversine sum over OSM shape points (km).
 *   • Returns full diagnostics (nodesEvaluated, edgesRelaxed, executionMs)
 *     for the Route Optimization panel in the UI.
 *   • NO straight-line fallback: if found=false, DistanceScore = 0.
 */

import type { RoadGraph } from './roadGraph'

export interface DijkstraResult {
  found: boolean
  sourceNodeId: string
  targetNodeId: string
  /** Shortest road distance in kilometres. */
  distanceKm: number
  /** Ordered list of node IDs along the shortest path. */
  path: string[]
  /** Number of nodes whose shortest distance was finalised. */
  nodesEvaluated: number
  /** Number of edge relaxations performed. */
  edgesRelaxed: number
  /** Wall-clock execution time in milliseconds. */
  executionMs: number
}

// ─── Binary min-heap ──────────────────────────────────────────────────────────

class MinHeap {
  private heap: [number, string][] = []

  push(priority: number, value: string) {
    this.heap.push([priority, value])
    this._bubbleUp(this.heap.length - 1)
  }

  pop(): [number, string] | null {
    if (this.heap.length === 0) return null
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size() { return this.heap.length }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[parent][0] <= this.heap[i][0]) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private _sinkDown(i: number) {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1, r = 2 * i + 2
      if (l < n && this.heap[l][0] < this.heap[smallest][0]) smallest = l
      if (r < n && this.heap[r][0] < this.heap[smallest][0]) smallest = r
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────

/**
 * Run Dijkstra from `sourceNodeId` to `targetNodeId` on the road graph.
 *
 * @param graph          Loaded road graph with adjacency list
 * @param sourceNodeId   Start node (snapped user location)
 * @param targetNodeId   End node (snapped job location)
 */
export function dijkstra(
  graph: RoadGraph,
  sourceNodeId: string,
  targetNodeId: string
): DijkstraResult {
  const t0 = performance.now()
  const { adj } = graph

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  dist.set(sourceNodeId, 0)

  const pq = new MinHeap()
  pq.push(0, sourceNodeId)

  let nodesEvaluated = 0
  let edgesRelaxed = 0

  while (pq.size > 0) {
    const [d, u] = pq.pop()!
    if (d > (dist.get(u) ?? Infinity)) continue // stale entry

    nodesEvaluated++

    if (u === targetNodeId) break

    for (const [v, w] of adj.get(u) ?? []) {
      edgesRelaxed++
      const nd = d + w
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd)
        prev.set(v, u)
        pq.push(nd, v)
      }
    }
  }

  const executionMs = performance.now() - t0
  const found = dist.has(targetNodeId)

  if (!found) {
    return {
      found: false,
      sourceNodeId,
      targetNodeId,
      distanceKm: Infinity,
      path: [],
      nodesEvaluated,
      edgesRelaxed,
      executionMs,
    }
  }

  // Reconstruct path
  const path: string[] = []
  let cur: string | undefined = targetNodeId
  while (cur !== undefined) {
    path.unshift(cur)
    cur = prev.get(cur)
  }

  return {
    found: true,
    sourceNodeId,
    targetNodeId,
    distanceKm: dist.get(targetNodeId)!,
    path,
    nodesEvaluated,
    edgesRelaxed,
    executionMs,
  }
}

/**
 * Extract the Leaflet polyline geometry for a Dijkstra path.
 * Concatenates edge geometry arrays in path order.
 *
 * @returns Array of [lat, lng] pairs for L.polyline()
 */
export function pathToPolyline(
  path: string[],
  graph: RoadGraph
): [number, number][] {
  if (path.length < 2) return []

  const nodeSet = new Set(path)
  const coords: [number, number][] = []

  // Build a quick lookup: (from,to) → geometry
  const edgeGeom = new Map<string, number[][]>()
  for (const e of graph.edges) {
    if (nodeSet.has(e.f) && nodeSet.has(e.t)) {
      edgeGeom.set(`${e.f}|${e.t}`, e.g)
      edgeGeom.set(`${e.t}|${e.f}`, [...e.g].reverse())
    }
  }

  for (let i = 0; i < path.length - 1; i++) {
    const key = `${path[i]}|${path[i + 1]}`
    const geom = edgeGeom.get(key)
    if (geom) {
      for (let j = i === 0 ? 0 : 1; j < geom.length; j++) {
        coords.push([geom[j][0], geom[j][1]])
      }
    } else {
      // Fallback: straight line between junction nodes
      const a = graph.nodes[path[i]]
      const b = graph.nodes[path[i + 1]]
      if (a && b) {
        if (i === 0) coords.push([a[0], a[1]])
        coords.push([b[0], b[1]])
      }
    }
  }

  return coords
}
