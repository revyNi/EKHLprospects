'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  country?: string | null
  country_code?: string | null
  league?: string | null
  team_colors?: string | null
  town?: string | null
  founded?: string | number | null
  arena_name?: string | null
  arena_location?: string | null
}

type LeagueRecord = {
  id: string
  name: string
  abbreviation?: string | null
  short_name?: string | null
  display_name?: string | null
  country_code?: string | null
}

type SeasonRecord = {
  id: string
  name: string
}

type PlayerRecord = {
  id: string
  name: string
  team_id?: string | null
  number?: number | null
  position?: string | null
  nationality?: string | null
  teams?: TeamRecord | TeamRecord[] | null
}

type TeamStatRecord = {
  id: string
  player_id?: string | null
  team_id?: string | null
  season_id?: string | null
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
  game_type?: string | null
}

type RosterEntry = PlayerRecord & {
  seasonName: string
}

type TeamPlayerStat = {
  id: string
  name: string
  number?: number | null
  position?: string | null
  nationality?: string | null
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
  plusMinus: number
  shots: number
  toi: number
  saves: number
  conceded: number
  gk_percentage: number
  goalieWins: number
  goalieLosses: number
  goalieOvertimeLosses: number
  goalieShutouts: number
}

type FranchiseStat = {
  id: string
  name: string
  position: string | null | undefined
  nationality: string | null | undefined
  gp: number
  goals: number
  assists: number
  points: number
  hits: number
}

type FranchiseSeasonStat = FranchiseStat & {
  seasonName: string
  leagueName: string
}

type FranchiseRankKey = 'gp' | 'goals' | 'assists' | 'points' | 'hits' | 'ppg'

const recentForm = [
  { result: 'W 1-0', date: 'Mar 27' },
  { result: 'W 6-2', date: 'Apr 3' },
  { result: 'L 1-2', date: 'Apr 4' },
  { result: '19:15', date: 'Apr 7' },
  { result: '17:45', date: 'Apr 8' },
]

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
  lithuania: 'LT',
  estonia: 'EE',
  france: 'FR',
  italy: 'IT',
  slovenia: 'SI',
  croatia: 'HR',
  serbia: 'RS',
  romania: 'RO',
  hungary: 'HU',
  belarus: 'BY',
  ukraine: 'UA',
  kazakhstan: 'KZ',
  japan: 'JP',
  poland: 'PL',
  netherlands: 'NL',
  belgium: 'BE',
  iceland: 'IS',
  turkey: 'TR',
  spain: 'ES',
  great: 'GB',
  britain: 'GB',
  'united kingdom': 'GB',
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
  const resolvedCode = getCountryCode(country, countryCode)
  if (!resolvedCode) return null
  return `https://flagcdn.com/w20/${resolvedCode.toLowerCase()}.png`
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

function getPlayerLinkedTeam(player: PlayerRecord): TeamRecord | null {
  if (Array.isArray(player.teams)) {
    return player.teams[0] || null
  }

  return player.teams || null
}

