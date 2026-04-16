'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

type LeagueRecord = {
  id: string
  name: string
  country_code?: string | null
}

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  league?: string | null
}

type SeasonRecord = {
  id: string
  name: string
}

type MatchRecord = {
  id: string
  league_id?: string | null
  season_id?: string | null
  match_date?: string | null
  home_team_id?: string | null
  visiting_team_id?: string | null
  home_score?: number | null
  visiting_score?: number | null
  score_note?: string | null
  status?: string | null
  venue?: string | null
  attendance?: number | null
}

type TabKey = 'recent' | 'upcoming'

function normalizeLookupValue(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

function hasFinalScore(match: MatchRecord) {
  return (
    match.home_score !== null &&
    match.home_score !== undefined &&
    match.visiting_score !== null &&
    match.visiting_score !== undefined
  )
}

function normalizeMatchStatus(match: MatchRecord) {
  const normalized = (match.status || '').trim().toLowerCase()
  if (normalized) return normalized
  return hasFinalScore(match) ? 'final' : 'scheduled'
}

function formatScore(match: MatchRecord) {
  if (!hasFinalScore(match)) return '-'
  return `${match.home_score}-${match.visiting_score}${match.score_note ? ` (${match.score_note})` : ''}`
}

function formatStatusLabel(match: MatchRecord) {
  const status = normalizeMatchStatus(match)
  if (status === 'live') return 'LIVE'
  if (status === 'postponed') return 'PPD'
  if (status === 'cancelled') return 'CANCELLED'
  if (status === 'final') return 'FINAL'
  return 'SCHEDULED'
}

function getStatusBadgeStyle(match: MatchRecord) {
  const status = normalizeMatchStatus(match)

  if (status === 'live') {
    return { ...statusBadge, background: '#c51e2d', color: '#fff' }
  }

  if (status === 'postponed' || status === 'cancelled') {
    return { ...statusBadge, background: '#edf1f5', color: '#4d5f70' }
  }

  if (status === 'final') {
    return { ...statusBadge, background: '#dce8ef', color: '#123f58' }
  }

  return { ...statusBadge, background: '#e8f2ea', color: '#1c6b36' }
}

function formatDateLabel(value?: string | null) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

function formatTimeLabel(value?: string | null) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupMatchesByDate(matches: MatchRecord[]) {
  const buckets = new Map<string, MatchRecord[]>()

  matches.forEach((match) => {
    const key = formatDateLabel(match.match_date)
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key)?.push(match)
  })

  return Array.from(buckets.entries())
}

