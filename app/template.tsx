export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="route-transition-shell">
      <div className="route-transition-overlay" />
      <div className="route-transition-content">{children}</div>
    </div>
  )
}
