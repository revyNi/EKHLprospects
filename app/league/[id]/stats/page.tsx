'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  country_code?: string | null
}

type TeamRecord = {
  id: string
  name: string
  league?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
}

type SeasonRecord = {
  id: string
  name: string
}

type StatRecord = {
  id: string
  player_id?: string | null
  team_id?: string | null
  season_id?: string | null
  game_type?: string | null
  gp?: number | null
  goals?: number | null
  assists?: number | null
  points?: number | null
  hits?: number | null
  plus_minus?: number | null
}

type StatTotals = {
  playerId: string
  playerName: string
  position?: string | null
  nationality?: string | null
  teamName?: string | null
  seasons: Set<string>
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  plusMinus: number
}

type TabKey = 'season' | 'allTime' | 'allTimeSeason' | 'allTimeTeam'

function normalizeLookupValue(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

function formatPosition(position?: string | null) {
  const value = position?.toUpperCase() || ''
  if (value.includes('G')) return 'G'
  if (value.includes('D')) return 'D'
  if (value.includes('W')) return 'W'
  if (value.includes('C')) return 'C'
  return value || 'F'
}

function calcPoints(goals?: number | null, assists?: number | null, points?: number | null) {
  if (points !== null && points !== undefined) return Number(points) || 0
  return (Number(goals) || 0) + (Number(assists) || 0)
}

export default function LeagueStatsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const identifier = decodeURIComponent(params.id as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [leagues, setLeagues] = useState<LeagueRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [stats, setStats] = useState<StatRecord[]>([])
  const [seasons, setSeasons] = useState<SeasonRecord[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [fromSeasonId, setFromSeasonId] = useState('')
  const [toSeasonId, setToSeasonId] = useState('')
  const [gameType, setGameType] = useState<'regular' | 'playoffs'>('regular')
  const [activeTab, setActiveTab] = useState<TabKey>('season')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const requestedTab = searchParams.get('tab')

    if (requestedTab === 'season' || requestedTab === 'allTime' || requestedTab === 'allTimeSeason' || requestedTab === 'allTimeTeam') {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    if (!identifier) return

    async function fetchStatsPage() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, display_name, country_code')

      if (leaguesError) {
        setLeague(null)
        setLeagues([])
        setTeams([])
        setPlayers([])
        setStats([])
        setSeasons([])
        setErrorMessage(leaguesError.message)
        setIsLoading(false)
        return
      }

      const leagueRows = (leaguesData as LeagueRecord[]) || []
      const normalizedIdentifier = normalizeLookupValue(identifier)
      const leagueRecord =
        leagueRows.find((row) => String(row.id) === identifier) ||
        leagueRows.find((row) =>
          [row.name, row.display_name]
            .filter(Boolean)
            .some((value) => normalizeLookupValue(value) === normalizedIdentifier)
        ) ||
        null

      if (!leagueRecord) {
        setLeague(null)
        setLeagues(leagueRows)
        setTeams([])
        setPlayers([])
        setStats([])
        setSeasons([])
        setErrorMessage('League not found.')
        setIsLoading(false)
        return
      }

      const leagueNames = [leagueRecord.name, leagueRecord.display_name].filter(Boolean) as string[]

      const [
        { data: teamsData, error: teamsError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, league')
          .in('league', leagueNames.length ? leagueNames : [leagueRecord.name])
          .order('name', { ascending: true }),
        supabase.from('seasons').select('id, name').order('name', { ascending: true }),
      ])

      if (teamsError || seasonsError) {
        setLeague(leagueRecord)
        setLeagues(leagueRows)
        setTeams((teamsData as TeamRecord[]) || [])
        setPlayers([])
        setStats([])
        setSeasons((seasonsData as SeasonRecord[]) || [])
        setErrorMessage(teamsError?.message || seasonsError?.message || '')
        setIsLoading(false)
        return
      }

      const teamRows = (teamsData as TeamRecord[]) || []
      const teamIds = teamRows.map((team) => team.id)

      let statsRows: StatRecord[] = []
      let playerRows: PlayerRecord[] = []

      if (teamIds.length) {
        const { data: statsData, error: statsError } = await supabase
          .from('stats')
          .select('id, player_id, team_id, season_id, game_type, gp, goals, assists, points, hits, plus_minus')
          .in('team_id', teamIds)

        if (statsError) {
          setErrorMessage(statsError.message)
        } else {
          statsRows = (statsData as StatRecord[]) || []
          const playerIds = Array.from(
            new Set(statsRows.map((row) => row.player_id).filter(Boolean))
          ) as string[]

          if (playerIds.length) {
            const { data: playersData } = await supabase
              .from('players')
              .select('id, name, position, nationality')
              .in('id', playerIds)

            playerRows = (playersData as PlayerRecord[]) || []
          }
        }
      }

      const seasonRows = (seasonsData as SeasonRecord[]) || []
      const usedSeasonIds = Array.from(
        new Set(statsRows.map((row) => row.season_id).filter(Boolean))
      ) as string[]
      const availableSeasons = seasonRows.filter((season) =>
        usedSeasonIds.includes(String(season.id))
      )

      setLeague(leagueRecord)
      setLeagues(leagueRows)
      setTeams(teamRows)
      setPlayers(playerRows)
      setStats(statsRows)
      setSeasons(availableSeasons)
      setSelectedSeasonId(availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || '')
      setFromSeasonId(availableSeasons[0]?.id || '')
      setToSeasonId(availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || '')
      setIsLoading(false)
    }

    fetchStatsPage()
  }, [identifier])

  const teamsById = useMemo(() => new Map(teams.map((team) => [String(team.id), team])), [teams])
  const playersById = useMemo(() => new Map(players.map((player) => [String(player.id), player])), [players])
  const seasonsById = useMemo(() => new Map(seasons.map((season) => [String(season.id), season.name])), [seasons])
  const seasonOrder = useMemo(() => seasons.map((season) => String(season.id)), [seasons])
  const seasonIndexById = useMemo(
    () => new Map(seasonOrder.map((id, index) => [id, index])),
    [seasonOrder]
  )

  const activeLeagueId = league?.id || ''
  const activeLeagueName = league?.name || ''
  const selectedSeasonName = seasonsById.get(String(selectedSeasonId)) || ''
  const contextLabel = searchParams.get('context')?.trim() || ''
  const tabLabel =
    activeTab === 'season'
      ? gameType === 'playoffs'
        ? 'Playoffs'
        : 'Regular Season'
      : activeTab === 'allTime'
        ? 'All-Time'
        : activeTab === 'allTimeSeason'
          ? 'All-time / Season'
          : 'All-time / Team'
  const headerTitle = activeLeagueName ? `${activeLeagueName} ${tabLabel} Stats` : 'League Stats'

  const matchesGameType = (row: StatRecord) => {
    const normalized = (row.game_type || 'regular').toLowerCase()
    return gameType === 'playoffs' ? normalized === 'playoffs' : normalized !== 'playoffs'
  }

  const isInSeasonRange = (seasonId?: string | null) => {
    if (!fromSeasonId && !toSeasonId) return true
    if (!seasonId) return false
    const index = seasonIndexById.get(String(seasonId))
    if (index === undefined) return false
    const fromIndex = fromSeasonId ? seasonIndexById.get(String(fromSeasonId)) ?? 0 : 0
    const toIndex = toSeasonId
      ? seasonIndexById.get(String(toSeasonId)) ?? seasonOrder.length - 1
      : seasonOrder.length - 1
    const minIndex = Math.min(fromIndex, toIndex)
    const maxIndex = Math.max(fromIndex, toIndex)
    return index >= minIndex && index <= maxIndex
  }

  const filteredStats = stats.filter((row) => matchesGameType(row) && isInSeasonRange(row.season_id))
  const seasonStats = filteredStats.filter((row) =>
    selectedSeasonId ? String(row.season_id) === String(selectedSeasonId) : true
  )

  const seasonTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    seasonStats.forEach((row) => {
      if (!row.player_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return

      const key = String(row.player_id)
      const teamName = row.team_id ? teamsById.get(String(row.team_id))?.name || null : null
      const points = calcPoints(row.goals, row.assists, row.points)

      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          teamName,
          seasons: new Set(),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
        })
      }

      const entry = totals.get(key)!
      entry.seasons.add(String(row.season_id || ''))
      entry.gp += Number(row.gp) || 0
      entry.goals += Number(row.goals) || 0
      entry.assists += Number(row.assists) || 0
      entry.points += points
      entry.hits += Number(row.hits) || 0
      entry.plusMinus += Number(row.plus_minus) || 0

      if (teamName && entry.teamName && entry.teamName !== teamName) {
        entry.teamName = 'Multiple'
      } else if (teamName && !entry.teamName) {
        entry.teamName = teamName
      }
    })

    return Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)
  }, [seasonStats, playersById, teamsById])

  const allTimeTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    filteredStats.forEach((row) => {
      if (!row.player_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return
      const key = String(row.player_id)
      const points = calcPoints(row.goals, row.assists, row.points)
      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          teamName: null,
          seasons: new Set(),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
        })
      }
      const entry = totals.get(key)!
      entry.seasons.add(String(row.season_id || ''))
      entry.gp += Number(row.gp) || 0
      entry.goals += Number(row.goals) || 0
      entry.assists += Number(row.assists) || 0
      entry.points += points
      entry.hits += Number(row.hits) || 0
      entry.plusMinus += Number(row.plus_minus) || 0
    })

    return Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)
  }, [filteredStats, playersById])

  const allTimeSeasonTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    filteredStats.forEach((row) => {
      if (!row.player_id || !row.season_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return
      const key = `${row.player_id}-${row.season_id}`
      const points = calcPoints(row.goals, row.assists, row.points)
      const teamName = row.team_id ? teamsById.get(String(row.team_id))?.name || null : null

      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          teamName,
          seasons: new Set([String(row.season_id)]),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
        })
      }

      const entry = totals.get(key)!
      entry.gp += Number(row.gp) || 0
      entry.goals += Number(row.goals) || 0
      entry.assists += Number(row.assists) || 0
      entry.points += points
      entry.hits += Number(row.hits) || 0
      entry.plusMinus += Number(row.plus_minus) || 0

      if (teamName && entry.teamName && entry.teamName !== teamName) {
        entry.teamName = 'Multiple'
      } else if (teamName && !entry.teamName) {
        entry.teamName = teamName
      }
    })

    return Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)
  }, [filteredStats, playersById, teamsById])

  const allTimeTeamTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    filteredStats.forEach((row) => {
      if (!row.player_id || !row.team_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return
      const key = `${row.player_id}-${row.team_id}`
      const points = calcPoints(row.goals, row.assists, row.points)
      const teamName = teamsById.get(String(row.team_id))?.name || null

      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          teamName,
          seasons: new Set(),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
        })
      }

      const entry = totals.get(key)!
      entry.seasons.add(String(row.season_id || ''))
      entry.gp += Number(row.gp) || 0
      entry.goals += Number(row.goals) || 0
      entry.assists += Number(row.assists) || 0
      entry.points += points
      entry.hits += Number(row.hits) || 0
      entry.plusMinus += Number(row.plus_minus) || 0
    })

    return Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)
  }, [filteredStats, playersById, teamsById])

  const leagueFlagUrl = getFlagUrl(league?.country_code)

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={headerRow}>
          <div>
            <div style={pageTitle}>{headerTitle}</div>
            <div style={leagueMetaRow}>
              {leagueFlagUrl ? <img src={leagueFlagUrl} alt={league?.name || ''} style={leagueFlag} /> : null}
              <span style={leagueMetaText}>{activeLeagueName || 'League'}</span>
            </div>
          </div>
          <select
            value={activeLeagueId}
            onChange={(event) => {
              const nextId = event.target.value
              if (nextId) {
                router.push(`/league/${encodeURIComponent(nextId)}/stats`)
              }
            }}
            style={leagueSelect}
          >
            {leagues.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div style={tabsRow}>
          <button type="button" onClick={() => setActiveTab('season')} style={activeTab === 'season' ? tabActive : tab}>
            Season
          </button>
          <button type="button" onClick={() => setActiveTab('allTime')} style={activeTab === 'allTime' ? tabActive : tab}>
            All-Time
          </button>
          <button type="button" onClick={() => setActiveTab('allTimeSeason')} style={activeTab === 'allTimeSeason' ? tabActive : tab}>
            All-time / Season
          </button>
          <button type="button" onClick={() => setActiveTab('allTimeTeam')} style={activeTab === 'allTimeTeam' ? tabActive : tab}>
            All-time / Team
          </button>
        </div>

        <div style={filtersCard}>
          <div style={filtersRow}>
            <label style={filterLabel}>
              Regular Season
              <select
                value={gameType}
                onChange={(event) => setGameType(event.target.value as 'regular' | 'playoffs')}
                style={filterSelect}
              >
                <option value="regular">Regular Season</option>
                <option value="playoffs">Playoffs</option>
              </select>
            </label>

            {activeTab === 'season' ? (
              <label style={filterLabel}>
                Season
                <select
                  value={selectedSeasonId}
                  onChange={(event) => setSelectedSeasonId(event.target.value)}
                  style={filterSelect}
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label style={filterLabel}>
                  From Season
                  <select
                    value={fromSeasonId}
                    onChange={(event) => setFromSeasonId(event.target.value)}
                    style={filterSelect}
                  >
                    <option value="">Any</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={filterLabel}>
                  To Season
                  <select
                    value={toSeasonId}
                    onChange={(event) => setToSeasonId(event.target.value)}
                    style={filterSelect}
                  >
                    <option value="">Any</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}

        {activeTab === 'season' ? (
          <StatsTable
            title={
              contextLabel
                ? contextLabel.toUpperCase()
                : `${selectedSeasonName || 'Season'} ${gameType === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'} PLAYER STATS`
            }
            rows={seasonTotals}
            teamsById={teamsById}
            seasonsById={seasonsById}
            showSeason={false}
            showTeam
            showPeriod={false}
            showYears={false}
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTime' ? (
          <StatsTable
            title={
              contextLabel
                ? contextLabel.toUpperCase()
                : `ALL-TIME TOTALS ${gameType === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'} PLAYER STATS`
            }
            rows={allTimeTotals}
            teamsById={teamsById}
            seasonsById={seasonsById}
            showSeason={false}
            showTeam={false}
            showPeriod
            showYears
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTimeSeason' ? (
          <StatsTable
            title={
              contextLabel
                ? contextLabel.toUpperCase()
                : `ALL-TIME SEASON ${gameType === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'} PLAYER STATS`
            }
            rows={allTimeSeasonTotals}
            teamsById={teamsById}
            seasonsById={seasonsById}
            showSeason
            showTeam
            showPeriod={false}
            showYears={false}
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTimeTeam' ? (
          <StatsTable
            title={
              contextLabel
                ? contextLabel.toUpperCase()
                : `ALL-TIME TOTALS/TEAM ${gameType === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'} PLAYER STATS`
            }
            rows={allTimeTeamTotals}
            teamsById={teamsById}
            seasonsById={seasonsById}
            showSeason={false}
            showTeam
            showPeriod
            showYears
            isLoading={isLoading}
          />
        ) : null}
      </div>
    </div>
  )
}

