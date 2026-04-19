'use client'
/* eslint-disable @next/next/no-img-element */

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import LoadingExperience from '../../../../components/LoadingExperience'

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  abbreviation?: string | null
  short_name?: string | null
  country_code?: string | null
}

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
  league?: string | null
  town?: string | null
  arena_name?: string | null
}

type PlayerRecord = {
  id: string
  team_id?: string | null
}

function normalizeLeagueLookup(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getCountryCode(countryCode?: string | null) {
  if (countryCode && countryCode.trim()) {
    return countryCode.toUpperCase().slice(0, 2)
  }

  return '--'
}

function getFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

export default function LeagueTeamsPage() {
  const params = useParams()
  const identifier = decodeURIComponent(params.id as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!identifier) return

    async function fetchLeagueTeams() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase.from('leagues').select('*')
      const leagueRows = (leaguesData as LeagueRecord[]) || []
      const normalizedIdentifier = normalizeLeagueLookup(identifier)
      const leagueRecord =
        leagueRows.find((row) => String(row.id) === identifier) ||
        leagueRows.find((row) =>
          [row.name, row.abbreviation, row.short_name, row.display_name]
            .filter(Boolean)
            .some((value) => normalizeLeagueLookup(value) === normalizedIdentifier)
        ) ||
        null

      if (leaguesError || !leagueRecord) {
        setLeague(null)
        setTeams([])
        setPlayers([])
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
        { data: playersData, error: playersError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, logo_url, league, town, arena_name')
          .in('league', leagueNames.length ? leagueNames : [leagueRecord.name])
          .order('name', { ascending: true }),
        supabase.from('players').select('id, team_id'),
      ])

      setLeague(leagueRecord)
      setTeams((teamsData as TeamRecord[]) || [])
      setPlayers((playersData as PlayerRecord[]) || [])
      setErrorMessage(teamsError?.message || playersError?.message || '')
      setIsLoading(false)
    }

    fetchLeagueTeams()
  }, [identifier])

  if (isLoading) {
    return (
      <div style={pageWrap}>
        <LoadingExperience label="Loading teams, logos, and roster counts..." />
      </div>
    )
  }

  if (!league) {
    return <div style={pageWrap}>{errorMessage || 'League not found.'}</div>
  }

  const playerCountsByTeam = players.reduce<Record<string, number>>((acc, player) => {
    if (!player.team_id) return acc
    acc[String(player.team_id)] = (acc[String(player.team_id)] || 0) + 1
    return acc
  }, {})

  const leagueLabel = league.abbreviation || league.short_name || league.name

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={teamsTableCard}>
          <div style={tableTitleBar}>{leagueLabel.toUpperCase()} TEAMS</div>
          <div style={tableWrap}>
            <table style={teamsTable}>
              <thead>
                <tr style={tableHeadRow}>
                  <th style={nameTh}>NAME</th>
                  <th style={leagueTh}>LEAGUE</th>
                  <th style={playersTh}># PLAYERS</th>
                  <th style={townTh}>TOWN</th>
                  <th style={arenaTh}>ARENA</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr key={team.id} style={index % 2 === 0 ? tableRowAlt : tableRow}>
                    <td style={nameTd}>
                      <Link href={`/team/${team.id}`} style={entityLink}>
                        {team.logo_url ? <img src={team.logo_url} alt={team.name} style={rowLogo} /> : null}
                        <span>{team.name}</span>
                      </Link>
                    </td>
                    <td style={leagueTd}>
                      <Link href={`/league/${encodeURIComponent(league.id)}`} style={entityLink}>
                        {getFlagUrl(league.country_code) ? (
                          <Image
                            src={getFlagUrl(league.country_code) || ''}
                            alt={getCountryCode(league.country_code)}
                            width={14}
                            height={10}
                            unoptimized
                            style={flagImage}
                          />
                        ) : (
                          <span style={flagBox}>{getCountryCode(league.country_code)}</span>
                        )}
                        <span>{leagueLabel}</span>
                      </Link>
                    </td>
                    <td style={playersTd}>{playerCountsByTeam[team.id] || 0}</td>
                    <td style={townTd}>{team.town || '-'}</td>
                    <td style={arenaTd}>{team.arena_name || '-'}</td>
                  </tr>
                ))}
                {teams.length === 0 ? (
                  <tr style={tableRow}>
                    <td colSpan={5} style={emptyTableCell}>
                      No teams linked to this league yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div style={teamCountBar}>{teams.length} teams</div>
        </div>

        {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
      </div>
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

const teamsTableCard = {
  border: '1px solid #bdc9d5',
  borderRadius: 4,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const tableTitleBar = {
  background: '#123f58',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
  textTransform: 'uppercase' as const,
}

const tableWrap = {
  width: '100%',
  overflowX: 'auto' as const,
}

const teamsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 12,
}

const tableHeadRow = {
  background: '#c51e2d',
}

const sharedTh = {
  color: '#fff',
  padding: '8px 8px',
  textAlign: 'left' as const,
  fontWeight: 800,
  whiteSpace: 'nowrap' as const,
}

const nameTh = {
  ...sharedTh,
  width: '28%',
}

const leagueTh = {
  ...sharedTh,
  width: '24%',
}

const playersTh = {
  ...sharedTh,
  width: '10%',
  textAlign: 'right' as const,
}

const townTh = {
  ...sharedTh,
  width: '18%',
}

const arenaTh = {
  ...sharedTh,
  width: '20%',
}

const tableRow = {
  background: '#fff',
}

const tableRowAlt = {
  background: '#e8ebef',
}

const sharedTd = {
  padding: '8px 8px',
  color: '#1f3445',
}

const nameTd = {
  ...sharedTd,
}

const leagueTd = {
  ...sharedTd,
}

const playersTd = {
  ...sharedTd,
  textAlign: 'right' as const,
}

const townTd = {
  ...sharedTd,
}

const arenaTd = {
  ...sharedTd,
}

const entityLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#2c78b6',
  textDecoration: 'none',
}

const rowLogo = {
  width: 18,
  height: 18,
  objectFit: 'contain' as const,
}

const flagBox = {
  display: 'inline-flex',
  minWidth: 14,
  height: 10,
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #aab8c6',
  background: '#fff',
  fontSize: 7,
  fontWeight: 700,
  color: '#173650',
  lineHeight: 1,
}

const flagImage = {
  width: 14,
  height: 10,
  objectFit: 'cover' as const,
  border: '1px solid #aab8c6',
  display: 'block',
}

const emptyTableCell = {
  padding: '16px 10px',
  color: '#607487',
  textAlign: 'center' as const,
}

const teamCountBar = {
  padding: '10px 12px 12px 12px',
  textAlign: 'right' as const,
  color: '#102f47',
  fontSize: 12,
  fontWeight: 700,
}

const errorText = {
  marginTop: 12,
  color: '#b42318',
  fontSize: 12,
}
