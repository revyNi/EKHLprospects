'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type TeamRecord = {
  id: string
  name: string
  league?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  nationality?: string | null
  position?: string | null
}

type TransferRecord = {
  id: string
  type?: string | null
  date?: string | null
  player_id?: string | null
  from_team_id?: string | null
  to_team_id?: string | null
  source?: string | null
  source_url?: string | null
}

type TransferFormState = {
  date: string
  type: 'transfer' | 'rumour'
  player_id: string
  from_team_id: string
  to_team_id: string
  source: string
  source_url: string
}

function getFlagUrl(countryCode?: string | null) {
  if (!countryCode || !countryCode.trim()) return null
  return `https://flagcdn.com/w20/${countryCode.toLowerCase().slice(0, 2)}.png`
}

function formatTransferType(type?: string | null) {
  const value = (type || 'transfer').trim().toLowerCase()
  return value === 'rumour' ? 'rumour' : 'transfer'
}

function formatDateLabel(value?: string | null) {
  if (!value) return '-'
  return value
}

export default function HomePage() {
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [activeTab, setActiveTab] = useState<'transfer' | 'rumour'>('transfer')
  const [dateFilter, setDateFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [nationFilter, setNationFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    date: '',
    type: 'transfer',
    player_id: '',
    from_team_id: '',
    to_team_id: '',
    source: '',
    source_url: '',
  })

  useEffect(() => {
    async function fetchTransfersPage() {
      setIsLoading(true)
      setErrorMessage('')

      const [
        { data: playersData, error: playersError },
        { data: teamsData, error: teamsError },
        { data: transfersData, error: transfersError },
      ] = await Promise.all([
        supabase.from('players').select('id, name, nationality, position'),
        supabase.from('teams').select('id, name, league'),
        supabase.from('transfers').select('*').order('date', { ascending: false }),
      ])

      if (playersError || teamsError || transfersError) {
        setErrorMessage(playersError?.message || teamsError?.message || transfersError?.message || '')
        setPlayers([])
        setTeams([])
        setTransfers([])
        setIsLoading(false)
        return
      }

      setPlayers((playersData as PlayerRecord[]) || [])
      setTeams((teamsData as TeamRecord[]) || [])
      setTransfers((transfersData as TransferRecord[]) || [])
      setIsLoading(false)
    }

    fetchTransfersPage()
  }, [])

  const playersById = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  )
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [String(team.id), team])),
    [teams]
  )

  const dateOptions = useMemo(
    () =>
      Array.from(new Set(transfers.map((transfer) => transfer.date).filter(Boolean) as string[])).sort(
        (a, b) => b.localeCompare(a)
      ),
    [transfers]
  )

  const leagueOptions = useMemo(
    () =>
      Array.from(
        new Set(
          transfers
            .flatMap((transfer) => [
              teamsById.get(String(transfer.from_team_id || ''))?.league,
              teamsById.get(String(transfer.to_team_id || ''))?.league,
            ])
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [teamsById, transfers]
  )

  const nationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          transfers
            .map((transfer) => playersById.get(String(transfer.player_id || ''))?.nationality)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [playersById, transfers]
  )

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const normalizedType = formatTransferType(transfer.type)
      if (normalizedType !== activeTab) return false

      const player = playersById.get(String(transfer.player_id || ''))
      const fromTeam = teamsById.get(String(transfer.from_team_id || ''))
      const toTeam = teamsById.get(String(transfer.to_team_id || ''))
      const transferLeagues = [fromTeam?.league, toTeam?.league].filter(Boolean) as string[]

      if (dateFilter && transfer.date !== dateFilter) return false
      if (leagueFilter && !transferLeagues.some((league) => league === leagueFilter)) return false
      if (nationFilter && player?.nationality !== nationFilter) return false
      if (
        teamFilter &&
        ![fromTeam?.name, toTeam?.name]
          .filter(Boolean)
          .some((teamName) => String(teamName).toLowerCase().includes(teamFilter.toLowerCase()))
      ) {
        return false
      }

      return true
    })
  }, [activeTab, dateFilter, leagueFilter, nationFilter, playersById, teamFilter, teamsById, transfers])

  function resetFilters() {
    setDateFilter('')
    setLeagueFilter('')
    setNationFilter('')
    setTeamFilter('')
  }

  function openSubmitModal() {
    setSubmitMessage('')
    setTransferForm({
      date: '',
      type: activeTab,
      player_id: '',
      from_team_id: '',
      to_team_id: '',
      source: '',
      source_url: '',
    })
    setIsSubmitOpen(true)
  }

  function closeSubmitModal() {
    setIsSubmitOpen(false)
    setSubmitMessage('')
    setIsSubmitting(false)
  }

  async function submitTransfer() {
    setIsSubmitting(true)
    setSubmitMessage('')

    const payload = {
      date: transferForm.date.trim() || null,
      type: transferForm.type,
      player_id: transferForm.player_id || null,
      from_team_id: transferForm.from_team_id || null,
      to_team_id: transferForm.to_team_id || null,
      source: transferForm.source.trim() || null,
      source_url: transferForm.source_url.trim() || null,
    }

    const { data, error } = await supabase.from('transfers').insert(payload).select('*').single()

    if (error) {
      setSubmitMessage(error.message)
      setIsSubmitting(false)
      return
    }

    if (data) {
      setTransfers((current) => [data as TransferRecord, ...current])
    }

    setSubmitMessage('Transfer saved.')
    setIsSubmitting(false)
    setIsSubmitOpen(false)
  }

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={heroBlock}>
          <div style={heroAccent} />
          <div>
            <h1 style={pageTitle}>TRANSFERS</h1>
            <div style={pageSubtitle}>All the latest roster updates</div>
          </div>
        </div>

        <div style={filtersRow}>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} style={filterSelect}>
            <option value="">Date/Time</option>
            {dateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)} style={filterSelect}>
            <option value="">League</option>
            {leagueOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select value={nationFilter} onChange={(event) => setNationFilter(event.target.value)} style={filterSelect}>
            <option value="">Nation</option>
            {nationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            placeholder="Filter by team"
            style={teamFilterInput}
          />

          <button type="button" onClick={resetFilters} style={resetButton}>
            RESET FILTER
          </button>
        </div>

        <div style={tabsBar}>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            style={activeTab === 'transfer' ? activeTabButton : inactiveTabButton}
          >
            CONFIRMED TRANSFERS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rumour')}
            style={activeTab === 'rumour' ? activeTabButton : inactiveTabButton}
          >
            RUMOURS
          </button>
          <div style={tabsSpacer} />
          <button type="button" style={submitButton} onClick={openSubmitModal}>
            SUBMIT TRANSFER/RUMOUR
          </button>
        </div>

        <div style={tableCard}>
          <table style={table}>
            <thead>
              <tr style={tableHeadRow}>
                <th style={dateTh}>DATE</th>
                <th style={playerTh}>PLAYER</th>
                <th style={teamTh}>FROM</th>
                <th style={teamTh}>TO</th>
                <th style={sourceTh}>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((transfer, index) => {
                const player = playersById.get(String(transfer.player_id || ''))
                const fromTeam = teamsById.get(String(transfer.from_team_id || ''))
                const toTeam = teamsById.get(String(transfer.to_team_id || ''))
                const flagUrl = getFlagUrl(player?.nationality)

                return (
                  <tr key={transfer.id} style={index % 2 === 0 ? tableRowAlt : tableRow}>
                    <td style={dateTd}>{formatDateLabel(transfer.date)}</td>
                    <td style={playerTd}>
                      {player ? (
                        <Link href={`/player/${player.id}`} style={entityLink}>
                          {flagUrl ? (
                            <img src={flagUrl} alt={player.nationality || ''} style={flagImage} />
                          ) : null}
                          <span>
                            {player.name} {player.position ? `(${player.position})` : ''}
                          </span>
                        </Link>
                      ) : (
                        <span>Unknown</span>
                      )}
                    </td>
                    <td style={teamTdCell}>{fromTeam ? fromTeam.name : 'Unknown'}</td>
                    <td style={teamTdCell}>{toTeam ? toTeam.name : 'Unknown'}</td>
                    <td style={sourceTd}>
                      {transfer.source_url ? (
                        <a href={transfer.source_url} target="_blank" rel="noreferrer" style={sourceLink}>
                          {transfer.source || 'Open'}
                        </a>
                      ) : (
                        <span style={sourcePlaceholder}>{transfer.source || '-'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!isLoading && filteredTransfers.length === 0 ? (
                <tr style={tableRow}>
                  <td colSpan={5} style={emptyCell}>
                    No transfers found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {isLoading ? <div style={footerInfo}>Loading transfers...</div> : null}
          {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
          {!isLoading ? (
            <div style={footerBar}>
              <button type="button" style={showMoreButton}>
                SHOW ALL {activeTab === 'transfer' ? 'CONFIRMED TRANSFERS' : 'RUMOURS'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isSubmitOpen ? (
        <div style={modalOverlay} onClick={closeSubmitModal}>
          <div style={modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>Submit Transfer/Rumour</div>
              <button type="button" onClick={closeSubmitModal} style={closeButton}>
                Close
              </button>
            </div>

            <div style={modalBody}>
              <div style={formGrid}>
                <label style={fieldWrap}>
                  <span style={fieldLabel}>Date</span>
                  <input
                    value={transferForm.date}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, date: event.target.value }))
                    }
                    placeholder="2026-04-10"
                    style={fieldInput}
                  />
                </label>

                <label style={fieldWrap}>
                  <span style={fieldLabel}>Type</span>
                  <select
                    value={transferForm.type}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        type: event.target.value as 'transfer' | 'rumour',
                      }))
                    }
                    style={fieldInput}
                  >
                    <option value="transfer">Transfer</option>
                    <option value="rumour">Rumour</option>
                  </select>
                </label>

                <label style={fieldWrap}>
                  <span style={fieldLabel}>Player</span>
                  <select
                    value={transferForm.player_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, player_id: event.target.value }))
                    }
                    style={fieldInput}
                  >
                    <option value="">Select player</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldWrap}>
                  <span style={fieldLabel}>From Team</span>
                  <select
                    value={transferForm.from_team_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, from_team_id: event.target.value }))
                    }
                    style={fieldInput}
                  >
                    <option value="">Unknown</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldWrap}>
                  <span style={fieldLabel}>To Team</span>
                  <select
                    value={transferForm.to_team_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, to_team_id: event.target.value }))
                    }
                    style={fieldInput}
                  >
                    <option value="">Unknown</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldWrap}>
                  <span style={fieldLabel}>Source</span>
                  <input
                    value={transferForm.source}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, source: event.target.value }))
                    }
                    style={fieldInput}
                  />
                </label>

                <label style={{ ...fieldWrap, gridColumn: '1 / -1' }}>
                  <span style={fieldLabel}>Source URL</span>
                  <input
                    value={transferForm.source_url}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, source_url: event.target.value }))
                    }
                    style={fieldInput}
                  />
                </label>
              </div>
            </div>

            <div style={modalFooter}>
              {submitMessage ? <div style={submitMessageStyle}>{submitMessage}</div> : <div />}
              <button type="button" onClick={submitTransfer} style={primaryButton} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const pageWrap = {
  minHeight: '100vh',
  background: '#eef2f6',
  padding: '26px 16px 40px 16px',
  fontFamily: 'var(--font-inter), sans-serif',
}