function StatsTable({
  title,
  rows,
  teamsById,
  seasonsById,
  showSeason,
  showTeam,
  showPeriod,
  showYears,
  isLoading,
}: {
  title: string
  rows: StatTotals[]
  teamsById: Map<string, TeamRecord>
  seasonsById: Map<string, string>
  showSeason: boolean
  showTeam: boolean
  showPeriod: boolean
  showYears: boolean
  isLoading: boolean
}) {
  return (
    <div style={tableCard}>
      <div style={tableTitle}>{title}</div>
      <table style={table}>
        <thead>
          <tr style={tableHead}>
            <th style={rankTh}>#</th>
            <th style={playerTh}>PLAYER</th>
            {showSeason ? <th style={seasonTh}>SEASON</th> : null}
            {showTeam ? <th style={teamTh}>TEAM</th> : null}
            <th style={statTh}>GP</th>
            <th style={statTh}>G</th>
            <th style={statTh}>A</th>
            <th style={statTh}>TP</th>
            <th style={statTh}>PPG</th>
            <th style={statTh}>HITS</th>
            <th style={statTh}>+/-</th>
            {showPeriod ? <th style={statTh}>PERIOD</th> : null}
            {showYears ? <th style={statTh}>YEARS</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const flagUrl = getFlagUrl(row.nationality)
            const seasons = Array.from(row.seasons).filter(Boolean)
            const seasonLabel = seasons.length ? seasonsById.get(seasons[0]) || seasons[0] : '-'
            const years = seasons.length
            const sortedSeasons = seasons
              .map((id) => seasonsById.get(id) || id)
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b))
            const period =
              sortedSeasons.length > 1
                ? `${sortedSeasons[0]} - ${sortedSeasons[sortedSeasons.length - 1]}`
                : sortedSeasons[0] || '-'
            const ppg = row.gp ? (row.points / row.gp).toFixed(2) : '0.00'
            const teamLabel =
              row.teamName ||
              (row.teamName === 'Multiple' ? 'Multiple' : null) ||
              (showTeam && row.teamName ? row.teamName : '-') ||
              '-'

            return (
              <tr key={`${row.playerId}-${index}`} style={index % 2 === 0 ? tableRowAlt : tableRow}>
                <td style={rankTd}>{index + 1}.</td>
                <td style={playerTd}>
                  <Link href={`/player/${row.playerId}`} style={playerLink}>
                    {flagUrl ? <img src={flagUrl} alt={row.nationality || ''} style={playerFlag} /> : null}
                    <span>
                      {row.playerName} ({formatPosition(row.position)})
                    </span>
                  </Link>
                </td>
                {showSeason ? <td style={seasonTd}>{seasonLabel}</td> : null}
                {showTeam ? <td style={teamTd}>{teamLabel}</td> : null}
                <td style={statTd}>{row.gp}</td>
                <td style={statTd}>{row.goals}</td>
                <td style={statTd}>{row.assists}</td>
                <td style={statPrimaryTd}>{row.points}</td>
                <td style={statTd}>{ppg}</td>
                <td style={statTd}>{row.hits}</td>
                <td style={statTd}>{row.plusMinus}</td>
                {showPeriod ? <td style={statTd}>{period}</td> : null}
                {showYears ? <td style={statTd}>{years}</td> : null}
              </tr>
            )
          })}
          {!rows.length ? (
            <tr style={tableRow}>
              <td colSpan={12} style={emptyText}>
                {isLoading ? 'Loading...' : 'No stats available for this filter.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

const pageWrap = {
  minHeight: '100vh',
  background: '#e9edf3',
  padding: '24px 12px',
  fontFamily: 'var(--font-inter), sans-serif',
  color: '#173650',
}

const shell = {
  maxWidth: 1120,
  margin: '0 auto',
}

const headerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 4px 18px',
}

const pageTitle = {
  fontSize: 22,
  fontWeight: 800,
  color: '#102f47',
  marginBottom: 6,
}

const leagueMetaRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const leagueMetaText = {
  color: '#2a73ad',
  fontSize: 12,
  fontWeight: 700,
}

const leagueFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #bcc6cf',
}

const leagueSelect = {
  height: 28,
  border: '1px solid #c8d2db',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 700,
  color: '#173650',
}

const tabsRow = {
  display: 'flex',
  gap: 8,
  marginBottom: 12,
}

const tab = {
  border: '1px solid #173650',
  background: '#fff',
  color: '#173650',
  padding: '6px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 700,
}

const tabActive = {
  ...tab,
  background: '#123f58',
  color: '#fff',
  border: '1px solid #123f58',
}

const filtersCard = {
  border: '1px solid #cfd8e2',
  borderRadius: 4,
  background: '#fff',
  padding: 10,
  marginBottom: 14,
}

const filtersRow = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 10,
}

