'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import HoverPreviewLink from '../../../components/HoverPreviewLink'
import LoadingExperience from '../../../components/LoadingExperience'

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  full_name?: string | null
  abbreviation?: string | null
  short_name?: string | null
  country_code?: string | null
  logo_url?: string | null
  image_url?: string | null
}

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  country?: string | null
  country_code?: string | null
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

type StandingRecord = {
  id: string
  league_id?: string | null
  team_id?: string | null
  season_id?: string | null
  division?: string | null
  standing_tag?: string | null
  rank?: number | null
  gp?: number | null
  wins?: number | null
  losses?: number | null
  overtime_losses?: number | null
  regulation_wins?: number | null
  points?: number | null
  goals_for?: number | null
  goals_against?: number | null
  goal_difference?: number | null
  sogf?: number | null
  soga?: number | null
  shot_percentage?: number | null
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
  gk_saves?: number | null
  gk_shots_against?: number | null
  gk_percentage?: number | null
  goalie_goals_against?: number | null
  goalie_shutouts?: number | null
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

type LeagueChampionRecord = {
  id: string
  league_id?: string | null
  champion_year?: string | number | null
  team_id?: string | null
  team_name?: string | null
}

type LeagueAwardRecord = {
  id: string
  league_id?: string | null
  award?: string | null
}

type LeaguePlayerStat = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  saves: number
  shotsAgainst: number
  goalieGoalsAgainst: number
  gk_percentage: number
}

type NationalityHistoryRow = {
  nationality: string
  playerCount: number
}

type LeagueFranchiseStat = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
}

type LeagueGoalieFranchiseStat = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
  gp: number
  saves: number
  shutouts: number
  shotsAgainst: number
  gk_percentage: number
}

type LeagueFranchiseSeasonStat = LeagueFranchiseStat & {
  seasonName: string
  leagueName: string
}

const countryNameToCode: Record<string, string> = {
  sweden: 'SE',
  finland: 'FI',
  czechia: 'CZ',
  'czech republic': 'CZ',
  slovakia: 'SK',
  russia: 'RU',
  usa: 'US',
  'united states': 'US',
  canada: 'CA',
  germany: 'DE',
  switzerland: 'CH',
  austria: 'AT',
  norway: 'NO',
  denmark: 'DK',
  latvia: 'LV',
}

function getCountryCode(country?: string | null, countryCode?: string | null) {
  if (countryCode && countryCode.trim()) {
    return countryCode.toUpperCase().slice(0, 2)
  }

  if (!country || !country.trim()) return null

  const normalized = country.trim().toLowerCase()
  return countryNameToCode[normalized] || null
}

function getFlagUrl(country?: string | null, countryCode?: string | null) {
  const code = getCountryCode(country, countryCode)
  if (!code) return null
  return `https://flagcdn.com/w20/${code.toLowerCase()}.png`
}