const shell = {
  maxWidth: 1120,
  margin: '0 auto',
}

const heroBlock = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 18,
}

const heroAccent = {
  width: 3,
  height: 42,
  background: '#cf2a2d',
  marginTop: 2,
}

const pageTitle = {
  margin: 0,
  fontSize: 38,
  fontWeight: 800,
  letterSpacing: '-0.04em',
  color: '#243746',
  lineHeight: 1,
}

const pageSubtitle = {
  marginTop: 6,
  fontSize: 22,
  color: '#8c96a0',
  lineHeight: 1.15,
}

const filtersRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
  marginBottom: 18,
}

const filterSelect = {
  height: 36,
  border: '1px solid #c7d2dc',
  borderRadius: 4,
  background: '#fff',
  padding: '0 10px',
  color: '#445564',
  fontSize: 14,
  minWidth: 108,
}

const teamFilterInput = {
  height: 36,
  border: '1px solid #c7d2dc',
  borderRadius: 6,
  background: '#fff',
  padding: '0 12px',
  color: '#445564',
  fontSize: 14,
  minWidth: 130,
}

const resetButton = {
  border: 'none',
  background: 'transparent',
  color: '#c1c8cf',
  fontSize: 13,
  fontWeight: 700,
  padding: '0 6px',
}

