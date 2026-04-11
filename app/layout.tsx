'use client'
/* eslint-disable @next/next/no-img-element */

import './globals.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { loadAdminStatus } from '../lib/adminClient'

type AdminPanelType = 'player' | 'stats' | 'league' | 'team' | 'standings' | null

type AdminPlayerOption = {
  id: string
  name: string
}

type AdminTeamOption = {
  id: string
  name: string
}

type AdminSeasonOption = {
  id: string
  name: string
}

type AdminLeagueOption = {
  id: string
  name: string
  abbreviation?: string | null
  logo_url?: string | null
}

type SearchPlayerOption = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
  image_url?: string | null
}

type SearchTeamOption = {
  id: string
  name: string
  logo_url?: string | null
  league?: string | null
}

type SearchLeagueOption = {
  id: string
  name: string
  abbreviation?: string | null
  country_code?: string | null
  logo_url?: string | null
  image_url?: string | null
  href?: string
}

type SidebarPlayerOption = {
  id: string
  name: string
  nationality?: string | null
}

type SidebarStatRecord = {
  player_id?: string | null
  team_id?: string | null
  gp?: number | null
  goals?: number | null
  assists?: number | null
  points?: number | null
}

type SidebarLeaderRow = {
  id: string
  name: string
  nationality?: string | null
  gp: number
  goals: number
  assists: number
  points: number
}

type AdminPlayerForm = {
  name: string
  display_name: string
  team_id: string
  number: string
  position: string
  nationality: string
  player_type: string
  image_url: string
}

type AdminStatsForm = {
  player_id: string
  team_id: string
  season_id: string
  game_type: 'regular' | 'playoffs'
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

type AdminLeagueForm = {
  name: string
  display_name: string
  abbreviation: string
  short_name: string
  logo_url: string
  category: 'league' | 'international'
  region: string
  country_code: string
}

type AdminTeamForm = {
  name: string
  league: string
  logo_url: string
  country: string
  country_code: string
  team_colors: string
  town: string
  founded: string
  arena_name: string
  arena_location: string
}

type AdminStandingRowForm = {
  id?: string
  team_id: string
  rank: string
  gp: string
  wins: string
  losses: string
  overtime_losses: string
  regulation_wins: string
  points: string
  goals_for: string
  goals_against: string
  goal_difference: string
  sogf: string
  soga: string
  shot_percentage: string
}

type AdminStandingsForm = {
  league_id: string
  season_id: string
  rows: AdminStandingRowForm[]
}

const pages = [
  { name: 'Home', href: '/' },
  { name: 'Teams', href: '/team' },
  { name: 'Leagues', href: '/league' },
  { name: 'Awards', href: '/awards' },
]

const emptyPlayerForm = (): AdminPlayerForm => ({
  name: '',
  display_name: '',
  team_id: '',
  number: '',
  position: '',
  nationality: '',
  player_type: '',
  image_url: '',
})

const emptyStatsForm = (): AdminStatsForm => ({
  player_id: '',
  team_id: '',
  season_id: '',
  game_type: 'regular',
  gp: '',
  goals: '',
  assists: '',
  points: '',
  hits: '',
  plus_minus: '',
  shots: '',
  toi: '',
  gk_saves: '',
  gk_shots_against: '',
  gk_percentage: '',
  goalie_wins: '',
  goalie_losses: '',
  goalie_overtime_losses: '',
  goalie_shutouts: '',
  goalie_goals_against: '',
})

const emptyLeagueForm = (): AdminLeagueForm => ({
  name: '',
  display_name: '',
  abbreviation: '',
  short_name: '',
  logo_url: '',
  category: 'league',
  region: 'EU',
  country_code: '',
})

const emptyTeamForm = (): AdminTeamForm => ({
  name: '',
  league: '',
  logo_url: '',
  country: '',
  country_code: '',
  team_colors: '',
  town: '',
  founded: '',
  arena_name: '',
  arena_location: '',
})

const emptyStandingRow = (): AdminStandingRowForm => ({
  team_id: '',
  rank: '',
  gp: '',
  wins: '',
  losses: '',
  overtime_losses: '',
  regulation_wins: '',
  points: '',
  goals_for: '',
  goals_against: '',
  goal_difference: '',
  sogf: '',
  soga: '',
  shot_percentage: '',
})

const emptyStandingsForm = (): AdminStandingsForm => ({
  league_id: '',
  season_id: '',
  rows: [emptyStandingRow()],
})

function toNullableNumber(value: string) {
  return value.trim() ? Number(value) : null
}

function getSearchFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

function normalizeLeagueLookup(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeImageUrl(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const nationalityToCode: Record<string, string> = {
  canada: 'CA',
  usa: 'US',
  'united states': 'US',
  sweden: 'SE',
  finland: 'FI',
  czechia: 'CZ',
  'czech republic': 'CZ',
  slovakia: 'SK',
  russia: 'RU',
  germany: 'DE',
  switzerland: 'CH',
  austria: 'AT',
  norway: 'NO',
  denmark: 'DK',
  latvia: 'LV',
}

function getNationalityFlagUrl(nationality?: string | null) {
  if (!nationality) return null
  const trimmed = nationality.trim()
  if (!trimmed) return null

  const countryCode =
    trimmed.length === 2 ? trimmed.toUpperCase() : nationalityToCode[trimmed.toLowerCase()] || null

  return countryCode ? getSearchFlagUrl(countryCode) : null
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [activeAdminPanel, setActiveAdminPanel] = useState<AdminPanelType>(null)
  const [adminPlayers, setAdminPlayers] = useState<AdminPlayerOption[]>([])
  const [adminTeams, setAdminTeams] = useState<AdminTeamOption[]>([])
  const [adminSeasons, setAdminSeasons] = useState<AdminSeasonOption[]>([])
  const [adminLeagues, setAdminLeagues] = useState<AdminLeagueOption[]>([])
  const [adminIsLoading, setAdminIsLoading] = useState(false)
  const [adminSaveMessage, setAdminSaveMessage] = useState('')
  const [adminIsSaving, setAdminIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewerEmail, setViewerEmail] = useState<string | null>(null)
  const [playerForm, setPlayerForm] = useState<AdminPlayerForm>(emptyPlayerForm)
  const [statsForm, setStatsForm] = useState<AdminStatsForm>(emptyStatsForm)
  const [leagueForm, setLeagueForm] = useState<AdminLeagueForm>(emptyLeagueForm)
  const [teamForm, setTeamForm] = useState<AdminTeamForm>(emptyTeamForm)
  const [standingsForm, setStandingsForm] = useState<AdminStandingsForm>(emptyStandingsForm)
  const [searchValue, setSearchValue] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchPlayers, setSearchPlayers] = useState<SearchPlayerOption[]>([])
  const [searchTeams, setSearchTeams] = useState<SearchTeamOption[]>([])
  const [searchLeagues, setSearchLeagues] = useState<SearchLeagueOption[]>([])
  const [leaderPlayers, setLeaderPlayers] = useState<SidebarPlayerOption[]>([])
  const [leaderTeams, setLeaderTeams] = useState<SearchTeamOption[]>([])
  const [leaderStats, setLeaderStats] = useState<SidebarStatRecord[]>([])
  const [selectedLeaderLeague, setSelectedLeaderLeague] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadViewerStatus() {
      const status = await loadAdminStatus()
      if (!isMounted) return
      setIsAdmin(status.isAdmin)
      setViewerEmail(status.email)
    }

    void loadViewerStatus()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadViewerStatus()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setIsAdminMenuOpen(false)
      setActiveAdminPanel(null)
    }
  }, [isAdmin])

  async function signOutViewer() {
    await supabase.auth.signOut()
    setIsAdmin(false)
    setViewerEmail(null)
    setIsAdminMenuOpen(false)
    setActiveAdminPanel(null)
    router.push('/')
  }

  useEffect(() => {
    if (!activeAdminPanel) return

    async function fetchAdminOptions() {
      setAdminIsLoading(true)

      const [
        { data: playersData },
        { data: teamsData },
        { data: seasonsData },
        { data: leaguesData },
      ] = await Promise.all([
        supabase.from('players').select('id, name').order('name', { ascending: true }),
        supabase.from('teams').select('id, name').order('name', { ascending: true }),
        supabase.from('seasons').select('id, name').order('name', { ascending: true }),
        supabase
          .from('leagues')
          .select('id, name, logo_url')
          .order('name', { ascending: true }),
      ])

      setAdminPlayers((playersData as AdminPlayerOption[]) || [])
      setAdminTeams((teamsData as AdminTeamOption[]) || [])
      setAdminSeasons((seasonsData as AdminSeasonOption[]) || [])
      setAdminLeagues((leaguesData as AdminLeagueOption[]) || [])
      setAdminIsLoading(false)
    }

    fetchAdminOptions()
  }, [activeAdminPanel])

  useEffect(() => {
    if (activeAdminPanel !== 'standings') return
    if (!standingsForm.league_id || !standingsForm.season_id) return

    async function fetchExistingStandings() {
      setAdminIsLoading(true)

      const { data, error } = await supabase
        .from('league_standings')
        .select('id, team_id, rank, gp, wins, losses, overtime_losses, regulation_wins, points, goals_for, goals_against, goal_difference, sogf, soga, shot_percentage')
        .eq('league_id', standingsForm.league_id)
        .eq('season_id', standingsForm.season_id)
        .order('rank', { ascending: true })

      if (error) {
        setAdminSaveMessage(error.message)
        setAdminIsLoading(false)
        return
      }

      const loadedRows = ((data as Record<string, unknown>[]) || []).map((row) => ({
        id: String(row.id || ''),
        team_id: String(row.team_id || ''),
        rank: row.rank === null || row.rank === undefined ? '' : String(row.rank),
        gp: row.gp === null || row.gp === undefined ? '' : String(row.gp),
        wins: row.wins === null || row.wins === undefined ? '' : String(row.wins),
        losses: row.losses === null || row.losses === undefined ? '' : String(row.losses),
        overtime_losses:
          row.overtime_losses === null || row.overtime_losses === undefined ? '' : String(row.overtime_losses),
        regulation_wins:
          row.regulation_wins === null || row.regulation_wins === undefined ? '' : String(row.regulation_wins),
        points: row.points === null || row.points === undefined ? '' : String(row.points),
        goals_for: row.goals_for === null || row.goals_for === undefined ? '' : String(row.goals_for),
        goals_against:
          row.goals_against === null || row.goals_against === undefined ? '' : String(row.goals_against),
        goal_difference:
          row.goal_difference === null || row.goal_difference === undefined ? '' : String(row.goal_difference),
        sogf: row.sogf === null || row.sogf === undefined ? '' : String(row.sogf),
        soga: row.soga === null || row.soga === undefined ? '' : String(row.soga),
        shot_percentage:
          row.shot_percentage === null || row.shot_percentage === undefined ? '' : String(row.shot_percentage),
      }))

      setStandingsForm((current) => ({
        ...current,
        rows: loadedRows.length ? loadedRows : [emptyStandingRow()],
      }))
      setAdminSaveMessage(loadedRows.length ? 'Loaded existing standings for this league and season.' : '')
      setAdminIsLoading(false)
    }

    void fetchExistingStandings()
  }, [activeAdminPanel, standingsForm.league_id, standingsForm.season_id])

  useEffect(() => {
    async function fetchSearchOptions() {
      const [
        { data: playersData },
        { data: teamsData },
        { data: leaguesData },
      ] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, position, nationality, image_url')
          .order('name', { ascending: true })
          .limit(24),
        supabase
          .from('teams')
          .select('id, name, logo_url, league')
          .order('name', { ascending: true })
          .limit(24),
        supabase
          .from('leagues')
          .select('id, name, abbreviation, country_code, logo_url, image_url')
          .order('name', { ascending: true })
          .limit(48),
      ])

      setSearchPlayers((playersData as SearchPlayerOption[]) || [])
      setSearchTeams((teamsData as SearchTeamOption[]) || [])
      setSearchLeagues((leaguesData as SearchLeagueOption[]) || [])
    }

    fetchSearchOptions()
  }, [])

  useEffect(() => {
    async function fetchSidebarLeaders() {
      const [{ data: playersData }, { data: teamsData }, { data: statsData }] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, nationality')
          .order('name', { ascending: true }),
        supabase.from('teams').select('id, league, logo_url'),
        supabase
          .from('stats')
          .select('player_id, team_id, gp, goals, assists, points'),
      ])

      setLeaderPlayers((playersData as SidebarPlayerOption[]) || [])
      setLeaderTeams((teamsData as SearchTeamOption[]) || [])
      setLeaderStats((statsData as SidebarStatRecord[]) || [])
    }

    fetchSidebarLeaders()
  }, [])

  useEffect(() => {
    setIsSearchOpen(false)
  }, [pathname])

