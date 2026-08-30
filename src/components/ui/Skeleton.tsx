export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
      <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
      <div className="h-2 bg-gray-100 rounded w-32" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="h-3 bg-gray-100 rounded w-32 mb-2" />
        <div className="h-2 bg-gray-100 rounded w-48" />
      </div>
      <div className="h-5 bg-gray-100 rounded w-16" />
    </div>
  )
}