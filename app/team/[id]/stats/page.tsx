'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

type TeamRecord = {
  id: string
  name: string
  league?: string | null
  country?: string | null
  country_code?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
}

type LeagueRecord = {
  id: string
  name: string
  country_code?: string | null
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
  gk_saves?: number | null
  gk_shots_against?: number | null
  gk_percentage?: number | null
  goalie_shutouts?: number | null
  goalie_goals_against?: number | null
}

type StatTotals = {
  playerId: string
  playerName: string
  position?: string | null
  nationality?: string | null
  seasons: Set<string>
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  plusMinus: number
  saves: number
  shotsAgainst: number
  savePct: number
  shutouts: number
  goalsAgainst: number
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

function getPositionGroup(position?: string | null) {
  const value = position?.toUpperCase() || ''
  if (value.includes('G')) return 'G'
  if (value.includes('D')) return 'D'
  return 'C'
}

function calcPoints(goals?: number | null, assists?: number | null, points?: number | null) {
  if (points !== null && points !== undefined) return Number(points) || 0
  return (Number(goals) || 0) + (Number(assists) || 0)
}

function formatSavePct(value?: number | null, saves?: number, shotsAgainst?: number) {
  if (value && Number.isFinite(Number(value))) {
    return Number(value).toFixed(3)
  }
  const against = Number(shotsAgainst) || 0
  if (!against) return '0'
  return ((Number(saves) || 0) / against).toFixed(3)
}

function formatGaa(goalsAgainst?: number, gp?: number, saves?: number, shotsAgainst?: number) {
  const gamesPlayed = Number(gp) || 0
  if (!gamesPlayed) return '0.00'
  const against = Number(goalsAgainst) || Math.max((Number(shotsAgainst) || 0) - (Number(saves) || 0), 0)
  return (against / gamesPlayed).toFixed(2)
}

export default function TeamStatsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const teamId = params.id as string

  const [team, setTeam] = useState<TeamRecord | null>(null)
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [leagues, setLeagues] = useState<LeagueRecord[]>([])
  const [stats, setStats] = useState<StatRecord[]>([])
  const [seasons, setSeasons] = useState<SeasonRecord[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [fromSeasonId, setFromSeasonId] = useState('')
  const [toSeasonId, setToSeasonId] = useState('')
  const [gameType, setGameType] = useState<'regular' | 'playoffs'>('regular')
  const [activeTab, setActiveTab] = useState<TabKey>('season')
  const [activeCategory, setActiveCategory] = useState<'skaters' | 'goalies'>('skaters')
  const [positionFilter, setPositionFilter] = useState('')
  const [nationalityFilter, setNationalityFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    const requestedCategory = searchParams.get('category')

    if (requestedTab === 'season' || requestedTab === 'allTime' || requestedTab === 'allTimeSeason' || requestedTab === 'allTimeTeam') {
      setActiveTab(requestedTab)
    }

    if (requestedCategory === 'skaters' || requestedCategory === 'goalies') {
      setActiveCategory(requestedCategory)
    }
  }, [searchParams])

  useEffect(() => {
    if (!teamId) return

    async function fetchStatsPage() {
      setIsLoading(true)
      setErrorMessage('')

      const [{ data: teamData, error: teamError }, { data: leaguesData }, { data: seasonsData }] =
        await Promise.all([
          supabase.from('teams').select('id, name, league, country, country_code').eq('id', teamId).single(),
          supabase.from('leagues').select('id, name, country_code').order('name', { ascending: true }),
          supabase.from('seasons').select('id, name').order('name', { ascending: true }),
        ])

      if (teamError || !teamData) {
        setTeam(null)
        setPlayers([])
        setStats([])
        setSeasons([])
        setLeagues([])
        setErrorMessage(teamError?.message || 'Team not found.')
        setIsLoading(false)
        return
      }

      const { data: statsData, error: statsError } = await supabase
        .from('stats')
        .select('id, player_id, team_id, season_id, game_type, gp, goals, assists, points, hits, plus_minus, gk_saves, gk_shots_against, gk_percentage, goalie_shutouts, goalie_goals_against')
        .eq('team_id', teamId)

      if (statsError) {
        setTeam(teamData as TeamRecord)
        setPlayers([])
        setStats([])
        setSeasons((seasonsData as SeasonRecord[]) || [])
        setLeagues((leaguesData as LeagueRecord[]) || [])
        setErrorMessage(statsError.message)
        setIsLoading(false)
        return
      }

      const statsRows = (statsData as StatRecord[]) || []
      const playerIds = Array.from(new Set(statsRows.map((row) => row.player_id).filter(Boolean))) as string[]
      const { data: playersData } = playerIds.length
        ? await supabase.from('players').select('id, name, position, nationality').in('id', playerIds)
        : { data: [] }

      const seasonRows = (seasonsData as SeasonRecord[]) || []
      const usedSeasonIds = Array.from(new Set(statsRows.map((row) => row.season_id).filter(Boolean))) as string[]
      const availableSeasons = seasonRows.filter((season) => usedSeasonIds.includes(String(season.id)))

      setTeam(teamData as TeamRecord)
      setPlayers((playersData as PlayerRecord[]) || [])
      setStats(statsRows)
      setLeagues((leaguesData as LeagueRecord[]) || [])
      setSeasons(availableSeasons)
      setSelectedSeasonId(availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || '')
      setFromSeasonId(availableSeasons[0]?.id || '')
      setToSeasonId(availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || '')
      setIsLoading(false)
    }

    fetchStatsPage()
  }, [teamId])

  const playersById = useMemo(() => new Map(players.map((player) => [String(player.id), player])), [players])
  const seasonsById = useMemo(() => new Map(seasons.map((season) => [String(season.id), season.name])), [seasons])
  const seasonOrder = useMemo(() => seasons.map((season) => String(season.id)), [seasons])
  const seasonIndexById = useMemo(
    () => new Map(seasonOrder.map((id, index) => [id, index])),
    [seasonOrder]
  )

  const teamLeagueRecord =
    team?.league &&
    leagues.find((league) => normalizeLookupValue(league.name) === normalizeLookupValue(team.league))
  const leagueOptions = [
    { id: 'all', name: 'All Leagues + Tournaments' },
    ...(teamLeagueRecord ? [{ id: teamLeagueRecord.id, name: teamLeagueRecord.name }] : []),
  ]

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

  const filteredByLeague = (rows: StatTotals[]) => {
    if (leagueFilter === 'all') return rows
    return rows.filter(() => teamLeagueRecord && teamLeagueRecord.id === leagueFilter)
  }

  const filteredByPositionNationality = (rows: StatTotals[]) => {
    return rows.filter((row) => {
      if (activeCategory === 'goalies' && getPositionGroup(row.position) !== 'G') return false
      if (activeCategory === 'skaters' && getPositionGroup(row.position) === 'G') return false
      if (positionFilter && formatPosition(row.position) !== positionFilter) return false
      if (nationalityFilter && (row.nationality || '').toUpperCase() !== nationalityFilter) return false
      return true
    })
  }

  const buildTotals = (rows: StatRecord[]) => {
    const totals = new Map<string, StatTotals>()
    rows.forEach((row) => {
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
          seasons: new Set(),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
          saves: 0,
          shotsAgainst: 0,
          savePct: 0,
          shutouts: 0,
          goalsAgainst: 0,
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
      entry.saves += Number(row.gk_saves) || 0
      entry.shotsAgainst += Number(row.gk_shots_against) || 0
      entry.shutouts += Number(row.goalie_shutouts) || 0
      entry.goalsAgainst +=
        row.goalie_goals_against !== null && row.goalie_goals_against !== undefined
          ? Number(row.goalie_goals_against) || 0
          : Math.max((Number(row.gk_shots_against) || 0) - (Number(row.gk_saves) || 0), 0)
    })
    return Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)
  }

  const seasonTotals = useMemo(
    () => filteredByPositionNationality(filteredByLeague(buildTotals(seasonStats))),
    [seasonStats, activeCategory, positionFilter, nationalityFilter, leagueFilter]
  )
  const allTimeTotals = useMemo(
    () => filteredByPositionNationality(filteredByLeague(buildTotals(filteredStats))),
    [filteredStats, activeCategory, positionFilter, nationalityFilter, leagueFilter]
  )

  const allTimeSeasonTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    filteredStats.forEach((row) => {
      if (!row.player_id || !row.season_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return
      const key = `${row.player_id}-${row.season_id}`
      const points = calcPoints(row.goals, row.assists, row.points)

      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          seasons: new Set([String(row.season_id)]),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
          saves: 0,
          shotsAgainst: 0,
          savePct: 0,
          shutouts: 0,
          goalsAgainst: 0,
        })
      }

      const entry = totals.get(key)!
      entry.gp += Number(row.gp) || 0
      entry.goals += Number(row.goals) || 0
      entry.assists += Number(row.assists) || 0
      entry.points += points
      entry.hits += Number(row.hits) || 0
      entry.plusMinus += Number(row.plus_minus) || 0
      entry.saves += Number(row.gk_saves) || 0
      entry.shotsAgainst += Number(row.gk_shots_against) || 0
      entry.shutouts += Number(row.goalie_shutouts) || 0
      entry.goalsAgainst +=
        row.goalie_goals_against !== null && row.goalie_goals_against !== undefined
          ? Number(row.goalie_goals_against) || 0
          : Math.max((Number(row.gk_shots_against) || 0) - (Number(row.gk_saves) || 0), 0)
    })

    return filteredByPositionNationality(filteredByLeague(Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)))
  }, [filteredStats, activeCategory, positionFilter, nationalityFilter, leagueFilter, playersById])

  const allTimeTeamTotals = useMemo(() => {
    const totals = new Map<string, StatTotals>()
    filteredStats.forEach((row) => {
      if (!row.player_id || !row.team_id) return
      const player = playersById.get(String(row.player_id))
      if (!player) return
      const key = `${row.player_id}-${row.team_id}`
      const points = calcPoints(row.goals, row.assists, row.points)

      if (!totals.has(key)) {
        totals.set(key, {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          seasons: new Set(),
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          plusMinus: 0,
          saves: 0,
          shotsAgainst: 0,
          savePct: 0,
          shutouts: 0,
          goalsAgainst: 0,
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
      entry.saves += Number(row.gk_saves) || 0
      entry.shotsAgainst += Number(row.gk_shots_against) || 0
      entry.shutouts += Number(row.goalie_shutouts) || 0
      entry.goalsAgainst +=
        row.goalie_goals_against !== null && row.goalie_goals_against !== undefined
          ? Number(row.goalie_goals_against) || 0
          : Math.max((Number(row.gk_shots_against) || 0) - (Number(row.gk_saves) || 0), 0)
    })

    return filteredByPositionNationality(filteredByLeague(Array.from(totals.values()).sort((a, b) => b.points - a.points || b.goals - a.goals)))
  }, [filteredStats, activeCategory, positionFilter, nationalityFilter, leagueFilter, playersById])

  const nationalityOptions = Array.from(
    new Set(players.map((player) => (player.nationality || '').trim().toUpperCase()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))
  const positionOptions = Array.from(
    new Set(players.map((player) => formatPosition(player.position)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const teamFlagUrl = getFlagUrl(team?.country_code)
  const contextLabel = searchParams.get('context')?.trim() || ''
  const showCategoryTabs = !contextLabel
  const tabLabel =
    activeTab === 'season'
      ? gameType === 'playoffs'
        ? 'Playoffs'
        : 'Regular Season'
      : activeTab === 'allTime'
        ? 'All-Time'
        : activeTab === 'allTimeSeason'
          ? 'Totals / Season'
          : 'Totals / League'
  const statEntityLabel = activeCategory === 'goalies' ? 'GOALIE' : 'PLAYER'
  const headerTitle = team?.name ? `${team.name} ${tabLabel} Stats` : 'Team Stats'

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={headerRow}>
          <div>
            <div style={pageTitle}>{headerTitle}</div>
            <div style={leagueMetaRow}>
              {teamFlagUrl ? <img src={teamFlagUrl} alt={team?.name || ''} style={leagueFlag} /> : null}
              <span style={leagueMetaText}>{team?.country || ''}</span>
            </div>
          </div>
          <div style={headerLinks}>
            {team?.league ? <div style={headerSubLink}>Team Information and Facts</div> : null}
          </div>
        </div>

        {showCategoryTabs ? (
          <div style={categoryTabs}>
            <button type="button" onClick={() => setActiveCategory('skaters')} style={activeCategory === 'skaters' ? categoryTabActive : categoryTab}>
              SKATERS
            </button>
            <button type="button" onClick={() => setActiveCategory('goalies')} style={activeCategory === 'goalies' ? categoryTabActive : categoryTab}>
              GOALIES
            </button>
          </div>
        ) : null}

        <div style={filtersCard}>
          <div style={filtersRow}>
            <label style={filterLabel}>
              Positions
              <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} style={filterSelect}>
                <option value="">Positions</option>
                {positionOptions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </label>
            <label style={filterLabel}>
              Leagues
              <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)} style={filterSelect}>
                {leagueOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={filterLabel}>
              Nationalities
              <select value={nationalityFilter} onChange={(event) => setNationalityFilter(event.target.value)} style={filterSelect}>
                <option value="">Nationalities</option>
                {nationalityOptions.map((nat) => (
                  <option key={nat} value={nat}>
                    {nat}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setPositionFilter('')
                setLeagueFilter('all')
                setNationalityFilter('')
              }}
              style={resetButton}
            >
              RESET FILTER
            </button>
          </div>
        </div>

        <div style={tabsRow}>
          <button type="button" onClick={() => setActiveTab('season')} style={activeTab === 'season' ? tabActive : tab}>
            Season
          </button>
          <button type="button" onClick={() => setActiveTab('allTime')} style={activeTab === 'allTime' ? tabActive : tab}>
            All-Time Totals
          </button>
          <button type="button" onClick={() => setActiveTab('allTimeSeason')} style={activeTab === 'allTimeSeason' ? tabActive : tab}>
            Totals / Season
          </button>
          <button type="button" onClick={() => setActiveTab('allTimeTeam')} style={activeTab === 'allTimeTeam' ? tabActive : tab}>
            Totals / League
          </button>
        </div>

        <div style={filtersCard}>
          <div style={filtersRow}>
            <label style={filterLabel}>
              Regular Season
              <select value={gameType} onChange={(event) => setGameType(event.target.value as 'regular' | 'playoffs')} style={filterSelect}>
                <option value="regular">Regular Season</option>
                <option value="playoffs">Playoffs</option>
              </select>
            </label>
            {activeTab === 'season' ? (
              <label style={filterLabel}>
                Season
                <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={filterSelect}>
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
                  <select value={fromSeasonId} onChange={(event) => setFromSeasonId(event.target.value)} style={filterSelect}>
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
                  <select value={toSeasonId} onChange={(event) => setToSeasonId(event.target.value)} style={filterSelect}>
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
                : `${seasonsById.get(String(selectedSeasonId)) || 'Season'} ${gameType === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'} ${statEntityLabel} STATS`
            }
            rows={seasonTotals}
            seasonsById={seasonsById}
            showSeason={false}
            showPeriod={false}
            showYears={false}
            category={activeCategory}
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTime' ? (
          <StatsTable
            title={contextLabel ? contextLabel.toUpperCase() : `ALL TIME ${statEntityLabel} STATS`}
            rows={allTimeTotals}
            seasonsById={seasonsById}
            showSeason={false}
            showPeriod
            showYears
            category={activeCategory}
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTimeSeason' ? (
          <StatsTable
            title={contextLabel ? contextLabel.toUpperCase() : `ALL TIME SEASON ${statEntityLabel} STATS`}
            rows={allTimeSeasonTotals}
            seasonsById={seasonsById}
            showSeason
            showPeriod={false}
            showYears={false}
            category={activeCategory}
            isLoading={isLoading}
          />
        ) : null}

        {activeTab === 'allTimeTeam' ? (
          <StatsTable
            title={contextLabel ? contextLabel.toUpperCase() : `ALL TIME TOTALS/TEAM ${statEntityLabel} STATS`}
            rows={allTimeTeamTotals}
            seasonsById={seasonsById}
            showSeason={false}
            showPeriod
            showYears
            category={activeCategory}
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
  seasonsById,
  showSeason,
  showPeriod,
  showYears,
  category,
  isLoading,
}: {
  title: string
  rows: StatTotals[]
  seasonsById: Map<string, string>
  showSeason: boolean
  showPeriod: boolean
  showYears: boolean
  category: 'skaters' | 'goalies'
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
            <th style={statTh}>GP</th>
            {category === 'goalies' ? (
              <>
                <th style={statTh}>SVS</th>
                <th style={statTh}>SO</th>
                <th style={statTh}>SV%</th>
                <th style={statTh}>GAA</th>
              </>
            ) : (
              <>
                <th style={statTh}>G</th>
                <th style={statTh}>A</th>
                <th style={statTh}>TP</th>
                <th style={statTh}>PPG</th>
                <th style={statTh}>HITS</th>
                <th style={statTh}>+/-</th>
              </>
            )}
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
                <td style={statTd}>{row.gp}</td>
                {category === 'goalies' ? (
                  <>
                    <td style={statTd}>{row.saves}</td>
                    <td style={statTd}>{row.shutouts}</td>
                    <td style={statPrimaryTd}>{formatSavePct(undefined, row.saves, row.shotsAgainst)}</td>
                    <td style={statTd}>{formatGaa(row.goalsAgainst, row.gp, row.saves, row.shotsAgainst)}</td>
                  </>
                ) : (
                  <>
                    <td style={statTd}>{row.goals}</td>
                    <td style={statTd}>{row.assists}</td>
                    <td style={statPrimaryTd}>{row.points}</td>
                    <td style={statTd}>{ppg}</td>
                    <td style={statTd}>{row.hits}</td>
                    <td style={statTd}>{row.plusMinus}</td>
                  </>
                )}
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
  alignItems: 'flex-end',
  padding: '8px 4px 16px',
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

const headerLinks = {
  textAlign: 'right' as const,
  color: '#2a73ad',
  fontSize: 12,
  fontWeight: 700,
}

const headerSubLink = {
  textDecoration: 'underline',
}

const categoryTabs = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const categoryTab = {
  borderBottom: '2px solid #cbd5df',
  background: 'transparent',
  color: '#173650',
  fontSize: 12,
  fontWeight: 700,
  padding: '8px 10px',
}

const categoryTabActive = {
  ...categoryTab,
  borderBottom: '2px solid #123f58',
  color: '#123f58',
}

const tabsRow = {
  display: 'flex',
  gap: 8,
  margin: '8px 0 12px',
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
  marginBottom: 10,
}

const filtersRow = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 10,
  alignItems: 'flex-end',
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

const resetButton = {
  border: '1px solid #c8d2db',
  borderRadius: 6,
  background: '#fff',
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 700,
  color: '#7d8b99',
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