function openAdminPanel(panel: Exclude<AdminPanelType, null>) {
    if (!isAdmin) return

    setAdminSaveMessage('')
    setIsAdminMenuOpen(false)
    if (panel === 'player') setPlayerForm(emptyPlayerForm())
    if (panel === 'stats') setStatsForm(emptyStatsForm())
    if (panel === 'league') setLeagueForm(emptyLeagueForm())
    if (panel === 'team') setTeamForm(emptyTeamForm())
    if (panel === 'standings') setStandingsForm(emptyStandingsForm())
    setActiveAdminPanel(panel)
  }

  function closeAdminPanel() {
    setActiveAdminPanel(null)
    setAdminSaveMessage('')
    setAdminIsSaving(false)
  }

  const normalizedSearch = searchValue.trim().toLowerCase()
  const playerMatches = normalizedSearch
    ? searchPlayers.filter((player) =>
        [player.name, player.position, player.nationality]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : []
  const teamMatches = normalizedSearch
    ? searchTeams.filter((team) =>
        [team.name, team.league]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : []
  const fallbackLeagueOptions: SearchLeagueOption[] = Array.from(
    new Set(leaderTeams.map((team) => team.league).filter(Boolean))
  ).map((leagueName) => {
    const normalizedLeagueName = normalizeLeagueLookup(String(leagueName))
    const matchedSearchLeague = searchLeagues.find((league) =>
      [league.name, league.abbreviation]
        .filter(Boolean)
        .some((value) => {
          const normalizedValue = normalizeLeagueLookup(String(value))
          return (
            normalizedValue === normalizedLeagueName ||
            normalizedValue.includes(normalizedLeagueName) ||
            normalizedLeagueName.includes(normalizedValue)
          )
        })
    )
    const matchedAdminLeague = adminLeagues.find((league) =>
      [league.name, league.abbreviation]
        .filter(Boolean)
        .some((value) => {
          const normalizedValue = normalizeLeagueLookup(String(value))
          return (
            normalizedValue === normalizedLeagueName ||
            normalizedValue.includes(normalizedLeagueName) ||
            normalizedLeagueName.includes(normalizedValue)
          )
        })
    )

    if (matchedSearchLeague) {
      return {
        id: matchedSearchLeague.id,
        name: matchedSearchLeague.name,
        abbreviation: matchedSearchLeague.abbreviation || null,
        country_code: matchedSearchLeague.country_code || null,
        logo_url: matchedSearchLeague.logo_url || null,
        image_url: matchedSearchLeague.image_url || null,
        href: `/league/${matchedSearchLeague.id}`,
      }
    }

    if (matchedAdminLeague) {
      return {
        id: matchedAdminLeague.id,
        name: matchedAdminLeague.name,
        abbreviation: matchedAdminLeague.abbreviation || null,
        country_code: null,
        logo_url: null,
        image_url: null,
        href: `/league/${matchedAdminLeague.id}`,
      }
    }

    return {
      id: String(leagueName),
      name: String(leagueName),
      abbreviation: null,
      country_code: null,
      logo_url: null,
      image_url: null,
      href: `/league/${encodeURIComponent(String(leagueName))}`,
    }
  })
  const resolvedLeagueOptions = searchLeagues.length
    ? searchLeagues.map((league) => ({
        ...league,
        logo_url: normalizeImageUrl(league.logo_url),
        image_url: normalizeImageUrl(league.image_url),
      }))
    : adminLeagues.length
      ? adminLeagues.map((league) => ({
          id: league.id,
          name: league.name,
          abbreviation: league.abbreviation || null,
          country_code: null,
          logo_url: normalizeImageUrl(league.logo_url),
          image_url: null,
          href: `/league/${league.id}`,
        }))
      : fallbackLeagueOptions
  const sidebarLeagueOptions = resolvedLeagueOptions.length ? resolvedLeagueOptions : fallbackLeagueOptions
  const activeLeaderLeagueId = selectedLeaderLeague || sidebarLeagueOptions[0]?.id || ''
  const activeLeaderLeague = sidebarLeagueOptions.find((league) => league.id === activeLeaderLeagueId) || null
  const leaderPlayersById = new Map(leaderPlayers.map((player) => [String(player.id), player]))
  const leaderRows = Object.values(
    leaderStats.reduce<Record<string, SidebarLeaderRow>>((acc, stat) => {
      if (!stat.player_id || !stat.team_id) return acc

      const team = leaderTeams.find((entry) => String(entry.id) === String(stat.team_id))
      if (!team?.league) return acc

      if (activeLeaderLeague) {
        const normalizedTeamLeague = normalizeLeagueLookup(team.league)
        const matchesLeague = [activeLeaderLeague.name, activeLeaderLeague.abbreviation]
          .filter(Boolean)
          .some((value) => {
            const normalizedLeagueValue = normalizeLeagueLookup(String(value))
            return (
              normalizedLeagueValue === normalizedTeamLeague ||
              normalizedLeagueValue.includes(normalizedTeamLeague) ||
              normalizedTeamLeague.includes(normalizedLeagueValue)
            )
          })

        if (!matchesLeague) return acc
      }

      const player = leaderPlayersById.get(String(stat.player_id))
      if (!player) return acc

      if (!acc[player.id]) {
        acc[player.id] = {
          id: player.id,
          name: player.name,
          nationality: player.nationality,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
        }
      }

      acc[player.id].gp += Number(stat.gp) || 0
      acc[player.id].goals += Number(stat.goals) || 0
      acc[player.id].assists += Number(stat.assists) || 0
      acc[player.id].points +=
        stat.points !== null && stat.points !== undefined
          ? Number(stat.points) || 0
          : (Number(stat.goals) || 0) + (Number(stat.assists) || 0)

      return acc
    }, {})
  )
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
    .slice(0, 5)

  useEffect(() => {
    if (!selectedLeaderLeague && sidebarLeagueOptions.length) {
      setSelectedLeaderLeague(sidebarLeagueOptions[0].id)
    }
  }, [selectedLeaderLeague, sidebarLeagueOptions])
  const leagueMatches = normalizedSearch
    ? resolvedLeagueOptions.filter((league) =>
        [league.name, league.abbreviation]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : []
  const popularLeagueOptions: SearchLeagueOption[] = searchLeagues.length
    ? searchLeagues.map((league) => ({
        ...league,
        logo_url: normalizeImageUrl(league.logo_url),
        image_url: normalizeImageUrl(league.image_url),
      }))
    : adminLeagues.length
      ? adminLeagues.map((league) => ({
          id: league.id,
          name: league.name,
          abbreviation: league.abbreviation || null,
          country_code: null,
          logo_url: normalizeImageUrl(league.logo_url),
          image_url: null,
          href: `/league/${league.id}`,
        }))
      : fallbackLeagueOptions

  const legacyCombinedMatches = [
    ...playerMatches.slice(0, 4).map((player) => ({
      id: `player-${player.id}`,
      href: `/player/${player.id}`,
      title: player.name,
      subtitle: `${player.position || 'Player'}${player.nationality ? ` • ${player.nationality}` : ''}`,
      kind: 'Player',
      imageUrl: player.image_url || null,
    })),
    ...teamMatches.slice(0, 3).map((team) => ({
      id: `team-${team.id}`,
      href: `/team/${team.id}`,
      title: team.name,
      subtitle: team.league || 'Team',
      kind: 'Team',
      imageUrl: team.logo_url || null,
    })),
    ...leagueMatches.slice(0, 3).map((league) => ({
      id: `league-${league.id}`,
      href: `/league/${league.id}`,
      title: league.name,
      subtitle: league.abbreviation || 'League',
      kind: 'League',
      imageUrl: getSearchFlagUrl(league.country_code),
    })),
  ].slice(0, 8)
  const playerSearchResults = playerMatches.slice(0, 4).map((player) => ({
    id: `player-${player.id}`,
    href: `/player/${player.id}`,
    title: player.name,
    subtitle:
      `${player.position || 'Player'}` +
      `${player.nationality ? ` • ${player.nationality}` : ''}`,
    kind: 'Player',
    imageUrl: player.image_url || null,
  }))
  const teamSearchResults = teamMatches.slice(0, 3).map((team) => ({
    id: `team-${team.id}`,
    href: `/team/${team.id}`,
    title: team.name,
    subtitle: team.league || 'Team',
    kind: 'Team',
    imageUrl: team.logo_url || null,
  }))
  const leagueSearchResults = leagueMatches.slice(0, 8).map((league) => ({
    id: `league-${league.id}`,
    href: league.href || `/league/${league.id}`,
    title: league.name,
    subtitle: league.abbreviation ? `${league.abbreviation} • League` : 'League',
    kind: 'League',
    imageUrl: league.logo_url || league.image_url || getSearchFlagUrl(league.country_code),
  }))
  const combinedMatches = [...playerSearchResults, ...teamSearchResults, ...leagueSearchResults]

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!combinedMatches.length) return

    router.push(combinedMatches[0].href)
    setIsSearchOpen(false)
  }

  function goToRandomPlayer() {
    if (!searchPlayers.length) return

    const randomPlayer = searchPlayers[Math.floor(Math.random() * searchPlayers.length)]
    router.push(`/player/${randomPlayer.id}`)
    setIsSearchOpen(false)
  }

  async function savePlayerForm() {
    setAdminIsSaving(true)
    setAdminSaveMessage('')

    const payload = {
      name: playerForm.name.trim(),
      display_name: playerForm.display_name.trim() || null,
      team_id: playerForm.team_id || null,
      number: toNullableNumber(playerForm.number),
      position: playerForm.position.trim() || null,
      nationality: playerForm.nationality.trim() || null,
      player_type: playerForm.player_type.trim() || null,
      image_url: playerForm.image_url.trim() || null,
    }

    const { error } = await supabase.from('players').insert(payload)

    if (error) {
      setAdminSaveMessage(error.message)
      setAdminIsSaving(false)
      return
    }

    setAdminSaveMessage('Player added.')
    setPlayerForm(emptyPlayerForm())
    setAdminIsSaving(false)
  }

  async function saveStatsForm() {
    setAdminIsSaving(true)
    setAdminSaveMessage('')

    const matchPayload = {
      player_id: statsForm.player_id,
      team_id: statsForm.team_id,
      season_id: statsForm.season_id,
      game_type: statsForm.game_type,
    }

    const statPayload = {
      ...matchPayload,
      gp: toNullableNumber(statsForm.gp),
      goals: toNullableNumber(statsForm.goals),
      assists: toNullableNumber(statsForm.assists),
      points: toNullableNumber(statsForm.points),
      hits: toNullableNumber(statsForm.hits),
      plus_minus: toNullableNumber(statsForm.plus_minus),
      shots: toNullableNumber(statsForm.shots),
      toi: toNullableNumber(statsForm.toi),
      gk_saves: toNullableNumber(statsForm.gk_saves),
      gk_shots_against: toNullableNumber(statsForm.gk_shots_against),
      gk_percentage: toNullableNumber(statsForm.gk_percentage),
      goalie_wins: toNullableNumber(statsForm.goalie_wins),
      goalie_losses: toNullableNumber(statsForm.goalie_losses),
      goalie_overtime_losses: toNullableNumber(statsForm.goalie_overtime_losses),
      goalie_shutouts: toNullableNumber(statsForm.goalie_shutouts),
      goalie_goals_against: toNullableNumber(statsForm.goalie_goals_against),
    }

    const { data: existingRow, error: existingError } = await supabase
      .from('stats')
      .select('id')
      .eq('player_id', statsForm.player_id)
      .eq('team_id', statsForm.team_id)
      .eq('season_id', statsForm.season_id)
      .eq('game_type', statsForm.game_type)
      .maybeSingle()

    if (existingError) {
      setAdminSaveMessage(existingError.message)
      setAdminIsSaving(false)
      return
    }

    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({ team_id: statsForm.team_id })
      .eq('id', statsForm.player_id)

    if (playerUpdateError) {
      setAdminSaveMessage(playerUpdateError.message)
      setAdminIsSaving(false)
      return
    }

    const { error: saveError } = existingRow?.id
      ? await supabase.from('stats').update(statPayload).eq('id', existingRow.id)
      : await supabase.from('stats').insert(statPayload)

    if (saveError) {
      setAdminSaveMessage(saveError.message)
      setAdminIsSaving(false)
      return
    }

    setAdminSaveMessage(existingRow?.id ? 'Roster/stats updated.' : 'Roster/stats added.')
    setStatsForm(emptyStatsForm())
    setAdminIsSaving(false)
  }

  async function saveLeagueForm() {
    setAdminIsSaving(true)
    setAdminSaveMessage('')

    const payload = {
      name: leagueForm.name.trim(),
      display_name: leagueForm.display_name.trim() || null,
      abbreviation: leagueForm.abbreviation.trim() || null,
      short_name: leagueForm.short_name.trim() || null,
      logo_url: leagueForm.logo_url.trim() || null,
      category: leagueForm.category,
      region: leagueForm.region.trim() || null,
      country_code: leagueForm.country_code.trim().toUpperCase() || null,
    }

    const { error } = await supabase.from('leagues').insert(payload)

    if (error) {
      setAdminSaveMessage(error.message)
      setAdminIsSaving(false)
      return
    }

    setAdminSaveMessage('League added.')
    setLeagueForm(emptyLeagueForm())
    setAdminIsSaving(false)
  }

  async function saveTeamForm() {
    setAdminIsSaving(true)
    setAdminSaveMessage('')

    const payload = {
      name: teamForm.name.trim(),
      league: teamForm.league.trim() || null,
      logo_url: teamForm.logo_url.trim() || null,
      country: teamForm.country.trim() || null,
      country_code: teamForm.country_code.trim().toUpperCase() || null,
      team_colors: teamForm.team_colors.trim() || null,
      town: teamForm.town.trim() || null,
      founded: teamForm.founded.trim() || null,
      arena_name: teamForm.arena_name.trim() || null,
      arena_location: teamForm.arena_location.trim() || null,
    }

    const { error } = await supabase.from('teams').insert(payload)

    if (error) {
      setAdminSaveMessage(error.message)
      setAdminIsSaving(false)
      return
    }

    setAdminSaveMessage('Team added.')
    setTeamForm(emptyTeamForm())
    setAdminIsSaving(false)
  }

  function updateStandingsRow(index: number, field: keyof AdminStandingRowForm, value: string) {
    setStandingsForm((current) => ({
      ...current,
      rows: current.rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      ),
    }))
  }

  function addStandingsRow() {
    setStandingsForm((current) => ({
      ...current,
      rows: [...current.rows, emptyStandingRow()],
    }))
  }

  function removeStandingsRow(index: number) {
    setStandingsForm((current) => ({
      ...current,
      rows:
        current.rows.length === 1
          ? [emptyStandingRow()]
          : current.rows.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  async function saveStandingsForm() {
    if (!standingsForm.league_id || !standingsForm.season_id) {
      setAdminSaveMessage('Select a league and season first.')
      return
    }

    setAdminIsSaving(true)
    setAdminSaveMessage('')

    const rowsToSave = standingsForm.rows
      .filter((row) => row.team_id)
      .map((row) => ({
        id: row.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),
        league_id: standingsForm.league_id,
        season_id: standingsForm.season_id,
        team_id: row.team_id,
        rank: toNullableNumber(row.rank),
        gp: toNullableNumber(row.gp),
        wins: toNullableNumber(row.wins),
        losses: toNullableNumber(row.losses),
        overtime_losses: toNullableNumber(row.overtime_losses),
        regulation_wins: toNullableNumber(row.regulation_wins),
        points: toNullableNumber(row.points),
        goals_for: toNullableNumber(row.goals_for),
        goals_against: toNullableNumber(row.goals_against),
        goal_difference: toNullableNumber(row.goal_difference),
        sogf: toNullableNumber(row.sogf),
        soga: toNullableNumber(row.soga),
        shot_percentage: toNullableNumber(row.shot_percentage),
      }))

    if (!rowsToSave.length) {
      setAdminSaveMessage('Add at least one team row to save standings.')
      setAdminIsSaving(false)
      return
    }

    const { error } = await supabase.from('league_standings').upsert(rowsToSave)

    if (error) {
      setAdminSaveMessage(error.message)
      setAdminIsSaving(false)
      return
    }

    setAdminSaveMessage('Standings saved.')
    setAdminIsSaving(false)
  }

  return (
    <html lang="en">
      <body style={body}>
        <header style={header}>
          <div style={topBar}>
            <div style={topBarInner}>
              <div style={topBarDisclaimer}>
                This project is inspired by Elite Prospects and is not affiliated with or endorsed by them.
              </div>
              <div style={topBarActions}>
                <span style={topBarText}>Help</span>
                {viewerEmail ? (
                  <>
                    <span style={topBarUserText}>{viewerEmail}</span>
                    <button type="button" onClick={signOutViewer} style={topBarGhostButton}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <div style={topBarAuthPills}>
                    <Link href="/sign-up" style={topBarPrimaryAuthLink}>
                      Sign up
                    </Link>
                    <Link href="/sign-in" style={topBarSecondaryAuthLink}>
                      Sign in
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={mainHeader}>
            <div style={mainHeaderInner}>
              <div style={logoContainer}>
                <Link href="/" style={logoLink}>
                  <span style={logoEkhl}>EKHL</span>
                  <span style={logoProspects}>prospects</span>
                </Link>
              </div>

              <nav style={nav}>
                {pages.map((page) => {
                  const isActive =
                    pathname === page.href ||
                    (page.href !== '/' && pathname?.startsWith(page.href + '/'))

                  return (
                    <Link
                      key={page.name}
                      href={page.href}
                      style={{
                        ...navLink,
                        ...(isActive ? navActive : {}),
                      }}
                    >
                      {page.name}
                    </Link>
                  )
                })}
              </nav>

              {isAdmin ? <div style={adminMenuWrap}>
                <button
                  type="button"
                  onClick={() => setIsAdminMenuOpen((value) => !value)}
                  style={adminMenuButton}
                >
                  <span style={adminMenuDots}>⋮⋮</span>
                  <span>Show More</span>
                </button>

                {isAdminMenuOpen ? (
                  <div style={adminMenuPanel}>
                    <button type="button" style={adminMenuItem} onClick={() => openAdminPanel('player')}>
                      Add Player
                    </button>
                    <button type="button" style={adminMenuItem} onClick={() => openAdminPanel('stats')}>
                      Add Roster/Stats
                    </button>
                    <button type="button" style={adminMenuItem} onClick={() => openAdminPanel('league')}>
                      Add League
                    </button>
                    <button type="button" style={adminMenuItem} onClick={() => openAdminPanel('team')}>
                      Add Team
                    </button>
                    <button type="button" style={adminMenuItem} onClick={() => openAdminPanel('standings')}>
                      Add/Update Standings
                    </button>
                  </div>
                ) : null}
              </div> : null}
            </div>
          </div>

          <div className="global-search-shell">
            <div className="global-search-wrap">
              <div className="global-search-row">
                <form className="global-search-form" onSubmit={submitGlobalSearch}>
                  <div className="global-search-input-wrap">
                    <span className="global-search-icon" aria-hidden="true">
                      ○
                    </span>
                    <input
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      onFocus={() => setIsSearchOpen(true)}
                      className="global-search-input"
                      placeholder="Search players, teams and leagues"
                    />
                  </div>
                  <button type="submit" className="global-search-button">
                    Search
                  </button>
                </form>

                <button
                  type="button"
                  className="global-search-link-button"
                  onClick={goToRandomPlayer}
                >
                  Random Player
                </button>
              </div>

              {isSearchOpen ? (
                <div className="global-search-panel">
                  {normalizedSearch ? (
                    <div className="global-search-results">
                      <div className="global-search-heading">Search Results</div>
                      {combinedMatches.length ? (
                        <>
                          {playerSearchResults.length ? (
                            <>
                              <div className="global-search-section-label">Players</div>
                              {playerSearchResults.map((result) => (
                                <Link
                                  key={result.id}
                                  href={result.href}
                                  className="global-search-result"
                                  onClick={() => setIsSearchOpen(false)}
                                >
                                  <div className="global-search-result-thumb">
                                    {result.imageUrl ? (
                                      <img
                                        src={result.imageUrl}
                                        alt={result.title}
                                        className="global-search-result-image"
                                      />
                                    ) : (
                                      <span className="global-search-result-fallback">
                                        {result.title.slice(0, 1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="global-search-result-copy">
                                    <span className="global-search-result-kind">{result.kind}</span>
                                    <span className="global-search-result-title">{result.title}</span>
                                    <span className="global-search-result-subtitle">{result.subtitle}</span>
                                  </div>
                                </Link>
                              ))}
                            </>
                          ) : null}
                          {teamSearchResults.length ? (
                            <>
                              <div className="global-search-section-label">Teams</div>
                              {teamSearchResults.map((result) => (
                                <Link
                                  key={result.id}
                                  href={result.href}
                                  className="global-search-result"
                                  onClick={() => setIsSearchOpen(false)}
                                >
                                  <div className="global-search-result-thumb">
                                    {result.imageUrl ? (
                                      <img
                                        src={result.imageUrl}
                                        alt={result.title}
                                        className="global-search-result-image"
                                      />
                                    ) : (
                                      <span className="global-search-result-fallback">
                                        {result.title.slice(0, 1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="global-search-result-copy">
                                    <span className="global-search-result-kind">{result.kind}</span>
                                    <span className="global-search-result-title">{result.title}</span>
                                    <span className="global-search-result-subtitle">{result.subtitle}</span>
                                  </div>
                                </Link>
                              ))}
                            </>
                          ) : null}
                          {leagueSearchResults.length ? (
                            <>
                              <div className="global-search-section-label">Leagues</div>
                              {leagueSearchResults.map((result) => (
                                <Link
                                  key={result.id}
                                  href={result.href}
                                  className="global-search-result"
                                  onClick={() => setIsSearchOpen(false)}
                                >
                                  <div className="global-search-result-thumb">
                                    {result.imageUrl ? (
                                      <img
                                        src={result.imageUrl}
                                        alt={result.title}
                                        className="global-search-result-image"
                                      />
                                    ) : (
                                      <span className="global-search-result-fallback">
                                        {result.title.slice(0, 1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="global-search-result-copy">
                                    <span className="global-search-result-kind">{result.kind}</span>
                                    <span className="global-search-result-title">{result.title}</span>
                                    <span className="global-search-result-subtitle">{result.subtitle}</span>
                                  </div>
                                </Link>
                              ))}
                            </>
                          ) : null}
                        </>
                      ) : (
                        <div className="global-search-empty">No matches found.</div>
                      )}
                    </div>
                  ) : (
                    <div className="global-search-default-grid">
                      <div>
                        <div className="global-search-heading">Top Player Searches</div>
                        <div className="global-search-card-row">
                          {searchPlayers.slice(0, 4).map((player) => (
                            <Link
                              key={player.id}
                              href={`/player/${player.id}`}
                              className="global-search-card"
                              onClick={() => setIsSearchOpen(false)}
                            >
                              {player.image_url ? (
                                <img
                                  src={player.image_url}
                                  alt={player.name}
                                  className="global-search-card-image"
                                />
                              ) : (
                                <div className="global-search-card-image global-search-card-image-fallback">
                                  {player.name.slice(0, 1)}
                                </div>
                              )}
                              <div className="global-search-card-overlay" />
                              <div className="global-search-card-copy">
                                <span className="global-search-card-title">
                                  {player.name} {player.position ? `(${player.position})` : ''}
                                </span>
                                <span className="global-search-card-subtitle">
                                  {player.nationality || 'Player'}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div className="global-search-leagues-column">
                        <div className="global-search-heading">Popular Leagues</div>
                        <div className="global-search-list global-search-list-single">
                          {popularLeagueOptions.slice(0, 10).map((league) => (
                            <Link
                              key={league.id}
                              href={league.href || `/league/${league.id}`}
                              className="global-search-list-item"
                              onClick={() => setIsSearchOpen(false)}
                            >
                              <div className="global-search-list-badge">
                                {normalizeImageUrl(league.logo_url) || normalizeImageUrl(league.image_url) ? (
                                  <img
                                    src={normalizeImageUrl(league.logo_url) || normalizeImageUrl(league.image_url) || ''}
                                    alt={league.name}
                                    className="global-search-list-logo"
                                  />
                                ) : league.country_code ? (
                                  <img
                                    src={getSearchFlagUrl(league.country_code) || ''}
                                    alt={league.country_code}
                                    className="global-search-list-flag"
                                  />
                                ) : (
                                  <span className="global-search-list-initial">
                                    {(league.abbreviation || league.name).slice(0, 1)}
                                  </span>
                                )}
                              </div>
                              <div className="global-search-list-copy">
                                <span className="global-search-list-title">
                                  {league.abbreviation || league.name}
                                </span>
                                <span className="global-search-list-subtitle">
                                  {league.name !== league.abbreviation && league.abbreviation
                                    ? league.name
                                    : 'League'}
                                </span>
                              </div>
                            </Link>
                          ))}
                          {!popularLeagueOptions.length ? (
                            <div className="global-search-empty">No leagues available.</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main style={main}>
          <div className="global-page-shell">
            <aside className="global-leaders-sidebar">
              <div className="global-leaders-card">
                <div className="global-leaders-title">Scoring Leaders</div>
                <div className="global-leaders-body">
                  <select
                    value={activeLeaderLeagueId}
                    onChange={(event) => setSelectedLeaderLeague(event.target.value)}
                    className="global-leaders-select"
                  >
                    {sidebarLeagueOptions.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.abbreviation || league.name}
                      </option>
                    ))}
                  </select>

                  <table className="global-leaders-table">
                    <thead>
                      <tr className="global-leaders-head">
                        <th>#</th>
                        <th>Player</th>
                        <th>GP</th>
                        <th>G</th>
                        <th>A</th>
                        <th>TP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderRows.map((leader, index) => {
                        const leaderFlagUrl = getNationalityFlagUrl(leader.nationality)

                        return (
                          <tr key={leader.id} className="global-leaders-row">
                            <td>{index + 1}</td>
                            <td>
                              <Link href={`/player/${leader.id}`} className="global-leaders-player">
                                {leaderFlagUrl ? (
                                  <img
                                    src={leaderFlagUrl}
                                    alt={leader.nationality || ''}
                                    className="global-leaders-flag"
                                  />
                                ) : null}
                                <span>{leader.name}</span>
                              </Link>
                            </td>
                            <td>{leader.gp}</td>
                            <td>{leader.goals}</td>
                            <td>{leader.assists}</td>
                            <td className="global-leaders-points">{leader.points}</td>
                          </tr>
                        )
                      })}
                      {!leaderRows.length ? (
                        <tr className="global-leaders-row">
                          <td colSpan={6} className="global-leaders-empty">
                            No leaders available.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>

                  <button type="button" className="global-leaders-more">
                    Show More
                  </button>
                </div>
              </div>
            </aside>

            <div className="global-page-content">{children}</div>
          </div>
        </main>

        {activeAdminPanel ? (
          <div style={modalOverlay} onClick={closeAdminPanel}>
            <div style={modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={modalHeader}>
                <div style={modalTitle}>
                  {activeAdminPanel === 'player'
                    ? 'Add Player'
                    : activeAdminPanel === 'stats'
                      ? 'Add Roster/Stats'
                      : activeAdminPanel === 'standings'
                        ? 'Add/Update Standings'
                      : activeAdminPanel === 'team'
                        ? 'Add Team'
                      : 'Add League'}
                </div>
                <button type="button" onClick={closeAdminPanel} style={closeButton}>
                  Close
                </button>
              </div>

              {adminIsLoading ? <div style={modalBody}>Loading options...</div> : null}

              {!adminIsLoading && activeAdminPanel === 'player' ? (
                <div style={modalBody}>
                  <div style={formGrid}>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Name</span>
                      <input
                        value={playerForm.name}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, name: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Display Name</span>
                      <input
                        value={playerForm.display_name}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, display_name: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Team</span>
                      <select
                        value={playerForm.team_id}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, team_id: event.target.value }))}
                        style={fieldInput}
                      >
                        <option value="">No team</option>
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Number</span>
                      <input
                        value={playerForm.number}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, number: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Position</span>
                      <input
                        value={playerForm.position}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, position: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Nationality</span>
                      <input
                        value={playerForm.nationality}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, nationality: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Player Type</span>
                      <input
                        value={playerForm.player_type}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, player_type: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={{ ...fieldWrap, gridColumn: '1 / -1' }}>
                      <span style={fieldLabel}>Image URL</span>
                      <input
                        value={playerForm.image_url}
                        onChange={(event) => setPlayerForm((current) => ({ ...current, image_url: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {!adminIsLoading && activeAdminPanel === 'stats' ? (
                <div style={modalBody}>
                  <div style={formGrid}>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Player</span>
                      <select
                        value={statsForm.player_id}
                        onChange={(event) => setStatsForm((current) => ({ ...current, player_id: event.target.value }))}
                        style={fieldInput}
                      >
                        <option value="">Select player</option>
                        {adminPlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Team</span>
                      <select
                        value={statsForm.team_id}
                        onChange={(event) => setStatsForm((current) => ({ ...current, team_id: event.target.value }))}
                        style={fieldInput}
                      >
                        <option value="">Select team</option>
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Season</span>
                      <select
                        value={statsForm.season_id}
                        onChange={(event) => setStatsForm((current) => ({ ...current, season_id: event.target.value }))}
                        style={fieldInput}
                      >
                        <option value="">Select season</option>
                        {adminSeasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Game Type</span>
                      <select
                        value={statsForm.game_type}
                        onChange={(event) =>
                          setStatsForm((current) => ({
                            ...current,
                            game_type: event.target.value as 'regular' | 'playoffs',
                          }))
                        }
                        style={fieldInput}
                      >
                        <option value="regular">Regular</option>
                        <option value="playoffs">Playoffs</option>
                      </select>
                    </label>
                    <label style={fieldWrap}><span style={fieldLabel}>GP</span><input value={statsForm.gp} onChange={(event) => setStatsForm((current) => ({ ...current, gp: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Goals</span><input value={statsForm.goals} onChange={(event) => setStatsForm((current) => ({ ...current, goals: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Assists</span><input value={statsForm.assists} onChange={(event) => setStatsForm((current) => ({ ...current, assists: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Points</span><input value={statsForm.points} onChange={(event) => setStatsForm((current) => ({ ...current, points: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Hits</span><input value={statsForm.hits} onChange={(event) => setStatsForm((current) => ({ ...current, hits: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>+/-</span><input value={statsForm.plus_minus} onChange={(event) => setStatsForm((current) => ({ ...current, plus_minus: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Shots</span><input value={statsForm.shots} onChange={(event) => setStatsForm((current) => ({ ...current, shots: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>TOI</span><input value={statsForm.toi} onChange={(event) => setStatsForm((current) => ({ ...current, toi: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Saves</span><input value={statsForm.gk_saves} onChange={(event) => setStatsForm((current) => ({ ...current, gk_saves: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Shots Against</span><input value={statsForm.gk_shots_against} onChange={(event) => setStatsForm((current) => ({ ...current, gk_shots_against: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>SV%</span><input value={statsForm.gk_percentage} onChange={(event) => setStatsForm((current) => ({ ...current, gk_percentage: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Goalie Wins</span><input value={statsForm.goalie_wins} onChange={(event) => setStatsForm((current) => ({ ...current, goalie_wins: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Goalie Losses</span><input value={statsForm.goalie_losses} onChange={(event) => setStatsForm((current) => ({ ...current, goalie_losses: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Goalie OTL</span><input value={statsForm.goalie_overtime_losses} onChange={(event) => setStatsForm((current) => ({ ...current, goalie_overtime_losses: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Shutouts</span><input value={statsForm.goalie_shutouts} onChange={(event) => setStatsForm((current) => ({ ...current, goalie_shutouts: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Goals Against</span><input value={statsForm.goalie_goals_against} onChange={(event) => setStatsForm((current) => ({ ...current, goalie_goals_against: event.target.value }))} style={fieldInput} /></label>
                  </div>
                </div>
              ) : null}

              {!adminIsLoading && activeAdminPanel === 'league' ? (
                <div style={modalBody}>
                  <div style={formGrid}>
                    <label style={fieldWrap}><span style={fieldLabel}>Name</span><input value={leagueForm.name} onChange={(event) => setLeagueForm((current) => ({ ...current, name: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Display Name</span><input value={leagueForm.display_name} onChange={(event) => setLeagueForm((current) => ({ ...current, display_name: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Abbreviation</span><input value={leagueForm.abbreviation} onChange={(event) => setLeagueForm((current) => ({ ...current, abbreviation: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Short Name</span><input value={leagueForm.short_name} onChange={(event) => setLeagueForm((current) => ({ ...current, short_name: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Logo URL</span><input value={leagueForm.logo_url} onChange={(event) => setLeagueForm((current) => ({ ...current, logo_url: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Category</span>
                      <select
                        value={leagueForm.category}
                        onChange={(event) =>
                          setLeagueForm((current) => ({
                            ...current,
                            category: event.target.value as 'league' | 'international',
                          }))
                        }
                        style={fieldInput}
                      >
                        <option value="league">League</option>
                        <option value="international">International</option>
                      </select>
                    </label>
                    <label style={fieldWrap}><span style={fieldLabel}>Region</span><input value={leagueForm.region} onChange={(event) => setLeagueForm((current) => ({ ...current, region: event.target.value }))} style={fieldInput} /></label>
                    <label style={fieldWrap}><span style={fieldLabel}>Country Code</span><input value={leagueForm.country_code} onChange={(event) => setLeagueForm((current) => ({ ...current, country_code: event.target.value }))} style={fieldInput} /></label>
                  </div>
                </div>
              ) : null}

              {!adminIsLoading && activeAdminPanel === 'standings' ? (
                <div style={modalBody}>
                  <div style={formGrid}>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>League</span>
                      <select
                        value={standingsForm.league_id}
                        onChange={(event) =>
                          setStandingsForm((current) => ({
                            ...current,
                            league_id: event.target.value,
                            rows: [emptyStandingRow()],
                          }))
                        }
                        style={fieldInput}
                      >
                        <option value="">Select league</option>
                        {adminLeagues.map((league) => (
                          <option key={league.id} value={league.id}>
                            {league.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Season</span>
                      <select
                        value={standingsForm.season_id}
                        onChange={(event) =>
                          setStandingsForm((current) => ({
                            ...current,
                            season_id: event.target.value,
                            rows: [emptyStandingRow()],
                          }))
                        }
                        style={fieldInput}
                      >
                        <option value="">Select season</option>
                        {adminSeasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={bulkSectionHeader}>
                    <div style={bulkSectionTitle}>Standing Rows</div>
                    <button type="button" onClick={addStandingsRow} style={miniActionButton}>
                      Add Team Row
                    </button>
                  </div>

                  <div style={standingsRowsWrap}>
                    {standingsForm.rows.map((row, index) => (
                      <div key={`${row.id || 'new-standing'}-${index}`} style={standingRowCard}>
                        <div style={standingRowHeader}>
                          <div style={standingRowTitle}>Team Row {index + 1}</div>
                          <button type="button" onClick={() => removeStandingsRow(index)} style={miniDangerButton}>
                            Remove
                          </button>
                        </div>

                        <div style={formGrid}>
                          <label style={fieldWrap}>
                            <span style={fieldLabel}>Team</span>
                            <select
                              value={row.team_id}
                              onChange={(event) => updateStandingsRow(index, 'team_id', event.target.value)}
                              style={fieldInput}
                            >
                              <option value="">Select team</option>
                              {adminTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={fieldWrap}><span style={fieldLabel}>Rank</span><input value={row.rank} onChange={(event) => updateStandingsRow(index, 'rank', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>GP</span><input value={row.gp} onChange={(event) => updateStandingsRow(index, 'gp', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Wins</span><input value={row.wins} onChange={(event) => updateStandingsRow(index, 'wins', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Losses</span><input value={row.losses} onChange={(event) => updateStandingsRow(index, 'losses', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>OTL</span><input value={row.overtime_losses} onChange={(event) => updateStandingsRow(index, 'overtime_losses', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Regulation Wins</span><input value={row.regulation_wins} onChange={(event) => updateStandingsRow(index, 'regulation_wins', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Points</span><input value={row.points} onChange={(event) => updateStandingsRow(index, 'points', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Goals For</span><input value={row.goals_for} onChange={(event) => updateStandingsRow(index, 'goals_for', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Goals Against</span><input value={row.goals_against} onChange={(event) => updateStandingsRow(index, 'goals_against', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Goal Difference</span><input value={row.goal_difference} onChange={(event) => updateStandingsRow(index, 'goal_difference', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>SOGF</span><input value={row.sogf} onChange={(event) => updateStandingsRow(index, 'sogf', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>SOGA</span><input value={row.soga} onChange={(event) => updateStandingsRow(index, 'soga', event.target.value)} style={fieldInput} /></label>
                          <label style={fieldWrap}><span style={fieldLabel}>Shot Percentage</span><input value={row.shot_percentage} onChange={(event) => updateStandingsRow(index, 'shot_percentage', event.target.value)} style={fieldInput} /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!adminIsLoading && activeAdminPanel === 'team' ? (
                <div style={modalBody}>
                  <div style={formGrid}>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Name</span>
                      <input
                        value={teamForm.name}
                        onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>League</span>
                      <select
                        value={teamForm.league}
                        onChange={(event) => setTeamForm((current) => ({ ...current, league: event.target.value }))}
                        style={fieldInput}
                      >
                        <option value="">No league</option>
                        {adminLeagues.map((league) => (
                          <option key={league.id} value={league.name}>
                            {league.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Country</span>
                      <input
                        value={teamForm.country}
                        onChange={(event) => setTeamForm((current) => ({ ...current, country: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Country Code</span>
                      <input
                        value={teamForm.country_code}
                        onChange={(event) => setTeamForm((current) => ({ ...current, country_code: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Town</span>
                      <input
                        value={teamForm.town}
                        onChange={(event) => setTeamForm((current) => ({ ...current, town: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Founded</span>
                      <input
                        value={teamForm.founded}
                        onChange={(event) => setTeamForm((current) => ({ ...current, founded: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Arena Name</span>
                      <input
                        value={teamForm.arena_name}
                        onChange={(event) => setTeamForm((current) => ({ ...current, arena_name: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Arena Location</span>
                      <input
                        value={teamForm.arena_location}
                        onChange={(event) => setTeamForm((current) => ({ ...current, arena_location: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={fieldWrap}>
                      <span style={fieldLabel}>Team Colors</span>
                      <input
                        value={teamForm.team_colors}
                        onChange={(event) => setTeamForm((current) => ({ ...current, team_colors: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                    <label style={{ ...fieldWrap, gridColumn: '1 / -1' }}>
                      <span style={fieldLabel}>Logo URL</span>
                      <input
                        value={teamForm.logo_url}
                        onChange={(event) => setTeamForm((current) => ({ ...current, logo_url: event.target.value }))}
                        style={fieldInput}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div style={modalFooter}>
                {adminSaveMessage ? <div style={saveMessage}>{adminSaveMessage}</div> : <div />}
                <button
                  type="button"
                  onClick={
                    activeAdminPanel === 'player'
                      ? savePlayerForm
                      : activeAdminPanel === 'stats'
                        ? saveStatsForm
                        : activeAdminPanel === 'standings'
                          ? saveStandingsForm
                        : activeAdminPanel === 'team'
                          ? saveTeamForm
                          : saveLeagueForm
                  }
                  style={primaryButton}
                  disabled={adminIsSaving}
                >
                  {adminIsSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </body>
    </html>
  )
}

const body: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
  backgroundColor: '#f1f4f8',
}

const header: React.CSSProperties = {
  position: 'relative',
  zIndex: 40,
}

const topBar: React.CSSProperties = {
  backgroundColor: '#10384d',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
}

const topBarInner: React.CSSProperties = {
  maxWidth: 1440,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 38,
  padding: '0 28px',
}

const topBarDisclaimer: React.CSSProperties = {
  color: 'rgba(223, 236, 245, 0.82)',
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.2,
  paddingRight: 16,
}

const topBarActions: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const topBarText: React.CSSProperties = {
  color: '#97c9e6',
  fontSize: 15,
  fontWeight: 700,
}

const topBarUserText: React.CSSProperties = {
  color: '#d7e6ef',
  fontSize: 13,
  fontWeight: 600,
}

const topBarAuthPills: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginLeft: 6,
  padding: 3,
  border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: 999,
}

const topBarPrimaryAuthLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 64,
  height: 28,
  padding: '0 14px',
  borderRadius: 999,
  background: '#28a84d',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 800,
}

const topBarSecondaryAuthLink: React.CSSProperties = {
  ...topBarPrimaryAuthLink,
  background: '#173a4c',
  border: '1px solid rgba(255,255,255,0.22)',
}

const topBarGhostButton: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.35)',
  background: 'transparent',
  color: '#fff',
  borderRadius: 999,
  height: 28,
  padding: '0 14px',
  fontSize: 13,
  fontWeight: 800,
}

const mainHeader: React.CSSProperties = {
  backgroundColor: '#123f58',
  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
}

const mainHeaderInner: React.CSSProperties = {
  maxWidth: 1440,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  padding: '0 28px',
  minHeight: 84,
}

const adminMenuWrap: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  marginLeft: 'auto',
}

const adminMenuButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  padding: '10px 0',
}

const adminMenuDots: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: 2,
}

const adminMenuPanel: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 214,
  background: '#0f3146',
  borderRadius: 4,
  boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
  overflow: 'hidden',
}

const adminMenuItem: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  color: '#e8f5ff',
  textAlign: 'left',
  padding: '18px 18px',
  fontSize: 15,
}

const logoContainer: React.CSSProperties = { display: 'flex', alignItems: 'center' }

const logoLink: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  textDecoration: 'none',
  lineHeight: 0.86,
}

const logoEkhl: React.CSSProperties = {
  color: '#ef6659',
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.05em',
}

const logoProspects: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: '-0.06em',
}

const nav: React.CSSProperties = {
  display: 'flex',
  gap: 34,
  alignItems: 'center',
}

const navLink: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 15,
  position: 'relative',
  padding: '10px 0',
}

const navActive: React.CSSProperties = {
  fontWeight: 800,
  borderBottom: '2px solid #ef6659',
}

const main: React.CSSProperties = { paddingTop: 18 }

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4, 18, 28, 0.58)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  zIndex: 200,
}

const modalCard: React.CSSProperties = {
  width: 'min(900px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 16px 34px rgba(0,0,0,0.24)',
}

const modalHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '18px 20px',
  borderBottom: '1px solid #d7e1ea',
}

const modalTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: '#102f47',
}

const closeButton: React.CSSProperties = {
  border: '1px solid #b8c6d3',
  borderRadius: 6,
  background: '#fff',
  color: '#173650',
  padding: '8px 12px',
  fontSize: 13,
}

const modalBody: React.CSSProperties = {
  padding: 20,
}

const bulkSectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 22,
  marginBottom: 14,
}

const bulkSectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#102f47',
}

const standingsRowsWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const standingRowCard: React.CSSProperties = {
  border: '1px solid #d5dfe8',
  borderRadius: 8,
  background: '#f8fbfe',
  padding: 16,
}

const standingRowHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}

const standingRowTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#173650',
}

const miniActionButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 6,
  background: '#31a64a',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
}

const miniDangerButton: React.CSSProperties = {
  border: '1px solid #d9a2aa',
  borderRadius: 6,
  background: '#fff',
  color: '#a73445',
  fontSize: 12,
  fontWeight: 800,
  padding: '8px 12px',
}

const formGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#445f74',
}

const fieldInput: React.CSSProperties = {
  height: 38,
  border: '1px solid #c4d0db',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 14,
  color: '#173650',
  background: '#fff',
}

const modalFooter: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '0 20px 20px 20px',
}

const saveMessage: React.CSSProperties = {
  color: '#0b7d38',
  fontSize: 13,
  fontWeight: 700,
}

const primaryButton: React.CSSProperties = {
  border: '1px solid #2d8a3f',
  borderRadius: 6,
  background: '#31a64a',
  color: '#fff',
  padding: '10px 18px',
  fontSize: 14,
}
