/**
 * The 33 official barangays of Angeles City, Pampanga.
 * Centroid coordinates sourced from PhilAtlas (verified 2026-08).
 * OSM polygon matches confirmed against admin_level=10 relations.
 */

export interface BarangayCentroid {
  canonical: string
  aliases: string[]
  lat: number
  lng: number
  source: 'PhilAtlas'
}

export const ANGELES_CITY_BARANGAYS: BarangayCentroid[] = [
  { canonical: 'Agapito del Rosario', aliases: [], lat: 15.1433, lng: 120.5887, source: 'PhilAtlas' },
  { canonical: 'Amsic', aliases: [], lat: 15.1588, lng: 120.5679, source: 'PhilAtlas' },
  { canonical: 'Anunas', aliases: [], lat: 15.1559, lng: 120.5551, source: 'PhilAtlas' },
  { canonical: 'Balibago', aliases: [], lat: 15.1663, lng: 120.5901, source: 'PhilAtlas' },
  { canonical: 'Capaya', aliases: [], lat: 15.1456, lng: 120.6173, source: 'PhilAtlas' },
  { canonical: 'Claro M. Recto', aliases: ['Claro M Recto'], lat: 15.1472, lng: 120.5927, source: 'PhilAtlas' },
  { canonical: 'Cuayan', aliases: [], lat: 15.1466, lng: 120.5486, source: 'PhilAtlas' },
  { canonical: 'Cutcut', aliases: [], lat: 15.1376, lng: 120.5821, source: 'PhilAtlas' },
  { canonical: 'Cutud', aliases: [], lat: 15.1750, lng: 120.6267, source: 'PhilAtlas' },
  { canonical: 'Lourdes Northwest', aliases: ['Lourdes North West', 'Lourdes NW'], lat: 15.1442, lng: 120.5842, source: 'PhilAtlas' },
  { canonical: 'Lourdes Sur', aliases: [], lat: 15.1403, lng: 120.5902, source: 'PhilAtlas' },
  { canonical: 'Lourdes Sur East', aliases: [], lat: 15.1435, lng: 120.5940, source: 'PhilAtlas' },
  { canonical: 'Malabañas', aliases: ['Malabanias', 'Malabanas'], lat: 15.1577, lng: 120.5830, source: 'PhilAtlas' },
  { canonical: 'Margot', aliases: [], lat: 15.1708, lng: 120.5355, source: 'PhilAtlas' },
  { canonical: 'Mining', aliases: [], lat: 15.1402, lng: 120.6134, source: 'PhilAtlas' },
  { canonical: 'Ninoy Aquino', aliases: ['Ninoy Aquino (Marisol)', 'Marisol'], lat: 15.1503, lng: 120.5962, source: 'PhilAtlas' },
  { canonical: 'Pampang', aliases: [], lat: 15.1482, lng: 120.5745, source: 'PhilAtlas' },
  { canonical: 'Pandan', aliases: [], lat: 15.1473, lng: 120.6053, source: 'PhilAtlas' },
  { canonical: 'Pulungbulu', aliases: ['Pulung Bulu'], lat: 15.1302, lng: 120.6082, source: 'PhilAtlas' },
  { canonical: 'Pulung Cacutud', aliases: [], lat: 15.1644, lng: 120.6172, source: 'PhilAtlas' },
  { canonical: 'Pulung Maragul', aliases: [], lat: 15.1652, lng: 120.6032, source: 'PhilAtlas' },
  { canonical: 'Salapungan', aliases: [], lat: 15.1479, lng: 120.5977, source: 'PhilAtlas' },
  { canonical: 'San Jose', aliases: [], lat: 15.1311, lng: 120.5942, source: 'PhilAtlas' },
  { canonical: 'San Nicolas', aliases: [], lat: 15.1390, lng: 120.5855, source: 'PhilAtlas' },
  { canonical: 'Santa Teresita', aliases: [], lat: 15.1493, lng: 120.5872, source: 'PhilAtlas' },
  { canonical: 'Santa Trinidad', aliases: [], lat: 15.1419, lng: 120.5823, source: 'PhilAtlas' },
  { canonical: 'Santo Cristo', aliases: [], lat: 15.1406, lng: 120.5983, source: 'PhilAtlas' },
  { canonical: 'Santo Domingo', aliases: [], lat: 15.1277, lng: 120.6002, source: 'PhilAtlas' },
  { canonical: 'Santo Rosario', aliases: ['Santo Rosario (Pob.)', 'Poblacion'], lat: 15.1355, lng: 120.5873, source: 'PhilAtlas' },
  { canonical: 'Sapalibutad', aliases: [], lat: 15.1582, lng: 120.6304, source: 'PhilAtlas' },
  { canonical: 'Sapangbato', aliases: [], lat: 15.1701, lng: 120.5142, source: 'PhilAtlas' },
  { canonical: 'Tabun', aliases: [], lat: 15.1499, lng: 120.6146, source: 'PhilAtlas' },
  { canonical: 'Virgen delos Remedios', aliases: ['Virgen Delos Remedios', 'Virgen De Los Remedios'], lat: 15.1500, lng: 120.5919, source: 'PhilAtlas' },
]

/** Resolve a user-supplied string to a canonical barangay name. */
export function resolveBarangay(name: string): string | null {
  const n = name.toLowerCase().trim()
  for (const b of ANGELES_CITY_BARANGAYS) {
    if (b.canonical.toLowerCase() === n) return b.canonical
    for (const a of b.aliases) {
      if (a.toLowerCase() === n) return b.canonical
    }
  }
  return null
}

/** Canonical names in alphabetical order, for filter dropdowns. */
export const BARANGAY_NAMES: string[] = ANGELES_CITY_BARANGAYS
  .map(b => b.canonical)
  .sort()
