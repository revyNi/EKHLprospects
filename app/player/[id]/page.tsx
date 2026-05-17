'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { loadAdminStatus } from '../../../lib/adminClient'
import HoverPreviewLink from '../../../components/HoverPreviewLink'

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  league?: string | null
}

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  category?: string | null
}

type PlayerRoleRecord = {
  id: string
  name: string
  description?: string | null
}

type PlayerRoleAssignmentRecord = {
  player_id?: string | null
  role_id?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  display_name?: string | null
  team_id?: string | null
  number?: number | null
  position?: string | null
  nationality?: string | null
  player_type?: string | null
  player_type_description?: string | null
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

type EditableStatSide = {
  id?: string
  position: string
  gp: string
  goals: string
  assists: string
  points: string
  hits: string
  plus_minus: string
  shots: string
  toi: string
  gk_saves: string
  gk_shots_against: string
  gk_percentage: string
  goalie_wins: string
  goalie_losses: string
  goalie_overtime_losses: string
  goalie_shutouts: string
  goalie_goals_against: string
}

type EditableStatRecord = {
  team_id?: string | null
  season_id?: string | null
  regular: EditableStatSide
  playoffs: EditableStatSide
}

type AwardRecord = {
  id: string
  player_id?: string | null
  season?: string | null
  league?: string | null
  award?: string | null
}

type EditableAwardRecord = {
  id?: string
  season: string
  league: string
  award: string
}

type FullStat = StatRecord & {
  team?: TeamRecord | null
  season?: SeasonRecord | null
  match?: MatchRecord | null
}

type GroupedStat = {
  season: string
  team: string
  teamId: string | null
  logo: string | null
  teamLeague: string | null
  position: string | null
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  plusMinus: number
  shots: number
  toi: number
  saves: number
  shotsAgainst: number
  conceded: number
  gk_percentage: number
  goalieWins: number
  goalieLosses: number
  goalieOvertimeLosses: number
  goalieShutouts: number
}

type CareerTotal = {
  league: string
  teamId: string | null
  logo: string | null
  teamLeague: string | null
  seasons: number
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  plusMinus: number
  shots: number
  toi: number
  saves: number
  shotsAgainst: number
  conceded: number
  gk_percentage: number
  calcPct: string
  goalieWins: number
  goalieLosses: number
  goalieOvertimeLosses: number
  goalieShutouts: number
}

function getFlagUrl(code?: string | null) {
  if (!code) return null
  return `https://flagcdn.com/w20/${code.toLowerCase().slice(0, 2)}.png`
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

function normalizeLookupValue(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getCompactTeamName(name?: string | null) {
  const trimmed = (name || '').trim()
  if (!trimmed) return '-'
  if (trimmed.length <= 12) return trimmed

  const genericWords = new Set(['team', 'hc', 'hk', 'if', 'ik', 'bk', 'sk', 'fk', 'fc', 'club'])
  const words = trimmed.split(/\s+/).filter(Boolean)
  const meaningfulWords = words.filter((word) => !genericWords.has(word.toLowerCase()))

  if (meaningfulWords.length) {
    const firstMeaningful = meaningfulWords[0]
    if (firstMeaningful.length <= 12) return firstMeaningful

    const lastMeaningful = meaningfulWords[meaningfulWords.length - 1]
    if (lastMeaningful.length <= 12) return lastMeaningful
  }

  return trimmed.slice(0, 12)
}

function getSeasonSortValue(seasonLabel?: string | null) {
  const value = (seasonLabel || '').trim()
  if (!value) return Number.MAX_SAFE_INTEGER

  const seasonCountMatch = value.match(/^S(\d+)$/i)
  if (seasonCountMatch) {
    return Number(seasonCountMatch[1])
  }

  const yearMatch = value.match(/(\d{4})/)
  if (yearMatch) {
    return Number(yearMatch[1])
  }

  const numberMatch = value.match(/(\d+)/)
  if (numberMatch) {
    return Number(numberMatch[1])
  }

  return Number.MAX_SAFE_INTEGER
}

function getPrimaryTeam(teamValue?: TeamRecord | TeamRecord[] | null) {
  if (Array.isArray(teamValue)) {
    return teamValue[0] || null
  }

  return teamValue || null
}

function resolveLeagueRecord(teamLeagueValue: string | null | undefined, leagues: LeagueRecord[]) {
  const rawValue = (teamLeagueValue || '').trim()
  const normalizedValue = normalizeLookupValue(rawValue)

  if (!rawValue || !normalizedValue) return null

  return (
    leagues.find((league) => String(league.id) === rawValue) ||
    leagues.find((league) =>
      [league.name, league.display_name]
        .filter(Boolean)
        .some((value) => normalizeLookupValue(value) === normalizedValue)
    ) ||
    leagues.find((league) =>
      [league.name, league.display_name]
        .filter(Boolean)
        .some((value) => {
          const normalizedLeagueValue = normalizeLookupValue(value)
          return (
            normalizedLeagueValue.includes(normalizedValue) ||
            normalizedValue.includes(normalizedLeagueValue)
          )
        })
    ) ||
    null
  )
}

function toInputValue(value?: string | number | null) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function makeEditableStatSide(stat?: FullStat | null): EditableStatSide {
  return {
    id: stat?.id,
    position: toInputValue(stat?.position),
    gp: toInputValue(stat?.gp),
    goals: toInputValue(stat?.goals),
    assists: toInputValue(stat?.assists),
    points: toInputValue(stat?.points),
    hits: toInputValue(stat?.hits),
    plus_minus: toInputValue(stat?.plus_minus),
    shots: toInputValue(stat?.shots),
    toi: toInputValue(stat?.toi),
    gk_saves: toInputValue(stat?.gk_saves),
    gk_shots_against: toInputValue(stat?.gk_shots_against),
    gk_percentage: toInputValue(stat?.gk_percentage),
    goalie_wins: toInputValue(stat?.goalie_wins),
    goalie_losses: toInputValue(stat?.goalie_losses),
    goalie_overtime_losses: toInputValue(stat?.goalie_overtime_losses),
    goalie_shutouts: toInputValue(stat?.goalie_shutouts),
    goalie_goals_against: toInputValue(stat?.goalie_goals_against),
  }
}

function mergeEditableStats(stats: FullStat[]) {
  const rows = new Map<string, EditableStatRecord[]>()

  stats.forEach((stat) => {
    const key = `${stat.season_id || 'no-season'}-${stat.team_id || `no-team-${stat.id}`}`
    const bucket = rows.get(key) || []
    const sideName = (stat.game_type || 'regular') === 'playoffs' ? 'playoffs' : 'regular'
    const existing = bucket.find(
      (row) => !row[sideName].id && !statSideHasValues(row[sideName])
    ) || {
      team_id: stat.team_id || '',
      season_id: stat.season_id || '',
      regular: makeEditableStatSide(),
      playoffs: makeEditableStatSide(),
    }

    if (!bucket.includes(existing)) {
      bucket.push(existing)
    }

    if (sideName === 'playoffs') {
      existing.playoffs = makeEditableStatSide(stat)
    } else {
      existing.regular = makeEditableStatSide(stat)
    }

    rows.set(key, bucket)
  })

  return Array.from(rows.values()).flat()
}

function statSideHasValues(side: EditableStatSide) {
  const values = [
    side.gp,
    side.position,
    side.goals,
    side.assists,
    side.points,
    side.hits,
    side.plus_minus,
    side.shots,
    side.toi,
    side.gk_saves,
    side.gk_shots_against,
    side.gk_percentage,
    side.goalie_wins,
    side.goalie_losses,
    side.goalie_overtime_losses,
    side.goalie_shutouts,
    side.goalie_goals_against,
  ]

  return values.some((value) => value.trim() !== '')
}

function makeEditableAward(award?: AwardRecord | null): EditableAwardRecord {
  return {
    id: award?.id,
    season: award?.season || '',
    league: award?.league || '',
    award: award?.award || '',
  }
}

function makeClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined
}

function getStatRole(position?: string | null, fallbackPosition?: string | null) {
  return isGoaliePosition(position || fallbackPosition) ? 'goalie' : 'skater'
}

const commonPositionOptions = ['C', 'LW', 'RW', 'D', 'F', 'G']

export default function PlayerPage() {
  const params = useParams()
  const playerId = params?.id as string

  const [player, setPlayer] = useState<PlayerRecord | null>(null)
  const [leagues, setLeagues] = useState<LeagueRecord[]>([])
  const [playerRoles, setPlayerRoles] = useState<PlayerRoleRecord[]>([])
  const [playerRoleAssignments, setPlayerRoleAssignments] = useState<PlayerRoleAssignmentRecord[]>([])
  const [allStats, setAllStats] = useState<FullStat[]>([])
  const [stats, setStats] = useState<FullStat[]>([])
  const [grouped, setGrouped] = useState<GroupedStat[]>([])
  const [awards, setAwards] = useState<AwardRecord[]>([])
  const [seasonOptions, setSeasonOptions] = useState<SeasonRecord[]>([])
  const [teamOptions, setTeamOptions] = useState<TeamRecord[]>([])
  const [statsView, setStatsView] = useState<'default' | 'perGame'>('default')
  const [tab, setTab] = useState<'regular' | 'playoffs' | 'combined'>('regular')
  const [careerRole, setCareerRole] = useState<'skater' | 'goalie'>('skater')
  const [awardView, setAwardView] = useState<'season' | 'league'>('season')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [editorFacts, setEditorFacts] = useState({
    name: '',
    display_name: '',
    team_id: '',
    number: '',
    position: '',
    nationality: '',
    player_type: '',
    player_type_description: '',
    image_url: '',
  })
  const [editorStats, setEditorStats] = useState<EditableStatRecord[]>([])
  const [editorAwards, setEditorAwards] = useState<EditableAwardRecord[]>([])
  const [deletedStatIds, setDeletedStatIds] = useState<string[]>([])
  const [deletedAwardIds, setDeletedAwardIds] = useState<string[]>([])
  const [editorRoleIds, setEditorRoleIds] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true

    async function checkAdminStatus() {
      const status = await loadAdminStatus()
      if (!isMounted) return
      setIsAdmin(status.isAdmin)
    }

    void checkAdminStatus()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkAdminStatus()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!playerId) return

    async function fetchData() {
      setErrorMessage('')

      const [
        { data: playerData, error: playerError },
        { data: statsRaw },
        { data: teams },
        { data: seasons },
        { data: matches },
        { data: leaguesData },
        { data: playerRolesData },
        { data: playerRoleAssignmentsData },
        { data: awardsRaw },
      ] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, display_name, team_id, number, position, nationality, player_type, player_type_description, image_url, teams(id, name, logo_url, league)')
          .eq('id', playerId)
          .single(),
        supabase.from('stats').select('*').eq('player_id', playerId),
        supabase.from('teams').select('id, name, logo_url, league'),
        supabase.from('seasons').select('id, name'),
        supabase.from('matches').select('*'),
        supabase.from('leagues').select('id, name, display_name, category'),
        supabase.from('player_roles').select('id, name, description'),
        supabase.from('player_role_assignments').select('player_id, role_id').eq('player_id', playerId),
        supabase
          .from('awards')
          .select('id, player_id, season, league, award')
          .eq('player_id', playerId),
      ])

      if (playerError) {
        setErrorMessage(playerError.message)
        setPlayer(null)
        setLeagues([])
        setAllStats([])
        setStats([])
        setGrouped([])
        setAwards([])
        setSeasonOptions([])
        setTeamOptions([])
        setPlayerRoles([])
        setPlayerRoleAssignments([])
        return
      }

      const playerRow = (playerData as PlayerQueryRecord | null) || null
      const playerRecord: PlayerRecord | null = playerRow
        ? {
            ...playerRow,
            teams: playerRow.teams ?? null,
          }
        : null
      setPlayer(playerRecord)
      setLeagues((leaguesData as LeagueRecord[]) || [])
      setPlayerRoles((playerRolesData as PlayerRoleRecord[]) || [])
      setPlayerRoleAssignments((playerRoleAssignmentsData as PlayerRoleAssignmentRecord[]) || [])
      setSeasonOptions((seasons as SeasonRecord[]) || [])
      setTeamOptions((teams as TeamRecord[]) || [])

      const fullStats: FullStat[] = ((statsRaw as StatRecord[]) || []).map((stat) => ({
        ...stat,
        team:
          ((teams as TeamRecord[]) || []).find(
            (team) => String(team.id) === String(stat.team_id)
          ) || null,
        season:
          ((seasons as SeasonRecord[]) || []).find(
            (season) => String(season.id) === String(stat.season_id)
          ) || null,
        match:
          ((matches as MatchRecord[]) || []).find(
            (match) => String(match.id) === String(stat.match_id)
          ) || null,
      }))
      setAllStats(fullStats)

      const filteredStats = fullStats
        .filter((stat) =>
          tab === 'combined' ? true : (stat.game_type || 'regular') === tab
        )
        .sort((a, b) => {
          const dateA = a.match?.game_date ? new Date(a.match.game_date).getTime() : 0
          const dateB = b.match?.game_date ? new Date(b.match.game_date).getTime() : 0
          return dateB - dateA
        })

      setStats(filteredStats)

      const groupedMap: Record<string, GroupedStat> = {}

      filteredStats.forEach((stat) => {
        const season = stat.season?.name || 'Unknown'
        const team = stat.team?.name || 'Unknown'
        const key = `${season}-${team}`

        if (!groupedMap[key]) {
          groupedMap[key] = {
            season,
            team,
            teamId: stat.team?.id || null,
            logo: stat.team?.logo_url || null,
            teamLeague: stat.team?.league || null,
            position: stat.position || playerRecord?.position || null,
            gp: 0,
            goals: 0,
            assists: 0,
            points: 0,
            hits: 0,
            plusMinus: 0,
            shots: 0,
            toi: 0,
            saves: 0,
            shotsAgainst: 0,
            conceded: 0,
            gk_percentage: 0,
            goalieWins: 0,
            goalieLosses: 0,
            goalieOvertimeLosses: 0,
            goalieShutouts: 0,
          }
        }

        groupedMap[key].gp += Number(stat.gp) || 0
        groupedMap[key].goals += Number(stat.goals) || 0
        groupedMap[key].assists += Number(stat.assists) || 0
        groupedMap[key].points +=
          stat.points !== null && stat.points !== undefined
            ? Number(stat.points) || 0
            : (Number(stat.goals) || 0) + (Number(stat.assists) || 0)
        groupedMap[key].hits += Number(stat.hits) || 0
        groupedMap[key].plusMinus += Number(stat.plus_minus) || 0
        groupedMap[key].shots += Number(stat.shots) || 0
        groupedMap[key].toi += Number(stat.toi) || 0

        const saves = Number(stat.gk_saves) || 0
        const against = Number(stat.gk_shots_against) || 0
        const goalsAgainst =
          stat.goalie_goals_against !== null && stat.goalie_goals_against !== undefined
            ? Number(stat.goalie_goals_against) || 0
            : Math.max(against - saves, 0)

        groupedMap[key].saves += saves
        groupedMap[key].shotsAgainst += against
        groupedMap[key].conceded += goalsAgainst
        groupedMap[key].goalieWins += Number(stat.goalie_wins) || 0
        groupedMap[key].goalieLosses += Number(stat.goalie_losses) || 0
        groupedMap[key].goalieOvertimeLosses += Number(stat.goalie_overtime_losses) || 0
        groupedMap[key].goalieShutouts += Number(stat.goalie_shutouts) || 0

        if (stat.gk_percentage) {
          groupedMap[key].gk_percentage = stat.gk_percentage
        }
      })
      setGrouped(
        Object.values(groupedMap).sort(
          (a, b) =>
            getSeasonSortValue(a.season) - getSeasonSortValue(b.season) ||
            a.season.localeCompare(b.season) ||
            a.team.localeCompare(b.team)
        )
      )
      setAwards((awardsRaw as AwardRecord[]) || [])
    }

    fetchData()
  }, [playerId, tab, reloadKey])

  useEffect(() => {
    if (!player) return

    const hasGoalieStats = allStats.some((stat) => getStatRole(stat.position, player.position) === 'goalie')
    const hasSkaterStats = allStats.some((stat) => getStatRole(stat.position, player.position) === 'skater')

    if (hasGoalieStats && !hasSkaterStats) {
      setCareerRole('goalie')
      return
    }

    if (!hasGoalieStats && hasSkaterStats) {
      setCareerRole('skater')
      return
    }

    if (hasGoalieStats && hasSkaterStats) {
      setCareerRole((current) => current || (isGoaliePosition(player.position) ? 'goalie' : 'skater'))
    }
  }, [allStats, player])

  if (!player && !errorMessage) {
    return <div style={{ minHeight: '40vh' }} />
  }

  if (!player) {
    return <div style={{ padding: 24 }}>{errorMessage || 'Player not found.'}</div>
  }

  const last5 = stats.slice(0, 5)

  const total = (items: FullStat[], field: keyof FullStat) =>
    items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0)

  const avg = (value: number, gp: number) => (gp ? (value / gp).toFixed(1) : '0')
  const showStat = (value: number, gp: number) =>
    statsView === 'perGame' ? avg(value, gp) : value
  const showPlusMinus = (value: number, gp: number) =>
    statsView === 'perGame' ? avg(value, gp) : formatPlusMinus(value)

  const assignedPlayerRoles = playerRoles.filter((role) =>
    playerRoleAssignments.some((assignment) => assignment.role_id === role.id)
  )
  const fallbackPlayerRole =
    player.player_type
      ? playerRoles.find((role) => role.name.trim().toLowerCase() === player.player_type?.trim().toLowerCase())
      : null
  const visiblePlayerRoles = assignedPlayerRoles.length
    ? assignedPlayerRoles
    : fallbackPlayerRole
      ? [fallbackPlayerRole]
      : player.player_type
        ? [
            {
              id: 'legacy-role',
              name: player.player_type,
              description: player.player_type_description || '',
            },
          ]
        : []
  const displayName = player.display_name || player.name
  const primaryTeam = getPrimaryTeam(player.teams)
  const teamName = primaryTeam?.name || 'No Team'
  const flagUrl = getFlagUrl(player.nationality)
  const availableCareerRoles = Array.from(
    new Set(allStats.map((stat) => getStatRole(stat.position, player.position)))
  ) as Array<'skater' | 'goalie'>
  const showCareerRoleTabs = availableCareerRoles.length > 1
  const effectiveCareerRole = showCareerRoleTabs ? careerRole : availableCareerRoles[0] || (isGoaliePosition(player.position) ? 'goalie' : 'skater')
  const isGoalie = effectiveCareerRole === 'goalie'
  const playerLeague = resolveLeagueRecord(primaryTeam?.league, leagues)
  const playerLeagueLabel = playerLeague?.name || primaryTeam?.league || 'No League'
  const currentSeasonLabel = stats[0]?.season?.name || allStats[0]?.season?.name || ''
  const last10 = stats.slice(0, 10)
  const teamsById = new Map(teamOptions.map((team) => [String(team.id), team]))
  const visibleGameLog = stats
    .filter((stat) => getStatRole(stat.position, player.position) === effectiveCareerRole)
    .filter((stat) => {
      return (
        Boolean(stat.match_id) ||
        Boolean(stat.match?.game_date) ||
        Boolean(stat.team_id) ||
        (Number(stat.gp) || 0) > 0
      )
    })
  const gameLogRows = visibleGameLog.map((stat) => {
    const match = stat.match
    const team = stat.team || (stat.team_id ? teamsById.get(String(stat.team_id)) || null : null)
    const isHome = team && match ? String(match.home_team_id) === String(team.id) : false
    const opponentId =
      team && match
        ? isHome
          ? match.visiting_team_id
          : match.home_team_id
        : null
    const opponent = opponentId ? teamsById.get(String(opponentId)) || null : null
    const matchupLabel = opponent
      ? `${isHome ? 'vs' : '@'} ${opponent.name}`
      : team?.name || '-'
    const compactMatchupLabel = opponent ? getCompactTeamName(opponent.name) : getCompactTeamName(team?.name)
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
      compactMatchupLabel,
      goalsAgainst,
      result,
      score: formatMatchScore(match),
      seasonLabel: stat.season?.name || '-',
      typeLabel: formatGameTypeLabel(stat.game_type),
    }
  })
  const gameLogSeasonOptions = Array.from(
    new Set(gameLogRows.map((row) => row.seasonLabel).filter((value) => value && value !== '-'))
  ).sort((a, b) => getSeasonSortValue(a) - getSeasonSortValue(b) || a.localeCompare(b))
  const displayedGameLogRows = gameLogRows.slice(0, 8)
  const gameLogSummary = displayedGameLogRows.reduce(
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
  const visibleGrouped = grouped.filter(
    (group) => getStatRole(group.position, player.position) === effectiveCareerRole
  )
  const careerTotals = visibleGrouped.reduce<CareerTotal[]>((totals, seasonRow) => {
    const existing = totals.find((item) => item.league === seasonRow.team)
    const calcPct = formatSavePct(seasonRow.saves, seasonRow.shotsAgainst, seasonRow.gk_percentage)

    if (existing) {
      existing.seasons += 1
      existing.gp += seasonRow.gp
      existing.goals += seasonRow.goals
      existing.assists += seasonRow.assists
      existing.points += seasonRow.points
      existing.hits += seasonRow.hits
      existing.plusMinus += seasonRow.plusMinus
      existing.shots += seasonRow.shots
      existing.toi += seasonRow.toi
      existing.saves += seasonRow.saves
      existing.shotsAgainst += seasonRow.shotsAgainst
      existing.conceded += seasonRow.conceded
      existing.goalieWins += seasonRow.goalieWins
      existing.goalieLosses += seasonRow.goalieLosses
      existing.goalieOvertimeLosses += seasonRow.goalieOvertimeLosses
      existing.goalieShutouts += seasonRow.goalieShutouts
      if (seasonRow.gk_percentage) {
        existing.gk_percentage = seasonRow.gk_percentage
      }
      existing.calcPct = formatSavePct(existing.saves, existing.shotsAgainst, existing.gk_percentage)
      return totals
    }

    totals.push({
      league: seasonRow.team,
      teamId: seasonRow.teamId,
      logo: seasonRow.logo,
      teamLeague: seasonRow.teamLeague,
      seasons: 1,
      gp: seasonRow.gp,
      goals: seasonRow.goals,
      assists: seasonRow.assists,
      points: seasonRow.points,
      hits: seasonRow.hits,
      plusMinus: seasonRow.plusMinus,
      shots: seasonRow.shots,
      toi: seasonRow.toi,
      saves: seasonRow.saves,
      shotsAgainst: seasonRow.shotsAgainst,
      conceded: seasonRow.conceded,
      gk_percentage: seasonRow.gk_percentage,
      calcPct,
      goalieWins: seasonRow.goalieWins,
      goalieLosses: seasonRow.goalieLosses,
      goalieOvertimeLosses: seasonRow.goalieOvertimeLosses,
      goalieShutouts: seasonRow.goalieShutouts,
    })

    return totals
  }, []).sort((a, b) => a.seasons - b.seasons || a.league.localeCompare(b.league))
  const groupedAwards = awards.reduce<Record<string, string[]>>((acc, awardRow) => {
    const key =
      awardView === 'season'
        ? awardRow.season || 'Unknown'
        : awardRow.league || 'Unknown'

    if (!acc[key]) {
      acc[key] = []
    }

    if (awardRow.award) {
      acc[key].push(awardRow.award)
    }

    return acc
  }, {})
  const awardGroups = Object.entries(groupedAwards)
  const getLeagueForTeamLeague = (teamLeague?: string | null) =>
    resolveLeagueRecord(teamLeague, leagues)

  function openEditor() {
    if (!player || !isAdmin) return

    setSaveMessage('')
    setDeletedStatIds([])
    setDeletedAwardIds([])
    setEditorFacts({
      name: player.name || '',
      display_name: player.display_name || '',
      team_id: primaryTeam?.id || player.team_id || '',
      number: toInputValue(player.number),
      position: player.position || '',
      nationality: player.nationality || '',
      player_type: player.player_type || '',
      player_type_description: player.player_type_description || '',
      image_url: player.image_url || '',
    })
    setEditorRoleIds(
      playerRoleAssignments
        .map((assignment) => assignment.role_id)
        .filter((roleId): roleId is string => Boolean(roleId))
    )
    setEditorStats(mergeEditableStats(allStats))
    setEditorAwards(awards.map((award) => makeEditableAward(award)))
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setIsEditorOpen(false)
    setDeletedStatIds([])
    setDeletedAwardIds([])
    setSaveMessage('')
  }

  function addStatRow() {
    setEditorStats((current) => [
      ...current,
      {
        team_id: primaryTeam?.id || '',
        season_id: '',
        regular: makeEditableStatSide(),
        playoffs: makeEditableStatSide(),
      },
    ])
  }

  function updateStatRow(index: number, field: 'season_id' | 'team_id', value: string) {
    setEditorStats((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  function updateStatSideRow(
    index: number,
    side: 'regular' | 'playoffs',
    field: keyof EditableStatSide,
    value: string
  ) {
    setEditorStats((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [side]: {
                ...row[side],
                [field]: value,
              },
            }
          : row
      )
    )
  }

  function removeStatRow(index: number) {
    const statToRemove = editorStats[index]
    const idsToDelete = [statToRemove?.regular.id, statToRemove?.playoffs.id].filter(Boolean) as string[]

    if (idsToDelete.length) {
      setDeletedStatIds((ids) => Array.from(new Set([...ids, ...idsToDelete])))
      setSaveMessage(
        `${idsToDelete.length} saved stat row${idsToDelete.length === 1 ? '' : 's'} marked for deletion. Save changes to delete from the database.`
      )
    }

    setEditorStats((current) => {
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  function addAwardRow() {
    setEditorAwards((current) => [...current, makeEditableAward()])
  }

  function updateAwardRow(index: number, field: keyof EditableAwardRecord, value: string) {
    setEditorAwards((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  function removeAwardRow(index: number) {
    setEditorAwards((current) => {
      const awardToRemove = current[index]
      if (awardToRemove?.id) {
        setDeletedAwardIds((ids) => [...ids, awardToRemove.id as string])
      }
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  function toggleEditorRole(roleId: string) {
    setEditorRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((currentRoleId) => currentRoleId !== roleId)
        : [...current, roleId]
    )
  }

  async function saveEditor() {
    if (!player || !isAdmin) return

    setIsSaving(true)
    setSaveMessage('')

    const factsPayload = {
      name: editorFacts.name.trim(),
      display_name: editorFacts.display_name.trim() || null,
      team_id: editorFacts.team_id || null,
      number: editorFacts.number.trim() ? Number(editorFacts.number) : null,
      position: editorFacts.position.trim() || null,
      nationality: editorFacts.nationality.trim() || null,
      player_type: editorFacts.player_type.trim() || null,
      player_type_description: editorFacts.player_type_description.trim() || null,
      image_url: editorFacts.image_url.trim() || null,
    }

    const statIdsToDeleteFromEmptyRows: string[] = []
    const statRowsToSave = editorStats.flatMap((row) => {
      const buildPayload = (side: EditableStatSide, gameType: 'regular' | 'playoffs') => ({
        id: side.id,
        player_id: playerId,
        team_id: row.team_id || null,
        season_id: row.season_id || null,
        position: side.position.trim() || editorFacts.position.trim() || null,
        game_type: gameType,
        gp: side.gp.trim() ? Number(side.gp) : null,
        goals: side.goals.trim() ? Number(side.goals) : null,
        assists: side.assists.trim() ? Number(side.assists) : null,
        points: side.points.trim() ? Number(side.points) : null,
        hits: side.hits.trim() ? Number(side.hits) : null,
        plus_minus: side.plus_minus.trim() ? Number(side.plus_minus) : null,
        shots: side.shots.trim() ? Number(side.shots) : null,
        toi: side.toi.trim() ? Number(side.toi) : null,
        gk_saves: side.gk_saves.trim() ? Number(side.gk_saves) : null,
        gk_shots_against: side.gk_shots_against.trim() ? Number(side.gk_shots_against) : null,
        gk_percentage: side.gk_percentage.trim() ? Number(side.gk_percentage) : null,
        goalie_wins: side.goalie_wins.trim() ? Number(side.goalie_wins) : null,
        goalie_losses: side.goalie_losses.trim() ? Number(side.goalie_losses) : null,
        goalie_overtime_losses: side.goalie_overtime_losses.trim()
          ? Number(side.goalie_overtime_losses)
          : null,
        goalie_shutouts: side.goalie_shutouts.trim() ? Number(side.goalie_shutouts) : null,
        goalie_goals_against: side.goalie_goals_against.trim()
          ? Number(side.goalie_goals_against)
          : null,
      })

      const payloads = []

      if (statSideHasValues(row.regular)) {
        payloads.push(buildPayload(row.regular, 'regular'))
      } else if (row.regular.id) {
        statIdsToDeleteFromEmptyRows.push(row.regular.id)
      }

      if (statSideHasValues(row.playoffs)) {
        payloads.push(buildPayload(row.playoffs, 'playoffs'))
      } else if (row.playoffs.id) {
        statIdsToDeleteFromEmptyRows.push(row.playoffs.id)
      }

      return payloads
    })

    const existingStatRows = statRowsToSave.filter((row) => row.id)
    const newStatRows = statRowsToSave.filter((row) => !row.id)

    const existingAwards = editorAwards
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id,
        player_id: playerId,
        season: row.season.trim() || null,
        league: row.league.trim() || null,
        award: row.award.trim() || null,
      }))

    const newAwards = editorAwards
      .filter((row) => !row.id)
      .map((row) => ({
        id: makeClientId(),
        player_id: playerId,
        season: row.season.trim() || null,
        league: row.league.trim() || null,
        award: row.award.trim() || null,
      }))

    const roleAssignmentRows = editorRoleIds.map((roleId) => ({
      player_id: playerId,
      role_id: roleId,
    }))

    const savedStatIds = new Set(
      existingStatRows.map((row) => row.id).filter((id): id is string => Boolean(id))
    )
    const finalDeletedStatIds = Array.from(new Set([...deletedStatIds, ...statIdsToDeleteFromEmptyRows])).filter(
      (id) => !savedStatIds.has(id)
    )

    const runSaveStep = async (action: PromiseLike<{ error: { message: string } | null }>) => {
      const result = await action
      if (result.error) {
        throw new Error(result.error.message)
      }
    }

    try {
      await runSaveStep(supabase.from('players').update(factsPayload).eq('id', playerId))

      if (finalDeletedStatIds.length) {
        await runSaveStep(
          supabase.from('stats').delete().eq('player_id', playerId).in('id', finalDeletedStatIds)
        )
      }
      if (existingStatRows.length) {
        await runSaveStep(supabase.from('stats').upsert(existingStatRows))
      }
      if (newStatRows.length) {
        await runSaveStep(
          supabase.from('stats').insert(
            newStatRows.map((row) => ({
              ...row,
              id: row.id || makeClientId(),
            }))
          )
        )
      }
      if (existingAwards.length) {
        await runSaveStep(supabase.from('awards').upsert(existingAwards))
      }
      if (newAwards.length) {
        await runSaveStep(supabase.from('awards').insert(newAwards))
      }
      if (deletedAwardIds.length) {
        await runSaveStep(supabase.from('awards').delete().in('id', deletedAwardIds))
      }
      await runSaveStep(supabase.from('player_role_assignments').delete().eq('player_id', playerId))
      if (roleAssignmentRows.length) {
        await runSaveStep(supabase.from('player_role_assignments').insert(roleAssignmentRows))
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Could not save player changes.')
      setIsSaving(false)
      return
    }

    setSaveMessage('Saved.')
    setIsSaving(false)
    setIsEditorOpen(false)
    setDeletedStatIds([])
    setDeletedAwardIds([])
    setReloadKey((value) => value + 1)
  }

  return (
    <div style={container} className="motion-page-root">
      <div style={heroCard} className="motion-hero-card">
        <div style={heroLeft}>
          <div style={playerPhotoWrap}>
            <img
              src={player.image_url || 'https://via.placeholder.com/180x180?text=Player'}
              alt={player.name}
              style={playerPhoto}
              className="motion-hero-image"
            />
          </div>

          <div style={heroTextWrap}>
            <div style={nameRow}>
              {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={nationFlag} /> : null}
              <h1 style={heroName}>{player.name}</h1>
            </div>

            <div style={heroSubtitle}>a.k.a. &quot;{displayName}&quot;</div>
            <div style={heroMeta}>
              <span>{player.number ? `#${player.number}` : '#--'}</span>
              {primaryTeam?.id ? (
                <HoverPreviewLink href={`/team/${primaryTeam.id}`} entityType="team" entityId={primaryTeam.id} style={heroMetaLink}>
                  {teamName}
                </HoverPreviewLink>
              ) : (
                <span>{teamName}</span>
              )}
              <span>/</span>
              {playerLeague ? (
                <HoverPreviewLink href={`/league/${playerLeague.id}`} entityType="league" entityId={playerLeague.id} style={heroMetaLink}>
                  {playerLeagueLabel}
                </HoverPreviewLink>
              ) : primaryTeam?.league ? (
                <HoverPreviewLink href={`/league/${encodeURIComponent(primaryTeam.league)}`} entityType="league" lookupValue={primaryTeam.league} style={heroMetaLink}>
                  {playerLeagueLabel}
                </HoverPreviewLink>
              ) : (
                <span>{playerLeagueLabel}</span>
              )}
              {currentSeasonLabel ? (
                <>
                  <span>-</span>
                  <span>{currentSeasonLabel}</span>
                </>
              ) : null}
            </div>

          </div>
        </div>

        <div style={heroRight}>
          <div style={last5Card}>
            <table style={miniStatsTable}>
              <thead>
                <tr>
                  <th style={miniHeadLeft}>GAMES</th>
                  <th style={miniHeadCell}>GP</th>
                  {isGoalie ? (
                    <>
                      <th style={miniHeadCell}>W</th>
                      <th style={miniHeadCell}>L</th>
                      <th style={miniHeadCell}>SV%</th>
                      <th style={miniHeadCell}>GAA</th>
                    </>
                  ) : (
                    <>
                      <th style={miniHeadCell}>G</th>
                      <th style={miniHeadCell}>A</th>
                      <th style={miniHeadCell}>TP</th>
                      <th style={miniHeadCell}>+/-</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={miniLabelCell}>Last 5 games</td>
                  <td style={miniValueCell}>{last5.length}</td>
                  {isGoalie ? (
                    <>
                      <td style={miniValueCell}>{total(last5, 'goalie_wins')}</td>
                      <td style={miniValueCell}>{total(last5, 'goalie_losses')}</td>
                      <td style={miniValueCell}>
                        {formatSavePct(total(last5, 'gk_saves'), total(last5, 'gk_shots_against'))}
                      </td>
                      <td style={miniValueCell}>
                        {formatGaa(
                          total(last5, 'goalie_goals_against') ||
                            Math.max(total(last5, 'gk_shots_against') - total(last5, 'gk_saves'), 0),
                          last5.length,
                          total(last5, 'toi')
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={miniValueCell}>{total(last5, 'goals')}</td>
                      <td style={miniValueCell}>{total(last5, 'assists')}</td>
                      <td style={miniValueCell}>{total(last5, 'points')}</td>
                      <td style={miniValueCell}>{total(last5, 'plus_minus')}</td>
                    </>
                  )}
                </tr>
                <tr>
                  <td style={miniLabelCell}>Last 10 games</td>
                  <td style={miniValueCell}>{last10.length}</td>
                  {isGoalie ? (
                    <>
                      <td style={miniValueCell}>{total(last10, 'goalie_wins')}</td>
                      <td style={miniValueCell}>{total(last10, 'goalie_losses')}</td>
                      <td style={miniValueCell}>
                        {formatSavePct(total(last10, 'gk_saves'), total(last10, 'gk_shots_against'))}
                      </td>
                      <td style={miniValueCell}>
                        {formatGaa(
                          total(last10, 'goalie_goals_against') ||
                            Math.max(total(last10, 'gk_shots_against') - total(last10, 'gk_saves'), 0),
                          last10.length,
                          total(last10, 'toi')
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={miniValueCell}>{total(last10, 'goals')}</td>
                      <td style={miniValueCell}>{total(last10, 'assists')}</td>
                      <td style={miniValueCell}>{total(last10, 'points')}</td>
                      <td style={miniValueCell}>{total(last10, 'plus_minus')}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div style={editorBar}>
          <button type="button" onClick={openEditor} style={editorButton}>
            Update Stats/Facts
          </button>
        </div>
      ) : null}

      <div style={topGrid}>
        <div style={sectionCard} className="motion-section-card motion-section-card-delay-1">
          <div style={sectionHeader}>PLAYER FACTS</div>
          <div style={factsGrid}>
            <Fact label="Position" value={player.position || 'N/A'} />
            <Fact label="Nationality" value={player.nationality || 'N/A'} />
            <Fact
              label="Player Role"
              value={
                visiblePlayerRoles.length ? (
                  <div style={roleListWrap}>
                    {visiblePlayerRoles.map((role) => (
                      <RoleBadge
                        key={role.id}
                        label={role.name}
                        description={role.description?.trim() || ''}
                      />
                    ))}
                  </div>
                ) : 'N/A'
              }
            />
            <Fact label="Team" value={teamName} />
          </div>
        </div>

        <div style={sectionCard} className="motion-section-card motion-section-card-delay-2">
          <div style={sectionHeader}>GAME LOG</div>
          <div style={gameLogPreviewBar}>
            <div style={gameLogSummaryRow}>
              <div style={gameLogSummaryItem}>
                <span style={gameLogSummaryLabel}>Games</span>
                <span style={gameLogSummaryValue}>{gameLogSummary.games}</span>
              </div>
              <div style={gameLogSummaryItem}>
                <span style={gameLogSummaryLabel}>Record</span>
                <span style={gameLogSummaryValue}>
                  {gameLogSummary.wins}-{gameLogSummary.losses}
                </span>
              </div>
              <div style={gameLogSummaryItem}>
                <span style={gameLogSummaryLabel}>{isGoalie ? 'SV%' : 'PTS'}</span>
                <span style={gameLogSummaryValue}>
                  {isGoalie
                    ? formatSavePct(gameLogSummary.saves, gameLogSummary.shotsAgainst)
                    : gameLogSummary.points}
                </span>
              </div>
            </div>
            <Link href={`/player/${player.id}/gamelog`} style={gameLogMoreLink}>
              Show More
            </Link>
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
                {isGoalie ? (
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
              {displayedGameLogRows.length ? (
                displayedGameLogRows.map((row) => {
                  const { stat, match, team, opponent, compactMatchupLabel, goalsAgainst, result, seasonLabel, typeLabel, isHome } = row
                  const venueLabel = match && row.team ? (isHome ? 'Home' : 'Away') : '-'
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
                              {compactMatchupLabel}
                            </HoverPreviewLink>
                          ) : (
                            <span>{compactMatchupLabel}</span>
                          )}
                        </div>
                      </td>
                      <td style={tdLeft}>
                        <span
                          style={{
                            ...gameLogResultBadge,
                            ...(result === 'win'
                              ? gameLogResultWin
                              : result === 'loss'
                                ? gameLogResultLoss
                                : gameLogResultPending),
                          }}
                        >
                          {result === 'win' ? 'W' : result === 'loss' ? 'L' : '-'} {formatMatchScore(match)}
                        </span>
                      </td>
                      <td style={tdRight}>{stat.gp || 0}</td>
                      {isGoalie ? (
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
                  <td style={tdLeft} colSpan={isGoalie ? 14 : 13}>
                    No game log rows with linked match data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={tabsWrap} className="motion-tab-group motion-section-card-delay-1">
        <button
          type="button"
          onClick={() => setTab('regular')}
          className="motion-tab-button"
          style={tab === 'regular' ? activeTab : inactiveTab}
        >
          Regular Season
        </button>
        <button
          type="button"
          onClick={() => setTab('playoffs')}
          className="motion-tab-button"
          style={tab === 'playoffs' ? activeTab : inactiveTab}
        >
          Playoffs
        </button>
        <button
          type="button"
          onClick={() => setTab('combined')}
          className="motion-tab-button"
          style={tab === 'combined' ? activeTab : inactiveTab}
        >
          Regular Season + Playoffs
        </button>
      </div>

      <div style={statsTabsWrap} className="motion-tab-group motion-section-card-delay-2">
        <div style={statsModeWrap}>
          {showCareerRoleTabs ? (
            <>
              <button
                type="button"
                onClick={() => setCareerRole('skater')}
                className="motion-tab-button"
                style={careerRole === 'skater' ? statsModeActive : statsModeInactive}
              >
                Skaters
              </button>
              <button
                type="button"
                onClick={() => setCareerRole('goalie')}
                className="motion-tab-button"
                style={careerRole === 'goalie' ? statsModeActive : statsModeInactive}
              >
                Goalies
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setStatsView('default')}
            className="motion-tab-button"
            style={statsView === 'default' ? statsModeActive : statsModeInactive}
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setStatsView('perGame')}
            className="motion-tab-button"
            style={statsView === 'perGame' ? statsModeActive : statsModeInactive}
          >
            Per Game Average
          </button>
        </div>
      </div>

      <div style={sectionCard} className="motion-section-card motion-section-card-delay-3">
        <div style={sectionHeader}>CAREER STATS</div>
        <table style={table} className="motion-table">
          <thead>
            <tr style={tableHead}>
              <th style={thLeft}>Season</th>
              <th style={thLeft}>Team</th>
              <th style={thLeft}>League</th>
              <th style={thRight}>GP</th>
              {isGoalie ? (
                <>
                  <th style={thRight}>W</th>
                  <th style={thRight}>L</th>
                  <th style={thRight}>OTL</th>
                  <th style={thRight}>SO</th>
                  <th style={thRight}>GA</th>
                  <th style={thRight}>SA</th>
                  <th style={thRight}>SVS</th>
                  <th style={thRight}>SV%</th>
                  <th style={thRight}>GAA</th>
                </>
              ) : (
                <>
                  <th style={thRight}>G</th>
                  <th style={thRight}>A</th>
                  <th style={thRight}>PTS</th>
                  <th style={thRight}>Hits</th>
                  <th style={thRight}>SOG</th>
                  <th style={thRight}>SOG/G</th>
                  <th style={thRight}>TOI</th>
                  <th style={thRight}>+/-</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleGrouped.map((group, index) => {
              const sogPerGame = avg(group.shots, group.gp)
              const calcPct = formatSavePct(group.saves, group.shotsAgainst, group.gk_percentage)
              const showSeasonLabel = index === 0 || visibleGrouped[index - 1]?.season !== group.season
              const rowLeague =
                getLeagueForTeamLeague(group.teamLeague) ||
                (normalizeLookupValue(group.teamLeague) === normalizeLookupValue(playerLeagueLabel)
                  ? playerLeague
                  : null)
              const isInternationalRow = isInternationalLeague(rowLeague)
              const leftCellStyle = isInternationalRow ? internationalTdLeft : tdLeft
              const rightCellStyle = isInternationalRow ? internationalTdRight : tdRight
              const pointsCellStyle = isInternationalRow ? internationalPtsCell : ptsCell
              const teamLinkStyle = isInternationalRow ? internationalTableTeamLink : tableTeamLink
              const leagueLinkStyle = isInternationalRow ? internationalTableLeagueLink : tableLeagueLink

              return (
                <tr key={`${group.season}-${group.team}`} style={tableRow}>
                  <td style={leftCellStyle}>{showSeasonLabel ? group.season : ''}</td>
                  <td style={leftCellStyle}>
                    <div style={teamCell}>
                      {group.logo ? <img src={group.logo} alt={group.team} style={teamLogo} /> : null}
                      {group.teamId ? (
                        <HoverPreviewLink href={`/team/${group.teamId}`} entityType="team" entityId={group.teamId} style={teamLinkStyle}>
                          {group.team}
                        </HoverPreviewLink>
                      ) : (
                        <span style={isInternationalRow ? internationalPlainText : undefined}>{group.team}</span>
                      )}
                    </div>
                  </td>
                  <td style={leftCellStyle}>
                    {group.teamLeague ? (
                      rowLeague ? (
                        <HoverPreviewLink href={`/league/${rowLeague.id}`} entityType="league" entityId={rowLeague.id} style={leagueLinkStyle}>
                          {rowLeague.name || group.teamLeague}
                        </HoverPreviewLink>
                      ) : (
                        <HoverPreviewLink href={`/league/${encodeURIComponent(group.teamLeague)}`} entityType="league" lookupValue={group.teamLeague} style={leagueLinkStyle}>
                          {group.teamLeague}
                        </HoverPreviewLink>
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={rightCellStyle}>{group.gp}</td>
                  {isGoalie ? (
                    <>
                      <td style={rightCellStyle}>{showStat(group.goalieWins, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.goalieLosses, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.goalieOvertimeLosses, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.goalieShutouts, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.conceded, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.shotsAgainst, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.saves, group.gp)}</td>
                      <td style={rightCellStyle}>{calcPct}</td>
                      <td style={rightCellStyle}>{formatGaa(group.conceded, group.gp, group.toi)}</td>
                    </>
                  ) : (
                    <>
                      <td style={rightCellStyle}>{showStat(group.goals, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.assists, group.gp)}</td>
                      <td style={pointsCellStyle}>{showStat(group.points, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.hits, group.gp)}</td>
                      <td style={rightCellStyle}>{showStat(group.shots, group.gp)}</td>
                      <td style={rightCellStyle}>{sogPerGame}</td>
                      <td style={rightCellStyle}>{showStat(group.toi, group.gp)}</td>
                      <td style={rightCellStyle}>{showPlusMinus(group.plusMinus, group.gp)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={sectionCard} className="motion-section-card motion-section-card-delay-4">
        <div style={sectionHeader}>CAREER TOTALS</div>
        <table style={table} className="motion-table">
          <thead>
            <tr style={tableHead}>
              <th style={thLeft}>Seasons</th>
              <th style={thLeft}>Team</th>
              <th style={thLeft}>League</th>
              <th style={thRight}>GP</th>
              {isGoalie ? (
                <>
                  <th style={thRight}>W</th>
                  <th style={thRight}>L</th>
                  <th style={thRight}>OTL</th>
                  <th style={thRight}>SO</th>
                  <th style={thRight}>GA</th>
                  <th style={thRight}>SA</th>
                  <th style={thRight}>SVS</th>
                  <th style={thRight}>SV%</th>
                  <th style={thRight}>GAA</th>
                </>
              ) : (
                <>
                  <th style={thRight}>G</th>
                  <th style={thRight}>A</th>
                  <th style={thRight}>PTS</th>
                  <th style={thRight}>Hits</th>
                  <th style={thRight}>SOG</th>
                  <th style={thRight}>SOG/G</th>
                  <th style={thRight}>TOI</th>
                  <th style={thRight}>+/-</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {careerTotals.map((totalRow) => {
              const totalRowLeague =
                getLeagueForTeamLeague(totalRow.teamLeague) ||
                (normalizeLookupValue(totalRow.teamLeague) === normalizeLookupValue(playerLeagueLabel)
                  ? playerLeague
                  : null)
              const isInternationalRow = isInternationalLeague(totalRowLeague)
              const leftCellStyle = isInternationalRow ? internationalTdLeft : tdLeft
              const rightCellStyle = isInternationalRow ? internationalTdRight : tdRight
              const pointsCellStyle = isInternationalRow ? internationalPtsCell : ptsCell
              const teamLinkStyle = isInternationalRow ? internationalTableTeamLink : tableTeamLink
              const leagueLinkStyle = isInternationalRow ? internationalTableLeagueLink : tableLeagueLink

              return (
              <tr key={totalRow.league} style={tableRow}>
                <td style={leftCellStyle}>{totalRow.seasons}</td>
                <td style={leftCellStyle}>
                  <div style={teamCell}>
                    {totalRow.logo ? (
                      <img src={totalRow.logo} alt={totalRow.league} style={teamLogo} />
                    ) : null}
                    {totalRow.teamId ? (
                      <HoverPreviewLink href={`/team/${totalRow.teamId}`} entityType="team" entityId={totalRow.teamId} style={teamLinkStyle}>
                        {totalRow.league}
                      </HoverPreviewLink>
                    ) : (
                      <span style={isInternationalRow ? internationalPlainText : undefined}>{totalRow.league}</span>
                    )}
                  </div>
                </td>
                <td style={leftCellStyle}>
                  {totalRow.teamLeague ? (
                    totalRowLeague ? (
                      <HoverPreviewLink href={`/league/${totalRowLeague.id}`} entityType="league" entityId={totalRowLeague.id} style={leagueLinkStyle}>
                        {totalRowLeague.name || totalRow.teamLeague}
                      </HoverPreviewLink>
                    ) : (
                      <HoverPreviewLink href={`/league/${encodeURIComponent(totalRow.teamLeague)}`} entityType="league" lookupValue={totalRow.teamLeague} style={leagueLinkStyle}>
                        {totalRow.teamLeague}
                      </HoverPreviewLink>
                    )
                  ) : (
                    '-'
                  )}
                </td>
                <td style={rightCellStyle}>{totalRow.gp}</td>
                {isGoalie ? (
                  <>
                    <td style={rightCellStyle}>{showStat(totalRow.goalieWins, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.goalieLosses, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.goalieOvertimeLosses, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.goalieShutouts, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.conceded, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.shotsAgainst, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.saves, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{totalRow.gk_percentage || totalRow.calcPct}</td>
                    <td style={rightCellStyle}>{formatGaa(totalRow.conceded, totalRow.gp, totalRow.toi)}</td>
                  </>
                ) : (
                  <>
                    <td style={rightCellStyle}>{showStat(totalRow.goals, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.assists, totalRow.gp)}</td>
                    <td style={pointsCellStyle}>{showStat(totalRow.points, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.hits, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.shots, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{avg(totalRow.shots, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showStat(totalRow.toi, totalRow.gp)}</td>
                    <td style={rightCellStyle}>{showPlusMinus(totalRow.plusMinus, totalRow.gp)}</td>
                  </>
                )}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div style={sectionCard} className="motion-section-card motion-section-card-delay-5">
        <div style={subTabsWrap} className="motion-tab-group">
          <button
            type="button"
            onClick={() => setAwardView('season')}
            className="motion-tab-button"
            style={awardView === 'season' ? subActiveTab : subInactiveTab}
          >
            Season
          </button>
          <button
            type="button"
            onClick={() => setAwardView('league')}
            className="motion-tab-button"
            style={awardView === 'league' ? subActiveTab : subInactiveTab}
          >
            League
          </button>
        </div>

        <div style={sectionHeader}>
          {player.name.toUpperCase()} CAREER HIGHLIGHTS
        </div>

        <table style={table} className="motion-table">
          <thead>
            <tr style={highlightHead}>
              <th style={highlightThLeft}>
                {awardView === 'season' ? 'SEASON' : 'LEAGUE'}
              </th>
              <th style={highlightThLeft}>
                {awardView === 'season' ? 'AWARDS BY SEASON' : 'AWARDS BY LEAGUE'}
              </th>
            </tr>
          </thead>
          <tbody>
            {awardGroups.map(([groupLabel, groupAwards]) => (
              <tr key={groupLabel} style={tableRow}>
                <td style={highlightLabelCell}>{groupLabel}</td>
                <td style={highlightAwardsCell}>
                  {groupAwards.length > 0 ? (
                    <ul style={awardList}>
                      {groupAwards.map((awardText, index) => (
                        <li key={`${groupLabel}-${index}`} style={awardItem}>
                          {awardText}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
            {awardGroups.length === 0 ? (
              <tr style={tableRow}>
                <td style={highlightLabelCell}>-</td>
                <td style={highlightAwardsCell}>No awards yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {primaryTeam?.id ? (
        <div style={footerLinkWrap}>
          <HoverPreviewLink href={`/team/${primaryTeam.id}`} entityType="team" entityId={primaryTeam.id} style={teamLink}>
            View Team Page
          </HoverPreviewLink>
        </div>
      ) : null}

      {isMounted && isEditorOpen ? createPortal(
        <div style={modalOverlay} className="motion-modal-overlay">
          <div style={modalCard} className="motion-modal-card">
            <div style={modalHeader}>
              <div style={modalTitle}>Update Stats/Facts</div>
              <button type="button" onClick={closeEditor} style={modalCloseButton}>
                Close
              </button>
            </div>

            <div style={modalBody}>
              <div style={editorSection}>
                <div style={editorSectionTitle}>Player Facts</div>
                <div style={editorFactsGrid}>
                  <label style={editorField}>
                    <span style={editorLabel}>Name</span>
                    <input
                      value={editorFacts.name}
                      onChange={(event) =>
                        setEditorFacts((current) => ({ ...current, name: event.target.value }))
                      }
                      style={editorInput}
                    />
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Display Name</span>
                    <input
                      value={editorFacts.display_name}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          display_name: event.target.value,
                        }))
                      }
                      style={editorInput}
                    />
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Default Team</span>
                    <select
                      value={editorFacts.team_id}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          team_id: event.target.value,
                        }))
                      }
                      style={editorInput}
                    >
                      <option value="">No Team</option>
                      {teamOptions.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Number</span>
                    <input
                      value={editorFacts.number}
                      onChange={(event) =>
                        setEditorFacts((current) => ({ ...current, number: event.target.value }))
                      }
                      style={editorInput}
                    />
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Position</span>
                    <input
                      value={editorFacts.position}
                      onChange={(event) =>
                        setEditorFacts((current) => ({ ...current, position: event.target.value }))
                      }
                      style={editorInput}
                    />
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Nationality</span>
                    <input
                      value={editorFacts.nationality}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          nationality: event.target.value,
                        }))
                      }
                      style={editorInput}
                    />
                  </label>
                  <div style={{ ...editorField, gridColumn: '1 / -1' }}>
                    <span style={editorLabel}>Player Roles</span>
                    <div style={editorRoleList}>
                      {playerRoles.map((role) => {
                        const isSelected = editorRoleIds.includes(role.id)

                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => toggleEditorRole(role.id)}
                            style={isSelected ? editorRoleChipActive : editorRoleChip}
                          >
                            {role.name}
                          </button>
                        )
                      })}
                      {!playerRoles.length ? (
                        <span style={editorRoleEmpty}>No shared roles yet. Add them from Show More.</span>
                      ) : null}
                    </div>
                  </div>
                  <label style={editorField}>
                    <span style={editorLabel}>Legacy Role Name</span>
                    <input
                      value={editorFacts.player_type}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          player_type: event.target.value,
                        }))
                      }
                      style={editorInput}
                      placeholder="Optional fallback"
                    />
                  </label>
                  <label style={editorField}>
                    <span style={editorLabel}>Legacy Role Description</span>
                    <input
                      value={editorFacts.player_type_description}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          player_type_description: event.target.value,
                        }))
                      }
                      style={editorInput}
                      placeholder="Optional fallback"
                    />
                  </label>
                  <label style={{ ...editorField, gridColumn: '1 / -1' }}>
                    <span style={editorLabel}>Image URL</span>
                    <input
                      value={editorFacts.image_url}
                      onChange={(event) =>
                        setEditorFacts((current) => ({
                          ...current,
                          image_url: event.target.value,
                        }))
                      }
                      style={editorInput}
                    />
                  </label>
                </div>
              </div>

              <div style={editorSection}>
                <div style={editorSectionHeaderRow}>
                  <div style={editorSectionTitle}>Stats</div>
                  <div style={editorActionRow}>
                    <button type="button" onClick={() => addStatRow()} style={smallActionButton}>
                      Add Season Row
                    </button>
                  </div>
                </div>

                {deletedStatIds.length ? (
                  <div style={editorDeleteNotice}>
                    {deletedStatIds.length} saved stat row{deletedStatIds.length === 1 ? '' : 's'} will be deleted when you save changes.
                  </div>
                ) : null}

                {editorStats.map((row, index) => {
                  const regularIsGoalie = isGoaliePosition(row.regular.position || editorFacts.position)
                  const playoffsIsGoalie = isGoaliePosition(row.playoffs.position || editorFacts.position)
                  const rowPositionOptions = Array.from(
                    new Set(
                      [
                        row.regular.position || '',
                        row.playoffs.position || '',
                        editorFacts.position || '',
                        ...commonPositionOptions,
                      ]
                        .map((value) => value.trim())
                        .filter(Boolean)
                    )
                  )

                  return (
                    <div key={`${row.regular.id || row.playoffs.id || 'new'}-${index}`} style={editorRowCard}>
                      <div style={editorRowTop}>
                        <div style={editorRowTitle}>Season Row {index + 1}</div>
                        <button type="button" onClick={() => removeStatRow(index)} style={removeButton}>
                          Remove
                        </button>
                      </div>

                      <div style={editorSeasonHeaderRow}>
                        <label style={editorField}>
                          <span style={editorLabel}>Team</span>
                          <select
                            value={row.team_id || ''}
                            onChange={(event) => updateStatRow(index, 'team_id', event.target.value)}
                            style={editorInput}
                          >
                            <option value="">No team</option>
                            {teamOptions.map((teamOption) => (
                              <option key={teamOption.id} value={teamOption.id}>
                                {teamOption.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={editorField}>
                          <span style={editorLabel}>Season</span>
                          <select
                            value={row.season_id || ''}
                            onChange={(event) => updateStatRow(index, 'season_id', event.target.value)}
                            style={editorInput}
                          >
                            <option value="">No season</option>
                            {seasonOptions.map((season) => (
                              <option key={season.id} value={season.id}>
                                {season.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div style={editorSplitGrid}>
                        <div style={editorSideCard}>
                          <div style={editorSideTitle}>Regular</div>
                          <div style={editorStatsGrid}>
                            <label style={editorField}>
                              <span style={editorLabel}>Position</span>
                              <select
                                value={row.regular.position}
                                onChange={(event) => updateStatSideRow(index, 'regular', 'position', event.target.value)}
                                style={editorInput}
                              >
                                <option value="">Player default</option>
                                {rowPositionOptions.map((positionOption) => (
                                  <option key={`regular-${positionOption}`} value={positionOption}>
                                    {positionOption}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={editorField}>
                              <span style={editorLabel}>GP</span>
                              <input value={row.regular.gp} onChange={(event) => updateStatSideRow(index, 'regular', 'gp', event.target.value)} style={editorInput} />
                            </label>
                            {regularIsGoalie ? (
                              <>
                                <label style={editorField}><span style={editorLabel}>W</span><input value={row.regular.goalie_wins} onChange={(event) => updateStatSideRow(index, 'regular', 'goalie_wins', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>L</span><input value={row.regular.goalie_losses} onChange={(event) => updateStatSideRow(index, 'regular', 'goalie_losses', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>OTL</span><input value={row.regular.goalie_overtime_losses} onChange={(event) => updateStatSideRow(index, 'regular', 'goalie_overtime_losses', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>SO</span><input value={row.regular.goalie_shutouts} onChange={(event) => updateStatSideRow(index, 'regular', 'goalie_shutouts', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>GA</span><input value={row.regular.goalie_goals_against} onChange={(event) => updateStatSideRow(index, 'regular', 'goalie_goals_against', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Saves</span><input value={row.regular.gk_saves} onChange={(event) => updateStatSideRow(index, 'regular', 'gk_saves', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Shots Against</span><input value={row.regular.gk_shots_against} onChange={(event) => updateStatSideRow(index, 'regular', 'gk_shots_against', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>SV%</span><input value={row.regular.gk_percentage} onChange={(event) => updateStatSideRow(index, 'regular', 'gk_percentage', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>TOI</span><input value={row.regular.toi} onChange={(event) => updateStatSideRow(index, 'regular', 'toi', event.target.value)} style={editorInput} /></label>
                              </>
                            ) : (
                              <>
                                <label style={editorField}><span style={editorLabel}>G</span><input value={row.regular.goals} onChange={(event) => updateStatSideRow(index, 'regular', 'goals', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>A</span><input value={row.regular.assists} onChange={(event) => updateStatSideRow(index, 'regular', 'assists', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>PTS</span><input value={row.regular.points} onChange={(event) => updateStatSideRow(index, 'regular', 'points', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Hits</span><input value={row.regular.hits} onChange={(event) => updateStatSideRow(index, 'regular', 'hits', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>+/-</span><input value={row.regular.plus_minus} onChange={(event) => updateStatSideRow(index, 'regular', 'plus_minus', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Shots</span><input value={row.regular.shots} onChange={(event) => updateStatSideRow(index, 'regular', 'shots', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>TOI</span><input value={row.regular.toi} onChange={(event) => updateStatSideRow(index, 'regular', 'toi', event.target.value)} style={editorInput} /></label>
                              </>
                            )}
                          </div>
                        </div>

                        <div style={editorSideCard}>
                          <div style={editorSideTitle}>Playoffs</div>
                          <div style={editorStatsGrid}>
                            <label style={editorField}>
                              <span style={editorLabel}>Position</span>
                              <select
                                value={row.playoffs.position}
                                onChange={(event) => updateStatSideRow(index, 'playoffs', 'position', event.target.value)}
                                style={editorInput}
                              >
                                <option value="">Player default</option>
                                {rowPositionOptions.map((positionOption) => (
                                  <option key={`playoffs-${positionOption}`} value={positionOption}>
                                    {positionOption}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={editorField}>
                              <span style={editorLabel}>GP</span>
                              <input value={row.playoffs.gp} onChange={(event) => updateStatSideRow(index, 'playoffs', 'gp', event.target.value)} style={editorInput} />
                            </label>
                            {playoffsIsGoalie ? (
                              <>
                                <label style={editorField}><span style={editorLabel}>W</span><input value={row.playoffs.goalie_wins} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goalie_wins', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>L</span><input value={row.playoffs.goalie_losses} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goalie_losses', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>OTL</span><input value={row.playoffs.goalie_overtime_losses} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goalie_overtime_losses', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>SO</span><input value={row.playoffs.goalie_shutouts} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goalie_shutouts', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>GA</span><input value={row.playoffs.goalie_goals_against} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goalie_goals_against', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Saves</span><input value={row.playoffs.gk_saves} onChange={(event) => updateStatSideRow(index, 'playoffs', 'gk_saves', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Shots Against</span><input value={row.playoffs.gk_shots_against} onChange={(event) => updateStatSideRow(index, 'playoffs', 'gk_shots_against', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>SV%</span><input value={row.playoffs.gk_percentage} onChange={(event) => updateStatSideRow(index, 'playoffs', 'gk_percentage', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>TOI</span><input value={row.playoffs.toi} onChange={(event) => updateStatSideRow(index, 'playoffs', 'toi', event.target.value)} style={editorInput} /></label>
                              </>
                            ) : (
                              <>
                                <label style={editorField}><span style={editorLabel}>G</span><input value={row.playoffs.goals} onChange={(event) => updateStatSideRow(index, 'playoffs', 'goals', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>A</span><input value={row.playoffs.assists} onChange={(event) => updateStatSideRow(index, 'playoffs', 'assists', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>PTS</span><input value={row.playoffs.points} onChange={(event) => updateStatSideRow(index, 'playoffs', 'points', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Hits</span><input value={row.playoffs.hits} onChange={(event) => updateStatSideRow(index, 'playoffs', 'hits', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>+/-</span><input value={row.playoffs.plus_minus} onChange={(event) => updateStatSideRow(index, 'playoffs', 'plus_minus', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>Shots</span><input value={row.playoffs.shots} onChange={(event) => updateStatSideRow(index, 'playoffs', 'shots', event.target.value)} style={editorInput} /></label>
                                <label style={editorField}><span style={editorLabel}>TOI</span><input value={row.playoffs.toi} onChange={(event) => updateStatSideRow(index, 'playoffs', 'toi', event.target.value)} style={editorInput} /></label>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={editorSection}>
                <div style={editorSectionHeaderRow}>
                  <div style={editorSectionTitle}>Awards</div>
                  <button type="button" onClick={addAwardRow} style={smallActionButton}>
                    Add Award
                  </button>
                </div>

                {editorAwards.map((row, index) => (
                  <div key={`${row.id || 'new-award'}-${index}`} style={editorRowCard}>
                    <div style={editorRowTop}>
                      <div style={editorRowTitle}>Award Row {index + 1}</div>
                      <button type="button" onClick={() => removeAwardRow(index)} style={removeButton}>
                        Remove
                      </button>
                    </div>
                    <div style={editorAwardsGrid}>
                      <label style={editorField}>
                        <span style={editorLabel}>Season</span>
                        <input value={row.season} onChange={(event) => updateAwardRow(index, 'season', event.target.value)} style={editorInput} />
                      </label>
                      <label style={editorField}>
                        <span style={editorLabel}>League</span>
                        <input value={row.league} onChange={(event) => updateAwardRow(index, 'league', event.target.value)} style={editorInput} />
                      </label>
                      <label style={{ ...editorField, gridColumn: '1 / -1' }}>
                        <span style={editorLabel}>Award</span>
                        <input value={row.award} onChange={(event) => updateAwardRow(index, 'award', event.target.value)} style={editorInput} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={modalFooter}>
              <div style={saveMessageStyle}>{saveMessage}</div>
              <div style={editorActionRow}>
                <button type="button" onClick={closeEditor} style={secondaryEditorButton}>
                  Cancel
                </button>
                <button type="button" onClick={saveEditor} style={primaryEditorButton}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={factCard}>
      <div style={factLabel}>{label}</div>
      <div style={factValue}>{value}</div>
    </div>
  )
}

function RoleBadge({ label, description }: { label: string; description: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      style={roleBadgeWrap}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <button type="button" style={roleBadgeButton}>
        {label}
      </button>
      {description ? (
        <div
          style={{
            ...roleTooltip,
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  )
}

const container = {
  maxWidth: 1080,
  margin: '18px auto 40px auto',
  fontFamily: 'var(--font-inter), sans-serif',
}

const heroCard = {
  background: 'linear-gradient(135deg, #12354b 0%, #0e5a75 100%)',
  borderRadius: 10,
  color: 'white',
  padding: 18,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 14,
  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
}

const heroLeft = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  flex: 1,
}

const playerPhotoWrap = {
  width: 190,
  minWidth: 190,
  height: 190,
  background: '#fff',
  borderRadius: 8,
  padding: 4,
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
}

const playerPhoto = {
  width: '100%',
  height: '100%',
  objectFit: 'cover' as const,
  borderRadius: 6,
  display: 'block',
}

const heroTextWrap = {
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
}

const nameRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
}

const nationFlag = {
  width: 22,
  height: 15,
  border: '1px solid rgba(255,255,255,0.35)',
  objectFit: 'cover' as const,
}

const heroName = {
  margin: 0,
  fontSize: 38,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: '-0.02em',
}

const heroSubtitle = {
  fontSize: 18,
  color: '#a8deef',
  marginBottom: 10,
}

const heroMeta = {
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 18,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
}

const heroMetaLink = {
  color: '#ffffff',
  textDecoration: 'none',
}

const heroRight = {
  width: 230,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
}

const last5Card = {
  background: '#12425e',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  padding: 4,
  minWidth: 240,
}

const miniStatsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 11,
}

const miniHeadLeft = {
  textAlign: 'left' as const,
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 6px',
  borderBottom: '1px solid rgba(255,255,255,0.18)',
}

const miniHeadCell = {
  textAlign: 'center' as const,
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 6px',
  borderBottom: '1px solid rgba(255,255,255,0.18)',
}

const miniLabelCell = {
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  textAlign: 'left' as const,
  padding: '4px 6px',
  borderTop: '1px solid rgba(255,255,255,0.14)',
}

const miniValueCell = {
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  textAlign: 'center' as const,
  padding: '4px 6px',
  borderTop: '1px solid rgba(255,255,255,0.14)',
}

const topGrid = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: 14,
  marginBottom: 14,
}

const editorBar = {
  display: 'flex',
  justifyContent: 'flex-start',
  marginBottom: 14,
}

const editorButton = {
  border: '2px solid #21995b',
  borderRadius: 999,
  background: '#fff',
  color: '#102f47',
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}

const sectionCard = {
  background: '#fff',
  border: '1px solid #cfd8e1',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  marginBottom: 14,
}

const sectionHeader = {
  background: '#12354b',
  color: 'white',
  padding: '8px 12px 9px 12px',
  fontSize: 11,
  fontWeight: 800,
  fontFamily: 'var(--font-inter), sans-serif',
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
}

const gameLogPreviewBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '12px 14px 10px',
  borderBottom: '1px solid #edf1f5',
  flexWrap: 'wrap' as const,
  background: '#f8fbfd',
}

const gameLogSummaryRow = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap' as const,
}

const gameLogSummaryItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 10px',
  borderRadius: 999,
  background: '#e9f1f7',
  border: '1px solid #d8e2ea',
}

const gameLogSummaryLabel = {
  color: '#607182',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
}

const gameLogSummaryValue = {
  color: '#102f47',
  fontSize: 12,
  fontWeight: 800,
}

const gameLogMoreLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  padding: '0 14px',
  borderRadius: 999,
  background: '#29ae51',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
}

const gameLogResultBadge = {
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

const gameLogResultWin = {
  background: '#e7f7ec',
  color: '#18723a',
}

const gameLogResultLoss = {
  background: '#fbe9ea',
  color: '#b4232d',
}

const gameLogResultPending = {
  background: '#eef3f7',
  color: '#607182',
}

const factsGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  padding: 14,
}

const factCard = {
  padding: '8px 10px',
  borderBottom: '1px solid #eef2f6',
}

const factLabel = {
  fontSize: 12,
  color: '#6f7d89',
  marginBottom: 4,
}

const factValue = {
  fontSize: 18,
  fontWeight: 700,
  color: '#102f47',
}

function isInternationalLeague(league?: LeagueRecord | null) {
  return (league?.category || '').trim().toLowerCase() === 'international'
}

const roleListWrap = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 10,
}

const roleBadgeWrap = {
  position: 'relative' as const,
  display: 'inline-flex',
  alignItems: 'center',
}

const roleBadgeButton = {
  border: '0',
  borderRadius: 999,
  background: '#eef1f5',
  color: '#12354b',
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.2,
  letterSpacing: '0.01em',
  boxShadow: 'inset 0 0 0 1px rgba(18, 53, 75, 0.03)',
}

const roleTooltip = {
  position: 'absolute' as const,
  left: 0,
  bottom: 'calc(100% + 10px)',
  zIndex: 20,
  width: 240,
  borderRadius: 10,
  background: '#12354b',
  color: '#fff',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.45,
  boxShadow: '0 8px 24px rgba(16, 47, 71, 0.22)',
  transition: 'opacity 0.18s ease, transform 0.18s ease',
}

const tabsWrap = {
  display: 'flex',
  gap: 18,
  marginBottom: 8,
}

const statsTabsWrap = {
  display: 'flex',
  gap: 18,
  marginBottom: 0,
}

const statsModeWrap = {
  display: 'flex',
  gap: 2,
  alignItems: 'flex-end',
}

const statsModeActive = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#12354b',
  color: 'white',
  border: 'none',
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  padding: '10px 18px 9px 18px',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.1,
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}

const statsModeInactive = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#b9c8d3',
  color: 'white',
  border: 'none',
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  padding: '10px 18px 9px 18px',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.1,
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}

const activeTab = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderBottom: '3px solid #12354b',
  color: '#102f47',
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.2,
  padding: '0 0 6px 0',
  cursor: 'pointer',
}

const inactiveTab = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: '#102f47',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.2,
  padding: '0 0 6px 0',
  cursor: 'pointer',
}

const subTabsWrap = {
  display: 'flex',
  gap: 18,
  padding: '12px 12px 0 12px',
}

const subActiveTab = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderBottom: '3px solid #12354b',
  color: '#102f47',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.2,
  padding: '0 0 6px 0',
  cursor: 'pointer',
}

const subInactiveTab = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: '#102f47',
  fontSize: 15,
  fontWeight: 400,
  lineHeight: 1.2,
  padding: '0 0 6px 0',
  cursor: 'pointer',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 12,
}

const tableHead = {
  background: '#f3f6f9',
}

const highlightHead = {
  background: '#d9252a',
}

const highlightThLeft = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  color: 'white',
  fontWeight: 800,
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

const tableLeagueLink = {
  color: '#1b5b86',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
}

const internationalPlainText = {
  color: '#d9252a',
  fontWeight: 600,
}

const internationalTdLeft = {
  ...tdLeft,
  color: '#d9252a',
}

const internationalTdRight = {
  ...tdRight,
  color: '#d9252a',
}

const internationalPtsCell = {
  ...ptsCell,
  color: '#d9252a',
}

const internationalTableTeamLink = {
  ...tableTeamLink,
  color: '#d9252a',
}

const internationalTableLeagueLink = {
  ...tableLeagueLink,
  color: '#d9252a',
}

const footerLinkWrap = {
  marginTop: 10,
}

const teamLink = {
  color: '#1b5b86',
  textDecoration: 'none',
  fontWeight: 700,
}

const highlightLabelCell = {
  ...tdLeft,
  width: 140,
  verticalAlign: 'top' as const,
}

const highlightAwardsCell = {
  ...tdLeft,
  color: '#1a5f92',
}

const awardList = {
  margin: 0,
  paddingLeft: 16,
}

const awardItem = {
  marginBottom: 3,
}

const modalOverlay = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(6, 18, 28, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  zIndex: 1000,
}

const modalCard = {
  width: '100%',
  maxWidth: 980,
  maxHeight: '88vh',
  background: '#f5f8fb',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
  display: 'flex',
  flexDirection: 'column' as const,
}

const modalHeader = {
  background: '#12354b',
  color: '#fff',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const modalTitle = {
  fontSize: 18,
  fontWeight: 700,
}

const modalCloseButton = {
  border: '1px solid rgba(255,255,255,0.28)',
  background: 'transparent',
  color: '#fff',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
}

const modalBody = {
  padding: 18,
  overflowY: 'auto' as const,
  display: 'grid',
  gap: 16,
}

const editorSection = {
  background: '#fff',
  border: '1px solid #d4dde6',
  borderRadius: 10,
  padding: 14,
}

const editorSectionHeaderRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
}

const editorSectionTitle = {
  color: '#12354b',
  fontSize: 15,
  fontWeight: 700,
}

const editorFactsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const editorSeasonHeaderRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 12,
}

const editorSplitGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const editorSideCard = {
  border: '1px solid #dde6ee',
  borderRadius: 10,
  background: '#fff',
  padding: 12,
}

const editorSideTitle = {
  color: '#12354b',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 10,
  textTransform: 'uppercase' as const,
}

const editorStatsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const editorAwardsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const editorField = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 5,
}

const editorLabel = {
  color: '#536878',
  fontSize: 12,
  fontWeight: 600,
}

const editorRoleList = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
}

const editorRoleChip = {
  border: '1px solid #c9d5df',
  borderRadius: 999,
  background: '#fff',
  color: '#12354b',
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 700,
}

const editorRoleChipActive = {
  ...editorRoleChip,
  border: '1px solid #1d7f4a',
  background: '#eaf8ef',
  color: '#165337',
}

const editorRoleEmpty = {
  color: '#738392',
  fontSize: 12,
  fontWeight: 600,
}

const editorInput = {
  height: 36,
  border: '1px solid #cad4de',
  borderRadius: 8,
  padding: '0 10px',
  fontSize: 13,
  background: '#fff',
  color: '#102f47',
}

const editorTextarea = {
  minHeight: 88,
  border: '1px solid #cad4de',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  background: '#fff',
  color: '#102f47',
  resize: 'vertical' as const,
  fontFamily: 'inherit',
}

const editorRowCard = {
  border: '1px solid #d9e2ea',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  background: '#fbfcfd',
}

const editorRowTop = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
}

const editorRowTitle = {
  fontSize: 13,
  fontWeight: 700,
  color: '#12354b',
}

const editorActionRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const smallActionButton = {
  border: '1px solid #1f7f4d',
  borderRadius: 999,
  background: '#fff',
  color: '#165337',
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const removeButton = {
  border: '1px solid #d15555',
  borderRadius: 999,
  background: '#fff',
  color: '#9e1d1d',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const editorDeleteNotice = {
  border: '1px solid #f0c7c7',
  borderRadius: 8,
  background: '#fff4f4',
  color: '#9e1d1d',
  padding: '9px 11px',
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
}

const modalFooter = {
  borderTop: '1px solid #d7e0e8',
  background: '#fff',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const saveMessageStyle = {
  color: '#0f5b37',
  fontSize: 13,
  fontWeight: 600,
}

const secondaryEditorButton = {
  border: '1px solid #c5d0da',
  borderRadius: 8,
  background: '#fff',
  color: '#12354b',
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const primaryEditorButton = {
  border: '1px solid #1f7f4d',
  borderRadius: 8,
  background: '#21aa5b',
  color: '#fff',
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
