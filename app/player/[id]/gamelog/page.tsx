'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import HoverPreviewLink from '../../../../components/HoverPreviewLink'

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  league?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  display_name?: string | null
  team_id?: string | null
  number?: number | null
  position?: string | null
  nationality?: string | null
  image_url?: string | null
  teams?: TeamRecord | TeamRecord[] | null
}

type PlayerQueryRecord = Omit<PlayerRecord, 'teams'> & {
  teams?: TeamRecord[] | null
}

type StatRecord = {
  id: string
  player_id?: string
  team_id?: string | null
  season_id?: string | null
  position?: string | null
  match_id?: string | null
  game_type?: string | null
  gp?: number | null
  goals?: number | null
  assists?: number | null
  points?: number | null
  hits?: number | null
  plus_minus?: number | null
  shots?: number | null
  toi?: number | null
  gk_saves?: number | null
  gk_shots_against?: number | null
  gk_percentage?: number | null
  goalie_wins?: number | null
  goalie_losses?: number | null
  goalie_overtime_losses?: number | null
  goalie_shutouts?: number | null
  goalie_goals_against?: number | null
}

type SeasonRecord = {
  id: string
  name: string
}

type MatchRecord = {
  id: string
  game_date?: string | null
  home_team_id?: string | null
  visiting_team_id?: string | null
  home_score?: number | null
  visiting_score?: number | null
  score_note?: string | null
}

type FullStat = StatRecord & {
  team?: TeamRecord | null
  season?: SeasonRecord | null
  match?: MatchRecord | null
}

function getPrimaryTeam(teamValue?: TeamRecord | TeamRecord[] | null) {
  if (Array.isArray(teamValue)) return teamValue[0] || null
  return teamValue || null
}

