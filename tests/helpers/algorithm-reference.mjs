// Independent reference routines for implementation correctness, not relevance labels.
export function makeGraph(nodes, directedEdges) {
  const adj = new Map(nodes.map(id => [id, []]))
  directedEdges.forEach(([from, to, weight], index) => adj.get(from).push([to, weight, index]))
  return { nodes: Object.fromEntries(nodes.map(id => [id, [0, 0]])), adj, edges: [], meta: {} }
}

export function roadGraph(raw) {
  const directed = []
  for (const edge of raw.edges) {
    if (!Number.isFinite(edge.w) || edge.w < 0) throw new Error('Nonnegative finite road weights required')
    if (!raw.nodes[edge.f] || !raw.nodes[edge.t]) throw new Error('Edge references missing node')
    if (edge.ow === '-1') directed.push([edge.t, edge.f, edge.w])
    else {
      directed.push([edge.f, edge.t, edge.w])
      if (!['yes', '1', 'true'].includes(edge.ow)) directed.push([edge.t, edge.f, edge.w])
    }
  }
  return { ...makeGraph(Object.keys(raw.nodes), directed), nodes: raw.nodes, edges: raw.edges, meta: raw.meta }
}

export function bellmanFord(graph, source) {
  const distance = new Map(Object.keys(graph.nodes).map(id => [id, Infinity]))
  if (!distance.has(source)) return distance
  distance.set(source, 0)
  // Repeated relaxation does not use the production priority queue or traversal.
  for (let pass = 1; pass < distance.size; pass++) {
    let changed = false
    for (const [from, edges] of graph.adj) {
      if (!Number.isFinite(distance.get(from))) continue
      for (const [to, weight] of edges) {
        const candidate = distance.get(from) + weight
        if (candidate < distance.get(to)) {
          distance.set(to, candidate)
          changed = true
        }
      }
    }
    if (!changed) break
  }
  return distance
}

export function pathDistance(graph, path) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const edges = (graph.adj.get(path[i - 1]) ?? []).filter(([to]) => to === path[i])
    if (!edges.length) throw new Error('Returned path contains a nonexistent directed edge')
    total += Math.min(...edges.map(([, weight]) => weight))
  }
  return total
}

export function ontologyDistances(nodes, edges) {
  const indices = new Map(nodes.map((node, index) => [node.id, index]))
  const distance = nodes.map((_, i) => nodes.map((__, j) => i === j ? 0 : Infinity))
  for (const edge of edges) {
    const a = indices.get(edge.from), b = indices.get(edge.to)
    if (a === undefined || b === undefined) throw new Error('Ontology edge references missing skill')
    distance[a][b] = 1
    distance[b][a] = 1
  }
  // Floyd-Warshall independently checks the production BFS edge-count calculation.
  for (let k = 0; k < nodes.length; k++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j])
      }
    }
  }
  return distance
}