function normalizeLeagueLookup(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isGoaliePosition(position?: string | null) {
  return Boolean(position?.toUpperCase().includes('G'))
}

function formatSavePct(saves: number, shotsAgainst: number, savedPct?: number | null) {
  const rawValue =
    savedPct && Number.isFinite(Number(savedPct))
      ? Number(savedPct)
      : shotsAgainst
        ? saves / shotsAgainst
        : 0

  if (!Number.isFinite(rawValue)) return '0'

  return rawValue.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatStoredSavePct(savedPct?: number | null, saves?: number, shotsAgainst?: number) {
  if (savedPct && Number.isFinite(Number(savedPct))) {
    return Number(savedPct).toFixed(3)
  }

  return formatSavePct(Number(saves) || 0, Number(shotsAgainst) || 0, savedPct)
}

function formatGaa(goalsAgainst: number, gp: number) {
  if (!gp) return '0.00'
  return (goalsAgainst / gp).toFixed(2)
}

function getStandingSortValue(standing: StandingRecord) {
  const normalizedTag = (standing.standing_tag || '').trim().toLowerCase()
  return {
    points: Number(standing.points) || 0,
    tagPriority: normalizedTag === 'p' ? 1 : 0,
    goalDifference:
      standing.goal_difference !== null && standing.goal_difference !== undefined
        ? Number(standing.goal_difference) || 0
        : (Number(standing.goals_for) || 0) - (Number(standing.goals_against) || 0),
    goalsFor: Number(standing.goals_for) || 0,
    wins: Number(standing.wins) || 0,
    regulationWins: Number(standing.regulation_wins) || 0,
    rank: Number(standing.rank) || 999,
  }
}

function sortStandingsRows(rows: StandingRecord[]) {
  return [...rows].sort((a, b) => {
    const left = getStandingSortValue(a)
    const right = getStandingSortValue(b)

    return (
      right.points - left.points ||
      right.tagPriority - left.tagPriority ||
      right.goalDifference - left.goalDifference ||
      right.goalsFor - left.goalsFor ||
      right.wins - left.wins ||
      right.regulationWins - left.regulationWins ||
      left.rank - right.rank
    )
  })
}

function compareSeasonNames(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

const standingTagLegend: Record<string, string> = {
  p: 'Clinched Presidents Trophy',
  y: 'Clinched Conference',
  x: 'Clinched Playoffs',
  e: 'Eliminated from Playoffs',
}

const standingTagOrder = ['p', 'y', 'x', 'e']

function normalizeMatchStatus(status?: string | null, match?: MatchRecord) {
  const normalized = (status || '').trim().toLowerCase()
  if (normalized) return normalized

  if (
    match?.home_score !== null &&
    match?.home_score !== undefined &&
    match?.visiting_score !== null &&
    match?.visiting_score !== undefined
  ) {
    return 'final'
  }

  return 'scheduled'
}

function formatMatchStatusLabel(status?: string | null, match?: MatchRecord) {
  const normalized = normalizeMatchStatus(status, match)
  if (normalized === 'live') return 'LIVE'
  if (normalized === 'postponed') return 'PPD'
  if (normalized === 'cancelled') return 'CANCELLED'
  if (normalized === 'final') return 'FINAL'
  return 'SCHEDULED'
}

export default function LeagueDetailPage() {
  const params = useParams()
  const identifier = decodeURIComponent(params.id as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [standings, setStandings] = useState<StandingRecord[]>([])
  const [leagueMatches, setLeagueMatches] = useState<MatchRecord[]>([])
  const [leagueChampions, setLeagueChampions] = useState<LeagueChampionRecord[]>([])
  const [leagueAwards, setLeagueAwards] = useState<LeagueAwardRecord[]>([])
  const [leaguePlayers, setLeaguePlayers] = useState<PlayerRecord[]>([])
  const [leagueStats, setLeagueStats] = useState<StatRecord[]>([])
  const [allSeasons, setAllSeasons] = useState<SeasonRecord[]>([])
  const [standingSeasons, setStandingSeasons] = useState<SeasonRecord[]>([])
  const [selectedStandingSeasonId, setSelectedStandingSeasonId] = useState('')
  const [selectedStandingDivision, setSelectedStandingDivision] = useState('all')
  const [allTimeGameType, setAllTimeGameType] = useState<'regular' | 'playoffs'>('regular')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!identifier) return

    async function fetchLeaguePage() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('*')
      const allLeagues = (leaguesData as LeagueRecord[]) || []
      const normalizedIdentifier = normalizeLeagueLookup(identifier)
      const leagueRecord =
        allLeagues.find((league) => String(league.id) === identifier) ||
        allLeagues.find((league) =>
          [league.name, league.abbreviation, league.short_name, league.display_name]
            .filter(Boolean)
            .some((value) => normalizeLeagueLookup(value) === normalizedIdentifier)
        ) ||
        allLeagues.find((league) =>
          [league.name, league.abbreviation, league.short_name, league.display_name]
            .filter(Boolean)
            .some((value) => {
              const normalizedValue = normalizeLeagueLookup(value)
              return (
                normalizedValue.includes(normalizedIdentifier) ||
                normalizedIdentifier.includes(normalizedValue)
              )
            })
        ) ||
        null

      if (leaguesError || !leagueRecord) {
        setLeague(null)
        setTeams([])
        setStandings([])
        setLeagueMatches([])
        setLeagueChampions([])
        setLeagueAwards([])
        setLeaguePlayers([])
        setLeagueStats([])
        setAllSeasons([])
        setStandingSeasons([])
        setSelectedStandingSeasonId('')
        setErrorMessage(leaguesError?.message || 'League not found.')
        setIsLoading(false)
        return
      }

      const leagueNames = [
        leagueRecord.name,
        leagueRecord.abbreviation,
        leagueRecord.short_name,
      ].filter(Boolean) as string[]

      const [
        { data: teamsData, error: teamsError },
        { data: standingsData, error: standingsError },
        { data: matchesData, error: matchesError },
        { data: championsData, error: championsError },
        { data: awardsData, error: awardsError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, logo_url, country, country_code, league')
          .in('league', leagueNames.length ? leagueNames : [leagueRecord.name])
          .order('name', { ascending: true }),
        supabase
          .from('league_standings')
          .select('id, league_id, team_id, season_id, division, standing_tag, rank, gp, wins, losses, overtime_losses, regulation_wins, points, goals_for, goals_against, goal_difference, sogf, soga, shot_percentage')
          .eq('league_id', leagueRecord.id)
          .order('rank', { ascending: true }),
        supabase
          .from('league_matches')
          .select('id, league_id, season_id, match_date, home_team_id, visiting_team_id, home_score, visiting_score, score_note, status, venue, attendance')
          .eq('league_id', leagueRecord.id)
          .order('match_date', { ascending: false }),
        supabase
          .from('league_champions')
          .select('id, league_id, champion_year, team_id, team_name')
          .eq('league_id', leagueRecord.id)
          .order('champion_year', { ascending: false }),
        supabase
          .from('awards')
          .select('id, league_id, award')
          .eq('league_id', leagueRecord.id)
          .order('award', { ascending: true }),
        supabase.from('seasons').select('id, name'),
      ])
      const standingsRows = (standingsData as StandingRecord[]) || []
      const matchRows = (matchesData as MatchRecord[]) || []
      const championRows = (championsData as LeagueChampionRecord[]) || []
      const awardRows = (awardsData as LeagueAwardRecord[]) || []
      const seasonRows = (seasonsData as SeasonRecord[]) || []
      const teamRows = (teamsData as TeamRecord[]) || []
      const usedSeasonIds = Array.from(
        new Set(
          [...standingsRows.map((standing) => standing.season_id), ...matchRows.map((match) => match.season_id)].filter(Boolean)
        )
      ) as string[]
      const availableStandingSeasons = seasonRows
        .filter((season) => usedSeasonIds.includes(String(season.id)))
        .sort((a, b) => compareSeasonNames(a.name, b.name))

      const teamIds = teamRows.map((team) => team.id)
      let statsRows: StatRecord[] = []
      let playerRows: PlayerRecord[] = []

      if (teamIds.length) {
        const { data: statsData, error: statsError } = await supabase
          .from('stats')
          .select('id, player_id, team_id, season_id, game_type, gp, goals, assists, points, hits, gk_saves, gk_shots_against, gk_percentage, goalie_goals_against, goalie_shutouts')
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

      setLeague(leagueRecord)
      setTeams(teamsError ? [] : teamRows)
      setStandings(standingsError ? [] : standingsRows)
      setLeagueMatches(matchesError ? [] : matchRows)
      setLeagueChampions(championsError ? [] : championRows)
      setLeagueAwards(awardsError ? [] : awardRows)
      setLeagueStats(statsRows)
      setLeaguePlayers(playerRows)
      setAllSeasons(seasonsError ? [] : seasonRows)
      setStandingSeasons(seasonsError || standingsError || matchesError ? [] : availableStandingSeasons)
      setSelectedStandingSeasonId(
        availableStandingSeasons[availableStandingSeasons.length - 1]?.id ||
          availableStandingSeasons[0]?.id ||
          ''
      )
      setErrorMessage(
        teamsError?.message ||
          standingsError?.message ||
          matchesError?.message ||
          championsError?.message ||
          awardsError?.message ||
          seasonsError?.message ||
          ''
      )
      setIsLoading(false)
    }

    fetchLeaguePage()
  }, [identifier])

  if (isLoading) {
    return (
      <div style={pageWrap}>
        <LoadingExperience label="Loading league tables, leaders, and latest games..." />
      </div>
    )
  }

  if (!league) {
    return <div style={pageWrap}>{errorMessage || 'League not found.'}</div>
  }

  const flagUrl = getFlagUrl(null, league.country_code)
  const leagueShortName = league.abbreviation || league.short_name || league.name
  const leagueDisplayName = league.display_name || league.full_name || league.name
  const statsPageHref = `/league/${encodeURIComponent(league.id)}/stats`
  const gamesPageHref = `/league/${encodeURIComponent(league.id)}/games`
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const playersById = new Map(leaguePlayers.map((player) => [player.id, player]))
  const seasonsById = new Map(allSeasons.map((season) => [String(season.id), season.name]))
  const nationalityHistory = Object.values(
    leagueStats.reduce<Record<string, NationalityHistoryRow & { playerIds: Set<string> }>>((acc, stat) => {
      if (!stat.player_id) return acc

      const player = playersById.get(String(stat.player_id))
      const nationality = player?.nationality?.trim()
      if (!nationality) return acc

      if (!acc[nationality]) {
        acc[nationality] = {
          nationality,
          playerCount: 0,
          playerIds: new Set<string>(),
        }
      }

      acc[nationality].playerIds.add(String(stat.player_id))
      acc[nationality].playerCount = acc[nationality].playerIds.size
      return acc
    }, {})
  )
    .sort((a, b) => b.playerCount - a.playerCount || a.nationality.localeCompare(b.nationality))
    .map(({ nationality, playerCount }) => ({ nationality, playerCount }))
  const filteredStandings = selectedStandingSeasonId
    ? standings.filter((standing) => String(standing.season_id) === String(selectedStandingSeasonId))
    : standings
  const standingDivisionOptions = Array.from(
    new Set(
      filteredStandings
        .map((standing) => (standing.division || '').trim())
        .filter((value) => value.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))
  const hasStandingDivisions = standingDivisionOptions.length > 1
  const effectiveStandingDivision =
    selectedStandingDivision === 'divisions' && hasStandingDivisions ? 'divisions' : 'all'
  const orderedFullStandings = sortStandingsRows(filteredStandings)
  const groupedStandings = Object.entries(
    filteredStandings.reduce<Record<string, StandingRecord[]>>((acc, standing) => {
      const divisionName = (standing.division || '').trim() || 'Standings'
      if (!acc[divisionName]) {
        acc[divisionName] = []
      }
      acc[divisionName].push(standing)
      return acc
    }, {})
  )
  const visibleStandingLegend = Array.from(
    new Set(
      filteredStandings
        .map((standing) => (standing.standing_tag || '').trim().toLowerCase())
        .filter((tag) => tag && standingTagLegend[tag])
    )
  )
    .sort((a, b) => standingTagOrder.indexOf(a) - standingTagOrder.indexOf(b))
    .map((tag) => ({
      tag,
      label: standingTagLegend[tag],
    }))
  const filteredMatches = selectedStandingSeasonId
    ? leagueMatches.filter((match) => String(match.season_id) === String(selectedStandingSeasonId))
    : leagueMatches
  const selectedLeagueStats = selectedStandingSeasonId
    ? leagueStats.filter((stat) => String(stat.season_id) === String(selectedStandingSeasonId))
    : leagueStats
  const allTimeSourceStats = leagueStats.filter((stat) => {
    const normalizedGameType = (stat.game_type || 'regular').toLowerCase()
    return allTimeGameType === 'playoffs'
      ? normalizedGameType === 'playoffs'
      : normalizedGameType !== 'playoffs'
  })
  const allTimePlayerTotals = Object.values(
    allTimeSourceStats.reduce<Record<string, LeagueFranchiseStat>>((acc, stat) => {
      if (!stat.player_id) return acc

      const player = playersById.get(String(stat.player_id))
      if (!player || isGoaliePosition(player.position)) return acc

      if (!acc[player.id]) {
        acc[player.id] = {
          id: player.id,
          name: player.name,
          position: player.position,
          nationality: player.nationality,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
        }
      }

      acc[player.id].gp += Number(stat.gp) || 0
      acc[player.id].goals += Number(stat.goals) || 0
      acc[player.id].assists += Number(stat.assists) || 0
      acc[player.id].points +=
        stat.points !== null && stat.points !== undefined
          ? Number(stat.points) || 0
          : (Number(stat.goals) || 0) + (Number(stat.assists) || 0)
      acc[player.id].hits += Number(stat.hits) || 0
      return acc
    }, {})
  )
  const allTimeSeasonStats = allTimeSourceStats
    .filter((stat) => stat.player_id)
    .map((stat) => {
      const player = playersById.get(String(stat.player_id))
      if (!player || isGoaliePosition(player.position)) return null

      return {
        id: `${stat.player_id}-${stat.season_id}-${stat.id}`,
        name: player.name,
        position: player.position,
        nationality: player.nationality,
        seasonName: seasonsById.get(String(stat.season_id)) || 'Season',
        leagueName: leagueShortName,
        gp: Number(stat.gp) || 0,
        goals: Number(stat.goals) || 0,
        assists: Number(stat.assists) || 0,
        points:
          stat.points !== null && stat.points !== undefined
            ? Number(stat.points) || 0
            : (Number(stat.goals) || 0) + (Number(stat.assists) || 0),
        hits: Number(stat.hits) || 0,
      } satisfies LeagueFranchiseSeasonStat
    })
    .filter(Boolean) as LeagueFranchiseSeasonStat[]
  const allTimeGoalieTotals = Object.values(
    allTimeSourceStats.reduce<Record<string, LeagueGoalieFranchiseStat>>((acc, stat) => {
      if (!stat.player_id) return acc

      const player = playersById.get(String(stat.player_id))
      if (!player || !isGoaliePosition(player.position)) return acc

      if (!acc[player.id]) {
        acc[player.id] = {
          id: player.id,
          name: player.name,
          position: player.position,
          nationality: player.nationality,
          gp: 0,
          saves: 0,
          shutouts: 0,
          shotsAgainst: 0,
          gk_percentage: 0,
        }
      }

      acc[player.id].gp += Number(stat.gp) || 0
      acc[player.id].saves += Number(stat.gk_saves) || 0
      acc[player.id].shutouts += Number(stat.goalie_shutouts) || 0
      acc[player.id].shotsAgainst += Number(stat.gk_shots_against) || 0

      if (stat.gk_percentage) {
        acc[player.id].gk_percentage = Number(stat.gk_percentage) || 0
      }

      return acc
    }, {})
  )
  const leaguePlayerTotals = Object.values(
    selectedLeagueStats.reduce<Record<string, LeaguePlayerStat>>((acc, stat) => {
      if (!stat.player_id) return acc

      const player = playersById.get(String(stat.player_id))
      if (!player) return acc

      if (!acc[player.id]) {
        acc[player.id] = {
          id: player.id,
          name: player.name,
          position: player.position,
          nationality: player.nationality,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          hits: 0,
          saves: 0,
          shotsAgainst: 0,
          goalieGoalsAgainst: 0,
          gk_percentage: 0,
        }
      }

      acc[player.id].gp += Number(stat.gp) || 0
      acc[player.id].goals += Number(stat.goals) || 0
      acc[player.id].assists += Number(stat.assists) || 0
      acc[player.id].points +=
        stat.points !== null && stat.points !== undefined
          ? Number(stat.points) || 0
          : (Number(stat.goals) || 0) + (Number(stat.assists) || 0)
      acc[player.id].hits += Number(stat.hits) || 0
      acc[player.id].saves += Number(stat.gk_saves) || 0
      acc[player.id].shotsAgainst += Number(stat.gk_shots_against) || 0
      acc[player.id].goalieGoalsAgainst +=
        stat.goalie_goals_against !== null && stat.goalie_goals_against !== undefined
          ? Number(stat.goalie_goals_against) || 0
          : Math.max((Number(stat.gk_shots_against) || 0) - (Number(stat.gk_saves) || 0), 0)

      if (stat.gk_percentage) {
        acc[player.id].gk_percentage = Number(stat.gk_percentage) || 0
      }

      return acc
    }, {})
  )
  const topSkaters = leaguePlayerTotals
    .filter((player) => !isGoaliePosition(player.position))
    .sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 5)
  const topGoalies = leaguePlayerTotals
    .filter((player) => isGoaliePosition(player.position))
    .sort((a, b) => {
      const svPctA = Number(formatSavePct(a.saves, a.shotsAgainst, a.gk_percentage))
      const svPctB = Number(formatSavePct(b.saves, b.shotsAgainst, b.gk_percentage))
      return svPctB - svPctA || a.goalieGoalsAgainst - b.goalieGoalsAgainst || a.name.localeCompare(b.name)
    })
    .slice(0, 5)
  const selectedStandingSeasonIndex = standingSeasons.findIndex(
    (season) => String(season.id) === String(selectedStandingSeasonId)
  )
  const selectedSeasonLabel =
    standingSeasons.find((season) => String(season.id) === String(selectedStandingSeasonId))?.name ||
    'Season'
  const goToStandingSeason = (direction: 'previous' | 'next') => {
    if (!standingSeasons.length) return

    const currentIndex = selectedStandingSeasonIndex >= 0 ? selectedStandingSeasonIndex : 0
    const nextIndex =
      direction === 'previous'
        ? Math.max(currentIndex - 1, 0)
        : Math.min(currentIndex + 1, standingSeasons.length - 1)

    setSelectedStandingSeasonId(standingSeasons[nextIndex].id)
    setSelectedStandingDivision('all')
  }

  return (
    <div style={pageWrap} className="motion-page-root">
      <div style={shell}>
        <div style={leagueHeroCard} className="motion-hero-card">
          <div style={heroTitleRow} className="motion-hero-copy">
            <div>
              <h1 style={leagueTitle}>
                {flagUrl ? <img src={flagUrl} alt={getCountryCode(null, league.country_code) || ''} style={titleFlag} /> : null}
                {leagueDisplayName}
              </h1>
              <div style={leagueSubtitle}>{leagueShortName}</div>
            </div>
          </div>
        </div>

        <div style={teamRosterCard}>
          <div style={sectionHeader}>{leagueShortName.toUpperCase()} TEAM ROSTERS</div>
          <div style={teamGrid}>
            {teams.map((team) => {
              const teamFlagUrl = getFlagUrl(team.country, team.country_code)

              return (
                <HoverPreviewLink key={team.id} href={`/team/${team.id}`} entityType="team" entityId={team.id} style={teamLink}>
                  {teamFlagUrl ? <img src={teamFlagUrl} alt={team.country_code || ''} style={teamFlag} /> : null}
                  <span>{team.name}</span>
                </HoverPreviewLink>
              )
            })}

            {teams.length === 0 ? (
              <div style={emptyText}>No teams linked to this league yet.</div>
            ) : null}
          </div>
        </div>

        <div style={standingsCard}>
          <div style={sectionHeader}>{leagueShortName.toUpperCase()} STANDINGS</div>
          <div style={standingSeasonBar}>
            <button
              type="button"
              onClick={() => goToStandingSeason('previous')}
              style={seasonArrowButton}
              aria-label="Previous season"
            >
              ‹
            </button>
            <select
              value={selectedStandingSeasonId}
              onChange={(event) => {
                setSelectedStandingSeasonId(event.target.value)
                setSelectedStandingDivision('all')
              }}
              style={standingSeasonSelect}
            >
              {standingSeasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            {hasStandingDivisions ? (
              <select
                value={effectiveStandingDivision}
                onChange={(event) => setSelectedStandingDivision(event.target.value)}
                style={standingSeasonSelect}
              >
                <option value="all">Full League</option>
                <option value="divisions">Divisions</option>
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => goToStandingSeason('next')}
              style={seasonArrowButton}
              aria-label="Next season"
            >
              ›
            </button>
          </div>
          <div style={standingsTableWrap}>
            <table style={standingsTable}>
              <thead>
                <tr style={standingsHeadRow}>
                  <th style={standingRankTh}>#</th>
                  <th style={standingTeamTh}>TEAM</th>
                  <th style={standingStatTh}>GP</th>
                  <th style={standingStatTh}>W</th>
                  <th style={standingStatTh}>L</th>
                  <th style={standingStatTh}>OTL</th>
                  <th style={standingStatTh}>RW</th>
                  <th style={standingStatTh}>PTS</th>
                  <th style={standingStatTh}>GF</th>
                  <th style={standingStatTh}>GA</th>
                  <th style={standingStatTh}>GD</th>
                  <th style={standingStatTh}>SOGF</th>
                  <th style={standingStatTh}>SOGA</th>
                  <th style={standingStatTh}>SH%</th>
                </tr>
              </thead>
              <tbody>
                {effectiveStandingDivision === 'divisions'
                  ? groupedStandings.flatMap(([divisionName, divisionRows]) => {
                      const orderedRows = sortStandingsRows(divisionRows)

                      return [
                        <tr key={`division-${divisionName}`} style={divisionRow}>
                          <td colSpan={14} style={divisionCell}>
                            {divisionName.toUpperCase()}
                          </td>
                        </tr>,
                        ...orderedRows.map((standing, index) => {
                          const team = standing.team_id ? teamsById.get(standing.team_id) : null
                          const goalDifference =
                            standing.goal_difference ??
                            (Number(standing.goals_for) || 0) - (Number(standing.goals_against) || 0)

                          return (
                            <tr key={standing.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                              <td style={standingRankTd}>{index + 1}.</td>
                              <td style={standingTeamTd}>
                                {team ? (
                                  <HoverPreviewLink href={`/team/${team.id}`} entityType="team" entityId={team.id} style={teamLink}>
                                    {team.logo_url ? <img src={team.logo_url} alt={team.name} style={teamLogo} /> : null}
                                    {standing.standing_tag ? <span style={standingTag}>{standing.standing_tag}</span> : null}
                                    <span>{team.name}</span>
                                  </HoverPreviewLink>
                                ) : (
                                  <span>Team not linked</span>
                                )}
                              </td>
                              <td style={standingStatTd}>{standing.gp || 0}</td>
                              <td style={standingStatTd}>{standing.wins || 0}</td>
                              <td style={standingStatTd}>{standing.losses || 0}</td>
                              <td style={standingStatTd}>{standing.overtime_losses || 0}</td>
                              <td style={standingStatTd}>{standing.regulation_wins || 0}</td>
                              <td style={standingPtsTd}>{standing.points || 0}</td>
                              <td style={standingStatTd}>{standing.goals_for || 0}</td>
                              <td style={standingStatTd}>{standing.goals_against || 0}</td>
                              <td style={standingStatTd}>{goalDifference}</td>
                              <td style={standingStatTd}>{standing.sogf || 0}</td>
                              <td style={standingStatTd}>{standing.soga || 0}</td>
                              <td style={standingStatTd}>{standing.shot_percentage ?? '-'}</td>
                            </tr>
                          )
                        }),
                      ]
                    })
                  : orderedFullStandings.map((standing, index) => {
                      const team = standing.team_id ? teamsById.get(standing.team_id) : null
                      const goalDifference =
                        standing.goal_difference ??
                        (Number(standing.goals_for) || 0) - (Number(standing.goals_against) || 0)

                      return (
                        <tr key={standing.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                          <td style={standingRankTd}>{index + 1}.</td>
                          <td style={standingTeamTd}>
                            {team ? (
                              <HoverPreviewLink href={`/team/${team.id}`} entityType="team" entityId={team.id} style={teamLink}>
                                {team.logo_url ? <img src={team.logo_url} alt={team.name} style={teamLogo} /> : null}
                                {standing.standing_tag ? <span style={standingTag}>{standing.standing_tag}</span> : null}
                                <span>{team.name}</span>
                              </HoverPreviewLink>
                            ) : (
                              <span>Team not linked</span>
                            )}
                          </td>
                          <td style={standingStatTd}>{standing.gp || 0}</td>
                          <td style={standingStatTd}>{standing.wins || 0}</td>
                          <td style={standingStatTd}>{standing.losses || 0}</td>
                          <td style={standingStatTd}>{standing.overtime_losses || 0}</td>
                          <td style={standingStatTd}>{standing.regulation_wins || 0}</td>
                          <td style={standingPtsTd}>{standing.points || 0}</td>
                          <td style={standingStatTd}>{standing.goals_for || 0}</td>
                          <td style={standingStatTd}>{standing.goals_against || 0}</td>
                          <td style={standingStatTd}>{goalDifference}</td>
                          <td style={standingStatTd}>{standing.sogf || 0}</td>
                          <td style={standingStatTd}>{standing.soga || 0}</td>
                          <td style={standingStatTd}>{standing.shot_percentage ?? '-'}</td>
                        </tr>
                      )
                    })}

                {filteredStandings.length === 0 ? (
                  <tr style={standingRow}>
                    <td colSpan={14} style={emptyText}>
                      No standings added for this league yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {visibleStandingLegend.length ? (
            <div style={standingLegendWrap}>
              {visibleStandingLegend.map((entry) => (
                <div key={entry.tag} style={standingLegendRow}>
                  <div style={standingLegendTag}>{entry.tag.toUpperCase()}</div>
                  <div style={standingLegendText}>{entry.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={leaderboardGrid}>
          <LeaguePlayerStatsCard
            title={`${selectedSeasonLabel} ${leagueShortName.toUpperCase()} PLAYER STATS`}
            players={topSkaters}
            kind="skater"
            showMoreHref={`${statsPageHref}?tab=season&category=skaters&context=${encodeURIComponent(`${selectedSeasonLabel} ${leagueShortName} Player Stats`)}`}
          />
          <LeaguePlayerStatsCard
            title={`${selectedSeasonLabel} ${leagueShortName.toUpperCase()} GOALIE STATS`}
            players={topGoalies}
            kind="goalie"
            showMoreHref={`${statsPageHref}?tab=season&category=goalies&context=${encodeURIComponent(`${selectedSeasonLabel} ${leagueShortName} Goalie Stats`)}`}
          />
        </div>

        <LeagueMatchesCard
          title={`${leagueShortName.toUpperCase()} GAMES`}
          matches={filteredMatches.slice(0, 5)}
          teamsById={teamsById}
          showMoreHref={gamesPageHref}
        />

        <LeagueNationalityHistoryCard nationalities={nationalityHistory} />

        <LeagueAllTimeSection
          leagueShortName={leagueShortName}
          gameType={allTimeGameType}
          onGameTypeChange={setAllTimeGameType}
          stats={allTimePlayerTotals}
          goalieStats={allTimeGoalieTotals}
          seasonStats={allTimeSeasonStats}
          showMoreHref={statsPageHref}
        />

        <LeagueChampionsCard
          title={`LIST OF ${leagueShortName.toUpperCase()} CHAMPIONS`}
          champions={leagueChampions}
          teamsById={teamsById}
        />

        <LeagueAwardsCard title={`${leagueShortName.toUpperCase()} AWARDS`} awards={leagueAwards} />

        {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
      </div>
    </div>
  )
}

function LeaguePlayerStatsCard({
  title,
  players,
  kind,
  showMoreHref,
}: {
  title: string
  players: LeaguePlayerStat[]
  kind: 'skater' | 'goalie'
  showMoreHref: string
}) {
  return (
    <div style={leaderboardCard} className="motion-section-card motion-section-card-delay-2">
      <div style={sectionHeader}>{title}</div>
      <table style={standingsTable}>
        <thead>
          <tr style={standingsHeadRow}>
            <th style={standingRankTh}>#</th>
            <th style={standingTeamTh}>PLAYER</th>
            <th style={standingStatTh}>GP</th>
            {kind === 'skater' ? (
              <>
                <th style={standingStatTh}>G</th>
                <th style={standingStatTh}>A</th>
                <th style={standingStatTh}>TP</th>
                <th style={standingStatTh}>Hits</th>
              </>
            ) : (
              <>
                <th style={standingStatTh}>GAA</th>
                <th style={standingStatTh}>SV%</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const flagUrl = getFlagUrl(player.nationality, player.nationality)

            return (
              <tr key={player.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                <td style={standingRankTd}>{index + 1}.</td>
                <td style={standingTeamTd}>
                  <HoverPreviewLink href={`/player/${player.id}`} entityType="player" entityId={player.id} style={teamLink}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={teamFlag} /> : null}
                    <span>
                      {player.name} ({player.position || '-'})
                    </span>
                  </HoverPreviewLink>
                </td>
                <td style={standingStatTd}>{player.gp}</td>
                {kind === 'skater' ? (
                  <>
                    <td style={standingStatTd}>{player.goals}</td>
                    <td style={standingStatTd}>{player.assists}</td>
                    <td style={standingPtsTd}>{player.points}</td>
                    <td style={standingStatTd}>{player.hits}</td>
                  </>
                ) : (
                  <>
                    <td style={standingStatTd}>{formatGaa(player.goalieGoalsAgainst, player.gp)}</td>
                    <td style={standingPtsTd}>{formatSavePct(player.saves, player.shotsAgainst, player.gk_percentage)}</td>
                  </>
                )}
              </tr>
            )
          })}
          {players.length === 0 ? (
            <tr style={standingRow}>
              <td colSpan={kind === 'skater' ? 7 : 5} style={emptyText}>
                No {kind} stats for this season yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link href={showMoreHref} style={showMoreBar}>
        SHOW MORE
      </Link>
    </div>
  )
}

function LeagueMatchesCard({
  title,
  matches,
  teamsById,
  showMoreHref,
}: {
  title: string
  matches: MatchRecord[]
  teamsById: Map<string, TeamRecord>
  showMoreHref: string
}) {
  return (
    <div style={matchesCard} className="motion-section-card motion-section-card-delay-3">
      <div style={sectionHeader}>{title}</div>
      <table style={standingsTable}>
        <thead>
          <tr style={standingsHeadRow}>
            <th style={matchesDateTh}>DATE</th>
            <th style={matchesTeamTh}>HOME</th>
            <th style={matchesTeamTh}>VISITING</th>
            <th style={matchesScoreTh}>SCORE</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match, index) => {
            const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
            const visitingTeam = match.visiting_team_id ? teamsById.get(match.visiting_team_id) : null
            const scoreValue =
              match.home_score !== null &&
              match.home_score !== undefined &&
              match.visiting_score !== null &&
              match.visiting_score !== undefined
                ? `${match.home_score}-${match.visiting_score}${match.score_note ? ` (${match.score_note})` : ''}`
                : formatMatchStatusLabel(match.status, match)

            return (
              <tr key={match.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                <td style={matchesDateTd}>{match.match_date || '-'}</td>
                <td style={standingTeamTd}>
                  {homeTeam ? (
                    <HoverPreviewLink href={`/team/${homeTeam.id}`} entityType="team" entityId={homeTeam.id} style={teamLink}>
                      {homeTeam.logo_url ? <img src={homeTeam.logo_url} alt={homeTeam.name} style={teamLogo} /> : null}
                      <span>{homeTeam.name}</span>
                    </HoverPreviewLink>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td style={standingTeamTd}>
                  {visitingTeam ? (
                    <HoverPreviewLink href={`/team/${visitingTeam.id}`} entityType="team" entityId={visitingTeam.id} style={teamLink}>
                      {visitingTeam.logo_url ? <img src={visitingTeam.logo_url} alt={visitingTeam.name} style={teamLogo} /> : null}
                      <span>{visitingTeam.name}</span>
                    </HoverPreviewLink>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td style={matchesScoreTd}>{scoreValue}</td>
              </tr>
            )
          })}
          {matches.length === 0 ? (
            <tr style={standingRow}>
              <td colSpan={4} style={emptyText}>
                No matches added for this league yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link href={showMoreHref} style={showMoreBar}>
        SHOW MORE
      </Link>
    </div>
  )
}

function LeagueNationalityHistoryCard({
  nationalities,
}: {
  nationalities: NationalityHistoryRow[]
}) {
  return (
    <div style={matchesCard} className="motion-section-card motion-section-card-delay-4">
      <div style={sectionHeader}>PLAYER NATIONALITIES THROUGHOUT HISTORY</div>
      <div style={nationalityGrid}>
        {nationalities.map((row) => {
          const flagUrl = getFlagUrl(row.nationality, row.nationality)

          return (
            <div key={row.nationality} style={nationalityItem}>
              {flagUrl ? <img src={flagUrl} alt={row.nationality} style={teamFlag} /> : null}
              <span style={nationalityText}>
                {row.playerCount} {row.playerCount === 1 ? 'player' : 'players'}
              </span>
            </div>
          )
        })}
        {nationalities.length === 0 ? (
          <div style={emptyText}>No player nationalities added through stats yet.</div>
        ) : null}
      </div>
    </div>
  )
}

function LeagueAllTimeSection({
  leagueShortName,
  gameType,
  onGameTypeChange,
  stats,
  goalieStats,
  seasonStats,
  showMoreHref,
}: {
  leagueShortName: string
  gameType: 'regular' | 'playoffs'
  onGameTypeChange: (value: 'regular' | 'playoffs') => void
  stats: LeagueFranchiseStat[]
  goalieStats: LeagueGoalieFranchiseStat[]
  seasonStats: LeagueFranchiseSeasonStat[]
  showMoreHref: string
}) {
  const buildContextHref = (label: string, category: 'skaters' | 'goalies' = 'skaters') =>
    `${showMoreHref}?tab=allTime&category=${category}&context=${encodeURIComponent(label)}`
  const sortBy = (key: keyof Pick<LeagueFranchiseStat, 'gp' | 'goals' | 'assists' | 'points' | 'hits'>) =>
    [...stats].sort((a, b) => Number(b[key]) - Number(a[key]) || b.points - a.points).slice(0, 5)
  const pointsPerGame = [...stats]
    .filter((player) => player.gp > 0)
    .sort((a, b) => b.points / b.gp - a.points / a.gp || b.points - a.points)
    .slice(0, 5)
  const pointsPerSeason = [...seasonStats]
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)
  const goalieSaves = [...goalieStats]
    .sort((a, b) => b.saves - a.saves || b.gp - a.gp)
    .slice(0, 5)
  const goalieShutouts = [...goalieStats]
    .sort((a, b) => b.shutouts - a.shutouts || b.saves - a.saves)
    .slice(0, 5)
  const goalieSavePct = [...goalieStats]
    .filter((player) => player.shotsAgainst > 0 || player.gk_percentage > 0)
    .sort(
      (a, b) =>
        Number(formatSavePct(b.saves, b.shotsAgainst, b.gk_percentage)) -
          Number(formatSavePct(a.saves, a.shotsAgainst, a.gk_percentage)) ||
        b.saves - a.saves
    )
    .slice(0, 5)

  return (
    <div style={allTimeWrap} className="motion-section-card motion-section-card-delay-5">
      <div style={leagueGameTypeTabs}>
        <button
          type="button"
          onClick={() => onGameTypeChange('regular')}
          style={gameType === 'regular' ? leagueGameTypeTabActive : leagueGameTypeTab}
        >
          Regular Season
        </button>
        <button
          type="button"
          onClick={() => onGameTypeChange('playoffs')}
          style={gameType === 'playoffs' ? leagueGameTypeTabActive : leagueGameTypeTab}
        >
          Playoffs
        </button>
      </div>

      <div style={leaderboardGrid}>
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME POINTS`} stats={sortBy('points')} valueColumn="TP" rankBy="points" showMoreHref={buildContextHref(`${leagueShortName} All-Time Points`, 'skaters')} />
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME GOALS`} stats={sortBy('goals')} valueColumn="TP" rankBy="goals" showMoreHref={buildContextHref(`${leagueShortName} All-Time Goals`, 'skaters')} />
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME ASSISTS`} stats={sortBy('assists')} valueColumn="TP" rankBy="assists" showMoreHref={buildContextHref(`${leagueShortName} All-Time Assists`, 'skaters')} />
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME HITS`} stats={sortBy('hits')} valueColumn="HITS" rankBy="hits" showMoreHref={buildContextHref(`${leagueShortName} All-Time Hits`, 'skaters')} />
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME GAMES PLAYED`} stats={sortBy('gp')} valueColumn="TP" rankBy="gp" showMoreHref={buildContextHref(`${leagueShortName} All-Time Games Played`, 'skaters')} />
        <LeagueAllTimeCard title={`${leagueShortName.toUpperCase()} ALL-TIME POINTS PER GAME`} stats={pointsPerGame} valueColumn="PPG" rankBy="ppg" showMoreHref={buildContextHref(`${leagueShortName} All-Time Points Per Game`, 'skaters')} />
      </div>

      <div style={leaderboardGrid}>
        <LeagueAllTimeGoalieCard
          title={`${leagueShortName.toUpperCase()} ALL-TIME SAVES`}
          stats={goalieSaves}
          rankBy="saves"
          showMoreHref={buildContextHref(`${leagueShortName} All-Time Saves`, 'goalies')}
        />
        <LeagueAllTimeGoalieCard
          title={`${leagueShortName.toUpperCase()} ALL-TIME SHUTOUTS`}
          stats={goalieShutouts}
          rankBy="shutouts"
          showMoreHref={buildContextHref(`${leagueShortName} All-Time Shutouts`, 'goalies')}
        />
        <LeagueAllTimeGoalieCard
          title={`${leagueShortName.toUpperCase()} ALL-TIME SAVE PERCENTAGE`}
          stats={goalieSavePct}
          rankBy="savePct"
          showMoreHref={buildContextHref(`${leagueShortName} All-Time Save Percentage`, 'goalies')}
        />
      </div>

      <LeagueAllTimeSeasonCard
        title={`${leagueShortName.toUpperCase()} ALL-TIME POINTS PER SEASON`}
        stats={pointsPerSeason}
        rankBy="points"
        showMoreHref={buildContextHref(`${leagueShortName} All-Time Points Per Season`, 'skaters')}
      />
      <LeagueAllTimeSeasonCard
        title={`${leagueShortName.toUpperCase()} ALL-TIME GOALS PER SEASON`}
        stats={[...seasonStats].sort((a, b) => b.goals - a.goals || b.points - a.points).slice(0, 5)}
        rankBy="goals"
        showMoreHref={buildContextHref(`${leagueShortName} All-Time Goals Per Season`, 'skaters')}
      />
      <LeagueAllTimeSeasonCard
        title={`${leagueShortName.toUpperCase()} ALL-TIME ASSISTS PER SEASON`}
        stats={[...seasonStats].sort((a, b) => b.assists - a.assists || b.points - a.points).slice(0, 5)}
        rankBy="assists"
        showMoreHref={buildContextHref(`${leagueShortName} All-Time Assists Per Season`, 'skaters')}
      />
      <LeagueAllTimeSeasonCard
        title={`${leagueShortName.toUpperCase()} ALL-TIME HITS PER SEASON`}
        stats={[...seasonStats].sort((a, b) => b.hits - a.hits || b.points - a.points).slice(0, 5)}
        rankBy="hits"
        showMoreHref={buildContextHref(`${leagueShortName} All-Time Hits Per Season`, 'skaters')}
      />
    </div>
  )
}

type LeagueRankKey = 'points' | 'goals' | 'assists' | 'hits' | 'gp' | 'ppg'
type LeagueGoalieRankKey = 'saves' | 'shutouts' | 'savePct'

function LeagueAllTimeCard({
  title,
  stats,
  valueColumn,
  rankBy,
  showMoreHref,
}: {
  title: string
  stats: LeagueFranchiseStat[]
  valueColumn: 'TP' | 'HITS' | 'PPG'
  rankBy: LeagueRankKey
  showMoreHref: string
}) {
  return (
    <div style={leaderboardCard} className="motion-section-card motion-section-card-delay-2">
      <div style={sectionHeader}>{title}</div>
      <table style={standingsTable}>
        <thead>
          <tr style={standingsHeadRow}>
            <th style={standingRankTh}>#</th>
            <th style={standingTeamTh}>PLAYER</th>
            <th style={standingStatTh}>GP</th>
            <th style={standingStatTh}>G</th>
            <th style={standingStatTh}>A</th>
            <th style={standingStatTh}>{valueColumn}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((player, index) => {
            const flagUrl = getFlagUrl(player.nationality, player.nationality)
            const value =
              valueColumn === 'PPG'
                ? (player.gp ? (player.points / player.gp).toFixed(2) : '0.00')
                : valueColumn === 'HITS'
                  ? player.hits
                  : player.points

            return (
              <tr key={player.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                <td style={standingRankTd}>{index + 1}.</td>
                <td style={standingTeamTd}>
                  <HoverPreviewLink href={`/player/${player.id}`} entityType="player" entityId={player.id} style={teamLink}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={teamFlag} /> : null}
                    <span>
                      {player.name} ({player.position || '-'})
                    </span>
                  </HoverPreviewLink>
                </td>
                <td style={rankBy === 'gp' ? standingPrimaryTd : standingStatTd}>{player.gp}</td>
                <td style={rankBy === 'goals' ? standingPrimaryTd : standingStatTd}>{player.goals}</td>
                <td style={rankBy === 'assists' ? standingPrimaryTd : standingStatTd}>{player.assists}</td>
                <td style={rankBy === 'points' || rankBy === 'hits' || rankBy === 'ppg' ? standingPrimaryTd : standingStatTd}>{value}</td>
              </tr>
            )
          })}
          {stats.length === 0 ? (
            <tr style={standingRow}>
              <td colSpan={6} style={emptyText}>
                No league all-time stats yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link href={showMoreHref} style={showMoreBar}>
        SHOW MORE
      </Link>
    </div>
  )
}

function LeagueAllTimeGoalieCard({
  title,
  stats,
  rankBy,
  showMoreHref,
}: {
  title: string
  stats: LeagueGoalieFranchiseStat[]
  rankBy: LeagueGoalieRankKey
  showMoreHref: string
}) {
  return (
    <div style={leaderboardCard} className="motion-section-card motion-section-card-delay-3">
      <div style={sectionHeader}>{title}</div>
      <table style={standingsTable}>
        <thead>
          <tr style={standingsHeadRow}>
            <th style={standingRankTh}>#</th>
            <th style={standingTeamTh}>GOALIE</th>
            <th style={standingStatTh}>GP</th>
            <th style={standingStatTh}>SVS</th>
            <th style={standingStatTh}>SO</th>
            <th style={standingStatTh}>SV%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((player, index) => {
            const flagUrl = getFlagUrl(player.nationality, player.nationality)
            const savePct = formatStoredSavePct(player.gk_percentage, player.saves, player.shotsAgainst)

            return (
              <tr key={player.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                <td style={standingRankTd}>{index + 1}.</td>
                <td style={standingTeamTd}>
                  <HoverPreviewLink href={`/player/${player.id}`} entityType="player" entityId={player.id} style={teamLink}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={teamFlag} /> : null}
                    <span>
                      {player.name} ({player.position || 'G'})
                    </span>
                  </HoverPreviewLink>
                </td>
                <td style={standingStatTd}>{player.gp}</td>
                <td style={rankBy === 'saves' ? standingPrimaryTd : standingStatTd}>{player.saves}</td>
                <td style={rankBy === 'shutouts' ? standingPrimaryTd : standingStatTd}>{player.shutouts}</td>
                <td style={rankBy === 'savePct' ? standingPrimaryTd : standingStatTd}>{savePct}</td>
              </tr>
            )
          })}
          {stats.length === 0 ? (
            <tr style={standingRow}>
              <td colSpan={6} style={emptyText}>
                No league goalie all-time stats yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link href={showMoreHref} style={showMoreBar}>
        SHOW MORE
      </Link>
    </div>
  )
}

function LeagueAllTimeSeasonCard({
  title,
  stats,
  rankBy,
  showMoreHref,
}: {
  title: string
  stats: LeagueFranchiseSeasonStat[]
  rankBy: LeagueRankKey
  showMoreHref: string
}) {
  return (
    <div style={matchesCard} className="motion-section-card motion-section-card-delay-4">
      <div style={sectionHeader}>{title}</div>
      <table style={standingsTable}>
        <thead>
          <tr style={standingsHeadRow}>
            <th style={standingRankTh}>#</th>
            <th style={standingTeamTh}>PLAYER</th>
            <th style={matchesDateTh}>SEASON</th>
            <th style={matchesTeamTh}>LEAGUE</th>
            <th style={standingStatTh}>GP</th>
            <th style={standingStatTh}>G</th>
            <th style={standingStatTh}>A</th>
            <th style={standingStatTh}>TP</th>
            <th style={standingStatTh}>PPG</th>
            <th style={standingStatTh}>HITS</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((player, index) => {
            const flagUrl = getFlagUrl(player.nationality, player.nationality)

            return (
              <tr key={player.id} style={index % 2 === 0 ? standingRowAlt : standingRow}>
                <td style={standingRankTd}>{index + 1}.</td>
                <td style={standingTeamTd}>
                  <HoverPreviewLink href={`/player/${player.id}`} entityType="player" entityId={player.id} style={teamLink}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={teamFlag} /> : null}
                    <span>
                      {player.name} ({player.position || '-'})
                    </span>
                  </HoverPreviewLink>
                </td>
                <td style={matchesDateTd}>{player.seasonName}</td>
                <td style={standingTeamTd}>
                  <HoverPreviewLink href={`/league/${encodeURIComponent(player.leagueName)}`} entityType="league" lookupValue={player.leagueName} style={teamLink}>
                    <span>{player.leagueName}</span>
                  </HoverPreviewLink>
                </td>
                <td style={rankBy === 'gp' ? standingPrimaryTd : standingStatTd}>{player.gp}</td>
                <td style={rankBy === 'goals' ? standingPrimaryTd : standingStatTd}>{player.goals}</td>
                <td style={rankBy === 'assists' ? standingPrimaryTd : standingStatTd}>{player.assists}</td>
                <td style={rankBy === 'points' ? standingPrimaryTd : standingStatTd}>{player.points}</td>
                <td style={rankBy === 'ppg' ? standingPrimaryTd : standingStatTd}>{player.gp ? (player.points / player.gp).toFixed(2) : '0.00'}</td>
                <td style={rankBy === 'hits' ? standingPrimaryTd : standingStatTd}>{player.hits}</td>
              </tr>
            )
          })}
          {stats.length === 0 ? (
            <tr style={standingRow}>
              <td colSpan={10} style={emptyText}>
                No league season stats yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link href={showMoreHref} style={showMoreBar}>
        SHOW MORE
      </Link>
    </div>
  )
}

function LeagueChampionsCard({
  title,
  champions,
  teamsById,
}: {
  title: string
  champions: LeagueChampionRecord[]
  teamsById: Map<string, TeamRecord>
}) {
  return (
    <div style={matchesCard} className="motion-section-card motion-section-card-delay-5">
      <div style={sectionHeader}>{title}</div>
      <div style={infoGrid}>
        {champions.map((champion) => {
          const linkedTeam = champion.team_id ? teamsById.get(String(champion.team_id)) : null
          const displayName = linkedTeam?.name || champion.team_name || 'Champion'

          return (
            <div key={champion.id} style={infoItem}>
              <span style={infoYear}>{champion.champion_year}</span>
              {linkedTeam ? (
                <HoverPreviewLink href={`/team/${linkedTeam.id}`} entityType="team" entityId={linkedTeam.id} style={infoLink}>
                  {displayName}
                </HoverPreviewLink>
              ) : (
                <span style={infoLink}>{displayName}</span>
              )}
            </div>
          )
        })}
        {champions.length === 0 ? <div style={emptyText}>No champions added for this league yet.</div> : null}
      </div>
    </div>
  )
}

function LeagueAwardsCard({
  title,
  awards,
}: {
  title: string
  awards: LeagueAwardRecord[]
}) {
  return (
    <div style={matchesCard} className="motion-section-card motion-section-card-delay-5">
      <div style={sectionHeader}>{title}</div>
      <div style={infoGrid}>
        {awards.map((award) => (
          <div key={award.id} style={infoItem}>
            <span style={infoLink}>{award.award || '-'}</span>
          </div>
        ))}
        {awards.length === 0 ? <div style={emptyText}>No awards added for this league yet.</div> : null}
      </div>
    </div>
  )
}

const pageWrap = {
  minHeight: '100vh',
  background: '#e9edf3',
  padding: '12px 8px 28px 8px',
  color: '#071d2d',
  fontFamily: 'var(--font-inter), sans-serif',
}

const shell = {
  maxWidth: 920,
  margin: '0 auto',
}

const leagueHeroCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  padding: '22px 22px 18px 22px',
  marginBottom: 12,
}

const heroTitleRow = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 18,
}

const leagueTitle = {
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#071d2d',
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.06em',
}

const titleFlag = {
  width: 22,
  height: 14,
  objectFit: 'cover' as const,
  border: '1px solid #83909d',
}

const leagueSubtitle = {
  marginTop: 6,
  color: '#071d2d',
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '-0.03em',
}

const teamRosterCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  marginBottom: 14,
}

const sectionHeader = {
  background: '#123f58',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  padding: '9px 12px',
  textTransform: 'uppercase' as const,
  fontFamily: 'var(--font-inter), sans-serif',
}

const teamGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '8px 24px',
  padding: '12px 16px 14px 16px',
}

const teamLink = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#006eb7',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 600,
}

const teamFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #9eabb6',
}

const teamLogo = {
  width: 18,
  height: 18,
  objectFit: 'contain' as const,
}

const emptyText = {
  gridColumn: '1 / -1',
  color: '#607487',
  fontSize: 12,
  padding: '4px 0',
}

const standingsCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  marginBottom: 14,
}

const leaderboardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 14,
}

const allTimeWrap = {
  marginBottom: 14,
}

const leagueGameTypeTabs = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 2,
  marginBottom: 10,
}

const leagueGameTypeTab = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #bfcbd5',
  borderBottom: 'none',
  borderTopLeftRadius: 5,
  borderTopRightRadius: 5,
  background: '#eef2f5',
  color: '#0f2a3c',
  fontSize: 11,
  fontWeight: 800,
  fontFamily: 'var(--font-inter), sans-serif',
  lineHeight: 1.1,
  padding: '10px 18px',
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
}

const leagueGameTypeTabActive = {
  ...leagueGameTypeTab,
  background: '#123f58',
  color: '#fff',
}

const leaderboardCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
}

const matchesCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  marginBottom: 14,
}

const nationalityGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '10px 26px',
  padding: '14px 14px 16px 14px',
}

const nationalityItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#006eb7',
  fontSize: 12,
  fontWeight: 600,
  minHeight: 16,
}

const nationalityText = {
  color: '#006eb7',
}

const infoGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '8px 24px',
  padding: '14px 14px 16px 14px',
}

const infoItem = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  minHeight: 18,
  fontSize: 12,
}

const infoYear = {
  color: '#006eb7',
  fontWeight: 700,
}

const infoLink = {
  color: '#006eb7',
  textDecoration: 'none',
}

const standingsTableWrap = {
  width: '100%',
  overflowX: 'auto' as const,
}

const standingSeasonBar = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr 24px',
  alignItems: 'center',
  gap: 6,
  background: '#f5f7f9',
  borderBottom: '1px solid #d6dde5',
  padding: '10px 12px',
}

const standingSeasonSelect = {
  height: 28,
  border: '1px solid #c8d2db',
  borderRadius: 3,
  background: '#fff',
  color: '#1c3244',
  fontSize: 12,
  padding: '0 8px',
  width: '100%',
}

const seasonArrowButton = {
  width: 24,
  height: 28,
  border: 'none',
  background: 'transparent',
  color: '#006eb7',
  cursor: 'pointer',
  fontSize: 28,
  lineHeight: 1,
  padding: 0,
}

const standingsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 11,
  fontFamily: 'var(--font-inter), sans-serif',
}

const standingsHeadRow = {
  background: '#c51e2d',
}

const standingRankTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '7px 8px',
  width: 32,
  fontWeight: 800,
}

const standingTeamTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '7px 8px',
  minWidth: 180,
  fontWeight: 800,
}

const standingStatTh = {
  color: '#fff',
  textAlign: 'center' as const,
  padding: '7px 8px',
  width: 52,
  fontWeight: 800,
}

const matchesDateTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '7px 8px',
  width: 170,
  fontWeight: 800,
}

const matchesTeamTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '7px 8px',
  minWidth: 170,
  fontWeight: 800,
}

const matchesScoreTh = {
  color: '#fff',
  textAlign: 'center' as const,
  padding: '7px 8px',
  width: 110,
  fontWeight: 800,
}

const standingRow = {
  background: '#fff',
}

const standingRowAlt = {
  background: '#e8ebef',
}

const divisionRow = {
  background: '#d7e7f0',
}

const standingRankTd = {
  padding: '7px 8px',
  color: '#1f3445',
}

const standingTeamTd = {
  padding: '7px 8px',
  color: '#1f3445',
}

const standingStatTd = {
  padding: '7px 8px',
  color: '#1f3445',
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
}

const standingPtsTd = {
  ...standingStatTd,
  background: '#cfd5db',
  fontWeight: 700,
}

const divisionCell = {
  padding: '8px 12px',
  color: '#123f58',
  fontSize: 12,
  fontWeight: 800,
}

const standingTag = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 999,
  background: '#e8f2ea',
  color: '#1c6b36',
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
}

const standingLegendWrap = {
  borderTop: '1px solid #d7e0e8',
  background: '#fff',
}

const standingLegendRow = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr',
  borderTop: '1px solid #e5ebf0',
}

const standingLegendTag = {
  padding: '6px 10px',
  color: '#c51e2d',
  fontSize: 18,
  fontWeight: 800,
  fontStyle: 'italic',
  textAlign: 'center' as const,
}

const standingLegendText = {
  padding: '8px 12px',
  color: '#1f3445',
  fontSize: 13,
}

const standingPrimaryTd = {
  ...standingStatTd,
  background: '#cfd5db',
}

const matchesDateTd = {
  padding: '7px 8px',
  color: '#1f3445',
  whiteSpace: 'nowrap' as const,
}

const matchesScoreTd = {
  padding: '7px 8px',
  color: '#1f3445',
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
}

const showMoreBar = {
  background: '#209b52',
  color: '#fff',
  textAlign: 'center' as const,
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  padding: '11px 12px',
  textDecoration: 'none',
  display: 'block',
}

const errorText = {
  marginTop: 12,
  color: '#b42318',
  fontSize: 12,
}