function normalizeLeagueLookup(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function mergePlayersById(...groups: PlayerRecord[][]) {
  const merged = new Map<string, PlayerRecord>()

  groups.flat().forEach((player) => {
    if (!player?.id) return

    const existing = merged.get(player.id)
    merged.set(player.id, existing ? { ...player, ...existing } : player)
  })

  return Array.from(merged.values())
}

export default function TeamPage() {
  const params = useParams()
  const id = params.id as string

  const [team, setTeam] = useState<TeamRecord | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rawStats, setRawStats] = useState<TeamStatRecord[]>([])
  const [careerStats, setCareerStats] = useState<TeamStatRecord[]>([])
  const [teamPlayers, setTeamPlayers] = useState<PlayerRecord[]>([])
  const [franchisePlayers, setFranchisePlayers] = useState<PlayerRecord[]>([])
  const [experienceTeams, setExperienceTeams] = useState<TeamRecord[]>([])
  const [leagueRecords, setLeagueRecords] = useState<LeagueRecord[]>([])
  const [seasonOptions, setSeasonOptions] = useState<SeasonRecord[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [activeView, setActiveView] = useState<'roster' | 'stats'>('roster')
  const [statsCategory, setStatsCategory] = useState<'skaters' | 'goalies'>('skaters')
  const [franchiseGameType, setFranchiseGameType] = useState<'regular' | 'playoffs'>('regular')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!id) return

    async function fetchTeamPage() {
      setErrorMessage('')

      const [
        { data: teamData, error: teamError },
        { data: teamStats, error: statsError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', id).single(),
        supabase
          .from('stats')
          .select('id, player_id, team_id, season_id, gp, goals, assists, points, hits, plus_minus, shots, toi, gk_saves, gk_shots_against, gk_percentage, goalie_wins, goalie_losses, goalie_overtime_losses, goalie_shutouts, goalie_goals_against, game_type')
          .eq('team_id', id),
        supabase.from('seasons').select('id, name'),
      ])

      if (teamError || statsError || seasonsError) {
        setErrorMessage(teamError?.message || statsError?.message || seasonsError?.message || 'Unable to load team page.')
        setTeam(null)
        setRoster([])
        setRawStats([])
        setCareerStats([])
        setTeamPlayers([])
        setFranchisePlayers([])
        setExperienceTeams([])
        setLeagueRecords([])
        setSeasonOptions([])
        return
      }

      setTeam((teamData as TeamRecord) || null)

      const statsRows = (teamStats as TeamStatRecord[]) || []
      const seasonRows = (seasonsData as SeasonRecord[]) || []
      const usedSeasonIds = Array.from(
        new Set(statsRows.map((row) => row.season_id).filter(Boolean))
      ) as string[]
      const availableSeasons = seasonRows.filter((season) => usedSeasonIds.includes(season.id))

      setSeasonOptions(availableSeasons)

      const defaultSeasonId =
        availableSeasons[availableSeasons.length - 1]?.id || availableSeasons[0]?.id || ''
      setSelectedSeasonId(defaultSeasonId)

      const franchisePlayerIds = Array.from(
        new Set(statsRows.map((row) => row.player_id).filter(Boolean))
      ) as string[]

      let statsLinkedPlayers: PlayerRecord[] = []

      if (franchisePlayerIds.length) {
        const { data: statPlayersData } = await supabase
          .from('players')
          .select('id, name, team_id, number, position, nationality')
          .in('id', franchisePlayerIds)

        statsLinkedPlayers = (statPlayersData as PlayerRecord[]) || []
        setFranchisePlayers(statsLinkedPlayers)
      } else {
        setFranchisePlayers([])
      }

      const { data: leaguesData } = await supabase
        .from('leagues')
        .select('id, name, abbreviation, short_name, display_name, country_code')

      setLeagueRecords((leaguesData as LeagueRecord[]) || [])

      async function loadCareerExperience(players: PlayerRecord[]) {
        const playerIds = players.map((player) => player.id).filter(Boolean)

        if (!playerIds.length) {
          setCareerStats([])
          setExperienceTeams([])
          return
        }

        const { data: careerStatsData, error: careerStatsError } = await supabase
          .from('stats')
          .select('id, player_id, team_id, season_id, gp, goals, assists, points, hits, plus_minus, shots, toi, gk_saves, gk_shots_against, gk_percentage, goalie_wins, goalie_losses, goalie_overtime_losses, goalie_shutouts, goalie_goals_against, game_type')
          .in('player_id', playerIds)

        if (careerStatsError) {
          setCareerStats([])
          setExperienceTeams([])
          return
        }

        const careerRows = (careerStatsData as TeamStatRecord[]) || []
        const teamIds = Array.from(
          new Set(careerRows.map((row) => row.team_id).filter(Boolean))
        ) as string[]

        setCareerStats(careerRows)

        if (!teamIds.length) {
          setExperienceTeams([])
          return
        }

        const { data: careerTeamsData } = await supabase
          .from('teams')
          .select('id, name, logo_url, country, country_code')
          .in('id', teamIds)

        setExperienceTeams((careerTeamsData as TeamRecord[]) || [])
      }

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, team_id, number, position, nationality, teams!inner(id, name, logo_url)')
        .eq('teams.id', id)

      const joinedPlayers = (playersData as PlayerRecord[]) || []

      if (playersError || joinedPlayers.length === 0) {
        const fallbackPlayers = await supabase
          .from('players')
          .select('id, name, team_id, number, position, nationality, teams(id, name, logo_url)')

        if (fallbackPlayers.error) {
          setErrorMessage(playersError?.message || fallbackPlayers.error.message)
          setRoster([])
          return
        }

        const linkedPlayers = ((fallbackPlayers.data as PlayerRecord[]) || []).filter(
          (player) =>
            String(player.team_id) === String(id) ||
            String(getPlayerLinkedTeam(player)?.id) === String(id) ||
            getPlayerLinkedTeam(player)?.name === teamData.name
        )
        const players = mergePlayersById(
          linkedPlayers,
          statsLinkedPlayers.filter((player) => franchisePlayerIds.includes(String(player.id)))
        )

        setRawStats(statsRows)
        setTeamPlayers(players)
        await loadCareerExperience(players)

        const playerSeasonMap = new Map<string, Set<string>>()

        statsRows.forEach((row) => {
          const playerId = row.player_id ? String(row.player_id) : ''
          const season = seasonRows.find((entry) => String(entry.id) === String(row.season_id))
          if (!playerId || !season?.name) return

          if (!playerSeasonMap.has(playerId)) {
            playerSeasonMap.set(playerId, new Set<string>())
          }

          playerSeasonMap.get(playerId)?.add(season.name)
        })

        const rosterRows: RosterEntry[] = players.flatMap((player) => {
          const seasonsForPlayer = Array.from(playerSeasonMap.get(String(player.id)) || [])

          if (!seasonsForPlayer.length) {
            return [
              {
                ...player,
                seasonName: 'Current',
              },
            ]
          }

          return seasonsForPlayer.map((seasonName) => ({
            ...player,
            seasonName,
          }))
        })

        setRoster(rosterRows)
        return
      }

      const linkedPlayers = joinedPlayers.filter(
        (player) =>
          String(player.team_id) === String(id) ||
          String(getPlayerLinkedTeam(player)?.id) === String(id) ||
          getPlayerLinkedTeam(player)?.name === teamData.name
      )
      const players = mergePlayersById(
        linkedPlayers,
        statsLinkedPlayers.filter((player) => franchisePlayerIds.includes(String(player.id)))
      )
      setRawStats(statsRows)
      setTeamPlayers(players)
      await loadCareerExperience(players)

      const playerSeasonMap = new Map<string, Set<string>>()

      statsRows.forEach((row) => {
        const playerId = row.player_id ? String(row.player_id) : ''
        const season = seasonRows.find((entry) => String(entry.id) === String(row.season_id))
        if (!playerId || !season?.name) return

        if (!playerSeasonMap.has(playerId)) {
          playerSeasonMap.set(playerId, new Set<string>())
        }

        playerSeasonMap.get(playerId)?.add(season.name)
      })

      const rosterRows: RosterEntry[] = players.flatMap((player) => {
        const seasonsForPlayer = Array.from(playerSeasonMap.get(String(player.id)) || [])

        if (!seasonsForPlayer.length) {
          return [
            {
              ...player,
              seasonName: 'Current',
            },
          ]
        }

        return seasonsForPlayer.map((seasonName) => ({
          ...player,
          seasonName,
        }))
      })

      setRoster(rosterRows)
    }

    fetchTeamPage()
  }, [id])

  if (!team && !errorMessage) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!team) {
    return <div style={{ padding: 24 }}>{errorMessage || 'Team not found.'}</div>
  }

  const flagUrl = getFlagUrl(team.country, team.country_code)
  const filteredRoster = selectedSeasonId
    ? roster.filter((entry) => {
        const season = seasonOptions.find((item) => item.id === selectedSeasonId)
        return entry.seasonName === (season?.name || '') || entry.seasonName === 'Current'
      })
    : roster

  const goalies = filteredRoster.filter((player) => getPositionGroup(player.position) === 'G')
  const defenders = filteredRoster.filter((player) => getPositionGroup(player.position) === 'D')
  const forwards = filteredRoster.filter((player) => getPositionGroup(player.position) === 'C')
  const currentSeasonName =
    seasonOptions.find((season) => season.id === selectedSeasonId)?.name || 'Current'
  const teamStatsPageHref = `/team/${encodeURIComponent(team.id)}/stats`
  const nationalityRows = Object.values(
    filteredRoster.reduce<Record<string, { code: string; count: number }>>((acc, player) => {
      const code = (player.nationality || 'Unknown').trim().toUpperCase()

      if (!acc[code]) {
        acc[code] = { code, count: 0 }
      }

      acc[code].count += 1
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  const rosterPlayerIds = new Set(filteredRoster.map((player) => String(player.id)))
  const experienceTeamMap = new Map(experienceTeams.map((entry) => [String(entry.id), entry]))
  const getLeagueRecord = (leagueName?: string | null) => {
    const normalizedLeague = normalizeLeagueLookup(leagueName)
    if (!normalizedLeague) return null

    return (
      leagueRecords.find((league) =>
        [league.name, league.abbreviation, league.short_name, league.display_name]
          .filter(Boolean)
          .some((value) => normalizeLeagueLookup(value) === normalizedLeague)
      ) || null
    )
  }
  const experienceRows = Object.values(
    careerStats.reduce<
      Record<
        string,
        {
          team: string
          league: string
          country?: string | null
          country_code?: string | null
          gp: number
        }
      >
    >((acc, row) => {
      if (!row.player_id || !rosterPlayerIds.has(String(row.player_id))) return acc

      const teamId = row.team_id ? String(row.team_id) : 'unknown'
      const experienceTeam = experienceTeamMap.get(teamId)
      const teamName =
        experienceTeam?.name ||
        (String(team.id) === teamId ? team.name : null) ||
        'Unknown Team'
      const leagueName =
        experienceTeam?.league ||
        (String(team.id) === teamId ? team.league : null) ||
        teamName ||
        'Unknown League'
      const leagueRecord = getLeagueRecord(leagueName)

      if (!acc[teamId]) {
        acc[teamId] = {
          team: teamName,
          league: leagueName,
          country: experienceTeam?.country,
          country_code: leagueRecord?.country_code || experienceTeam?.country_code,
          gp: 0,
        }
      }

      acc[teamId].gp += Number(row.gp) || 0
      return acc
    }, {})
  ).sort((a, b) => b.gp - a.gp || a.team.localeCompare(b.team))
  const teamStats = rawStats.reduce<Record<string, TeamPlayerStat>>((acc, row) => {
    if (selectedSeasonId && row.season_id !== selectedSeasonId) return acc

    const player = teamPlayers.find((entry) => String(entry.id) === String(row.player_id))
    if (!player) return acc

    if (!acc[player.id]) {
      acc[player.id] = {
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.position,
        nationality: player.nationality,
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        hits: 0,
        plusMinus: 0,
        shots: 0,
        toi: 0,
        saves: 0,
        conceded: 0,
        gk_percentage: 0,
        goalieWins: 0,
        goalieLosses: 0,
        goalieOvertimeLosses: 0,
        goalieShutouts: 0,
      }
    }

    acc[player.id].gp += Number(row.gp) || 1
    acc[player.id].goals += Number(row.goals) || 0
    acc[player.id].assists += Number(row.assists) || 0
    acc[player.id].points +=
      row.points !== null && row.points !== undefined
        ? Number(row.points) || 0
        : (Number(row.goals) || 0) + (Number(row.assists) || 0)
    acc[player.id].hits += Number(row.hits) || 0
    acc[player.id].plusMinus += Number(row.plus_minus) || 0
    acc[player.id].shots += Number(row.shots) || 0
    acc[player.id].toi += Number(row.toi) || 0

    const saves = Number(row.gk_saves) || 0
    const against = Number(row.gk_shots_against) || 0
    const conceded =
      row.goalie_goals_against !== null && row.goalie_goals_against !== undefined
        ? Number(row.goalie_goals_against) || 0
        : Math.max(against - saves, 0)

    acc[player.id].saves += saves
    acc[player.id].conceded += conceded
    acc[player.id].goalieWins += Number(row.goalie_wins) || 0
    acc[player.id].goalieLosses += Number(row.goalie_losses) || 0
    acc[player.id].goalieOvertimeLosses += Number(row.goalie_overtime_losses) || 0
    acc[player.id].goalieShutouts += Number(row.goalie_shutouts) || 0

    if (row.gk_percentage) {
      acc[player.id].gk_percentage = Number(row.gk_percentage) || 0
    }

    return acc
  }, {})
  const teamStatRows = Object.values(teamStats)
  const skaterStats = teamStatRows
    .filter((player) => getPositionGroup(player.position) !== 'G')
    .sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.localeCompare(b.name))
  const goalieStats = teamStatRows
    .filter((player) => getPositionGroup(player.position) === 'G')
    .sort((a, b) => {
      const aPct = a.gk_percentage || (a.saves + a.conceded > 0 ? a.saves / (a.saves + a.conceded) : 0)
      const bPct = b.gk_percentage || (b.saves + b.conceded > 0 ? b.saves / (b.saves + b.conceded) : 0)
      return bPct - aPct || b.gp - a.gp || a.name.localeCompare(b.name)
    })
  const franchisePlayerMap = new Map(
    [...franchisePlayers, ...teamPlayers].map((player) => [String(player.id), player])
  )
  const matchesFranchiseGameType = (row: TeamStatRecord) => {
    const gameType = (row.game_type || '').toLowerCase()

    if (franchiseGameType === 'playoffs') {
      return gameType.includes('playoff')
    }

    return !gameType.includes('playoff')
  }
  const franchiseStats = Object.values(
    rawStats.reduce<Record<string, FranchiseStat>>((acc, row) => {
      if (!matchesFranchiseGameType(row) || !row.player_id) return acc

      const player = franchisePlayerMap.get(String(row.player_id))
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
        }
      }

      acc[player.id].gp += Number(row.gp) || 0
      acc[player.id].goals += Number(row.goals) || 0
      acc[player.id].assists += Number(row.assists) || 0
      acc[player.id].points +=
        row.points !== null && row.points !== undefined
          ? Number(row.points) || 0
          : (Number(row.goals) || 0) + (Number(row.assists) || 0)
      acc[player.id].hits += Number(row.hits) || 0

      return acc
    }, {})
  )
  const franchiseSeasonStats: FranchiseSeasonStat[] = rawStats
    .filter((row) => matchesFranchiseGameType(row) && row.player_id)
    .map((row) => {
      const player = franchisePlayerMap.get(String(row.player_id))
      const season = seasonOptions.find((entry) => String(entry.id) === String(row.season_id))

      if (!player) return null

      return {
        id: `${row.id}-${player.id}`,
        name: player.name,
        position: player.position,
        nationality: player.nationality,
        seasonName: season?.name || '-',
        leagueName: team.league || team.name,
        gp: Number(row.gp) || 0,
        goals: Number(row.goals) || 0,
        assists: Number(row.assists) || 0,
        points:
          row.points !== null && row.points !== undefined
            ? Number(row.points) || 0
            : (Number(row.goals) || 0) + (Number(row.assists) || 0),
        hits: Number(row.hits) || 0,
      } satisfies FranchiseSeasonStat
    })
    .filter((row): row is FranchiseSeasonStat => row !== null)

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={heroCard}>
          <div style={heroMain}>
            <div style={logoCard}>
              <img
                src={team.logo_url || 'https://via.placeholder.com/120?text=Team'}
                alt={team.name}
                style={teamLogo}
              />
            </div>

            <div style={teamInfo}>
              <h1 style={teamName}>{team.name}</h1>

              <div style={metaRow}>
                {flagUrl ? (
                  <img src={flagUrl} alt={team.country || team.country_code || ''} style={flagImage} />
                ) : null}
                <span style={metaText}>{team.country || 'Team Country'}</span>
              </div>
            </div>
          </div>

          <div style={rightRail}>
            <div style={formCard}>
              {recentForm.map((item, index) => (
                <div key={`${item.result}-${item.date}-${index}`} style={formItem}>
                  <div style={formBadge}>
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} style={miniLogo} />
                    ) : (
                      <span style={miniLogoFallback}>T</span>
                    )}
                  </div>
                  <div style={resultPill}>{item.result}</div>
                  <div style={formDate}>{item.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={rosterCard}>
          <div style={rosterTopBar}>
            <button
              type="button"
              onClick={() => setActiveView('roster')}
              style={activeView === 'roster' ? rosterTab : rosterTabMuted}
            >
              ROSTER
            </button>
            <button
              type="button"
              onClick={() => setActiveView('stats')}
              style={activeView === 'stats' ? rosterTab : rosterTabMuted}
            >
              STATS
            </button>
          </div>

          <div style={rosterHeaderBar}>
            <div style={rosterTitle}>
              {currentSeasonName} {team.name.toUpperCase()} {activeView === 'roster' ? 'ROSTER' : 'PLAYER STATS'}
            </div>

            <div style={headerControls}>
              <select
                value={selectedSeasonId}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
                style={seasonSelect}
              >
                {seasonOptions.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeView === 'roster' ? (
            <>
              <RosterSection title="GOALTENDERS" players={goalies} />
              <RosterSection title="DEFENSEMEN" players={defenders} />
              <RosterSection title="FORWARDS" players={forwards} />
            </>
          ) : (
            <>
              <StatsCategoryTabs
                category={statsCategory}
                onChange={setStatsCategory}
              />
              {statsCategory === 'skaters' ? (
                <SkaterStatsSection players={skaterStats} />
              ) : (
                <GoalieStatsSection players={goalieStats} />
              )}
            </>
          )}
        </div>

        {activeView === 'roster' ? (
          <div style={factsStack}>
            <TeamFacts team={team} />
            <RosterFacts
              seasonName={currentSeasonName}
              teamName={team.name}
              nationalities={nationalityRows}
              experienceRows={experienceRows}
            />
            <ArenaInformation team={team} />
            <FranchiseAllTime
              gameType={franchiseGameType}
              onGameTypeChange={setFranchiseGameType}
              stats={franchiseStats}
              seasonStats={franchiseSeasonStats}
              showMoreHref={teamStatsPageHref}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatsCategoryTabs({
  category,
  onChange,
}: {
  category: 'skaters' | 'goalies'
  onChange: (value: 'skaters' | 'goalies') => void
}) {
  return (
    <div style={statsTabsBar}>
      <button
        type="button"
        onClick={() => onChange('skaters')}
        style={category === 'skaters' ? statsTableTabActive : statsTableTab}
      >
        SKATER
      </button>
      <button
        type="button"
        onClick={() => onChange('goalies')}
        style={category === 'goalies' ? statsTableTabActive : statsTableTab}
      >
        GOALIE
      </button>
    </div>
  )
}

function RosterSection({ title, players }: { title: string; players: RosterEntry[] }) {
  return (
    <div style={rosterSection}>
      <div style={sectionTitle}>{title}</div>

      <div style={rosterTableWrap}>
        <table style={rosterTable}>
          <thead>
            <tr style={rosterTableHead}>
              <th style={rosterThNum}>#</th>
              <th style={rosterThPlayer}>PLAYER</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const flagUrl = getFlagUrl(player.nationality, player.nationality)

              return (
                <tr key={`${player.id}-${player.seasonName}`} style={rosterRow}>
                  <td style={rosterTdNum}>{player.number || '-'}</td>
                  <td style={rosterTdPlayer}>
                    <div style={playerCell}>
                      {flagUrl ? (
                        <img src={flagUrl} alt={player.nationality || ''} style={rosterFlag} />
                      ) : null}
                      <Link href={`/player/${player.id}`} style={playerLink}>
                        {player.name} ({formatPosition(player.position)})
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {players.length === 0 ? (
              <tr style={rosterRow}>
                <td colSpan={2} style={emptyRosterCell}>
                  No players for this position in the selected season.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SkaterStatsSection({ players }: { players: TeamPlayerStat[] }) {
  return (
    <div style={rosterSection}>
      <div style={rosterTableWrap}>
        <table style={rosterTable}>
          <thead>
            <tr style={rosterTableHead}>
              <th style={rosterThNum}>#</th>
              <th style={rosterThPlayer}>PLAYER</th>
              <th style={statsTh}>GP</th>
              <th style={statsTh}>G</th>
              <th style={statsTh}>A</th>
              <th style={statsTh}>PTS</th>
              <th style={statsTh}>Hits</th>
              <th style={statsTh}>SOG</th>
              <th style={statsTh}>SOG/G</th>
              <th style={statsTh}>TOI</th>
              <th style={statsTh}>+/-</th>
              <th style={statsTh}>SV%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const flagUrl = getFlagUrl(player.nationality, player.nationality)
              const sogPerGame = player.gp ? (player.shots / player.gp).toFixed(1) : '0'
              const calcPct =
                player.saves + player.conceded > 0
                  ? (player.saves / (player.saves + player.conceded)).toFixed(3)
                  : '0'

              return (
                <tr key={player.id} style={rosterRow}>
                  <td style={rosterTdNum}>{player.number || '-'}</td>
                  <td style={rosterTdPlayer}>
                    <div style={playerCell}>
                      {flagUrl ? (
                        <img src={flagUrl} alt={player.nationality || ''} style={rosterFlag} />
                      ) : null}
                      <Link href={`/player/${player.id}`} style={playerLink}>
                        {player.name}
                      </Link>
                    </div>
                  </td>
                  <td style={statsTd}>{player.gp}</td>
                  <td style={statsTd}>{player.goals}</td>
                  <td style={statsTd}>{player.assists}</td>
                  <td style={statsPtsTd}>{player.points}</td>
                  <td style={statsTd}>{player.hits}</td>
                  <td style={statsTd}>{player.shots}</td>
                  <td style={statsTd}>{sogPerGame}</td>
                  <td style={statsTd}>{player.toi}</td>
                  <td style={statsTd}>{player.plusMinus}</td>
                  <td style={statsTd}>{player.gk_percentage || calcPct}</td>
                </tr>
              )
            })}
            {players.length === 0 ? (
              <tr style={rosterRow}>
                <td colSpan={12} style={emptyRosterCell}>
                  No skater stats for this season.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GoalieStatsSection({ players }: { players: TeamPlayerStat[] }) {
  return (
    <div style={rosterSection}>
      <div style={rosterTableWrap}>
        <table style={rosterTable}>
          <thead>
            <tr style={rosterTableHead}>
              <th style={rosterThNum}>#</th>
              <th style={rosterThPlayer}>GOALIE</th>
              <th style={statsTh}>GP</th>
              <th style={statsTh}>GAA</th>
              <th style={statsTh}>SV%</th>
              <th style={statsTh}>W</th>
              <th style={statsTh}>L</th>
              <th style={statsTh}>OTL</th>
              <th style={statsTh}>SO</th>
              <th style={statsTh}>TOI</th>
              <th style={statsTh}>SVS</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const flagUrl = getFlagUrl(player.nationality, player.nationality)
              const calcPct =
                player.saves + player.conceded > 0
                  ? (player.saves / (player.saves + player.conceded)).toFixed(3)
                  : '0'
              const savePct = player.gk_percentage ? player.gk_percentage.toFixed(3) : calcPct
              const goalsAgainstAverage =
                player.toi > 0
                  ? ((player.conceded * 60) / player.toi).toFixed(2)
                  : player.gp > 0
                    ? (player.conceded / player.gp).toFixed(2)
                    : '0.00'

              return (
                <tr key={player.id} style={rosterRow}>
                  <td style={rosterTdNum}>{player.number || '-'}</td>
                  <td style={rosterTdPlayer}>
                    <div style={playerCell}>
                      {flagUrl ? (
                        <img src={flagUrl} alt={player.nationality || ''} style={rosterFlag} />
                      ) : null}
                      <Link href={`/player/${player.id}`} style={playerLink}>
                        {player.name} ({formatPosition(player.position)})
                      </Link>
                    </div>
                  </td>
                  <td style={statsTd}>{player.gp}</td>
                  <td style={statsTd}>{goalsAgainstAverage}</td>
                  <td style={statsPtsTd}>{savePct}</td>
                  <td style={statsTd}>{player.goalieWins}</td>
                  <td style={statsTd}>{player.goalieLosses}</td>
                  <td style={statsTd}>{player.goalieOvertimeLosses}</td>
                  <td style={statsTd}>{player.goalieShutouts}</td>
                  <td style={statsTd}>{player.toi}</td>
                  <td style={statsTd}>{player.saves}</td>
                </tr>
              )
            })}
            {players.length === 0 ? (
              <tr style={rosterRow}>
                <td colSpan={11} style={emptyRosterCell}>
                  No goalie stats for this season.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamFacts({ team }: { team: TeamRecord }) {
  const townFlagUrl = getFlagUrl(team.country, team.country_code)

  return (
    <div style={factsCard}>
      <div style={factsHeader}>{team.name.toUpperCase()} FACTS</div>
      <div style={factsBody}>
        <div style={factRow}>
          <div style={factLabel}>Plays in</div>
          <div style={factValue}>
            {team.league ? (
              <Link href={`/league/${encodeURIComponent(team.league)}`} style={factLink}>
                {team.league}
              </Link>
            ) : (
              'Set team league in Supabase'
            )}
          </div>
        </div>
        <FactRow label="Team Colors" value={team.team_colors || '-'} />
        <div style={factRow}>
          <div style={factLabel}>Town</div>
          <div style={factValue}>
            <span>{team.town || '-'}</span>
            {townFlagUrl && team.town ? (
              <img src={townFlagUrl} alt={team.country || team.country_code || ''} style={smallFactFlag} />
            ) : null}
          </div>
        </div>
        <FactRow label="Founded" value={team.founded ? String(team.founded) : '-'} />
      </div>
    </div>
  )
}

function RosterFacts({
  seasonName,
  teamName,
  nationalities,
  experienceRows,
}: {
  seasonName: string
  teamName: string
  nationalities: { code: string; count: number }[]
  experienceRows: {
    team: string
    league: string
    country?: string | null
    country_code?: string | null
    gp: number
  }[]
}) {
  const totalExperienceGp = experienceRows.reduce((sum, item) => sum + item.gp, 0)
  const leagueExperienceRows = Object.values(
    experienceRows.reduce<
      Record<
        string,
        {
          league: string
          gp: number
          country?: string | null
          country_code?: string | null
        }
      >
    >((acc, item) => {
      if (!acc[item.league]) {
        acc[item.league] = {
          league: item.league,
          gp: 0,
          country: item.country,
          country_code: item.country_code,
        }
      }

      acc[item.league].gp += item.gp
      return acc
    }, {})
  ).sort((a, b) => b.gp - a.gp || a.league.localeCompare(b.league))

  return (
    <div style={factsCard}>
      <div style={factsHeader}>
        {seasonName} {teamName.toUpperCase()} ROSTER FACTS
      </div>
      <div style={factsBody}>
        <div style={factsSplitRow}>
          <div style={factLabel}>Nationalities</div>
          <div style={factValueColumn}>
            {nationalities.length ? (
              nationalities.map((item) => {
                const flagUrl = getFlagUrl(item.code, item.code)

                return (
                  <div key={item.code} style={factInlineItem}>
                    {flagUrl ? <img src={flagUrl} alt={item.code} style={smallFactFlag} /> : null}
                    <span>
                      {item.code} {item.count} player{item.count === 1 ? '' : 's'}
                    </span>
                  </div>
                )
              })
            ) : (
              <span>-</span>
            )}
          </div>
        </div>

        <div style={factsDivider} />

        <div style={factsSplitRow}>
          <div style={factLabel}>Experience</div>
          <div style={factValueColumn}>
            {leagueExperienceRows.length ? (
              <>
                <div style={factInlineItem}>
                  <span>{teamName}: {totalExperienceGp} GP</span>
                </div>
                {leagueExperienceRows.map((item) => {
                  const flagUrl = getFlagUrl(item.country, item.country_code)

                  return (
                    <div key={item.league} style={factInlineItem}>
                      {flagUrl ? (
                        <img
                          src={flagUrl}
                          alt={item.country || item.country_code || ''}
                          style={smallFactFlag}
                        />
                      ) : null}
                      <Link href={`/league/${encodeURIComponent(item.league)}`} style={factLink}>
                        {item.league}
                      </Link>
                      <span>: {item.gp} GP</span>
                    </div>
                  )
                })}
              </>
            ) : (
              <span>No career stats yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ArenaInformation({ team }: { team: TeamRecord }) {
  return (
    <div style={factsCard}>
      <div style={factsHeader}>ARENA INFORMATION</div>
      <div style={factsBody}>
        <FactRow label="Arena Name" value={team.arena_name || '-'} />
        <FactRow label="Location" value={team.arena_location || '-'} />
      </div>
    </div>
  )
}

function FranchiseAllTime({
  gameType,
  onGameTypeChange,
  stats,
  seasonStats,
  showMoreHref,
}: {
  gameType: 'regular' | 'playoffs'
  onGameTypeChange: (value: 'regular' | 'playoffs') => void
  stats: FranchiseStat[]
  seasonStats: FranchiseSeasonStat[]
  showMoreHref: string
}) {
  const buildContextHref = (label: string) =>
    `${showMoreHref}?context=${encodeURIComponent(label)}`
  const sortBy = (key: keyof Pick<FranchiseStat, 'gp' | 'goals' | 'assists' | 'points' | 'hits'>) =>
    [...stats].sort((a, b) => Number(b[key]) - Number(a[key]) || b.points - a.points).slice(0, 5)
  const pointsPerGame = [...stats]
    .filter((player) => player.gp > 0)
    .sort((a, b) => b.points / b.gp - a.points / a.gp || b.points - a.points)
    .slice(0, 5)
  const pointsPerSeason = [...seasonStats]
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)

  return (
    <div style={franchiseWrap}>
      <div style={franchiseGameTypeTabs}>
        <button
          type="button"
          onClick={() => onGameTypeChange('regular')}
          style={gameType === 'regular' ? franchiseGameTypeTabActive : franchiseGameTypeTab}
        >
          Regular Season
        </button>
        <button
          type="button"
          onClick={() => onGameTypeChange('playoffs')}
          style={gameType === 'playoffs' ? franchiseGameTypeTabActive : franchiseGameTypeTab}
        >
          Playoffs
        </button>
      </div>

      <div style={franchiseGrid}>
        <FranchiseCard title="FRANCHISE ALL-TIME POINTS" stats={sortBy('points')} valueColumn="TP" rankBy="points" showMoreHref={buildContextHref('Franchise All-Time Points')} />
        <FranchiseCard title="FRANCHISE ALL-TIME GOALS" stats={sortBy('goals')} valueColumn="TP" rankBy="goals" showMoreHref={buildContextHref('Franchise All-Time Goals')} />
        <FranchiseCard title="FRANCHISE ALL-TIME ASSISTS" stats={sortBy('assists')} valueColumn="TP" rankBy="assists" showMoreHref={buildContextHref('Franchise All-Time Assists')} />
        <FranchiseCard title="FRANCHISE ALL-TIME HITS" stats={sortBy('hits')} valueColumn="HITS" rankBy="hits" showMoreHref={buildContextHref('Franchise All-Time Hits')} />
        <FranchiseCard title="FRANCHISE ALL-TIME GAMES PLAYED" stats={sortBy('gp')} valueColumn="TP" rankBy="gp" showMoreHref={buildContextHref('Franchise All-Time Games Played')} />
        <FranchiseCard title="FRANCHISE ALL-TIME POINTS PER GAME" stats={pointsPerGame} valueColumn="PPG" rankBy="ppg" showMoreHref={buildContextHref('Franchise All-Time Points Per Game')} />
      </div>

      <FranchiseSeasonCard title="FRANCHISE ALL-TIME POINTS PER SEASON" stats={pointsPerSeason} rankBy="points" showMoreHref={buildContextHref('Franchise All-Time Points Per Season')} />
      <FranchiseSeasonCard
        title="FRANCHISE ALL-TIME GOALS PER SEASON"
        stats={[...seasonStats].sort((a, b) => b.goals - a.goals || b.points - a.points).slice(0, 5)}
        rankBy="goals"
        showMoreHref={buildContextHref('Franchise All-Time Goals Per Season')}
      />
      <FranchiseSeasonCard
        title="FRANCHISE ALL-TIME ASSISTS PER SEASON"
        stats={[...seasonStats].sort((a, b) => b.assists - a.assists || b.points - a.points).slice(0, 5)}
        rankBy="assists"
        showMoreHref={buildContextHref('Franchise All-Time Assists Per Season')}
      />
      <FranchiseSeasonCard
        title="FRANCHISE ALL-TIME HITS PER SEASON"
        stats={[...seasonStats].sort((a, b) => b.hits - a.hits || b.points - a.points).slice(0, 5)}
        rankBy="hits"
        showMoreHref={buildContextHref('Franchise All-Time Hits Per Season')}
      />
    </div>
  )
}

function FranchiseCard({
  title,
  stats,
  valueColumn,
  rankBy,
  showMoreHref,
}: {
  title: string
  stats: FranchiseStat[]
  valueColumn: 'TP' | 'HITS' | 'PPG'
  rankBy: FranchiseRankKey
  showMoreHref: string
}) {
  return (
    <div style={franchiseCard}>
      <div style={franchiseCardTitle}>{title}</div>
      <table style={franchiseTable}>
        <thead>
          <tr style={rosterTableHead}>
            <th style={franchiseRankTh}>#</th>
            <th style={franchisePlayerTh}>PLAYER</th>
            <th style={franchiseStatTh}>GP</th>
            <th style={franchiseStatTh}>G</th>
            <th style={franchiseStatTh}>A</th>
            <th style={franchiseStatTh}>{valueColumn}</th>
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
              <tr key={player.id} style={index % 2 === 0 ? franchiseRowAlt : franchiseRow}>
                <td style={franchiseRankTd}>{index + 1}.</td>
                <td style={franchisePlayerTd}>
                  <div style={playerCell}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={rosterFlag} /> : null}
                    <Link href={`/player/${player.id}`} style={playerLink}>
                      {player.name} ({formatPosition(player.position)})
                    </Link>
                  </div>
                </td>
                <td style={rankBy === 'gp' ? franchisePrimaryStatTd : franchiseStatTd}>{player.gp}</td>
                <td style={rankBy === 'goals' ? franchisePrimaryStatTd : franchiseStatTd}>{player.goals}</td>
                <td style={rankBy === 'assists' ? franchisePrimaryStatTd : franchiseStatTd}>{player.assists}</td>
                <td style={rankBy === 'points' || rankBy === 'hits' || rankBy === 'ppg' ? franchisePrimaryStatTd : franchiseStatTd}>{value}</td>
              </tr>
            )
          })}
          {stats.length === 0 ? (
            <tr style={franchiseRow}>
              <td colSpan={6} style={emptyRosterCell}>
                No franchise stats yet.
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

function FranchiseSeasonCard({
  title,
  stats,
  rankBy,
  showMoreHref,
}: {
  title: string
  stats: FranchiseSeasonStat[]
  rankBy: FranchiseRankKey
  showMoreHref: string
}) {
  return (
    <div style={franchiseCardWide}>
      <div style={franchiseCardTitle}>{title}</div>
      <table style={franchiseTable}>
        <thead>
          <tr style={rosterTableHead}>
            <th style={franchiseRankTh}>#</th>
            <th style={franchisePlayerTh}>PLAYER</th>
            <th style={franchiseSeasonTh}>SEASON</th>
            <th style={franchiseSeasonTh}>LEAGUE</th>
            <th style={franchiseStatTh}>GP</th>
            <th style={franchiseStatTh}>G</th>
            <th style={franchiseStatTh}>A</th>
            <th style={franchiseStatTh}>TP</th>
            <th style={franchiseStatTh}>PPG</th>
            <th style={franchiseStatTh}>HITS</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((player, index) => {
            const flagUrl = getFlagUrl(player.nationality, player.nationality)

            return (
              <tr key={player.id} style={index % 2 === 0 ? franchiseRowAlt : franchiseRow}>
                <td style={franchiseRankTd}>{index + 1}.</td>
                <td style={franchisePlayerTd}>
                  <div style={playerCell}>
                    {flagUrl ? <img src={flagUrl} alt={player.nationality || ''} style={rosterFlag} /> : null}
                    <Link href={`/player/${player.id}`} style={playerLink}>
                      {player.name} ({formatPosition(player.position)})
                    </Link>
                  </div>
                </td>
                <td style={franchiseStatTd}>{player.seasonName}</td>
                <td style={franchiseStatTd}>
                  <Link href={`/league/${encodeURIComponent(player.leagueName)}`} style={franchiseLeagueLink}>
                    {player.leagueName}
                  </Link>
                </td>
                <td style={rankBy === 'gp' ? franchisePrimaryStatTd : franchiseStatTd}>{player.gp}</td>
                <td style={rankBy === 'goals' ? franchisePrimaryStatTd : franchiseStatTd}>{player.goals}</td>
                <td style={rankBy === 'assists' ? franchisePrimaryStatTd : franchiseStatTd}>{player.assists}</td>
                <td style={rankBy === 'points' ? franchisePrimaryStatTd : franchiseStatTd}>{player.points}</td>
                <td style={rankBy === 'ppg' ? franchisePrimaryStatTd : franchiseStatTd}>{player.gp ? (player.points / player.gp).toFixed(2) : '0.00'}</td>
                <td style={rankBy === 'hits' ? franchisePrimaryStatTd : franchiseStatTd}>{player.hits}</td>
              </tr>
            )
          })}
          {stats.length === 0 ? (
            <tr style={franchiseRow}>
              <td colSpan={10} style={emptyRosterCell}>
                No franchise season stats yet.
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

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={factRow}>
      <div style={factLabel}>{label}</div>
      <div style={factValue}>{value}</div>
    </div>
  )
}

const pageWrap = {
  minHeight: '100vh',
  background: '#e9edf3',
  padding: '28px 12px',
  fontFamily: 'var(--font-inter), sans-serif',
}

const shell = {
  maxWidth: 1180,
  margin: '0 auto',
}

const heroCard = {
  background: '#123f58',
  color: 'white',
  borderRadius: 0,
  padding: '22px 24px 18px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  marginBottom: 14,
}

const heroMain = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  flex: 1,
}

const logoCard = {
  width: 126,
  minWidth: 126,
  height: 126,
  background: '#f5f5f5',
  border: '2px solid rgba(0,0,0,0.15)',
  borderRadius: 4,
  padding: 6,
  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
}

const teamLogo = {
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
  display: 'block',
  background: '#fff',
}

const teamInfo = {
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
}

const teamName = {
  margin: '0 0 8px 0',
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: '-0.03em',
}

const metaRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 14,
}

const flagImage = {
  width: 18,
  height: 12,
  objectFit: 'cover' as const,
  border: '1px solid rgba(255,255,255,0.28)',
}

const metaText = {
  fontSize: 14,
  color: '#d7e7f0',
  fontWeight: 600,
}

const rightRail = {
  width: 420,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
}

const formCard = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 2,
  background: '#0f3348',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: 6,
  width: '100%',
  maxWidth: 390,
}

const formItem = {
  background: '#173f58',
  borderRadius: 4,
  padding: '8px 4px 6px 4px',
  textAlign: 'center' as const,
}

const formBadge = {
  width: 28,
  height: 28,
  margin: '0 auto 6px auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const miniLogo = {
  width: 28,
  height: 28,
  objectFit: 'contain' as const,
}

const miniLogoFallback = {
  width: 28,
  height: 28,
  borderRadius: 14,
  background: '#254f67',
  color: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
}

const resultPill = {
  fontSize: 10,
  fontWeight: 700,
  color: 'white',
  marginBottom: 4,
}

const formDate = {
  fontSize: 10,
  color: '#cfe1eb',
}

const rosterCard = {
  background: '#fff',
  border: '1px solid #c5d0da',
  borderRadius: 4,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const rosterTopBar = {
  display: 'grid',
  gridTemplateColumns: '160px 160px',
  gap: 2,
  background: '#d8e1e7',
  padding: '0 0 0 0',
}

const rosterTab = {
  background: '#123f58',
  color: 'white',
  fontSize: 11,
  fontWeight: 700,
  padding: '7px 12px',
  textAlign: 'center' as const,
  border: 'none',
  cursor: 'pointer',
}

const rosterTabMuted = {
  background: '#aab9c6',
  color: 'white',
  fontSize: 11,
  fontWeight: 700,
  padding: '7px 12px',
  textAlign: 'center' as const,
  border: 'none',
  cursor: 'pointer',
}

const rosterHeaderBar = {
  background: '#123f58',
  color: 'white',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
}

const rosterTitle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
}

const headerControls = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
}

const statsTabsBar = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 1,
  padding: '0 8px',
  background: '#edf2f6',
  borderTop: '1px solid #dbe3ea',
}

const statsTableTab = {
  minWidth: 112,
  height: 31,
  border: 'none',
  background: '#b8c4cf',
  color: '#ffffff',
  padding: '0 14px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  textAlign: 'center' as const,
}

const statsTableTabActive = {
  ...statsTableTab,
  background: '#123f58',
}

const seasonSelect = {
  height: 28,
  border: '1px solid #c8d2db',
  background: '#fff',
  color: '#1c3244',
  fontSize: 12,
  padding: '0 8px',
}

const rosterSection = {
  borderTop: '1px solid #dbe3ea',
}

const sectionTitle = {
  background: '#b9d1de',
  color: '#365468',
  fontSize: 10,
  fontWeight: 800,
  padding: '6px 10px',
  textTransform: 'uppercase' as const,
}

const rosterTableWrap = {
  width: '100%',
  overflowX: 'auto' as const,
}

const rosterTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 11,
}

const rosterTableHead = {
  background: '#d91f2a',
}

const rosterThNum = {
  color: 'white',
  textAlign: 'left' as const,
  padding: '6px 8px',
  width: 44,
  fontWeight: 800,
}

const rosterThPlayer = {
  color: 'white',
  textAlign: 'left' as const,
  padding: '6px 8px',
  fontWeight: 800,
}

const statsTh = {
  color: 'white',
  textAlign: 'center' as const,
  padding: '6px 8px',
  width: 62,
  fontWeight: 800,
}

const rosterRow = {
  borderTop: '1px solid #edf1f4',
}

const rosterTdNum = {
  padding: '6px 8px',
  color: '#2c4559',
  whiteSpace: 'nowrap' as const,
}

const rosterTdPlayer = {
  padding: '6px 8px',
}

const statsTd = {
  padding: '6px 8px',
  textAlign: 'center' as const,
  color: '#334d61',
}

const statsPtsTd = {
  ...statsTd,
  fontWeight: 700,
  color: '#16354f',
}

const playerCell = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const rosterFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #c2cbd3',
}

const playerLink = {
  color: '#2c78b6',
  textDecoration: 'none',
  fontWeight: 600,
}

const emptyRosterCell = {
  padding: '12px 10px',
  color: '#5c7386',
  textAlign: 'center' as const,
}

const factsStack = {
  marginTop: 14,
}

const factsCard = {
  margin: '0 0 12px 0',
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const factsHeader = {
  background: '#123f58',
  color: 'white',
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 800,
  padding: '9px 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.02em',
  fontFamily: 'var(--font-inter), sans-serif',
}

const factsBody = {
  padding: '6px 12px 8px 12px',
}

const factRow = {
  display: 'grid',
  gridTemplateColumns: '165px 1fr',
  alignItems: 'center',
  borderBottom: '1px solid #cbd3da',
  minHeight: 27,
}

const factsSplitRow = {
  display: 'grid',
  gridTemplateColumns: '165px 1fr',
  alignItems: 'start',
  padding: '7px 0',
}

const factLabel = {
  color: '#071d2d',
  fontSize: 11,
  fontWeight: 700,
}

const factValue = {
  color: '#006eb7',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const factLink = {
  color: '#006eb7',
  textDecoration: 'none',
  fontSize: 11,
  fontWeight: 600,
}

const factValueColumn = {
  color: '#006eb7',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 5,
}

const factInlineItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  lineHeight: 1,
}

const smallFactFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #9eabb6',
}

const factsDivider = {
  height: 1,
  background: '#cbd3da',
}

const franchiseWrap = {
  marginTop: 10,
}

const franchiseGameTypeTabs = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 18,
  margin: '0 0 12px 0',
}

const franchiseGameTypeTab = {
  background: 'transparent',
  border: 'none',
  borderBottom: '3px solid transparent',
  color: '#123f58',
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 500,
  lineHeight: 1,
  padding: '0 0 7px 0',
}

const franchiseGameTypeTabActive = {
  ...franchiseGameTypeTab,
  borderBottom: '3px solid #123f58',
  color: '#071d2d',
  fontWeight: 800,
}

const franchiseGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const franchiseCard = {
  background: '#fff',
  border: '1px solid #c6d1da',
  borderRadius: 5,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const franchiseCardWide = {
  ...franchiseCard,
  marginTop: 12,
}

const franchiseCardTitle = {
  background: '#123f58',
  color: '#fff',
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 800,
  padding: '9px 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.02em',
  fontFamily: 'var(--font-inter), sans-serif',
}

const franchiseTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 11,
  fontFamily: 'var(--font-inter), sans-serif',
}

const franchiseRankTh = {
  color: 'white',
  textAlign: 'left' as const,
  padding: '6px 8px',
  width: 30,
  fontWeight: 700,
}

const franchisePlayerTh = {
  color: 'white',
  textAlign: 'left' as const,
  padding: '6px 8px',
  fontWeight: 700,
}

const franchiseSeasonTh = {
  color: 'white',
  textAlign: 'left' as const,
  padding: '6px 8px',
  width: 95,
  fontWeight: 700,
}

const franchiseStatTh = {
  color: 'white',
  textAlign: 'center' as const,
  padding: '6px 7px',
  width: 42,
  fontWeight: 700,
}

const franchiseRow = {
  background: '#fff',
}

const franchiseRowAlt = {
  background: '#e8ebef',
}

const franchiseRankTd = {
  padding: '7px 8px',
  color: '#1f3445',
}

const franchisePlayerTd = {
  padding: '7px 8px',
}

const franchiseStatTd = {
  padding: '7px 7px',
  textAlign: 'center' as const,
  color: '#1f3445',
  whiteSpace: 'nowrap' as const,
  fontWeight: 600,
}

const franchiseLeagueLink = {
  color: '#1b5b86',
  textDecoration: 'none',
}

const franchisePrimaryStatTd = {
  ...franchiseStatTd,
  color: '#1f3445',
  background: '#cfd5db',
  fontWeight: 600,
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