const tabsBar = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginBottom: 0,
}

const activeTabButton = {
  border: 'none',
  background: 'transparent',
  borderBottom: '3px solid #193c53',
  color: '#1f2f3d',
  fontSize: 18,
  fontWeight: 800,
  padding: '0 6px 10px 6px',
}

const inactiveTabButton = {
  border: 'none',
  background: 'transparent',
  color: '#394c59',
  fontSize: 18,
  fontWeight: 700,
  padding: '0 6px 10px 6px',
}

const tabsSpacer = {
  flex: 1,
}

const submitButton = {
  height: 34,
  border: '1px solid #2d8a3f',
  borderRadius: 18,
  background: '#fff',
  color: '#000',
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 800,
}

const tableCard = {
  background: '#fff',
  borderRadius: 6,
  overflow: 'hidden',
  border: '1px solid #ccd5dd',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 14,
}

const tableHeadRow = {
  background: '#12354b',
}

const sharedTh = {
  color: '#fff',
  textAlign: 'left' as const,
  padding: '11px 12px',
  fontWeight: 800,
  fontSize: 14,
}

const dateTh = {
  ...sharedTh,
  width: 120,
}

const playerTh = {
  ...sharedTh,
}

const teamTh = {
  ...sharedTh,
  width: 190,
}

