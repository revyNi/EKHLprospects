'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

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
  position?: string | null
  nationality?: string | null
  number?: string | number | null
  image_url?: string | null
  player_type?: string | null
  team_id?: string | null
  teams?: TeamRecord | TeamRecord[] | null
}

type StatRecord = {
  id: string
  player_id?: string | null
  season_id?: string | null
  gp?: number | null
  goals?: number | null
  assists?: number | null
  points?: number | null
  shots?: number | null
  hits?: number | null
  plus_minus?: number | null
  toi?: number | null
  gk_percentage?: number | null
  goalie_wins?: number | null
  goalie_losses?: number | null
  goalie_overtime_losses?: number | null
  goalie_shutouts?: number | null
  goalie_goals_against?: number | null
  gk_saves?: number | null
  gk_shots_against?: number | null
  game_type?: string | null
  position?: string | null
}

type PlayerSummary = {
  seasons: number
  gp: number
  goals: number
  assists: number
  points: number
  shots: number
  hits: number
  plusMinus: number
  toi: number
  goalieWins: number
  goalieLosses: number
  goalieOvertimeLosses: number
  goalieShutouts: number
  goalieGoalsAgainst: number
  saves: number
  shotsAgainst: number
  savePct: string
  gaa: string
  pointsPerGame: string
  goalsPerGame: string
  assistsPerGame: string
  shotsPerGame: string
  hitsPerGame: string
  toiPerGame: string
  pointsPerSeason: string
  goalsPerSeason: string
  assistsPerSeason: string
  shotsPerSeason: string
  hitRate: string
  shootingPct: string
  savePctAgainst: string
  winPct: string
  shutoutsPerSeason: string
  pointsPer60: string
  shotsPerGoal: string
  goalShare: string
  regularGp: number
  regularGoals: number
  regularAssists: number
  regularPoints: number
  playoffGp: number
  playoffGoals: number
  playoffAssists: number
  playoffPoints: number
  careerHighPoints: number
  careerHighGoals: number
  careerHighAssists: number
  bestSeasonLabel: string
}

const emptySummary = (): PlayerSummary => ({
  seasons: 0,
  gp: 0,
  goals: 0,
  assists: 0,
  points: 0,
  shots: 0,
  hits: 0,
  plusMinus: 0,
  toi: 0,
  goalieWins: 0,
  goalieLosses: 0,
  goalieOvertimeLosses: 0,
  goalieShutouts: 0,
  goalieGoalsAgainst: 0,
  saves: 0,
  shotsAgainst: 0,
  savePct: '-',
  gaa: '-',
  pointsPerGame: '-',
  goalsPerGame: '-',
  assistsPerGame: '-',
  shotsPerGame: '-',
  hitsPerGame: '-',
  toiPerGame: '-',
  pointsPerSeason: '-',
  goalsPerSeason: '-',
  assistsPerSeason: '-',
  shotsPerSeason: '-',
  hitRate: '-',
  shootingPct: '-',
  savePctAgainst: '-',
  winPct: '-',
  shutoutsPerSeason: '-',
  pointsPer60: '-',
  shotsPerGoal: '-',
  goalShare: '-',
  regularGp: 0,
  regularGoals: 0,
  regularAssists: 0,
  regularPoints: 0,
  playoffGp: 0,
  playoffGoals: 0,
  playoffAssists: 0,
  playoffPoints: 0,
  careerHighPoints: 0,
  careerHighGoals: 0,
  careerHighAssists: 0,
  bestSeasonLabel: '-',
})

function getPrimaryTeam(teamValue?: TeamRecord | TeamRecord[] | null) {
  return Array.isArray(teamValue) ? teamValue[0] || null : teamValue || null
}

function formatSavePct(value?: number | null, saves?: number, goalsAgainst?: number) {
  if (value && value > 0) return Number(value).toFixed(3)
  const saveCount = Number(saves) || 0
  const against = Number(goalsAgainst) || 0
  const shotsAgainst = saveCount + against
  if (shotsAgainst <= 0) return '-'
  return (saveCount / shotsAgainst).toFixed(3)
}

