import AlertsPanel from './AlertsPanel'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3.5 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-sm md:text-base font-medium text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <AlertsPanel />
        {action && <div>{action}</div>}
      </div>
    </div>
  )
}