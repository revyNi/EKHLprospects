'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type LeagueCategory = 'league' | 'international'
type LeagueRegion = 'EU' | 'RU' | 'NA'
type InternationalLevel = 'EU_LEVEL' | 'NA_LEVEL'

type LeagueRecord = {
  id: string
  name: string
  category: string | null
  country_code: string | null
  region: string | null
}

const leagueRegions: { key: LeagueRegion; title: string }[] = [
  { key: 'EU', title: 'EU' },
  { key: 'RU', title: 'RU' },
  { key: 'NA', title: 'NA' },
]

const internationalLevels: { key: InternationalLevel; title: string }[] = [
  { key: 'EU_LEVEL', title: 'EU Level' },
  { key: 'NA_LEVEL', title: 'NA Level' },
]

function normalizeCategory(category?: string | null): LeagueCategory {
  return category?.toLowerCase() === 'international' ? 'international' : 'league'
}

function normalizeRegion(region?: string | null): LeagueRegion | null {
  if (!region) return null

  const value = region.toUpperCase()
  if (value === 'EU' || value === 'RU' || value === 'NA') return value
  return null
}

function normalizeInternationalLevel(region?: string | null): InternationalLevel | null {
  if (!region) return null

  const value = region.toUpperCase()
  if (value === 'EU_LEVEL' || value === 'NA_LEVEL') return value
  return null
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

export default function AwardsPage() {
  const [leagues, setLeagues] = useState<LeagueRecord[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchLeagues() {
      setIsLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, category, country_code, region')
        .order('name', { ascending: true })

      if (error) {
        setErrorMessage(error.message)
        setLeagues([])
        setIsLoading(false)
        return
      }

      setLeagues((data as LeagueRecord[]) || [])
      setIsLoading(false)
    }

    fetchLeagues()
  }, [])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchTerm(searchInput.trim().toLowerCase())
  }

  const filteredLeagues = leagues.filter((league) => {
    if (!searchTerm) return true
    return league.name.toLowerCase().includes(searchTerm)
  })

  const standardLeagues = filteredLeagues.filter(
    (league) => normalizeCategory(league.category) === 'league'
  )

  const internationalLeagues = filteredLeagues.filter(
    (league) => normalizeCategory(league.category) === 'international'
  )

  return (
    <div style={pageWrap}>
      <div style={shell}>
        <div style={card}>
          <div style={cardHeaderRow}>
            <div style={pageTitle}>Awards</div>

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

          <div style={leaguePanel}>
            <div style={tabsRow}>
              {leagueRegions.map((region, index) => (
                <div
                  key={region.key}
                  style={{
                    ...tabStyle,
                    borderRight:
                      index === leagueRegions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  {region.title}
                </div>
              ))}
            </div>

            <div style={columnsRow}>
              {leagueRegions.map((region, index) => {
                const regionLeagues = standardLeagues.filter(
                  (league) => normalizeRegion(league.region) === region.key
                )

                return (
                  <div
                    key={region.key}
                    style={{
                      ...columnStyle,
                      borderRight: index === leagueRegions.length - 1 ? 'none' : '1px solid #e1e7ee',
                    }}
                  >
                    {regionLeagues.map((league) => (
                      <Link key={league.id} href={`/awards/${league.id}`} style={leagueRow}>
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
                        <span style={leagueName}>{league.name}</span>
                      </Link>
                    ))}

                    {!isLoading && regionLeagues.length === 0 ? <div style={infoText}>No leagues found.</div> : null}
                    {isLoading ? <div style={infoText}>Loading...</div> : null}
                  </div>
                )
              })}
            </div>

            {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
          </div>

          <div style={leaguePanel}>
            <div style={panelTitle}>INTERNATIONAL</div>

            <div style={internationalTabsRow}>
              {internationalLevels.map((level, index) => (
                <div
                  key={level.key}
                  style={{
                    ...tabStyle,
                    borderRight:
                      index === internationalLevels.length - 1
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  {level.title}
                </div>
              ))}
            </div>

            <div style={internationalColumnsRow}>
              {internationalLevels.map((level, index) => {
                const levelLeagues = internationalLeagues.filter(
                  (league) => normalizeInternationalLevel(league.region) === level.key
                )

                return (
                  <div
                    key={level.key}
                    style={{
                      ...columnStyle,
                      borderRight:
                        index === internationalLevels.length - 1 ? 'none' : '1px solid #e1e7ee',
                    }}
                  >
                    {levelLeagues.map((league) => (
                      <Link key={league.id} href={`/awards/${league.id}`} style={leagueRow}>
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
                        <span style={leagueName}>{league.name}</span>
                      </Link>
                    ))}

                    {!isLoading && levelLeagues.length === 0 ? <div style={infoText}>No leagues found.</div> : null}
                    {isLoading ? <div style={infoText}>Loading...</div> : null}
                  </div>
                )
              })}
            </div>

            {errorMessage ? <div style={errorText}>{errorMessage}</div> : null}
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

const cardHeaderRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 12px 12px 12px',
  borderBottom: '1px solid #d6dde5',
}

const pageTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: '#102f47',
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

const leaguePanel = {
  margin: '12px 12px 12px 12px',
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
  textTransform: 'uppercase' as const,
}

const tabsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  background: '#d92a2d',
}

const internationalTabsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  background: '#d92a2d',
}

const tabStyle = {
  background: '#d92a2d',
  color: 'white',
  fontSize: 9,
  fontWeight: 700,
  padding: '4px 8px',
  whiteSpace: 'nowrap' as const,
}

const columnsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
}

const internationalColumnsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
}

const columnStyle = {
  minHeight: 520,
  padding: '8px 8px 10px 8px',
  background: '#fff',
}

const leagueRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: '0',
  marginBottom: 4,
  color: '#2a73ad',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 500,
}

const flagImage = {
  width: 14,
  height: 10,
  objectFit: 'cover' as const,
  border: '1px solid #bcc6cf',
}

const flagBox = {
  width: 14,
  height: 10,
  border: '1px solid #bcc6cf',
  fontSize: 7,
  lineHeight: '8px',
  color: '#5f7385',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const leagueName = {
  lineHeight: 1.2,
}

const infoText = {
  color: '#748497',
  fontSize: 11,
  paddingTop: 2,
}

const errorText = {
  padding: '8px 10px 12px 10px',
  color: '#c1272d',
  fontSize: 11,
}