export default function LeagueGamesPage() {
  const params = useParams()
  const identifier = decodeURIComponent(params.id as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [seasons, setSeasons] = useState<SeasonRecord[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recent')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!identifier) return

    async function fetchGamesPage() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, country_code')

      if (leaguesError) {
        setLeague(null)
        setTeams([])
        setSeasons([])
        setMatches([])
        setErrorMessage(leaguesError.message)
        setIsLoading(false)
        return
      }

      const leagueRows = (leaguesData as LeagueRecord[]) || []
      const normalizedIdentifier = normalizeLookupValue(identifier)
      const leagueRecord =
        leagueRows.find((row) => String(row.id) === identifier) ||
        leagueRows.find((row) =>
          [row.name]
            .filter(Boolean)
            .some((value) => normalizeLookupValue(value) === normalizedIdentifier)
        ) ||
        null

      if (!leagueRecord) {
        setLeague(null)
        setTeams([])
        setSeasons([])
        setMatches([])
        setErrorMessage('League not found.')
        setIsLoading(false)
        return
      }

      const leagueNames = [leagueRecord.name].filter(Boolean) as string[]

      const [
        { data: teamsData, error: teamsError },
        { data: seasonsData, error: seasonsError },
        { data: matchesData, error: matchesError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, logo_url, league')
          .in('league', leagueNames.length ? leagueNames : [leagueRecord.name])
          .order('name', { ascending: true }),
        supabase.from('seasons').select('id, name').order('name', { ascending: true }),
        supabase
          .from('league_matches')
          .select('id, league_id, season_id, match_date, home_team_id, visiting_team_id, home_score, visiting_score, score_note, status, venue, attendance')
          .eq('league_id', leagueRecord.id)
          .order('match_date', { ascending: false }),
      ])

      const seasonRows = (seasonsData as SeasonRecord[]) || []
      const matchRows = (matchesData as MatchRecord[]) || []
      const usedSeasonIds = Array.from(new Set(matchRows.map((row) => row.season_id).filter(Boolean))) as string[]
      const availableSeasons = seasonRows.filter((season) => usedSeasonIds.includes(String(season.id)))

      setLeague(leagueRecord)
      setTeams((teamsData as TeamRecord[]) || [])
      setSeasons(availableSeasons)
      setMatches(matchRows)
      setSelectedSeasonId(availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || '')
      setErrorMessage(teamsError?.message || seasonsError?.message || matchesError?.message || '')
      setIsLoading(false)
    }

    void fetchGamesPage()
  }, [identifier])

  const teamsById = useMemo(() => new Map(teams.map((team) => [String(team.id), team])), [teams])
  const selectedLeagueName = league?.name || 'League'
  const leagueFlagUrl = getFlagUrl(league?.country_code)

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (selectedSeasonId && String(match.season_id) !== String(selectedSeasonId)) return false

      if (
        selectedTeamId &&
        String(match.home_team_id) !== String(selectedTeamId) &&
        String(match.visiting_team_id) !== String(selectedTeamId)
      ) {
        return false
      }

      if (dateFrom || dateTo) {
        const rawDate = match.match_date ? new Date(match.match_date) : null
        if (!rawDate || Number.isNaN(rawDate.getTime())) return false

        if (dateFrom) {
          const fromDate = new Date(`${dateFrom}T00:00:00`)
          if (rawDate < fromDate) return false
        }

        if (dateTo) {
          const toDate = new Date(`${dateTo}T23:59:59`)
          if (rawDate > toDate) return false
        }
      }

      return true
    })
  }, [dateFrom, dateTo, matches, selectedSeasonId, selectedTeamId])

  const recentMatches = filteredMatches.filter((match) => normalizeMatchStatus(match) === 'final')
  const upcomingMatches = filteredMatches.filter((match) => normalizeMatchStatus(match) !== 'final')
  const visibleMatches = activeTab === 'recent' ? recentMatches : upcomingMatches
  const groupedMatches = groupMatchesByDate(visibleMatches)

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={heroBlock}>
          <div>
            <h1 style={pageTitle}>Recent Games</h1>
            <div style={leagueMeta}>
              {leagueFlagUrl ? <img src={leagueFlagUrl} alt={selectedLeagueName} style={leagueFlag} /> : null}
              <span style={leagueMetaText}>{selectedLeagueName}</span>
            </div>
          </div>
        </div>

        <div style={filtersGrid}>
          <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={filterInput}>
            <option value="">All Seasons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>

          <select style={filterInput} value={league?.id || ''} disabled>
            <option value={league?.id || ''}>{selectedLeagueName}</option>
          </select>

          <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} style={filterInput}>
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          <div style={dateRangeWrap}>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={dateInput} />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={dateInput} />
          </div>
        </div>

        <div style={tabsWrap}>
          <button type="button" onClick={() => setActiveTab('recent')} style={activeTab === 'recent' ? activeTabStyle : tabStyle}>
            RECENT GAMES
          </button>
          <button type="button" onClick={() => setActiveTab('upcoming')} style={activeTab === 'upcoming' ? activeTabStyle : tabStyle}>
            UPCOMING GAMES
          </button>
        </div>

        <div style={tableCard}>
          <table style={table}>
            <thead>
              <tr style={tableHeadRow}>
                <th style={dateTh}>DATE</th>
                <th style={teamTh}>HOME</th>
                <th style={teamTh}>VISITING</th>
                <th style={scoreTh}>SCORE</th>
                <th style={leagueTh}>LEAGUE</th>
              </tr>
            </thead>
            <tbody>
              {groupedMatches.map(([dateLabel, dateMatches]) => (
                dateMatches.map((match, index) => {
                  const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
                  const visitingTeam = match.visiting_team_id ? teamsById.get(String(match.visiting_team_id)) : null
                  const leagueLabel = league?.name || 'League'

                  return (
                    <tr key={match.id} style={index % 2 === 0 ? tableRowAlt : tableRow}>
                      <td style={dateCell}>
                        {index === 0 ? <div style={dateGroup}>{dateLabel}</div> : null}
                        <div style={timeLabel}>{formatTimeLabel(match.match_date)}</div>
                      </td>
                      <td style={teamCell}>
                        {homeTeam ? (
                          <Link href={`/team/${homeTeam.id}`} style={entityLink}>
                            {homeTeam.logo_url ? <img src={homeTeam.logo_url} alt={homeTeam.name} style={teamLogo} /> : null}
                            <span>{homeTeam.name}</span>
                          </Link>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td style={teamCell}>
                        {visitingTeam ? (
                          <Link href={`/team/${visitingTeam.id}`} style={entityLink}>
                            {visitingTeam.logo_url ? <img src={visitingTeam.logo_url} alt={visitingTeam.name} style={teamLogo} /> : null}
                            <span>{visitingTeam.name}</span>
                          </Link>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td style={scoreCell}>
                        <div style={scoreStack}>
                          <span>{activeTab === 'upcoming' ? formatTimeLabel(match.match_date) : formatScore(match)}</span>
                          <span style={getStatusBadgeStyle(match)}>{formatStatusLabel(match)}</span>
                        </div>
                      </td>
                      <td style={leagueCell}>
                        {league ? (
                          <Link href={`/league/${league.id}`} style={leagueLink}>
                            {leagueLabel}
                          </Link>
                        ) : (
                          leagueLabel
                        )}
                      </td>
                    </tr>
                  )
                })
              ))}

              {!groupedMatches.length ? (
                <tr style={tableRow}>
                  <td colSpan={5} style={emptyCell}>
                    {isLoading ? 'Loading games...' : `No ${activeTab} games found for this filter.`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
        </div>
      </div>
    </div>
  )
}

const pageWrap = {
  minHeight: '100vh',
  background: '#edf2f6',
  padding: '24px 12px 40px',
  fontFamily: 'var(--font-inter), sans-serif',
  color: '#173650',
}

const shell = {
  maxWidth: 1120,
  margin: '0 auto',
}

const heroBlock = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 18,
}

const pageTitle = {
  margin: 0,
  fontSize: 32,
  fontWeight: 800,
  color: '#192937',
  letterSpacing: '-0.04em',
}

const leagueMeta = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 8,
}

const leagueFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #bcc6cf',
}

const leagueMetaText = {
  color: '#2a73ad',
  fontSize: 12,
  fontWeight: 700,
}

const filtersGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 18,
}

const filterInput = {
  height: 38,
  border: '1px solid #c7d2dc',
  borderRadius: 4,
  background: '#fff',
  padding: '0 10px',
  color: '#445564',
  fontSize: 14,
  width: '100%',
}

const dateRangeWrap = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const dateInput = {
  ...filterInput,
}

const tabsWrap = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
  marginBottom: 0,
}