function formatPerGame(total: number, gp: number) {
  if (!gp) return '-'
  return (total / gp).toFixed(2)
}

function formatPerSeason(total: number, seasons: number) {
  if (!seasons) return '-'
  return (total / seasons).toFixed(1)
}

function formatPct(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '-'
}

function formatGaa(goalsAgainst: number, gp: number, toi: number) {
  if (toi > 0) return ((goalsAgainst * 60) / toi).toFixed(2)
  if (gp > 0) return (goalsAgainst / gp).toFixed(2)
  return '-'
}

function isPlayoffStat(stat: StatRecord) {
  const gameType = String(stat.game_type || '').trim().toLowerCase()
  return gameType === 'playoffs' || gameType === 'playoff'
}

function sumStats(stats: StatRecord[]) {
  const summary = emptySummary()
  const seasonIds = new Set<string>()
  const seasonTotals: Record<string, { points: number; goals: number; assists: number }> = {}

  for (const stat of stats) {
    const gp = Number(stat.gp) || 0
    const goals = Number(stat.goals) || 0
    const assists = Number(stat.assists) || 0
    const points =
      stat.points !== null && stat.points !== undefined
        ? Number(stat.points) || 0
        : goals + assists

    if (stat.season_id) seasonIds.add(String(stat.season_id))
    summary.gp += gp
    summary.goals += goals
    summary.assists += assists
    summary.points += points
    summary.shots += Number(stat.shots) || 0
    summary.hits += Number(stat.hits) || 0
    summary.plusMinus += Number(stat.plus_minus) || 0
    summary.toi += Number(stat.toi) || 0
    summary.goalieWins += Number(stat.goalie_wins) || 0
    summary.goalieLosses += Number(stat.goalie_losses) || 0
    summary.goalieOvertimeLosses += Number(stat.goalie_overtime_losses) || 0
    summary.goalieShutouts += Number(stat.goalie_shutouts) || 0
    summary.saves += Number(stat.gk_saves) || 0
    summary.shotsAgainst += Number(stat.gk_shots_against) || 0

    const goalsAgainst =
      stat.goalie_goals_against !== null && stat.goalie_goals_against !== undefined
        ? Number(stat.goalie_goals_against) || 0
        : Math.max((Number(stat.gk_shots_against) || 0) - (Number(stat.gk_saves) || 0), 0)

    summary.goalieGoalsAgainst += goalsAgainst

    if (stat.gk_percentage && Number(stat.gk_percentage) > 0) {
      summary.savePct = Number(stat.gk_percentage).toFixed(3)
    }

    if (isPlayoffStat(stat)) {
      summary.playoffGp += gp
      summary.playoffGoals += goals
      summary.playoffAssists += assists
      summary.playoffPoints += points
    } else {
      summary.regularGp += gp
      summary.regularGoals += goals
      summary.regularAssists += assists
      summary.regularPoints += points
    }

    const seasonKey = String(stat.season_id || 'Unknown')
    if (!seasonTotals[seasonKey]) {
      seasonTotals[seasonKey] = { points: 0, goals: 0, assists: 0 }
    }
    seasonTotals[seasonKey].points += points
    seasonTotals[seasonKey].goals += goals
    seasonTotals[seasonKey].assists += assists
  }

  summary.seasons = seasonIds.size

  if (summary.savePct === '-') {
    summary.savePct = formatSavePct(null, summary.saves, summary.goalieGoalsAgainst)
  }

  summary.gaa = formatGaa(summary.goalieGoalsAgainst, summary.gp, summary.toi)
  summary.pointsPerGame = formatPerGame(summary.points, summary.gp)
  summary.goalsPerGame = formatPerGame(summary.goals, summary.gp)
  summary.assistsPerGame = formatPerGame(summary.assists, summary.gp)
  summary.shotsPerGame = formatPerGame(summary.shots, summary.gp)
  summary.hitsPerGame = formatPerGame(summary.hits, summary.gp)
  summary.toiPerGame = formatPerGame(summary.toi, summary.gp)
  summary.pointsPerSeason = formatPerSeason(summary.points, summary.seasons)
  summary.goalsPerSeason = formatPerSeason(summary.goals, summary.seasons)
  summary.assistsPerSeason = formatPerSeason(summary.assists, summary.seasons)
  summary.shotsPerSeason = formatPerSeason(summary.shots, summary.seasons)
  summary.hitRate = summary.shots > 0 ? formatPct((summary.hits / summary.shots) * 100) : '-'
  summary.shootingPct = summary.shots > 0 ? formatPct((summary.goals / summary.shots) * 100) : '-'
  summary.savePctAgainst = summary.shotsAgainst > 0 ? formatPct((summary.saves / summary.shotsAgainst) * 100) : '-'
  summary.winPct =
    summary.goalieWins + summary.goalieLosses + summary.goalieOvertimeLosses > 0
      ? formatPct(
          (summary.goalieWins /
            (summary.goalieWins + summary.goalieLosses + summary.goalieOvertimeLosses)) *
            100
        )
      : '-'
  summary.shutoutsPerSeason = formatPerSeason(summary.goalieShutouts, summary.seasons)
  summary.pointsPer60 = summary.toi > 0 ? ((summary.points * 60) / summary.toi).toFixed(2) : '-'
  summary.shotsPerGoal = summary.goals > 0 ? (summary.shots / summary.goals).toFixed(1) : '-'
  summary.goalShare = summary.points > 0 ? formatPct((summary.goals / summary.points) * 100) : '-'

  for (const [seasonKey, totals] of Object.entries(seasonTotals)) {
    if (totals.points >= summary.careerHighPoints) {
      summary.careerHighPoints = totals.points
      summary.bestSeasonLabel = seasonKey
    }
    summary.careerHighGoals = Math.max(summary.careerHighGoals, totals.goals)
    summary.careerHighAssists = Math.max(summary.careerHighAssists, totals.assists)
  }

  return summary
}