const filterLabel = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  color: '#173650',
}

const filterSelect = {
  height: 26,
  border: '1px solid #c8d2db',
  borderRadius: 6,
  padding: '0 8px',
  fontSize: 11,
}

const tableCard = {
  border: '1px solid #bdc9d5',
  borderRadius: 4,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  marginBottom: 16,
}

const tableTitle = {
  background: '#123f58',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
  textTransform: 'uppercase' as const,
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 12,
}

const tableHead = {
  background: '#c51e2d',
}

const rankTh = {
  color: '#fff',
  padding: '6px 6px',
  textAlign: 'left' as const,
  width: 32,
}

const playerTh = {
  color: '#fff',
  padding: '6px 8px',
  textAlign: 'left' as const,
}

const seasonTh = {
  color: '#fff',
  padding: '6px 8px',
  textAlign: 'left' as const,
  width: 110,
}

const teamTh = {
  color: '#fff',
  padding: '6px 8px',
  textAlign: 'left' as const,
  width: 160,
}

const statTh = {
  color: '#fff',
  padding: '6px 6px',
  textAlign: 'center' as const,
}

const tableRow = {
  background: '#fff',
}

const tableRowAlt = {
  background: '#eef1f5',
}

const rankTd = {
  padding: '6px 6px',
  color: '#1d3447',
}

const playerTd = {
  padding: '6px 8px',
}

const playerLink = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#2a73ad',
  textDecoration: 'none',
  fontWeight: 600,
}

const playerFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #bcc6cf',
}

const seasonTd = {
  padding: '6px 8px',
  color: '#173650',
}

const teamTd = {
  padding: '6px 8px',
  color: '#173650',
}

const statTd = {
  padding: '6px 6px',
  textAlign: 'center' as const,
  color: '#173650',
}

const statPrimaryTd = {
  ...statTd,
  fontWeight: 800,
}

const emptyText = {
  padding: '12px 10px',
  textAlign: 'center' as const,
  color: '#748497',
}

const errorText = {
  margin: '0 4px 12px',
  padding: '10px 12px',
  border: '1px solid #d9c5c7',
  borderRadius: 4,
  background: '#fff5f5',
  color: '#c1272d',
  fontSize: 12,
}