function formatDate(date?: string | null) {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPlusMinus(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '0'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return String(numeric)
}

function isGoaliePosition(position?: string | null) {
  return Boolean(position?.toUpperCase().includes('G'))
}

function getStatRole(position?: string | null, fallbackPosition?: string | null) {
  return isGoaliePosition(position || fallbackPosition) ? 'goalie' : 'skater'
}

function formatSavePct(saves: number, shotsAgainst: number, savedPct?: number | null) {
  if (savedPct) return Number(savedPct).toFixed(3)
  if (!shotsAgainst) return '0'
  return (saves / shotsAgainst).toFixed(3)
}

function formatGaa(goalsAgainst: number, gp: number, toi: number) {
  if (toi > 0) return ((goalsAgainst * 60) / toi).toFixed(2)
  if (gp > 0) return (goalsAgainst / gp).toFixed(2)
  return '0.00'
}

function formatGameTypeLabel(gameType?: string | null) {
  return (gameType || 'regular') === 'playoffs' ? 'Playoffs' : 'Regular'
}

function formatMatchScore(match?: MatchRecord | null) {
  if (
    !match ||
    match.home_score === null ||
    match.home_score === undefined ||
    match.visiting_score === null ||
    match.visiting_score === undefined
  ) {
    return '-'
  }

  return `${match.home_score}-${match.visiting_score}${match.score_note ? ` (${match.score_note})` : ''}`
}

function getSeasonSortValue(seasonLabel?: string | null) {
  const value = (seasonLabel || '').trim()
  if (!value) return Number.MAX_SAFE_INTEGER
  const seasonCountMatch = value.match(/^S(\d+)$/i)
  if (seasonCountMatch) return Number(seasonCountMatch[1])
  const yearMatch = value.match(/(\d{4})/)
  if (yearMatch) return Number(yearMatch[1])
  const numberMatch = value.match(/(\d+)/)
  if (numberMatch) return Number(numberMatch[1])
  return Number.MAX_SAFE_INTEGER
}

export default function PlayerGameLogPage() {
  const params = useParams()
  const playerId = params?.id as string

  const [player, setPlayer] = useState<PlayerRecord | null>(null)
  const [stats, setStats] = useState<FullStat[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [venueFilter, setVenueFilter] = useState<'all' | 'home' | 'away'>('all')
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses' | 'pending'>('all')
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'regular' | 'playoffs'>('all')
  const [roleFilter, setRoleFilter] = useState<'skater' | 'goalie'>('skater')
  const [limit, setLimit] = useState<'25' | '50' | '100' | 'all'>('25')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!playerId) return

    async function fetchData() {
      const [
        { data: playerData, error: playerError },
        { data: statsRaw },
        { data: teamsRaw },
        { data: seasonsRaw },
        { data: matchesRaw },
      ] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, display_name, team_id, number, position, nationality, image_url, teams(id, name, logo_url, league)')
          .eq('id', playerId)
          .single(),
        supabase.from('stats').select('*').eq('player_id', playerId),
        supabase.from('teams').select('id, name, logo_url, league'),
        supabase.from('seasons').select('id, name'),
        supabase.from('matches').select('*'),
      ])

      if (playerError) {
        setErrorMessage(playerError.message)
        setPlayer(null)
        setStats([])
        setTeams([])
        return
      }

      const playerRow = (playerData as PlayerQueryRecord | null) || null
      const playerRecord: PlayerRecord | null = playerRow
        ? { ...playerRow, teams: playerRow.teams ?? null }
        : null

      const teamList = (teamsRaw as TeamRecord[]) || []
      const seasonList = (seasonsRaw as SeasonRecord[]) || []
      const matchList = (matchesRaw as MatchRecord[]) || []
      const fullStats: FullStat[] = ((statsRaw as StatRecord[]) || [])
        .map((stat) => ({
          ...stat,
          team: teamList.find((team) => String(team.id) === String(stat.team_id)) || null,
          season: seasonList.find((season) => String(season.id) === String(stat.season_id)) || null,
          match: matchList.find((match) => String(match.id) === String(stat.match_id)) || null,
        }))
        .sort((a, b) => {
          const dateA = a.match?.game_date ? new Date(a.match.game_date).getTime() : 0
          const dateB = b.match?.game_date ? new Date(b.match.game_date).getTime() : 0
          return dateB - dateA
        })

      setPlayer(playerRecord)
      setTeams(teamList)
      setStats(fullStats)
      if (playerRecord) {
        setRoleFilter(isGoaliePosition(playerRecord.position) ? 'goalie' : 'skater')
      }
    }

    void fetchData()
  }, [playerId])

  const teamsById = new Map(teams.map((team) => [String(team.id), team]))

  const gameLogRows = useMemo(() => {
    return stats
      .filter((stat) => getStatRole(stat.position, player?.position) === roleFilter)
      .filter((stat) => Boolean(stat.match_id) || Boolean(stat.match?.game_date) || (Number(stat.gp) || 0) > 0)
      .map((stat) => {
        const match = stat.match
        const team = stat.team || (stat.team_id ? teamsById.get(String(stat.team_id)) || null : null)
        const isHome = team && match ? String(match.home_team_id) === String(team.id) : false
        const opponentId = team && match ? (isHome ? match.visiting_team_id : match.home_team_id) : null
        const opponent = opponentId ? teamsById.get(String(opponentId)) || null : null
        const matchupLabel = opponent ? `${isHome ? 'vs' : '@'} ${opponent.name}` : team?.name || '-'
        const goalsAgainst =
          stat.goalie_goals_against !== null && stat.goalie_goals_against !== undefined
            ? Number(stat.goalie_goals_against) || 0
            : Math.max((Number(stat.gk_shots_against) || 0) - (Number(stat.gk_saves) || 0), 0)
        const hasFinalScore =
          match &&
          match.home_score !== null &&
          match.home_score !== undefined &&
          match.visiting_score !== null &&
          match.visiting_score !== undefined
        const teamScore = hasFinalScore && match
          ? isHome
            ? Number(match.home_score) || 0
            : Number(match.visiting_score) || 0
          : null
        const opponentScore = hasFinalScore && match
          ? isHome
            ? Number(match.visiting_score) || 0
            : Number(match.home_score) || 0
          : null
        const result =
          teamScore === null || opponentScore === null
            ? 'pending'
            : teamScore > opponentScore
              ? 'win'
              : teamScore < opponentScore
                ? 'loss'
                : 'draw'

        return {
          stat,
          match,
          team,
          opponent,
          isHome,
          matchupLabel,
          goalsAgainst,
          result,
          seasonLabel: stat.season?.name || '-',
          typeLabel: formatGameTypeLabel(stat.game_type),
        }
      })
  }, [player?.position, roleFilter, stats, teamsById])

  const seasonOptions = Array.from(
    new Set(gameLogRows.map((row) => row.seasonLabel).filter((value) => value && value !== '-'))
  ).sort((a, b) => getSeasonSortValue(a) - getSeasonSortValue(b) || a.localeCompare(b))

  const activeSeasonFilter = seasonFilter !== 'all' && seasonOptions.includes(seasonFilter) ? seasonFilter : 'all'

  const filteredRows = gameLogRows.filter((row) => {
    if (activeSeasonFilter !== 'all' && row.seasonLabel !== activeSeasonFilter) return false
    if (venueFilter === 'home' && !row.isHome) return false
    if (venueFilter === 'away' && row.isHome) return false
    if (resultFilter === 'wins' && row.result !== 'win') return false
    if (resultFilter === 'losses' && row.result !== 'loss') return false
    if (resultFilter === 'pending' && row.result !== 'pending') return false
    if (gameTypeFilter !== 'all' && (row.stat.game_type || 'regular') !== gameTypeFilter) return false
    return true
  })

  const displayedRows = limit === 'all' ? filteredRows : filteredRows.slice(0, Number(limit))

  const summary = filteredRows.reduce(
    (acc, row) => {
      acc.games += 1
      if (row.result === 'win') acc.wins += 1
      if (row.result === 'loss') acc.losses += 1
      acc.goals += Number(row.stat.goals) || 0
      acc.assists += Number(row.stat.assists) || 0
      acc.points +=
        row.stat.points !== null && row.stat.points !== undefined
          ? Number(row.stat.points) || 0
          : (Number(row.stat.goals) || 0) + (Number(row.stat.assists) || 0)
      acc.saves += Number(row.stat.gk_saves) || 0
      acc.shotsAgainst += Number(row.stat.gk_shots_against) || 0
      return acc
    },
    { games: 0, wins: 0, losses: 0, goals: 0, assists: 0, points: 0, saves: 0, shotsAgainst: 0 }
  )

  if (!player && !errorMessage) {
    return <div style={{ minHeight: '40vh' }} />
  }

  if (!player) {
    return <div style={{ padding: 24 }}>{errorMessage || 'Player not found.'}</div>
  }

  const primaryTeam = getPrimaryTeam(player.teams)
  const availableRoles = Array.from(new Set(stats.map((stat) => getStatRole(stat.position, player.position)))) as Array<'skater' | 'goalie'>

  return (
    <div style={container} className="motion-page-root">
      <div style={heroBand} className="motion-hero-card">
        <div>
          <div style={eyebrow}>Player Page</div>
          <h1 style={title}>{player.name} Game Log</h1>
          <div style={metaRow}>
            {primaryTeam?.id ? (
              <HoverPreviewLink href={`/team/${primaryTeam.id}`} entityType="team" entityId={primaryTeam.id} style={metaLink}>
                {primaryTeam.name}
              </HoverPreviewLink>
            ) : (
              <span>{primaryTeam?.name || 'No team'}</span>
            )}
            <span>/</span>
            <Link href={`/player/${player.id}`} style={metaLink}>
              Back to player
            </Link>
          </div>
        </div>
        <div style={summaryWrap}>
          <div style={summaryItem}>
            <span style={summaryLabel}>Games</span>
            <span style={summaryValue}>{summary.games}</span>
          </div>
          <div style={summaryItem}>
            <span style={summaryLabel}>Record</span>
            <span style={summaryValue}>{summary.wins}-{summary.losses}</span>
          </div>
          <div style={summaryItem}>
            <span style={summaryLabel}>{roleFilter === 'goalie' ? 'SV%' : 'PTS'}</span>
            <span style={summaryValue}>
              {roleFilter === 'goalie'
                ? formatSavePct(summary.saves, summary.shotsAgainst)
                : summary.points}
            </span>
          </div>
        </div>
      </div>

      <div style={shell} className="motion-section-card">
        <div style={toolbar}>
          <div style={filterGrid}>
            <select value={activeSeasonFilter} onChange={(event) => setSeasonFilter(event.target.value)} style={select}>
              <option value="all">All seasons</option>
              {seasonOptions.map((seasonLabel) => (
                <option key={seasonLabel} value={seasonLabel}>
                  {seasonLabel}
                </option>
              ))}
            </select>
            <select value={gameTypeFilter} onChange={(event) => setGameTypeFilter(event.target.value as 'all' | 'regular' | 'playoffs')} style={select}>
              <option value="all">Regular + Playoffs</option>
              <option value="regular">Regular</option>
              <option value="playoffs">Playoffs</option>
            </select>
            <select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value as 'all' | 'home' | 'away')} style={select}>
              <option value="all">Home + Away</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
            <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as 'all' | 'wins' | 'losses' | 'pending')} style={select}>
              <option value="all">All results</option>
              <option value="wins">Wins</option>
              <option value="losses">Losses</option>
              <option value="pending">Pending</option>
            </select>
            <select value={limit} onChange={(event) => setLimit(event.target.value as '25' | '50' | '100' | 'all')} style={select}>
              <option value="25">Latest 25</option>
              <option value="50">Latest 50</option>
              <option value="100">Latest 100</option>
              <option value="all">All rows</option>
            </select>
            {availableRoles.length > 1 ? (
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'skater' | 'goalie')} style={select}>
                <option value="skater">Skater Log</option>
                <option value="goalie">Goalie Log</option>
              </select>
            ) : null}
          </div>
        </div>

        <table style={table} className="motion-table">
          <thead>
            <tr style={tableHead}>
              <th style={thLeft}>Date</th>
              <th style={thLeft}>Season</th>
              <th style={thLeft}>Type</th>
              <th style={thLeft}>Venue</th>
              <th style={thLeft}>Matchup</th>
              <th style={thLeft}>Result</th>
              <th style={thRight}>GP</th>
              {roleFilter === 'goalie' ? (
                <>
                  <th style={thRight}>W</th>
                  <th style={thRight}>L</th>
                  <th style={thRight}>OTL</th>
                  <th style={thRight}>SVS</th>
                  <th style={thRight}>SA</th>
                  <th style={thRight}>SV%</th>
                  <th style={thRight}>GAA</th>
                </>
              ) : (
                <>
                  <th style={thRight}>G</th>
                  <th style={thRight}>A</th>
                  <th style={thRight}>PTS</th>
                  <th style={thRight}>+/-</th>
                  <th style={thRight}>SOG</th>
                  <th style={thRight}>TOI</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length ? (
              displayedRows.map((row) => {
                const { stat, match, team, opponent, matchupLabel, goalsAgainst, result, seasonLabel, typeLabel, isHome } = row
                const venueLabel = match && team ? (isHome ? 'Home' : 'Away') : '-'
                return (
                  <tr key={stat.id} style={tableRow}>
                    <td style={tdLeft}>{formatDate(match?.game_date)}</td>
                    <td style={tdLeft}>{seasonLabel}</td>
                    <td style={tdLeft}>{typeLabel}</td>
                    <td style={tdLeft}>{venueLabel}</td>
                    <td style={tdLeft}>
                      <div style={teamCell}>
                        {opponent?.logo_url ? (
                          <img src={opponent.logo_url} alt={opponent.name} style={teamLogo} />
                        ) : team?.logo_url ? (
                          <img src={team.logo_url} alt={team.name} style={teamLogo} />
                        ) : null}
                        {opponent?.id ? (
                          <HoverPreviewLink href={`/team/${opponent.id}`} entityType="team" entityId={opponent.id} style={tableTeamLink}>
                            {matchupLabel}
                          </HoverPreviewLink>
                        ) : (
                          <span>{matchupLabel}</span>
                        )}
                      </div>
                    </td>
                    <td style={tdLeft}>
                      <span
                        style={{
                          ...resultBadge,
                          ...(result === 'win'
                            ? resultWin
                            : result === 'loss'
                              ? resultLoss
                              : resultPending),
                        }}
                      >
                        {result === 'win' ? 'W' : result === 'loss' ? 'L' : '-'} {formatMatchScore(match)}
                      </span>
                    </td>
                    <td style={tdRight}>{stat.gp || 0}</td>
                    {roleFilter === 'goalie' ? (
                      <>
                        <td style={tdRight}>{stat.goalie_wins || 0}</td>
                        <td style={tdRight}>{stat.goalie_losses || 0}</td>
                        <td style={tdRight}>{stat.goalie_overtime_losses || 0}</td>
                        <td style={tdRight}>{stat.gk_saves || 0}</td>
                        <td style={tdRight}>{stat.gk_shots_against || 0}</td>
                        <td style={tdRight}>
                          {formatSavePct(Number(stat.gk_saves) || 0, Number(stat.gk_shots_against) || 0, stat.gk_percentage)}
                        </td>
                        <td style={tdRight}>{formatGaa(goalsAgainst, Number(stat.gp) || 0, Number(stat.toi) || 0)}</td>
                      </>
                    ) : (
                      <>
                        <td style={tdRight}>{stat.goals || 0}</td>
                        <td style={tdRight}>{stat.assists || 0}</td>
                        <td style={ptsCell}>{stat.points || 0}</td>
                        <td style={tdRight}>{formatPlusMinus(stat.plus_minus)}</td>
                        <td style={tdRight}>{stat.shots || 0}</td>
                        <td style={tdRight}>{stat.toi || 0}</td>
                      </>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr style={tableRow}>
                <td style={tdLeft} colSpan={roleFilter === 'goalie' ? 14 : 13}>
                  No game log rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const container = {
  maxWidth: 1180,
  margin: '18px auto 40px auto',
  fontFamily: 'var(--font-inter), sans-serif',
}

const heroBand = {
  background: 'linear-gradient(135deg, #12354b 0%, #0e5a75 100%)',
  borderRadius: 10,
  color: 'white',
  padding: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 14,
  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
}

const eyebrow = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  color: '#a8deef',
}

const title = {
  margin: '8px 0 10px',
  fontSize: 34,
  fontWeight: 700,
  lineHeight: 1,
}

const metaRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
  fontSize: 15,
}

const metaLink = {
  color: '#ffffff',
  textDecoration: 'none',
}

const summaryWrap = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap' as const,
}

const summaryItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.14)',
}

const summaryLabel = {
  color: '#a8deef',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
}

const summaryValue = {
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 800,
}

const shell = {
  background: '#fff',
  border: '1px solid #cfd8e1',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
}

const toolbar = {
  padding: 14,
  borderBottom: '1px solid #edf1f5',
  background: '#f8fbfd',
}

const filterGrid = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap' as const,
}

const select = {
  minWidth: 136,
  height: 36,
  border: '1px solid #cfd8e1',
  borderRadius: 8,
  background: '#fff',
  color: '#102f47',
  fontSize: 12,
  fontWeight: 600,
  padding: '0 10px',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 12,
}

const tableHead = {
  background: '#f3f6f9',
}

const thLeft = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  color: '#0f2f47',
  fontWeight: 800,
}

const thRight = {
  textAlign: 'right' as const,
  padding: '8px 10px',
  color: '#0f2f47',
  fontWeight: 800,
}

const tdLeft = {
  padding: '9px 10px',
  borderTop: '1px solid #edf1f5',
}

const tdRight = {
  textAlign: 'right' as const,
  padding: '9px 10px',
  borderTop: '1px solid #edf1f5',
}

const ptsCell = {
  ...tdRight,
  fontWeight: 700,
  color: '#0f2f47',
}

const tableRow = {
  background: '#fff',
}

const teamCell = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const teamLogo = {
  width: 18,
  height: 18,
  objectFit: 'contain' as const,
}

const tableTeamLink = {
  color: '#102f47',
  textDecoration: 'none',
  fontWeight: 600,
}

const resultBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 26,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap' as const,
}

const resultWin = {
  background: '#e7f7ec',
  color: '#18723a',
}

const resultLoss = {
  background: '#fbe9ea',
  color: '#b4232d',
}

const resultPending = {
  background: '#eef3f7',
  color: '#607182',
}