function formatToi(toi: number) {
  if (!toi) return '-'
  const totalMinutes = Math.floor(toi)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

export default function PlayerComparisonsPage() {
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [statsByPlayer, setStatsByPlayer] = useState<Record<string, StatRecord[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isComparing, setIsComparing] = useState(false)
  const [searchOne, setSearchOne] = useState('')
  const [searchTwo, setSearchTwo] = useState('')
  const [selectedOne, setSelectedOne] = useState<PlayerRecord | null>(null)
  const [selectedTwo, setSelectedTwo] = useState<PlayerRecord | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setIsLoading(true)

      const { data: playerData } = await supabase
        .from('players')
        .select('id, name, display_name, position, nationality, number, image_url, player_type, team_id, teams(id, name, logo_url, league)')
        .order('name', { ascending: true })
        .limit(1000)

      if (!isMounted) return

      const normalizedPlayers = (playerData as PlayerRecord[]) || []

      setPlayers(normalizedPlayers)
      setIsLoading(false)
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredOne = useMemo(() => {
    const query = searchOne.trim().toLowerCase()
    if (!query) return players.slice(0, 10)

    return players.filter((player) => {
      const team = getPrimaryTeam(player.teams)
      return [player.name, player.display_name, player.position, player.nationality, team?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    }).slice(0, 8)
  }, [players, searchOne])

  const filteredTwo = useMemo(() => {
    const query = searchTwo.trim().toLowerCase()
    if (!query) return players.slice(0, 10)

    return players.filter((player) => {
      const team = getPrimaryTeam(player.teams)
      return [player.name, player.display_name, player.position, player.nationality, team?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    }).slice(0, 8)
  }, [players, searchTwo])

  const summaryOne = selectedOne ? sumStats(statsByPlayer[selectedOne.id] || []) : emptySummary()
  const summaryTwo = selectedTwo ? sumStats(statsByPlayer[selectedTwo.id] || []) : emptySummary()

  function choosePlayer(slot: 1 | 2, player: PlayerRecord) {
    if (slot === 1) {
      setSelectedOne(player)
      setSearchOne(player.display_name || player.name)
    } else {
      setSelectedTwo(player)
      setSearchTwo(player.display_name || player.name)
    }
  }

  async function runCompare() {
    if (!selectedOne || !selectedTwo) return

    setIsComparing(true)

    const groupedStats: Record<string, StatRecord[]> = {}

    const [{ data: playerOneStats, error: playerOneError }, { data: playerTwoStats, error: playerTwoError }] = await Promise.all([
      supabase.from('stats').select('*').eq('player_id', selectedOne.id),
      supabase.from('stats').select('*').eq('player_id', selectedTwo.id),
    ])

    if (!playerOneError) {
      groupedStats[selectedOne.id] = (playerOneStats as StatRecord[]) || []
    }

    if (!playerTwoError) {
      groupedStats[selectedTwo.id] = (playerTwoStats as StatRecord[]) || []
    }

    setStatsByPlayer(groupedStats)
    setShowComparison(true)

    setIsComparing(false)
  }

  const playerOneTeam = getPrimaryTeam(selectedOne?.teams)
  const playerTwoTeam = getPrimaryTeam(selectedTwo?.teams)

  return (
    <div className="motion-page-root" style={pageWrap}>
      <div className="motion-hero-card motion-section-card" style={heroShell}>
        <div style={eyebrow}>Compare Players</div>
        <h1 style={title}>Player Comparisons</h1>
        <p style={copy}>
          Search for two players, lock them in, and compare their basic information and overall stats side by side.
        </p>
      </div>

      <div className="motion-section-card" style={compareShell}>
        <div style={searchGrid}>
          <div style={searchPanel}>
            <div style={panelTitle}>Player #1</div>
            <input
              value={searchOne}
              onChange={(event) => setSearchOne(event.target.value)}
              placeholder="Search player #1 to compare"
              style={searchInput}
            />
            <div style={resultsList}>
              {isLoading ? (
                <div style={emptyState}>Loading players...</div>
              ) : filteredOne.length ? (
                filteredOne.map((player) => {
                  const team = getPrimaryTeam(player.teams)
                  const isSelected = selectedOne?.id === player.id

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => choosePlayer(1, player)}
                      style={isSelected ? resultButtonActive : resultButton}
                    >
                      <div style={resultLeft}>
                        <div style={resultThumb}>
                          {player.image_url ? (
                            <img src={player.image_url} alt={player.name} style={resultThumbImage} />
                          ) : (
                            <span style={resultThumbFallback}>{(player.display_name || player.name).slice(0, 1)}</span>
                          )}
                        </div>
                        <div style={resultCopy}>
                          <div style={resultName}>{player.display_name || player.name}</div>
                          <div style={resultMeta}>
                            {[player.position, team?.name || player.nationality].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div style={emptyState}>No matching players.</div>
              )}
            </div>
          </div>

          <div style={dividerCol}>
            <div style={vsBadge}>VS</div>
          </div>

          <div style={searchPanel}>
            <div style={panelTitle}>Player #2</div>
            <input
              value={searchTwo}
              onChange={(event) => setSearchTwo(event.target.value)}
              placeholder="Search player #2 to compare"
              style={searchInput}
            />
            <div style={resultsList}>
              {isLoading ? (
                <div style={emptyState}>Loading players...</div>
              ) : filteredTwo.length ? (
                filteredTwo.map((player) => {
                  const team = getPrimaryTeam(player.teams)
                  const isSelected = selectedTwo?.id === player.id

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => choosePlayer(2, player)}
                      style={isSelected ? resultButtonActive : resultButton}
                    >
                      <div style={resultLeft}>
                        <div style={resultThumb}>
                          {player.image_url ? (
                            <img src={player.image_url} alt={player.name} style={resultThumbImage} />
                          ) : (
                            <span style={resultThumbFallback}>{(player.display_name || player.name).slice(0, 1)}</span>
                          )}
                        </div>
                        <div style={resultCopy}>
                          <div style={resultName}>{player.display_name || player.name}</div>
                          <div style={resultMeta}>
                            {[player.position, team?.name || player.nationality].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div style={emptyState}>No matching players.</div>
              )}
            </div>
          </div>
        </div>

        <div style={compareActionRow}>
          <button
            type="button"
            onClick={runCompare}
            disabled={!selectedOne || !selectedTwo}
            style={selectedOne && selectedTwo ? compareButton : compareButtonDisabled}
          >
            {isComparing ? 'Loading Comparison...' : 'Compare Players'}
          </button>
        </div>
      </div>

      {showComparison && selectedOne && selectedTwo ? (
        <div className="motion-section-card" style={comparisonCard}>
          <div style={comparisonHeader}>
            <div style={comparisonHero}>
              <div style={comparisonPlayerCard}>
                <div style={comparisonPlayerTopRight}>
                  <div style={comparisonImageWrap}>
                    {selectedOne.image_url ? (
                      <img src={selectedOne.image_url} alt={selectedOne.name} style={comparisonImage} />
                    ) : (
                      <div style={comparisonImageFallback}>{(selectedOne.display_name || selectedOne.name).slice(0, 1)}</div>
                    )}
                  </div>
                  <div>
                    <div style={comparisonName}>{selectedOne.display_name || selectedOne.name}</div>
                    <div style={comparisonMeta}>{playerOneTeam?.name || 'No club'}</div>
                  </div>
                </div>
              </div>

              <div style={comparisonMiddleBadge}>VS</div>

              <div style={comparisonPlayerCard}>
                <div style={comparisonPlayerTop}>
                  <div style={comparisonImageWrap}>
                    {selectedTwo.image_url ? (
                      <img src={selectedTwo.image_url} alt={selectedTwo.name} style={comparisonImage} />
                    ) : (
                      <div style={comparisonImageFallback}>{(selectedTwo.display_name || selectedTwo.name).slice(0, 1)}</div>
                    )}
                  </div>
                  <div>
                    <div style={comparisonName}>{selectedTwo.display_name || selectedTwo.name}</div>
                    <div style={comparisonMeta}>{playerTwoTeam?.name || 'No club'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={sectionBlock}>
            <div style={sectionTitle}>Basic Info</div>
            <table style={table}>
              <tbody>
                <CompareRow label="Name" left={selectedOne.display_name || selectedOne.name} right={selectedTwo.display_name || selectedTwo.name} />
                <CompareRow label="Position" left={formatValue(selectedOne.position)} right={formatValue(selectedTwo.position)} />
                <CompareRow label="Number" left={formatValue(selectedOne.number)} right={formatValue(selectedTwo.number)} />
                <CompareRow label="Nationality" left={formatValue(selectedOne.nationality)} right={formatValue(selectedTwo.nationality)} />
                <CompareRow label="Team" left={formatValue(playerOneTeam?.name)} right={formatValue(playerTwoTeam?.name)} />
                <CompareRow label="League" left={formatValue(playerOneTeam?.league)} right={formatValue(playerTwoTeam?.league)} />
                <CompareRow label="Role" left={formatValue(selectedOne.player_type)} right={formatValue(selectedTwo.player_type)} />
              </tbody>
            </table>
          </div>

          <div style={sectionBlock}>
            <div style={sectionTitle}>Overall Stats</div>
            <table style={table}>
              <tbody>
                <CompareRow label="Seasons" left={summaryOne.seasons} right={summaryTwo.seasons} />
                <CompareRow label="GP" left={summaryOne.gp} right={summaryTwo.gp} />
                <CompareRow label="G" left={summaryOne.goals} right={summaryTwo.goals} />
                <CompareRow label="A" left={summaryOne.assists} right={summaryTwo.assists} />
                <CompareRow label="PTS" left={summaryOne.points} right={summaryTwo.points} highlight />
                <CompareRow label="+/−" left={summaryOne.plusMinus} right={summaryTwo.plusMinus} />
                <CompareRow label="Shots" left={summaryOne.shots} right={summaryTwo.shots} />
                <CompareRow label="Hits" left={summaryOne.hits} right={summaryTwo.hits} />
                <CompareRow label="TOI" left={formatToi(summaryOne.toi)} right={formatToi(summaryTwo.toi)} />
                <CompareRow label="TOI / GP" left={summaryOne.toiPerGame} right={summaryTwo.toiPerGame} />
                <CompareRow label="PPG" left={summaryOne.pointsPerGame} right={summaryTwo.pointsPerGame} />
                <CompareRow label="GPG" left={summaryOne.goalsPerGame} right={summaryTwo.goalsPerGame} />
                <CompareRow label="APG" left={summaryOne.assistsPerGame} right={summaryTwo.assistsPerGame} />
                <CompareRow label="Shots / GP" left={summaryOne.shotsPerGame} right={summaryTwo.shotsPerGame} />
                <CompareRow label="Hits / GP" left={summaryOne.hitsPerGame} right={summaryTwo.hitsPerGame} />
                <CompareRow label="PTS / Season" left={summaryOne.pointsPerSeason} right={summaryTwo.pointsPerSeason} />
                <CompareRow label="G / Season" left={summaryOne.goalsPerSeason} right={summaryTwo.goalsPerSeason} />
                <CompareRow label="A / Season" left={summaryOne.assistsPerSeason} right={summaryTwo.assistsPerSeason} />
                <CompareRow label="Shots / Season" left={summaryOne.shotsPerSeason} right={summaryTwo.shotsPerSeason} />
                <CompareRow label="Shooting %" left={summaryOne.shootingPct} right={summaryTwo.shootingPct} />
                <CompareRow label="Hit Rate" left={summaryOne.hitRate} right={summaryTwo.hitRate} />
                <CompareRow label="PTS / 60" left={summaryOne.pointsPer60} right={summaryTwo.pointsPer60} />
                <CompareRow label="Shots / Goal" left={summaryOne.shotsPerGoal} right={summaryTwo.shotsPerGoal} />
                <CompareRow label="Goal Share" left={summaryOne.goalShare} right={summaryTwo.goalShare} />
                <CompareRow label="Career High PTS" left={summaryOne.careerHighPoints} right={summaryTwo.careerHighPoints} />
                <CompareRow label="Career High G" left={summaryOne.careerHighGoals} right={summaryTwo.careerHighGoals} />
                <CompareRow label="Career High A" left={summaryOne.careerHighAssists} right={summaryTwo.careerHighAssists} />
                <CompareRow label="Best Season" left={summaryOne.bestSeasonLabel} right={summaryTwo.bestSeasonLabel} />
              </tbody>
            </table>
          </div>

          <div style={sectionBlock}>
            <div style={sectionTitle}>Regular Vs Playoffs</div>
            <table style={table}>
              <tbody>
                <CompareRow label="Regular GP" left={summaryOne.regularGp} right={summaryTwo.regularGp} />
                <CompareRow label="Regular G" left={summaryOne.regularGoals} right={summaryTwo.regularGoals} />
                <CompareRow label="Regular A" left={summaryOne.regularAssists} right={summaryTwo.regularAssists} />
                <CompareRow label="Regular PTS" left={summaryOne.regularPoints} right={summaryTwo.regularPoints} highlight />
                <CompareRow label="Playoff GP" left={summaryOne.playoffGp} right={summaryTwo.playoffGp} />
                <CompareRow label="Playoff G" left={summaryOne.playoffGoals} right={summaryTwo.playoffGoals} />
                <CompareRow label="Playoff A" left={summaryOne.playoffAssists} right={summaryTwo.playoffAssists} />
                <CompareRow label="Playoff PTS" left={summaryOne.playoffPoints} right={summaryTwo.playoffPoints} highlight />
              </tbody>
            </table>
          </div>

          <div style={sectionBlock}>
            <div style={sectionTitle}>Goalie Comparison</div>
            <table style={table}>
              <tbody>
                <CompareRow label="Goalie Wins" left={summaryOne.goalieWins} right={summaryTwo.goalieWins} />
                <CompareRow label="Goalie Losses" left={summaryOne.goalieLosses} right={summaryTwo.goalieLosses} />
                <CompareRow label="Goalie OTL" left={summaryOne.goalieOvertimeLosses} right={summaryTwo.goalieOvertimeLosses} />
                <CompareRow label="Shutouts" left={summaryOne.goalieShutouts} right={summaryTwo.goalieShutouts} />
                <CompareRow label="Saves" left={summaryOne.saves} right={summaryTwo.saves} />
                <CompareRow label="Shots Against" left={summaryOne.shotsAgainst} right={summaryTwo.shotsAgainst} />
                <CompareRow label="Goals Against" left={summaryOne.goalieGoalsAgainst} right={summaryTwo.goalieGoalsAgainst} />
                <CompareRow label="SV%" left={summaryOne.savePct} right={summaryTwo.savePct} />
                <CompareRow label="Save Rate" left={summaryOne.savePctAgainst} right={summaryTwo.savePctAgainst} />
                <CompareRow label="GAA" left={summaryOne.gaa} right={summaryTwo.gaa} />
                <CompareRow label="Win %" left={summaryOne.winPct} right={summaryTwo.winPct} />
                <CompareRow label="SO / Season" left={summaryOne.shutoutsPerSeason} right={summaryTwo.shutoutsPerSeason} />
              </tbody>
            </table>
          </div>

          <div style={comparisonFooter}>
            <Link href={`/player/${selectedOne.id}`} style={footerLink}>
              Open {selectedOne.display_name || selectedOne.name}
            </Link>
            <Link href={`/player/${selectedTwo.id}`} style={footerLink}>
              Open {selectedTwo.display_name || selectedTwo.name}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CompareRow({
  label,
  left,
  right,
  highlight,
}: {
  label: string
  left: string | number
  right: string | number
  highlight?: boolean
}) {
  return (
    <tr>
      <td style={highlight ? compareValueHighlight : compareValueCell}>{left}</td>
      <td style={compareLabelCell}>{label}</td>
      <td style={highlight ? compareValueHighlightRight : compareValueCellRight}>{right}</td>
    </tr>
  )
}

const pageWrap: React.CSSProperties = {
  width: 'min(1320px, calc(100vw - 28px))',
  margin: '0 auto',
  padding: '24px 0 42px',
}

const heroShell: React.CSSProperties = {
  border: '1px solid rgba(30, 42, 53, 0.14)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(243,247,250,0.96))',
  padding: '30px 32px',
  boxShadow: '0 28px 60px rgba(8, 15, 22, 0.1)',
}

const compareShell: React.CSSProperties = {
  marginTop: 18,
  border: '1px solid rgba(30, 42, 53, 0.14)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, #13171c, #1b2128)',
  padding: '26px 26px 24px',
  boxShadow: '0 28px 60px rgba(8, 15, 22, 0.2)',
}

const eyebrow: React.CSSProperties = {
  color: '#1ea24d',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const title: React.CSSProperties = {
  margin: '10px 0 8px',
  color: '#102f47',
  fontSize: 36,
  lineHeight: 1,
}

const copy: React.CSSProperties = {
  margin: 0,
  maxWidth: 680,
  color: '#53697a',
  fontSize: 16,
  lineHeight: 1.6,
}

const searchGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 84px minmax(0, 1fr)',
  gap: 18,
  alignItems: 'stretch',
}

const searchPanel: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.03)',
  padding: 18,
  minHeight: 380,
}

const panelTitle: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 12,
}

const searchInput: React.CSSProperties = {
  width: '100%',
  height: 46,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  background: '#232a31',
  color: '#f5fbff',
  fontSize: 14,
  padding: '0 14px',
  boxSizing: 'border-box',
}

const resultsList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 14,
}

const resultButton: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  background: '#20262d',
  padding: 12,
  textAlign: 'left',
  color: '#f5fbff',
}

const resultButtonActive: React.CSSProperties = {
  ...resultButton,
  border: '1px solid rgba(46, 182, 85, 0.55)',
  background: 'rgba(30, 162, 77, 0.12)',
  boxShadow: '0 12px 26px rgba(30, 162, 77, 0.12)',
}

const resultLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
}

const resultThumb: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: '50%',
  overflow: 'hidden',
  background: '#31414d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const resultThumbImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const resultThumbFallback: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 18,
  fontWeight: 800,
}

const resultCopy: React.CSSProperties = {
  minWidth: 0,
}

const resultName: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.2,
}

const resultMeta: React.CSSProperties = {
  color: '#98aab8',
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4,
}

const emptyState: React.CSSProperties = {
  border: '1px dashed rgba(255,255,255,0.12)',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.03)',
  color: '#90a4b3',
  padding: '18px 16px',
  textAlign: 'center',
  fontSize: 14,
  fontWeight: 700,
}

const dividerCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const vsBadge: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: '50%',
  background: 'linear-gradient(180deg, #1ea24d, #16833d)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: '0.06em',
  boxShadow: '0 16px 28px rgba(30, 162, 77, 0.18)',
}

const compareActionRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 20,
}

const compareButton: React.CSSProperties = {
  height: 44,
  minWidth: 220,
  border: 0,
  borderRadius: 999,
  background: 'linear-gradient(180deg, #2bb253, #239b49)',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  boxShadow: '0 14px 28px rgba(35, 155, 73, 0.2)',
}

const compareButtonDisabled: React.CSSProperties = {
  ...compareButton,
  background: '#64717d',
  boxShadow: 'none',
}

const comparisonCard: React.CSSProperties = {
  marginTop: 18,
  border: '1px solid rgba(30, 42, 53, 0.14)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(243,247,250,0.96))',
  overflow: 'hidden',
  boxShadow: '0 28px 60px rgba(8, 15, 22, 0.1)',
}

const comparisonHeader: React.CSSProperties = {
  padding: 22,
  borderBottom: '1px solid rgba(18, 47, 71, 0.08)',
}

const comparisonHero: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 84px minmax(0, 1fr)',
  gap: 18,
  alignItems: 'center',
}

