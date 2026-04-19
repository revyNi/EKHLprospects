'use client'

import { useEffect, useRef, useState } from 'react'

type AnimatedNumberProps = {
  value: number
  duration?: number
  className?: string
  formatter?: (value: number) => string
}

export default function AnimatedNumber({
  value,
  duration = 850,
  className,
  formatter,
}: AnimatedNumberProps) {
  const frameRef = useRef<number | null>(null)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    const startValue = displayValue
    const delta = value - startValue

    if (delta === 0) return

    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      setDisplayValue(Math.round(startValue + delta * eased))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  const renderedValue = formatter ? formatter(displayValue) : String(displayValue)

  return <span className={className}>{renderedValue}</span>
}
