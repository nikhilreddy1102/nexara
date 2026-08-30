export function ModeBadge({ mode }: { mode: string }) {
  return <span className={`badge-${mode}`}>{mode === 'c2c' ? 'C2C' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge-${status}`}>{status}</span>
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge-${priority}`}>{priority}</span>
}