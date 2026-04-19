'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'

type PreviewEntityType = 'player' | 'team' | 'league'

type HoverPreviewLinkProps = {
  href: string
  entityType: PreviewEntityType
  entityId?: string | null
  lookupValue?: string | null
  style?: CSSProperties
  className?: string
  children: ReactNode
}

type PreviewData = {
  title: string
  subtitle?: string | null
  meta?: string | null
  imageUrl?: string | null
  flagUrl?: string | null
  eyebrow?: string | null
  facts?: Array<{ label: string; value: string }>
  actionLabel?: string | null
}

function normalizeLookupValue(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

function getActionLabel(entityType: PreviewEntityType) {
  if (entityType === 'player') return 'Open player profile'
  if (entityType === 'team') return 'Open team page'
  return 'Open league page'
}

export default function HoverPreviewLink({
  href,
  entityType,
  entityId,
  lookupValue,
  style,
  className,
  children,
}: HoverPreviewLinkProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, showAbove: false })

  useEffect(() => {
    setIsMounted(true)
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return

      const previewWidth = 280
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - previewWidth - 12)
      )
      const showAbove = rect.top > 170
      const top = showAbove ? rect.top - 12 : rect.bottom + 12

      setPosition({ top, left, showAbove })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen])

  async function loadPreview() {
    if (previewData || isLoading) return

    setIsLoading(true)

    try {
      if (entityType === 'player' && entityId) {
        const [{ data }, { count: statRowCount }, { count: awardCount }] = await Promise.all([
          supabase
            .from('players')
            .select('id, name, display_name, number, position, nationality, player_type, image_url, teams(id, name, league)')
            .eq('id', entityId)
            .single(),
          supabase.from('stats').select('id', { count: 'exact', head: true }).eq('player_id', entityId),
          supabase.from('awards').select('id', { count: 'exact', head: true }).eq('player_id', entityId),
        ])

        const player = data as
          | {
              id: string
              name: string
              display_name?: string | null
              number?: number | null
              position?: string | null
              nationality?: string | null
              player_type?: string | null
              image_url?: string | null
              teams?:
                | { id: string; name: string; league?: string | null }[]
                | { id: string; name: string; league?: string | null }
                | null
            }
          | null

        const playerTeam = Array.isArray(player?.teams) ? player?.teams?.[0] : player?.teams

        if (player) {
          const facts = [
            player.number != null ? { label: 'Number', value: `#${player.number}` } : null,
            player.player_type?.trim() ? { label: 'Role', value: player.player_type.trim() } : null,
            statRowCount ? { label: 'Stat Rows', value: String(statRowCount) } : null,
            awardCount ? { label: 'Awards', value: String(awardCount) } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>

          setPreviewData({
            title: player.display_name?.trim() || player.name,
            subtitle: [player.position, playerTeam?.name].filter(Boolean).join(' | ') || 'Player',
            meta: playerTeam?.league || player.nationality || null,
            imageUrl: player.image_url || null,
            flagUrl: getFlagUrl(player.nationality),
            eyebrow: 'Player Preview',
            facts,
            actionLabel: getActionLabel('player'),
          })
        }
      }

      if (entityType === 'team' && entityId) {
        const [{ data }, { count: linkedPlayerCount }, { count: matchCount }] = await Promise.all([
          supabase
            .from('teams')
            .select('id, name, logo_url, league, country, country_code, town, founded, arena_name')
            .eq('id', entityId)
            .single(),
          supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', entityId),
          supabase
            .from('league_matches')
            .select('id', { count: 'exact', head: true })
            .or(`home_team_id.eq.${entityId},visiting_team_id.eq.${entityId}`),
        ])

        const team = data as
          | {
              id: string
              name: string
              logo_url?: string | null
              league?: string | null
              country?: string | null
              country_code?: string | null
              town?: string | null
              founded?: string | number | null
              arena_name?: string | null
            }
          | null

        if (team) {
          const facts = [
            team.town?.trim() ? { label: 'Town', value: team.town.trim() } : null,
            team.founded ? { label: 'Founded', value: String(team.founded) } : null,
            team.arena_name?.trim() ? { label: 'Arena', value: team.arena_name.trim() } : null,
            linkedPlayerCount ? { label: 'Linked Players', value: String(linkedPlayerCount) } : null,
            matchCount ? { label: 'Matches', value: String(matchCount) } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>

          setPreviewData({
            title: team.name,
            subtitle: team.league || 'Team',
            meta: team.country || team.country_code || null,
            imageUrl: team.logo_url || null,
            flagUrl: getFlagUrl(team.country_code || team.country),
            eyebrow: 'Team Preview',
            facts,
            actionLabel: getActionLabel('team'),
          })
        }
      }

      if (entityType === 'league') {
        const normalizedLookup = normalizeLookupValue(lookupValue || entityId || '')
        const leagueResponse = entityId
          ? supabase
              .from('leagues')
              .select('id, name, display_name, short_name, country_code, logo_url, image_url, category, level')
              .eq('id', entityId)
              .single()
          : supabase
              .from('leagues')
              .select('id, name, display_name, short_name, country_code, logo_url, image_url, category, level')

        const [{ data }, { count: awardCount }] = await Promise.all([
          leagueResponse,
          entityId
            ? supabase.from('awards').select('id', { count: 'exact', head: true }).eq('league_id', entityId)
            : Promise.resolve({ count: 0 } as { count: number | null }),
        ])

        const league = Array.isArray(data)
          ? data.find((row) =>
              [row.id, row.name, row.display_name, row.short_name]
                .filter(Boolean)
                .some((value) => normalizeLookupValue(String(value)) === normalizedLookup)
            ) || null
          : (data as
              | {
                  id: string
                  name: string
                  display_name?: string | null
                  short_name?: string | null
                  country_code?: string | null
                  logo_url?: string | null
                  image_url?: string | null
                  category?: string | null
                  level?: string | number | null
                }
              | null)

        if (league) {
          const [{ count: teamCount }, { count: seasonCount }] = await Promise.all([
            supabase.from('teams').select('id', { count: 'exact', head: true }).eq('league', league.name),
            entityId
              ? supabase.from('league_standings').select('id', { count: 'exact', head: true }).eq('league_id', entityId)
              : Promise.resolve({ count: 0 } as { count: number | null }),
          ])

          const facts = [
            league.level ? { label: 'Level', value: String(league.level) } : null,
            teamCount ? { label: 'Teams', value: String(teamCount) } : null,
            seasonCount ? { label: 'Standings Rows', value: String(seasonCount) } : null,
            awardCount ? { label: 'Awards', value: String(awardCount) } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>

          setPreviewData({
            title: league.display_name || league.name,
            subtitle: league.short_name || league.name,
            meta: league.category || 'League',
            imageUrl: league.logo_url || league.image_url || null,
            flagUrl: getFlagUrl(league.country_code),
            eyebrow: 'League Preview',
            facts,
            actionLabel: getActionLabel('league'),
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const showPreview = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => {
      setIsOpen(true)
      void loadPreview()
    }, 110)
  }

  const hidePreview = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 90)
  }

  const previewCard = isOpen ? (
    <div
      className="hover-preview-card"
      onPointerEnter={showPreview}
      onPointerLeave={hidePreview}
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
      style={{
        top: position.top,
        left: position.left,
        transform: position.showAbove ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <div className="hover-preview-inner">
        {isLoading && !previewData ? (
          <div className="hover-preview-loading">Loading preview...</div>
        ) : previewData ? (
          <>
            <div className="hover-preview-media">
              {previewData.imageUrl ? (
                <img src={previewData.imageUrl} alt={previewData.title} className="hover-preview-image" />
              ) : (
                <div className="hover-preview-fallback">{previewData.title.slice(0, 1)}</div>
              )}
            </div>
            <div className="hover-preview-copy">
              {previewData.eyebrow ? <div className="hover-preview-eyebrow">{previewData.eyebrow}</div> : null}
              <div className="hover-preview-title-row">
                {previewData.flagUrl ? (
                  <img src={previewData.flagUrl} alt="" className="hover-preview-flag" />
                ) : null}
                <span className="hover-preview-title">{previewData.title}</span>
              </div>
              {previewData.subtitle ? <div className="hover-preview-subtitle">{previewData.subtitle}</div> : null}
              {previewData.meta ? <div className="hover-preview-meta">{previewData.meta}</div> : null}
              {previewData.facts?.length ? (
                <div className="hover-preview-facts">
                  {previewData.facts.slice(0, 4).map((fact) => (
                    <div key={`${fact.label}-${fact.value}`} className="hover-preview-fact">
                      <span className="hover-preview-fact-label">{fact.label}</span>
                      <span className="hover-preview-fact-value">{fact.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {previewData.actionLabel ? (
                <Link href={href} className="hover-preview-action" tabIndex={-1}>
                  <span>{previewData.actionLabel}</span>
                  <span className="hover-preview-action-arrow">→</span>
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <div className="hover-preview-loading">No preview available.</div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <span
        ref={wrapperRef}
        onPointerEnter={showPreview}
        onPointerLeave={hidePreview}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        style={{ display: 'inline-flex', position: 'relative' }}
      >
        <Link href={href} style={style} className={className}>
          {children}
        </Link>
      </span>

      {isMounted && previewCard ? createPortal(previewCard, document.body) : null}
    </>
  )
}
