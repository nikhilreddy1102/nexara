import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; href: string }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
      <p className="text-xs text-gray-500 mb-5 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  )
}