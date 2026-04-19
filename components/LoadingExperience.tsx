'use client'

type LoadingExperienceProps = {
  label?: string
  compact?: boolean
  variant?: 'default' | 'home' | 'player' | 'team' | 'league' | 'awards'
}

export default function LoadingExperience({
  label = 'Loading the next shift...',
  compact = false,
  variant = 'default',
}: LoadingExperienceProps) {
  const title =
    variant === 'player'
      ? 'Player Profile Loading'
      : variant === 'team'
        ? 'Team Hub Loading'
        : variant === 'league'
          ? 'League Center Loading'
          : variant === 'awards'
            ? 'Awards Loading'
            : variant === 'home'
              ? 'Home Ice Loading'
              : 'EKHL Loading'

  return (
    <div
      className={
        compact
          ? `loading-experience loading-experience-${variant} loading-experience-compact`
          : `loading-experience loading-experience-${variant}`
      }
    >
      <div className={`loading-experience-core loading-experience-core-${variant}`}>
        <div className={`loading-experience-rink loading-experience-rink-${variant}`}>
          <div className="loading-experience-lane" />
          <div className="loading-experience-lane loading-experience-lane-delay" />
          <div className="loading-experience-puck" />
          <div className="loading-experience-glow" />
        </div>
        <div className="loading-experience-copy">
          <div className="loading-experience-title">{title}</div>
          <div className="loading-experience-text">{label}</div>
        </div>
      </div>
    </div>
  )
}
