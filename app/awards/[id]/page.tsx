'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

type LeagueRecord = {
  id: string
  name: string
  display_name?: string | null
  country_code?: string | null
}

type AwardRecord = {
  id: string
  league_id?: string | null
  league?: string | null
  award?: string | null
}

function normalizeLookupValue(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export default function AwardLeaguePage() {
  const params = useParams()
  const identifier = decodeURIComponent(params.id as string)

  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [awards, setAwards] = useState<AwardRecord[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!identifier) return

    async function fetchAwardsPage() {
      setIsLoading(true)
      setErrorMessage('')

      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, display_name, country_code')
      const allLeagues = (leaguesData as LeagueRecord[]) || []
      const normalizedIdentifier = normalizeLookupValue(identifier)
      const leagueRecord =
        allLeagues.find((entry) => String(entry.id) === identifier) ||
        allLeagues.find((entry) =>
          [entry.name, entry.display_name]
            .filter(Boolean)
            .some((value) => normalizeLookupValue(value) === normalizedIdentifier)
        ) ||
        null

      if (leaguesError) {
        setLeague(null)
        setAwards([])
        setErrorMessage(leaguesError.message)
        setIsLoading(false)
        return
      }

      let awardsData: AwardRecord[] | null = null
      let awardsError: { message: string } | null = null

      if (leagueRecord) {
        const awardsByLeagueId = await supabase
          .from('awards')
          .select('id, league_id, league, award')
          .eq('league_id', leagueRecord.id)
          .order('award', { ascending: true })

        awardsData = (awardsByLeagueId.data as AwardRecord[]) || []
        awardsError = awardsByLeagueId.error ? { message: awardsByLeagueId.error.message } : null
      } else {
        const awardsByLeagueName = await supabase
          .from('awards')
          .select('id, league_id, league, award')
          .ilike('league', identifier)
          .order('award', { ascending: true })

        awardsData = (awardsByLeagueName.data as AwardRecord[]) || []
        awardsError = awardsByLeagueName.error ? { message: awardsByLeagueName.error.message } : null
      }

      const fallbackLeagueName =
        leagueRecord?.name ||
        awardsData?.find((row) => row.league?.trim())?.league?.trim() ||
        (identifier ? decodeURIComponent(identifier) : '')

      if (!leagueRecord && (!awardsData || awardsData.length === 0)) {
        setLeague(null)
        setAwards([])
        setErrorMessage(awardsError?.message || 'League not found.')
        setIsLoading(false)
        return
      }

      const resolvedLeagueRecord: LeagueRecord | null = leagueRecord
        ? leagueRecord
        : fallbackLeagueName
          ? {
              id: identifier,
              name: fallbackLeagueName,
            }
          : null

      setLeague(resolvedLeagueRecord)
      setAwards(awardsData || [])
      setErrorMessage(awardsError?.message || '')
      setIsLoading(false)
    }

    fetchAwardsPage()
  }, [identifier])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchTerm(searchInput.trim().toLowerCase())
  }

  const filteredAwards = awards.filter((row) => {
    if (!searchTerm) return true
    return (row.award || '').toLowerCase().includes(searchTerm)
  })

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={card}>
          <div style={headerRow}>
            <div style={pageTitle}>{league?.name ? `${league.name} Awards` : 'Awards'}</div>

            <form onSubmit={handleSearchSubmit} style={epSearchWrap}>
              <div style={epSearchInputWrap}>
                <span style={searchIcon}>Q</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search awards"
                  style={epSearchInput}
                />
              </div>

              <button type="submit" style={searchButton}>
                Search
              </button>
            </form>
          </div>

          <div style={panel}>
            <div style={panelTitle}>{(league?.name || 'League').toUpperCase()} AWARDS</div>

            {isLoading ? <div style={statusText}>Loading...</div> : null}
            {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}

            {!isLoading && !errorMessage ? (
              <div style={awardList}>
                {filteredAwards.map((row) => (
                  <Link
                    key={row.id}
                    href={`/awards/${encodeURIComponent(String(league?.id || identifier))}/${encodeURIComponent(row.award || '')}`}
                    style={awardItem}
                  >
                    {row.award || 'Untitled award'}
                  </Link>
                ))}

                {filteredAwards.length === 0 ? (
                  <div style={statusText}>
                    {awards.length === 0
                      ? 'No awards added for this league yet.'
                      : 'No awards match your search.'}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isLoading && !errorMessage ? (
              <div style={footerRow}>
                <Link href="/awards" style={backLink}>
                  Back to Awards
                </Link>
              </div>
            ) : null}
          </div>
        </div>
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

const card = {
  background: 'white',
  border: '1px solid #c7d2dc',
  borderRadius: 4,
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const headerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 14px 14px',
  borderBottom: '1px solid #d6dde5',
}

const pageTitle = {
  fontSize: 22,
  fontWeight: 800,
  color: '#102f47',
}

const backLink = {
  color: '#2a73ad',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
}

const epSearchWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 290,
}

const epSearchInputWrap = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  height: 24,
  border: '1px solid #d0d8e2',
  borderRadius: 12,
  background: '#fff',
  padding: '0 8px',
}

const searchIcon = {
  fontSize: 10,
  color: '#7d8b99',
  marginRight: 6,
}

const epSearchInput = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 10,
  color: '#173650',
}

const searchButton = {
  height: 22,
  border: '1px solid #2d8a3f',
  borderRadius: 4,
  background: '#31a64a',
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  padding: '0 10px',
}

const panel = {
  margin: 12,
  border: '1px solid #bdc9d5',
  borderRadius: 4,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
}

const panelTitle = {
  background: '#124a6a',
  color: 'white',
  fontSize: 10,
  fontWeight: 700,
  padding: '6px 10px',
}

const awardList = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px 34px',
  padding: 14,
}

const awardItem = {
  color: '#2a73ad',
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.35,
  textDecoration: 'none',
}

const statusText = {
  padding: 14,
  color: '#748497',
  fontSize: 12,
}

const errorText = {
  padding: '14px 14px 0',
  color: '#c1272d',
  fontSize: 12,
}

const footerRow = {
  padding: '0 14px 14px',
}
