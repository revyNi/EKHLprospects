'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  country_code?: string | null
}

type AwardRecord = {
  id: string
  player_id?: string | null
  league_id?: string | null
  season?: string | null
  league?: string | null
  award?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  position?: string | null
  nationality?: string | null
}

type AwardWinnerRow = {
  id: string
  playerId: string
  playerName: string
  position?: string | null
  nationality?: string | null
  wins: number
}

type AwardSeasonRow = {
  id: string
  season: string
  playerId: string
  playerName: string
  position: string | null | undefined
  nationality: string | null | undefined
}

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

export default function AwardDetailPage() {
  const params = useParams()
  const leagueIdentifier = decodeURIComponent(params.id as string)
  const awardIdentifier = decodeURIComponent(params.award as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [awardRows, setAwardRows] = useState<AwardRecord[]>([])
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!leagueIdentifier || !awardIdentifier) return

    async function fetchAwardPage() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, display_name, country_code')

      if (leaguesError) {
        setLeague(null)
        setAwardRows([])
        setPlayers([])
        setErrorMessage(leaguesError.message)
        setIsLoading(false)
        return
      }

      const allLeagues = (leaguesData as LeagueRecord[]) || []
      const normalizedLeagueIdentifier = normalizeLookupValue(leagueIdentifier)
      const normalizedAwardIdentifier = normalizeLookupValue(awardIdentifier)
      const leagueRecord =
        allLeagues.find((entry) => String(entry.id) === leagueIdentifier) ||
        allLeagues.find((entry) =>
          [entry.name, entry.display_name]
            .filter(Boolean)
            .some((value) => normalizeLookupValue(value) === normalizedLeagueIdentifier)
        ) ||
        null

      let fetchedAwards: AwardRecord[] = []
      let awardsErrorMessage = ''

      if (leagueRecord) {
        const { data, error } = await supabase
          .from('awards')
          .select('id, player_id, league_id, season, league, award')
          .eq('league_id', leagueRecord.id)
          .eq('award', awardIdentifier)

        fetchedAwards = (data as AwardRecord[]) || []
        awardsErrorMessage = error?.message || ''
      } else {
        const { data, error } = await supabase
          .from('awards')
          .select('id, player_id, league_id, season, league, award')
          .ilike('league', leagueIdentifier)
          .eq('award', awardIdentifier)

        fetchedAwards = (data as AwardRecord[]) || []
        awardsErrorMessage = error?.message || ''
      }

      if (!fetchedAwards.length) {
        const fallbackLeagueName = leagueRecord?.name || leagueIdentifier
        setLeague(
          leagueRecord ||
            (fallbackLeagueName
              ? {
                  id: leagueIdentifier,
                  name: fallbackLeagueName,
                }
              : null)
        )
        setAwardRows([])
        setPlayers([])
        setErrorMessage(awardsErrorMessage || 'No players found for this award.')
        setIsLoading(false)
        return
      }

      const playerIds = Array.from(
        new Set(fetchedAwards.map((row) => row.player_id).filter(Boolean))
      ) as string[]

      const { data: playersData, error: playersError } = playerIds.length
        ? await supabase
            .from('players')
            .select('id, name, position, nationality')
            .in('id', playerIds)
        : { data: [], error: null }

      const fallbackLeagueName =
        leagueRecord?.name || fetchedAwards.find((row) => row.league?.trim())?.league?.trim() || leagueIdentifier

      setLeague(
        leagueRecord ||
          (fallbackLeagueName
            ? {
                id: leagueIdentifier,
                name: fallbackLeagueName,
              }
            : null)
      )
      setAwardRows(
        fetchedAwards.filter((row) => normalizeLookupValue(row.award) === normalizedAwardIdentifier)
      )
      setPlayers((playersData as PlayerRecord[]) || [])
      setErrorMessage(awardsErrorMessage || playersError?.message || '')
      setIsLoading(false)
    }

    fetchAwardPage()
  }, [leagueIdentifier, awardIdentifier])

  const playerMap = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  )

  const winsLeaders = useMemo(() => {
    const grouped = awardRows.reduce<Record<string, AwardWinnerRow>>((acc, row) => {
      if (!row.player_id) return acc

      const player = playerMap.get(String(row.player_id))
      if (!player) return acc

      if (!acc[player.id]) {
        acc[player.id] = {
          id: player.id,
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          nationality: player.nationality,
          wins: 0,
        }
      }

      acc[player.id].wins += 1
      return acc
    }, {})

    return Object.values(grouped).sort(
      (a, b) => b.wins - a.wins || a.playerName.localeCompare(b.playerName)
    )
  }, [awardRows, playerMap])

  const allWinners = useMemo(() => {
    const rows: AwardSeasonRow[] = []

    awardRows.forEach((row) => {
      if (!row.player_id) return
      const player = playerMap.get(String(row.player_id))
      if (!player) return

      rows.push({
        id: row.id,
        season: row.season || '-',
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        nationality: player.nationality,
      })
    })

    return rows.sort((a, b) => b.season.localeCompare(a.season) || a.playerName.localeCompare(b.playerName))
  }, [awardRows, playerMap])

  const leagueFlagUrl = getFlagUrl(league?.country_code)

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={pageTitle}>Awards - {awardIdentifier}</div>
        <div style={leagueMetaRow}>
          {leagueFlagUrl ? <img src={leagueFlagUrl} alt={league?.name || ''} style={leagueFlag} /> : null}
          <span style={leagueMetaText}>{league?.name || leagueIdentifier}</span>
        </div>

        {errorMessage && !isLoading ? <div style={errorCard}>{errorMessage}</div> : null}

        <AwardTableCard
          title="MOST AWARD WINS (PLAYERS)"
          isLoading={isLoading}
          emptyText="No award winners found."
          columns={
            <>
              <th style={rankTh}>#</th>
              <th style={winsTh}>WINS</th>
              <th style={playerTh}>AWARD WINNER</th>
            </>
          }
          rows={winsLeaders.map((row, index) => {
            const flagUrl = getFlagUrl(row.nationality)
            return (
              <tr key={row.id} style={index % 2 === 0 ? tableRow : tableRowAlt}>
                <td style={rankTd}>{index + 1}</td>
                <td style={statTd}>{row.wins}</td>
                <td style={playerTd}>
                  <div style={playerCell}>
                    {flagUrl ? <img src={flagUrl} alt={row.nationality || ''} style={playerFlag} /> : null}
                    <Link href={`/player/${row.playerId}`} style={playerLink}>
                      {row.playerName} ({formatPosition(row.position)})
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        />

        <AwardTableCard
          title="ALL WINNERS (PLAYERS)"
          isLoading={isLoading}
          emptyText="No award winners found."
          columns={
            <>
              <th style={seasonTh}>S</th>
              <th style={playerTh}>AWARD WINNER</th>
            </>
          }
          rows={allWinners.map((row, index) => {
            const flagUrl = getFlagUrl(row.nationality)
            return (
              <tr key={row.id} style={index % 2 === 0 ? tableRow : tableRowAlt}>
                <td style={seasonTd}>{row.season}</td>
                <td style={playerTd}>
                  <div style={playerCell}>
                    {flagUrl ? <img src={flagUrl} alt={row.nationality || ''} style={playerFlag} /> : null}
                    <Link href={`/player/${row.playerId}`} style={playerLink}>
                      {row.playerName} ({formatPosition(row.position)})
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        />

        <div style={backRow}>
          <Link href={`/awards/${encodeURIComponent(league?.id || leagueIdentifier)}`} style={backLink}>
            Back to {league?.name || leagueIdentifier} Awards
          </Link>
        </div>
      </div>
    </div>
  )
}

function AwardTableCard({
  title,
  isLoading,
  emptyText,
  columns,
  rows,
}: {
  title: string
  isLoading: boolean
  emptyText: string
  columns: React.ReactNode
  rows: React.ReactNode[]
}) {
  return (
    <div style={tableCard}>
      <div style={tableTitle}>{title}</div>
      <table style={table}>
        <thead>
          <tr style={tableHead}>{columns}</tr>
        </thead>
        <tbody>
          {rows}
          {!rows.length ? (
            <tr style={tableRow}>
              <td colSpan={3} style={emptyTd}>
                {isLoading ? 'Loading...' : emptyText}
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

const pageTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: '#102f47',
  marginBottom: 8,
}

const leagueMetaRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 14,
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

const errorCard = {
  marginBottom: 12,
  padding: '12px 14px',
  border: '1px solid #d9c5c7',
  borderRadius: 4,
  background: '#fff5f5',
  color: '#c1272d',
  fontSize: 12,
}

const tableCard = {
  marginBottom: 14,
  border: '1px solid #bdc9d5',
  borderRadius: 4,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const tableTitle = {
  background: '#124a6a',
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  padding: '6px 10px',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 11,
}

const tableHead = {
  background: '#d92a2d',
}

const rankTh = {
  color: '#fff',
  textAlign: 'left' as const,
  width: 34,
  padding: '5px 7px',
  fontWeight: 700,
}

const winsTh = {
  ...rankTh,
  width: 54,
}

const seasonTh = {
  ...rankTh,
  width: 88,
}

const playerTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '5px 8px',
  fontWeight: 700,
}

const tableRow = {
  background: '#fff',
}

const tableRowAlt = {
  background: '#eef1f5',
}

const rankTd = {
  padding: '6px 7px',
  color: '#1d3447',
}

const statTd = {
  ...rankTd,
  fontWeight: 700,
}

const seasonTd = {
  ...rankTd,
  whiteSpace: 'nowrap' as const,
}

const playerTd = {
  padding: '6px 8px',
}

const playerCell = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const playerFlag = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #bcc6cf',
}

const playerLink = {
  color: '#2a73ad',
  textDecoration: 'none',
  fontWeight: 600,
}

const emptyTd = {
  padding: '12px 10px',
  textAlign: 'center' as const,
  color: '#748497',
}

const backRow = {
  paddingBottom: 12,
}

const backLink = {
  color: '#2a73ad',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
}
