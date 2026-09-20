/** Shared chart palette — keep in sync with CSS chart tokens in index.css */
export const CHART_PALETTE = {
  inflow: '#15803D',
  outflow: '#DC2626',
  materials: '#D97706',
  primary: '#0F5D73',
  info: '#2563EB',
  purple: '#7C3AED',
  slate: '#475569',
  grid: '#E2E8F0',
  tick: '#64748B',
} as const;

export const CHART_SERIES = [
  CHART_PALETTE.primary,
  CHART_PALETTE.materials,
  CHART_PALETTE.inflow,
  CHART_PALETTE.info,
  CHART_PALETTE.purple,
  CHART_PALETTE.slate,
  CHART_PALETTE.outflow,
] as const;