const comparisonPlayerCard: React.CSSProperties = {
  border: '1px solid rgba(18, 47, 71, 0.08)',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.84)',
  padding: 16,
}

const comparisonPlayerTop: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const comparisonPlayerTopRight: React.CSSProperties = {
  ...comparisonPlayerTop,
  flexDirection: 'row-reverse',
  textAlign: 'right',
}

const comparisonImageWrap: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, #405261 0%, #16354c 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const comparisonImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const comparisonImageFallback: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 24,
  fontWeight: 900,
}

const comparisonName: React.CSSProperties = {
  color: '#102f47',
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.1,
}

const comparisonMeta: React.CSSProperties = {
  color: '#607485',
  fontSize: 13,
  marginTop: 5,
}

const comparisonMiddleBadge: React.CSSProperties = {
  ...vsBadge,
  margin: '0 auto',
}

const sectionBlock: React.CSSProperties = {
  padding: '0 22px 22px',
}

const sectionTitle: React.CSSProperties = {
  color: '#14364e',
  fontSize: 18,
  fontWeight: 800,
  padding: '18px 0 12px',
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const compareValueCell: React.CSSProperties = {
  width: '38%',
  padding: '12px 14px',
  color: '#16384f',
  fontSize: 14,
  fontWeight: 800,
  background: '#f7fafc',
  borderTop: '1px solid #e4ebf1',
  textAlign: 'left',
}

const compareValueHighlight: React.CSSProperties = {
  ...compareValueCell,
  color: '#c21f28',
  background: '#fdf5f6',
}

const compareValueCellRight: React.CSSProperties = {
  ...compareValueCell,
  textAlign: 'right',
}

const compareValueHighlightRight: React.CSSProperties = {
  ...compareValueHighlight,
  textAlign: 'right',
}

const compareLabelCell: React.CSSProperties = {
  width: '24%',
  padding: '12px 14px',
  textAlign: 'center',
  color: '#5f7485',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  background: '#eef3f7',
  borderTop: '1px solid #e4ebf1',
}

const comparisonFooter: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  padding: '0 22px 22px',
}

const footerLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 999,
  textDecoration: 'none',
  background: '#0f3146',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 800,
}
