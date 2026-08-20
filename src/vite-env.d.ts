/// <reference types="vite/client" />

// JSON module declarations for generated data files
declare module '*/angelesBoundary.generated.json' {
  const value: { osmId: number; name: string; adminLevel: string; ring: number[][] }
  export default value
}
declare module '*/barangayPolygons.generated.json' {
  const value: Array<{
    osmId: number; canonical: string; aliases: string[]
    centroidLat: number; centroidLng: number; centroidSource: string; ring: number[][]
  }>
  export default value
}
declare module '*/jobs.verified.json' {
  import type { Job } from './types'
  const value: Job[]
  export default value
}
