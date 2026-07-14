/**
 * Color utilities for text cue inspector.
 */

/**
 * Normalize a color input to uppercase #RRGGBB format.
 * Accepts hex (#RGB, #RRGGBB), rgb(), rgba(), or named colors.
 */
export const normalizeColor = (input: string): string => {
  if (!input) return '#FFFFFF';

  // Remove whitespace
  const color = input.trim().toUpperCase();

  // Already in #RRGGBB format
  if (/^#[0-9A-F]{6}$/.test(color)) {
    return color;
  }

  // Convert #RGB to #RRGGBB
  if (/^#[0-9A-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // Handle rgb() and rgba()
  if (color.startsWith('RGB(') || color.startsWith('RGBA(')) {
    const isRgba = color.startsWith('RGBA(');
    const content = color.slice(isRgba ? 5 : 4, -1);
    const parts = content.split(',').map(p => parseFloat(p.trim()));
    if (parts.length >= 3) {
      const r = Math.min(255, Math.max(0, Math.round(parts[0] || 0)));
      const g = Math.min(255, Math.max(0, Math.round(parts[1] || 0)));
      const b = Math.min(255, Math.max(0, Math.round(parts[2] || 0)));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
  }

  // Fallback: try to use a canvas element to parse named colors
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      const computed = ctx.fillStyle;
      if (computed && computed.startsWith('#')) {
        return normalizeColor(computed); // Recurse to normalize the computed color
      }
    }
  }

  // Default fallback
  return '#FFFFFF';
};

/**
 * Convert a hex color to rgb() format.
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = normalizeColor(hex);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};