const tabStyle = {
  height: 38,
  border: 'none',
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  background: '#a7bbc9',
  color: '#fff',
  fontSize: 14,
  fontWeight: 800,
}

const activeTabStyle = {
  ...tabStyle,
  background: '#123f58',
}

const tableCard = {
  background: '#fff',
  borderRadius: 6,
  overflow: 'hidden',
  border: '1px solid #ccd5dd',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 14,
}

const tableHeadRow = {
  background: '#c51e2d',
}

const sharedTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '11px 12px',
  fontWeight: 800,
  fontSize: 14,
}

const dateTh = {
  ...sharedTh,
  width: 130,
}

const teamTh = {
  ...sharedTh,
}

const scoreTh = {
  ...sharedTh,
  width: 120,
  textAlign: 'center' as const,
}

const leagueTh = {
  ...sharedTh,
  width: 120,
}

const tableRow = {
  background: '#fff',
}

const tableRowAlt = {
  background: '#eef2f6',
}

const dateCell = {
  padding: '0',
  color: '#173650',
  verticalAlign: 'top' as const,
}

const dateGroup = {
  background: '#9fc0d3',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  padding: '10px 12px',
}

const timeLabel = {
  padding: '10px 12px',
  color: '#1f3445',
  whiteSpace: 'nowrap' as const,
}

const teamCell = {
  padding: '10px 12px',
  color: '#173650',
}

const scoreCell = {
  padding: '10px 12px',
  textAlign: 'center' as const,
  color: '#173650',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
}

const scoreStack = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const statusBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 70,
  height: 22,
  borderRadius: 999,
  padding: '0 8px',
  fontSize: 11,
  fontWeight: 800,
}

const leagueCell = {
  padding: '10px 12px',
}

const entityLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#2273ae',
  textDecoration: 'none',
}

const teamLogo = {
  width: 18,
  height: 18,
  objectFit: 'contain' as const,
}

const leagueLink = {
  color: '#2273ae',
  textDecoration: 'none',
  fontWeight: 600,
}

const emptyCell = {
  padding: '18px 12px',
  textAlign: 'center' as const,
  color: '#687786',
}

const errorText = {
  padding: '12px 14px',
  color: '#b42318',
  fontSize: 13,
}
