'use client'
/* eslint-disable @next/next/no-img-element */

import './globals.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

type AdminPanelType = 'player' | 'stats' | 'league' | null

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
  category: 'league' | 'international'
  region: string
  country_code: string
}

const pages = [
  { name: 'Players', href: '/' },
  { name: 'Teams', href: '/team' },
  { name: 'Leagues', href: '/league' },
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
  category: 'league',
  region: 'EU',
  country_code: '',
})

function toNullableNumber(value: string) {
  return value.trim() ? Number(value) : null
}

function getSearchFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [activeAdminPanel, setActiveAdminPanel] = useState<AdminPanelType>(null)
  const [adminPlayers, setAdminPlayers] = useState<AdminPlayerOption[]>([])
  const [adminTeams, setAdminTeams] = useState<AdminTeamOption[]>([])
  const [adminSeasons, setAdminSeasons] = useState<AdminSeasonOption[]>([])
  const [adminIsLoading, setAdminIsLoading] = useState(false)
  const [adminSaveMessage, setAdminSaveMessage] = useState('')
  const [adminIsSaving, setAdminIsSaving] = useState(false)
  const [playerForm, setPlayerForm] = useState<AdminPlayerForm>(emptyPlayerForm)
  const [statsForm, setStatsForm] = useState<AdminStatsForm>(emptyStatsForm)
  const [leagueForm, setLeagueForm] = useState<AdminLeagueForm>(emptyLeagueForm)
  const [searchValue, setSearchValue] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchPlayers, setSearchPlayers] = useState<SearchPlayerOption[]>([])
  const [searchTeams, setSearchTeams] = useState<SearchTeamOption[]>([])
  const [searchLeagues, setSearchLeagues] = useState<SearchLeagueOption[]>([])

  useEffect(() => {
    if (!activeAdminPanel) return

    async function fetchAdminOptions() {
      setAdminIsLoading(true)

      const [
        { data: playersData },
        { data: teamsData },
        { data: seasonsData },
      ] = await Promise.all([
        supabase.from('players').select('id, name').order('name', { ascending: true }),
        supabase.from('teams').select('id, name').order('name', { ascending: true }),
        supabase.from('seasons').select('id, name').order('name', { ascending: true }),
      ])

      setAdminPlayers((playersData as AdminPlayerOption[]) || [])
      setAdminTeams((teamsData as AdminTeamOption[]) || [])
      setAdminSeasons((seasonsData as AdminSeasonOption[]) || [])
      setAdminIsLoading(false)
    }

    fetchAdminOptions()
  }, [activeAdminPanel])

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
          .select('id, name, abbreviation, country_code')
          .order('name', { ascending: true })
          .limit(16),
      ])

      setSearchPlayers((playersData as SearchPlayerOption[]) || [])
      setSearchTeams((teamsData as SearchTeamOption[]) || [])
      setSearchLeagues((leaguesData as SearchLeagueOption[]) || [])
    }

    fetchSearchOptions()
  }, [])

  useEffect(() => {
    setIsSearchOpen(false)
  }, [pathname])

  function openAdminPanel(panel: Exclude<AdminPanelType, null>) {
    setAdminSaveMessage('')
    setIsAdminMenuOpen(false)
    if (panel === 'player') setPlayerForm(emptyPlayerForm())
    if (panel === 'stats') setStatsForm(emptyStatsForm())
    if (panel === 'league') setLeagueForm(emptyLeagueForm())
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
  const leagueMatches = normalizedSearch
    ? searchLeagues.filter((league) =>
        [league.name, league.abbreviation]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : []

  const combinedMatches = [
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

  return (
    <html lang="en">
      <body style={body}>
        <header style={header}>
          <div style={topBar}>
            <div style={topBarInner}>
              <span style={topBarText}>Help</span>
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

              <div style={adminMenuWrap}>
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
                  </div>
                ) : null}
              </div>
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
                        combinedMatches.map((result) => (
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
                        ))
                      ) : (
                        <div className="global-search-empty">No matches found.</div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="global-search-heading">Top Player Searches</div>
                      <div className="global-search-card-row">
                        {searchPlayers.slice(0, 6).map((player) => (
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

                      <div className="global-search-heading global-search-heading-spaced">
                        Popular Leagues
                      </div>
                      <div className="global-search-list">
                        {searchLeagues.slice(0, 6).map((league) => (
                          <Link
                            key={league.id}
                            href={`/league/${league.id}`}
                            className="global-search-list-item"
                            onClick={() => setIsSearchOpen(false)}
                          >
                            <div className="global-search-list-badge">
                              {league.country_code ? (
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
                              <span className="global-search-list-subtitle">League</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main style={main}>{children}</main>

        {activeAdminPanel ? (
          <div style={modalOverlay} onClick={closeAdminPanel}>
            <div style={modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={modalHeader}>
                <div style={modalTitle}>
                  {activeAdminPanel === 'player'
                    ? 'Add Player'
                    : activeAdminPanel === 'stats'
                      ? 'Add Roster/Stats'
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

              <div style={modalFooter}>
                {adminSaveMessage ? <div style={saveMessage}>{adminSaveMessage}</div> : <div />}
                <button
                  type="button"
                  onClick={
                    activeAdminPanel === 'player'
                      ? savePlayerForm
                      : activeAdminPanel === 'stats'
                        ? saveStatsForm
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
  position: 'sticky',
  top: 0,
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
  justifyContent: 'flex-end',
  height: 38,
  padding: '0 28px',
}

const topBarText: React.CSSProperties = {
  color: '#97c9e6',
  fontSize: 15,
  fontWeight: 700,
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