const sourceTh = {
  ...sharedTh,
  width: 120,
  textAlign: 'center' as const,
}

const tableRow = {
  background: '#fff',
}

const tableRowAlt = {
  background: '#eef2f6',
}

const sharedTd = {
  padding: '10px 12px',
  color: '#223746',
  fontSize: 14,
}

const dateTd = {
  ...sharedTd,
  whiteSpace: 'nowrap' as const,
}

const playerTd = {
  ...sharedTd,
}

const teamTdCell = {
  ...sharedTd,
  color: '#2273ae',
}

const sourceTd = {
  ...sharedTd,
  textAlign: 'center' as const,
}

const entityLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#2273ae',
  textDecoration: 'none',
}

const flagImage = {
  width: 16,
  height: 11,
  objectFit: 'cover' as const,
  border: '1px solid #b8c4ce',
}

const sourceLink = {
  color: '#198754',
  textDecoration: 'none',
  fontWeight: 700,
}

const sourcePlaceholder = {
  color: '#8e9aa4',
}

const emptyCell = {
  padding: '18px 12px',
  textAlign: 'center' as const,
  color: '#687786',
}

const footerInfo = {
  padding: '12px 14px',
  color: '#687786',
  fontSize: 13,
}

const errorText = {
  padding: '12px 14px',
  color: '#b42318',
  fontSize: 13,
}

const footerBar = {
  display: 'flex',
  justifyContent: 'center',
  padding: '18px 16px 20px 16px',
}

const showMoreButton = {
  minWidth: 254,
  height: 40,
  border: 'none',
  borderRadius: 24,
  background: '#28a34c',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  padding: '0 22px',
}

const modalOverlay = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(4, 18, 28, 0.58)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  zIndex: 200,
}

const modalCard = {
  width: 'min(760px, 100%)',
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 16px 34px rgba(0,0,0,0.24)',
}

const modalHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '18px 20px',
  borderBottom: '1px solid #d7e1ea',
}

const modalTitle = {
  fontSize: 22,
  fontWeight: 800,
  color: '#102f47',
}

const closeButton = {
  border: '1px solid #b8c6d3',
  borderRadius: 6,
  background: '#fff',
  color: '#173650',
  padding: '8px 12px',
  fontSize: 13,
}

const modalBody = {
  padding: 20,
}

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const fieldWrap = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}

const fieldLabel = {
  fontSize: 12,
  fontWeight: 700,
  color: '#445f74',
}

const fieldInput = {
  height: 38,
  border: '1px solid #c4d0db',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 14,
  color: '#173650',
  background: '#fff',
}

const modalFooter = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '0 20px 20px 20px',
}

const submitMessageStyle = {
  color: '#0b7d38',
  fontSize: 13,
  fontWeight: 700,
}

const primaryButton = {
  border: '1px solid #2d8a3f',
  borderRadius: 6,
  background: '#31a64a',
  color: '#fff',
  padding: '10px 18px',
  fontSize: 14,
}
