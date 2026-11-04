export interface PrimaryPreset {
  name: string
  hue: number
}

/** OKLCH hue angles. Lightness and chroma come from the CSS tokens. */
export const PRIMARY_PRESETS: PrimaryPreset[] = [
  { name: 'Magenta', hue: 335 },
  { name: 'Violet', hue: 295 },
  { name: 'Blue', hue: 255 },
  { name: 'Teal', hue: 185 },
  { name: 'Green', hue: 145 },
  { name: 'Orange', hue: 50 },
]

export const DEFAULT_PRIMARY_HUE = 335

export function isHue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 360
}

export function swatchColor(hue: number): string {
  return `oklch(0.6 0.22 ${hue})`
}
