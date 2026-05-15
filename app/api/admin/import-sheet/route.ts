import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type ImportSheetRequest = {
  leagueId?: string
  seasonId?: string
  statsSheetUrl?: string
  matchesSheetUrl?: string
}

type CsvRow = Record<string, string>

type SearchPlayer = {
  id: string
  name?: string | null
  display_name?: string | null
  team_id?: string | null
}

type SearchTeam = {
  id: string
  name?: string | null
  league?: string | null
  logo_url?: string | null
}

type SearchLeague = {
  id: string
  name?: string | null
  display_name?: string | null
}

type SearchSeason = {
  id: string
  name?: string | null
}

type GoogleSheetTab = {
  gid: string
  title: string
}

type StatsSheetSource = {
  url: string
  gameType: 'regular' | 'playoffs'
  label: string
}

type GenericSheetSource = {
  url: string
  label: string
}

type RobloxUserLookup = {
  name?: string | null
  displayName?: string | null
}

function normalizeRobloxUserId(value?: string | null) {
  const digitsOnly = (value || '').replace(/[^\d]/g, '')
  return digitsOnly.trim()
}

function normalizeLookupValue(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeSheetUrl(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''

  if (!trimmed.includes('docs.google.com/spreadsheets/d/')) {
    return trimmed
  }

  const spreadsheetMatch = trimmed.match(/\/spreadsheets\/d\/([^/]+)/i)
  if (!spreadsheetMatch) return trimmed

  const spreadsheetId = spreadsheetMatch[1]
  const url = new URL(trimmed)
  const hashGid = url.hash.match(/gid=(\d+)/i)?.[1]
  const queryGid = url.searchParams.get('gid')
  const gid = queryGid || hashGid || '0'

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
}

function extractSpreadsheetId(value?: string | null) {
  const trimmed = (value || '').trim()
  const spreadsheetMatch = trimmed.match(/\/spreadsheets\/d\/([^/]+)/i)
  return spreadsheetMatch?.[1] || ''
}

function detectGameTypeFromTabName(value?: string | null) {
  const normalizedValue = normalizeLookupValue(value)
  if (
    normalizedValue.includes('playoff') ||
    normalizedValue.includes('postseason') ||
    normalizedValue === 'po'
  ) {
    return 'playoffs' as const
  }

  if (
    normalizedValue.includes('regularseason') ||
    normalizedValue.includes('regular') ||
    normalizedValue === 'rs'
  ) {
    return 'regular' as const
  }

  return null
}

function isBacklogTabName(value?: string | null) {
  const normalizedValue = normalizeLookupValue(value)
  return normalizedValue.includes('backlog')
}

function isInvalidGeneratedTeamName(value?: string | null) {
  const normalizedValue = normalizeLookupValue(value)
  return (
    !normalizedValue ||
    normalizedValue.startsWith('statstab') ||
    normalizedValue.includes('regularseason') ||
    normalizedValue.includes('playoffs') ||
    normalizedValue.includes('gamestats') ||
    normalizedValue.includes('playoffstats')
  )
}

function cleanStatsSheetLabel(value?: string | null) {
  return (value || '')
    .replace(/\bgame\s*stats\b/gi, '')
    .replace(/\bplayoff\s*stats\b/gi, '')
    .replace(/\bplayoffs?\b/gi, '')
    .replace(/\bregular\s*season\b/gi, '')
    .replace(/\bregular\b/gi, '')
    .replace(/\bstats?\b/gi, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function uniqueBy<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = getKey(row)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildGoogleSheetCsvUrl(spreadsheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
}

async function fetchGoogleSheetTabs(spreadsheetId: string) {
  const sheetResponse = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, {
    cache: 'no-store',
  })

  if (!sheetResponse.ok) {
    return [] as GoogleSheetTab[]
  }

  const html = await sheetResponse.text()
  return extractGoogleSheetTabs(html)
}

function extractGoogleSheetTabs(html: string) {
  const tabs: GoogleSheetTab[] = []
  const regexPatterns = [
    /"sheetId"\s*:\s*(\d+)[^}]*?"title"\s*:\s*"([^"]+)"/g,
    /"title"\s*:\s*"([^"]+)"[^}]*?"sheetId"\s*:\s*(\d+)/g,
    /"gid"\s*[:=]\s*"?(\\?\d+)"?[^}]*?"title"\s*:\s*"([^"]+)"/g,
    /"title"\s*:\s*"([^"]+)"[^}]*?"gid"\s*[:=]\s*"?(\\?\d+)"?/g,
  ]

  regexPatterns.forEach((pattern, patternIndex) => {
    let match: RegExpExecArray | null = pattern.exec(html)
    while (match) {
      const gid = String(patternIndex % 2 === 0 ? match[1] : match[2]).replace(/\\/g, '')
      const title = String(patternIndex % 2 === 0 ? match[2] : match[1]).trim()
      if (gid && title) {
        tabs.push({ gid, title })
      }
      match = pattern.exec(html)
    }
  })

  return uniqueBy(tabs, (tab) => `${tab.gid}::${normalizeLookupValue(tab.title)}`)
}

async function resolveStatsSheetSources(rawStatsSheetUrl: string) {
  const trimmed = rawStatsSheetUrl.trim()
  if (!trimmed) return [] as StatsSheetSource[]

  if (!trimmed.includes('docs.google.com/spreadsheets/d/')) {
    return [
      {
        url: trimmed,
        gameType: 'regular',
        label: 'Stats CSV',
      },
    ]
  }

  const spreadsheetId = extractSpreadsheetId(trimmed)
  if (!spreadsheetId) {
    return [
      {
        url: normalizeSheetUrl(trimmed),
        gameType: 'regular',
        label: 'Stats Sheet',
      },
    ]
  }

  const gidMatchFromUrl = trimmed.match(/[?#&]gid=(\d+)/i)
  if (gidMatchFromUrl) {
    const detectedTabs = await fetchGoogleSheetTabs(spreadsheetId)
    const matchedTab = detectedTabs.find((tab) => String(tab.gid) === String(gidMatchFromUrl[1])) || null
    const resolvedLabel = matchedTab?.title || `Stats Tab ${gidMatchFromUrl[1]}`
    const directGameType = detectGameTypeFromTabName(resolvedLabel) || 'regular'
    return [
      {
        url: buildGoogleSheetCsvUrl(spreadsheetId, gidMatchFromUrl[1]),
        gameType: directGameType,
        label: resolvedLabel,
      },
    ]
  }

  const detectedTabs = await fetchGoogleSheetTabs(spreadsheetId)
  if (!detectedTabs.length) {
    return [
      {
        url: buildGoogleSheetCsvUrl(spreadsheetId, '0'),
        gameType: 'regular',
        label: 'Stats Default Tab',
      },
    ]
  }
  const matchingTabs = detectedTabs
    .map((tab) => ({
      tab,
      gameType: detectGameTypeFromTabName(tab.title),
    }))
    .filter((entry): entry is { tab: GoogleSheetTab; gameType: 'regular' | 'playoffs' } => Boolean(entry.gameType))

  if (!matchingTabs.length) {
    return [
      {
        url: buildGoogleSheetCsvUrl(spreadsheetId, '0'),
        gameType: 'regular',
        label: 'Stats Default Tab',
      },
    ]
  }

  return uniqueBy(
    matchingTabs.map((entry) => ({
      url: buildGoogleSheetCsvUrl(spreadsheetId, entry.tab.gid),
      gameType: entry.gameType,
      label: entry.tab.title,
    })),
    (entry) => `${entry.url}::${entry.gameType}`
  )
}

async function resolveBacklogSheetSources(rawStatsSheetUrl: string) {
  const trimmed = rawStatsSheetUrl.trim()
  if (!trimmed.includes('docs.google.com/spreadsheets/d/')) {
    return [] as GenericSheetSource[]
  }

  const spreadsheetId = extractSpreadsheetId(trimmed)
  if (!spreadsheetId) {
    return [] as GenericSheetSource[]
  }

  const detectedTabs = await fetchGoogleSheetTabs(spreadsheetId)
  if (!detectedTabs.length) {
    return [] as GenericSheetSource[]
  }

  return uniqueBy(
    detectedTabs
      .filter((tab) => isBacklogTabName(tab.title))
      .map((tab) => ({
        url: buildGoogleSheetCsvUrl(spreadsheetId, tab.gid),
        label: tab.title,
      })),
    (entry) => entry.url
  )
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1
      }
      currentRow.push(currentCell)
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += character
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell)
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow)
    }
  }

  if (!rows.length) return [] as CsvRow[]

  const headerHints = [
    'team',
    'playername',
    'playerusername',
    'userid',
    'gp',
    'g',
    'a',
    'p',
    'hits',
    'sog',
    'toi',
    'sv',
    'sh',
    'result',
    'opp',
    'key',
  ]
  const headerCandidateRows = rows.slice(0, Math.min(rows.length, 6)).map((row) => row.map((cell) => cell.trim()))
  let bestHeaderIndex = 0
  let bestHeaderScore = -1

  headerCandidateRows.forEach((candidateRow, index) => {
    const normalizedCandidateRow = candidateRow.map((cell) => normalizeLookupValue(cell))
    const score = headerHints.reduce((total, hint) => total + (normalizedCandidateRow.includes(hint) ? 1 : 0), 0)
    if (score > bestHeaderScore) {
      bestHeaderScore = score
      bestHeaderIndex = index
    }
  })

  const headers = headerCandidateRows[bestHeaderIndex] || rows[0].map((cell) => cell.trim())
  const dataRows = rows.slice(bestHeaderIndex + 1)

  return dataRows.map((row) => {
    const entry: CsvRow = {}
    headers.forEach((header, index) => {
      entry[header] = row[index]?.trim() || ''
    })
    return entry
  })
}

function getCell(row: CsvRow, aliases: string[]) {
  const normalizedRow = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeLookupValue(key)] = value
    return acc
  }, {})

  for (const alias of aliases) {
    const value = normalizedRow[normalizeLookupValue(alias)]
    if (value !== undefined && value !== '') {
      return value
    }
  }

  return ''
}

function toNullableNumber(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return null
  const normalizedValue = trimmed.replace(',', '.')
  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function buildLookupMap<T extends { name?: string | null }>(
  rows: T[],
  extraValueSelectors: Array<(row: T) => string | null | undefined> = []
) {
  const lookup = new Map<string, T>()

  rows.forEach((row) => {
    const candidates = [row.name, ...extraValueSelectors.map((selector) => selector(row))]
    candidates.forEach((candidate) => {
      const normalized = normalizeLookupValue(candidate)
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, row)
      }
    })
  })

  return lookup
}

function findFuzzyMatch<T extends { name?: string | null }>(
  value: string,
  rows: T[],
  extraValueSelectors: Array<(row: T) => string | null | undefined> = []
) {
  const normalizedValue = normalizeLookupValue(value)
  if (!normalizedValue) return null

  return (
    rows.find((row) =>
      [row.name, ...extraValueSelectors.map((selector) => selector(row))]
        .filter(Boolean)
        .some((candidate) => {
          const normalizedCandidate = normalizeLookupValue(candidate)
          return (
            normalizedCandidate === normalizedValue ||
            normalizedCandidate.includes(normalizedValue) ||
            normalizedValue.includes(normalizedCandidate)
          )
        })
    ) || null
  )
}

function normalizeGameType(value?: string | null) {
  return normalizeLookupValue(value).includes('playoff') ? 'playoffs' : 'regular'
}

function isMissingPlayerName(value?: string | null) {
  const normalizedValue = normalizeLookupValue(value)
  return !normalizedValue || normalizedValue === 'notfound' || normalizedValue === 'unknown'
}

function normalizeMatchStatus(
  statusValue?: string | null,
  homeScore?: number | null,
  visitingScore?: number | null
) {
  const normalizedStatus = normalizeLookupValue(statusValue)

  if (normalizedStatus === 'live') return 'live'
  if (normalizedStatus === 'postponed') return 'postponed'
  if (normalizedStatus === 'cancelled') return 'cancelled'
  if (normalizedStatus === 'scheduled') return 'scheduled'
  if (normalizedStatus === 'final') return 'final'

  if (homeScore !== null && visitingScore !== null) return 'final'
  return 'scheduled'
}

async function requireAdmin(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient()
  const authorizationHeader = request.headers.get('authorization') || ''
  const accessToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : ''

  if (!accessToken) {
    return {
      error: NextResponse.json({ error: 'Missing access token.' }, { status: 401 }),
      supabaseAdmin,
      userId: null as string | null,
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }),
      supabaseAdmin,
      userId: null as string | null,
    }
  }

  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) {
    return {
      error: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
      supabaseAdmin,
      userId: null as string | null,
    }
  }

  return {
    error: null,
    supabaseAdmin,
    userId: user.id,
  }
}

async function fetchRobloxUserLookup(
  robloxUserId: string,
  cache: Map<string, RobloxUserLookup | null>
) {
  const normalizedUserId = normalizeRobloxUserId(robloxUserId)
  if (!normalizedUserId) return null

  if (cache.has(normalizedUserId)) {
    return cache.get(normalizedUserId) || null
  }

  try {
    const response = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(normalizedUserId)}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      cache.set(normalizedUserId, null)
      return null
    }

    const data = (await response.json()) as { name?: string; displayName?: string }
    const result = {
      name: data.name || null,
      displayName: data.displayName || null,
    }

    cache.set(normalizedUserId, result)
    return result
  } catch {
    cache.set(normalizedUserId, null)
    return null
  }
}

export async function POST(request: Request) {
  const { error, supabaseAdmin } = await requireAdmin(request)
  if (error) return error

  let payload: ImportSheetRequest

  try {
    payload = (await request.json()) as ImportSheetRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const leagueId = payload.leagueId?.trim()
  const seasonId = payload.seasonId?.trim()
  const rawStatsSheetUrl = payload.statsSheetUrl?.trim() || ''
  const matchesSheetUrl = normalizeSheetUrl(payload.matchesSheetUrl)

  if (!leagueId || !seasonId) {
    return NextResponse.json({ error: 'League and season are required.' }, { status: 400 })
  }

  if (!rawStatsSheetUrl && !matchesSheetUrl) {
    return NextResponse.json({ error: 'Provide at least one sheet link.' }, { status: 400 })
  }

  const [
    { data: playersData, error: playersError },
    { data: teamsData, error: teamsError },
    { data: leaguesData, error: leaguesError },
    { data: seasonsData, error: seasonsError },
  ] = await Promise.all([
    supabaseAdmin.from('players').select('id, name, display_name, team_id'),
    supabaseAdmin.from('teams').select('id, name, league, logo_url'),
    supabaseAdmin.from('leagues').select('id, name, display_name'),
    supabaseAdmin.from('seasons').select('id, name'),
  ])

  if (playersError || teamsError || leaguesError || seasonsError) {
    return NextResponse.json(
      {
        error:
          playersError?.message ||
          teamsError?.message ||
          leaguesError?.message ||
          seasonsError?.message ||
          'Failed to load import lookups.',
      },
      { status: 500 }
    )
  }

  const players = (playersData as SearchPlayer[]) || []
  const teams = (teamsData as SearchTeam[]) || []
  const leagues = (leaguesData as SearchLeague[]) || []
  const seasons = (seasonsData as SearchSeason[]) || []

  const selectedLeague = leagues.find((league) => league.id === leagueId)
  const selectedSeason = seasons.find((season) => season.id === seasonId)

  if (!selectedLeague || !selectedSeason) {
    return NextResponse.json({ error: 'Selected league or season no longer exists.' }, { status: 400 })
  }

  const playerLookup = buildLookupMap(players, [(player) => player.display_name])
  const teamLookup = buildLookupMap(teams)
  const robloxUserLookupCache = new Map<string, RobloxUserLookup | null>()

  function resolveExistingTeam(teamName?: string | null) {
    const trimmedTeamName = (teamName || '').trim()
    if (!trimmedTeamName) return null
    const normalizedTeamName = normalizeLookupValue(trimmedTeamName)

    if (isInvalidGeneratedTeamName(trimmedTeamName)) {
      return null
    }

    const existingTeam =
      teamLookup.get(normalizedTeamName) || findFuzzyMatch(trimmedTeamName, teams)

    return existingTeam || null
  }

  const responseSummary = {
    stats: {
      parsed: 0,
      matched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [] as string[],
    },
    matches: {
      parsed: 0,
      matched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [] as string[],
    },
  }

  if (rawStatsSheetUrl) {
    const statsSheetSources = await resolveStatsSheetSources(rawStatsSheetUrl)
    const backlogSheetSources = await resolveBacklogSheetSources(rawStatsSheetUrl)
    const matchedRows: Array<Record<string, string | number | null>> = []
    const matchedPlayerIds = new Set<string>()
    const matchedTeamIds = new Set<string>()
    const backlogTeamByUserId = new Map<string, SearchTeam>()
    const backlogTeamByPlayerName = new Map<string, SearchTeam>()
    const backlogTeamByTeamKey = new Map<string, SearchTeam>()
    const backlogTeamByName = new Map<string, SearchTeam>()
    const backlogTeamsInOrder: SearchTeam[] = []

    for (const source of backlogSheetSources) {
      const backlogResponse = await fetch(source.url, { cache: 'no-store' })
      if (!backlogResponse.ok) continue

      const backlogRows = parseCsv(await backlogResponse.text())

      for (const row of backlogRows) {
        const backlogUserId = normalizeRobloxUserId(
          getCell(row, [
            'roblox_user_id',
            'roblox userid',
            'roblox user id',
            'user_id',
            'user id',
            'userid',
          ])
        )
        const backlogPlayerName = getCell(row, [
          'player',
          'player name',
          'player_name',
          'player username',
          'username',
          'roblox username',
          'name',
        ])
        const backlogTeamName = getCell(row, [
          'team',
          'team name',
          'team_name',
          'club',
          'franchise',
          'franchise name',
          'team key',
          'teamkey',
        ])
        const backlogExplicitTeamKey = getCell(row, [
          'team key',
          'teamkey',
          'franchise key',
          'franchisekey',
        ])
        const backlogTeam = resolveExistingTeam(backlogTeamName)

        if (!backlogTeam) continue

        if (backlogUserId) {
          backlogTeamByUserId.set(backlogUserId, backlogTeam)
        }

        const normalizedBacklogPlayerName = normalizeLookupValue(backlogPlayerName)
        if (normalizedBacklogPlayerName) {
          backlogTeamByPlayerName.set(normalizedBacklogPlayerName, backlogTeam)
        }

        const normalizedBacklogTeamKey = normalizeLookupValue(backlogExplicitTeamKey)
        if (normalizedBacklogTeamKey) {
          backlogTeamByTeamKey.set(normalizedBacklogTeamKey, backlogTeam)
        }

        const normalizedBacklogTeamName = normalizeLookupValue(backlogTeamName)
        if (normalizedBacklogTeamName) {
          backlogTeamByName.set(normalizedBacklogTeamName, backlogTeam)
        }

        if (!backlogTeamsInOrder.some((entry) => String(entry.id) === String(backlogTeam.id))) {
          backlogTeamsInOrder.push(backlogTeam)
        }
      }
    }

    for (const source of statsSheetSources) {
      const statsResponse = await fetch(source.url, { cache: 'no-store' })
      if (!statsResponse.ok) {
        return NextResponse.json(
          { error: `Could not fetch stats sheet tab "${source.label}" (${statsResponse.status}).` },
          { status: 400 }
        )
      }

      const statsRows = parseCsv(await statsResponse.text())
      responseSummary.stats.parsed += statsRows.length
      const cleanedSourceLabel = cleanStatsSheetLabel(source.label)
      const sourceTeam =
        backlogTeamByTeamKey.get(normalizeLookupValue(cleanedSourceLabel)) ||
        backlogTeamByName.get(normalizeLookupValue(cleanedSourceLabel)) ||
        resolveExistingTeam(cleanedSourceLabel)
      const blockTeamByRowIndex = new Map<number, SearchTeam>()

      if (!sourceTeam) {
        const rowBlocks: number[][] = []
        let currentBlock: number[] = []

        statsRows.forEach((row, rowIndex) => {
          const blockPlayerName = getCell(row, [
            'player',
            'player name',
            'player_name',
            'player username',
            'username',
            'roblox username',
            'name',
          ])
          const blockRobloxUserId = normalizeRobloxUserId(
            getCell(row, [
              'roblox_user_id',
              'roblox userid',
              'roblox user id',
              'user_id',
              'user id',
              'userid',
            ])
          )
          const blockHasStats = [
            getCell(row, ['gp', 'games', 'games played']),
            getCell(row, ['goals', 'g']),
            getCell(row, ['assists', 'a']),
            getCell(row, ['points', 'pts', 'tp', 'p']),
            getCell(row, ['hits']),
            getCell(row, ['plus_minus', '+/-', 'plusminus']),
            getCell(row, ['shots', 'sog']),
            getCell(row, ['toi', 'time on ice']),
            getCell(row, ['gk_saves', 'saves', 'svs', 'sv']),
            getCell(row, ['goalie_wins', 'wins', 'w']),
            getCell(row, ['goalie_shutouts', 'shutouts', 'so', 'sh']),
          ].some((value) => (value || '').trim() !== '' && (value || '').trim() !== '0')
          const blockHasIdentity = Boolean((blockPlayerName || '').trim() || blockRobloxUserId)

          if (blockHasIdentity || blockHasStats) {
            currentBlock.push(rowIndex)
            return
          }

          if (currentBlock.length) {
            rowBlocks.push(currentBlock)
            currentBlock = []
          }
        })

        if (currentBlock.length) {
          rowBlocks.push(currentBlock)
        }

        rowBlocks.forEach((block, blockIndex) => {
          const blockTeam = backlogTeamsInOrder[blockIndex] || null
          if (!blockTeam) return
          block.forEach((rowIndex) => {
            blockTeamByRowIndex.set(rowIndex, blockTeam)
          })
        })
      }

      for (const [index, row] of statsRows.entries()) {
        const rawPlayerName = getCell(row, [
          'player',
          'player name',
          'player_name',
          'player username',
          'username',
          'roblox username',
          'name',
        ])
        const teamName = getCell(row, ['team', 'team name', 'team_name', 'club', 'team key', 'teamkey'])
        const statsTeamKey = getCell(row, ['team key', 'teamkey', 'franchise key', 'franchisekey'])
        const robloxUserId = normalizeRobloxUserId(
          getCell(row, [
          'roblox_user_id',
          'roblox userid',
          'roblox user id',
          'user_id',
          'user id',
          'userid',
          ])
        )
        const hasAnyMappedStats = [
          getCell(row, ['gp', 'games', 'games played']),
          getCell(row, ['goals', 'g']),
          getCell(row, ['assists', 'a']),
          getCell(row, ['points', 'pts', 'tp', 'p']),
          getCell(row, ['hits']),
          getCell(row, ['plus_minus', '+/-', 'plusminus']),
          getCell(row, ['shots', 'sog']),
          getCell(row, ['toi', 'time on ice']),
          getCell(row, ['gk_saves', 'saves', 'svs', 'sv']),
          getCell(row, ['goalie_wins', 'wins', 'w']),
          getCell(row, ['goalie_shutouts', 'shutouts', 'so', 'sh']),
        ].some((value) => (value || '').trim() !== '')
        const hasPlayerIdentity = Boolean((rawPlayerName || '').trim() || robloxUserId)
        const isSectionBreakRow = !hasPlayerIdentity && !hasAnyMappedStats && !teamName.trim() && !statsTeamKey.trim()

        if (isSectionBreakRow) {
          continue
        }

        let resolvedPlayerName = rawPlayerName
        let resolvedPlayerDisplayName = ''

        if (robloxUserId && isMissingPlayerName(rawPlayerName)) {
          const robloxLookup = await fetchRobloxUserLookup(robloxUserId, robloxUserLookupCache)
          if (robloxLookup?.name || robloxLookup?.displayName) {
            resolvedPlayerName = robloxLookup.name || robloxLookup.displayName || ''
            resolvedPlayerDisplayName = robloxLookup.displayName || robloxLookup.name || ''
          }
        }

        let player =
          playerLookup.get(normalizeLookupValue(resolvedPlayerName)) ||
          playerLookup.get(normalizeLookupValue(resolvedPlayerDisplayName)) ||
          findFuzzyMatch(resolvedPlayerName, players, [(player) => player.display_name]) ||
          findFuzzyMatch(resolvedPlayerDisplayName, players, [(player) => player.display_name])

        if (!player && robloxUserId) {
          const robloxLookup = await fetchRobloxUserLookup(robloxUserId, robloxUserLookupCache)
          if (robloxLookup?.name || robloxLookup?.displayName) {
            resolvedPlayerName = robloxLookup.name || robloxLookup.displayName || ''
            resolvedPlayerDisplayName = robloxLookup.displayName || robloxLookup.name || ''
            player =
              playerLookup.get(normalizeLookupValue(resolvedPlayerName)) ||
              playerLookup.get(normalizeLookupValue(resolvedPlayerDisplayName)) ||
              findFuzzyMatch(resolvedPlayerName, players, [(player) => player.display_name]) ||
              findFuzzyMatch(resolvedPlayerDisplayName, players, [(player) => player.display_name])
          }
        }

        const blockTeam = blockTeamByRowIndex.get(index) || null

        const matchedTeamFromBacklog =
          backlogTeamByTeamKey.get(normalizeLookupValue(statsTeamKey)) ||
          (robloxUserId ? backlogTeamByUserId.get(robloxUserId) || null : null) ||
          backlogTeamByPlayerName.get(normalizeLookupValue(resolvedPlayerName)) ||
          backlogTeamByPlayerName.get(normalizeLookupValue(resolvedPlayerDisplayName)) ||
          null
        const matchedTeamFromRow =
          matchedTeamFromBacklog ||
          (teamName
            ? teamLookup.get(normalizeLookupValue(teamName)) || findFuzzyMatch(teamName, teams)
            : null) ||
          blockTeam ||
          sourceTeam ||
          null

        if (!player && resolvedPlayerName.trim()) {
          const { data: createdPlayer, error: createPlayerError } = await supabaseAdmin
            .from('players')
            .insert({
              name: resolvedPlayerName.trim(),
              team_id: matchedTeamFromRow?.id || null,
            })
            .select('id, name, display_name, team_id')
            .single()

          if (createPlayerError || !createdPlayer) {
            const previewValues = Object.entries(row)
              .slice(0, 6)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ')
            responseSummary.stats.skipped += 1
            responseSummary.stats.warnings.push(
              `Stats row ${index + 2} in "${source.label}": could not create player "${resolvedPlayerName.trim()}". ${createPlayerError?.message || 'Unknown create error.'} Sample: ${previewValues}`
            )
            continue
          }

          player = createdPlayer as SearchPlayer
          players.push(player)

          const normalizedCreatedName = normalizeLookupValue(player.name)
          if (normalizedCreatedName) {
            playerLookup.set(normalizedCreatedName, player)
          }

          const normalizedCreatedDisplayName = normalizeLookupValue(player.display_name)
          if (normalizedCreatedDisplayName) {
            playerLookup.set(normalizedCreatedDisplayName, player)
          }
        }

        const currentPlayerTeam =
          player?.team_id
            ? teams.find((teamRow) => String(teamRow.id) === String(player.team_id)) || null
            : null

        const shouldRepairPlayerTeam =
          player &&
          matchedTeamFromRow?.id &&
          (!player.team_id ||
            String(player.team_id) !== String(matchedTeamFromRow.id) ||
            isInvalidGeneratedTeamName(currentPlayerTeam?.name))

        if (shouldRepairPlayerTeam && player) {
          const { error: updatePlayerTeamError } = await supabaseAdmin
            .from('players')
            .update({ team_id: matchedTeamFromRow.id })
            .eq('id', player.id)

          if (!updatePlayerTeamError) {
            player.team_id = matchedTeamFromRow.id
          }
        }

        const team =
          matchedTeamFromRow ||
          (player?.team_id
            ? teams.find((teamRow) => String(teamRow.id) === String(player.team_id)) || null
            : null)

        if (!player) {
          const previewValues = Object.entries(row)
            .slice(0, 6)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ')
          responseSummary.stats.skipped += 1
          responseSummary.stats.warnings.push(
            `Stats row ${index + 2} in "${source.label}": could not match player "${resolvedPlayerName || rawPlayerName}". Sample: ${previewValues}`
          )
          continue
        }

        const goals = toNullableNumber(getCell(row, ['goals', 'g']))
        const assists = toNullableNumber(getCell(row, ['assists', 'a']))
        const points = toNullableNumber(getCell(row, ['points', 'pts', 'tp', 'p'])) ?? ((goals || 0) + (assists || 0))
        const explicitGameType = getCell(row, ['game_type', 'game type', 'type'])

        matchedRows.push({
          player_id: player.id,
          team_id: team?.id || null,
          season_id: selectedSeason.id,
          game_type: explicitGameType ? normalizeGameType(explicitGameType) : source.gameType,
          position: getCell(row, ['position', 'pos']) || null,
          gp: toNullableNumber(getCell(row, ['gp', 'games', 'games played'])),
          goals,
          assists,
          points,
          hits: toNullableNumber(getCell(row, ['hits'])),
          plus_minus: toNullableNumber(getCell(row, ['plus_minus', '+/-', 'plusminus'])),
          shots: toNullableNumber(getCell(row, ['shots', 'sog'])),
          toi: toNullableNumber(getCell(row, ['toi', 'time on ice'])),
          gk_saves: toNullableNumber(getCell(row, ['gk_saves', 'saves', 'svs', 'sv'])),
          gk_shots_against: toNullableNumber(getCell(row, ['gk_shots_against', 'shots_against', 'sa'])),
          gk_percentage: toNullableNumber(getCell(row, ['gk_percentage', 'save_percentage', 'sv%'])),
          goalie_wins: toNullableNumber(getCell(row, ['goalie_wins', 'wins', 'w'])),
          goalie_losses: toNullableNumber(getCell(row, ['goalie_losses', 'losses', 'l'])),
          goalie_overtime_losses: toNullableNumber(getCell(row, ['goalie_overtime_losses', 'otl'])),
          goalie_shutouts: toNullableNumber(getCell(row, ['goalie_shutouts', 'shutouts', 'so', 'sh'])),
          goalie_goals_against: toNullableNumber(getCell(row, ['goalie_goals_against', 'goals_against', 'ga'])),
        })
        responseSummary.stats.matched += 1
        matchedPlayerIds.add(player.id)
        if (team?.id) {
          matchedTeamIds.add(team.id)
        }
      }
    }

    if (matchedRows.length) {
      const { data: existingStats, error: existingStatsError } = await supabaseAdmin
        .from('stats')
        .select('id, player_id, team_id, season_id, game_type')
        .eq('season_id', selectedSeason.id)
        .in('player_id', Array.from(matchedPlayerIds))

      if (existingStatsError) {
        return NextResponse.json({ error: existingStatsError.message }, { status: 500 })
      }

      const existingStatsRows =
        (existingStats as Array<{
          id: string
          player_id?: string | null
          team_id?: string | null
          game_type?: string | null
        }>) || []
      const existingStatsByKey = new Map(
        existingStatsRows.map((row) => [
          `${row.player_id}::${row.team_id}::${row.game_type || 'regular'}`,
          row.id,
        ])
      )
      const existingStatsByPlayerGameType = new Map<string, typeof existingStatsRows>()
      existingStatsRows.forEach((row) => {
        const key = `${row.player_id}::${row.game_type || 'regular'}`
        const bucket = existingStatsByPlayerGameType.get(key) || []
        bucket.push(row)
        existingStatsByPlayerGameType.set(key, bucket)
      })

      const dedupedMatchedRows = Array.from(
        matchedRows.reduce(
          (acc, row) => {
            const dedupeKey = `${row.player_id}::${row.team_id || 'no-team'}::${row.game_type || 'regular'}`
            acc.set(dedupeKey, row)
            return acc
          },
          new Map<string, Record<string, string | number | null>>()
        ).values()
      )

      const upsertRows = dedupedMatchedRows.map((row) => {
        const playerGameTypeKey = `${row.player_id}::${row.game_type || 'regular'}`
        let resolvedTeamId = row.team_id
        let existingId: string | undefined

        if (!resolvedTeamId) {
          const candidates = existingStatsByPlayerGameType.get(playerGameTypeKey) || []
          if (candidates.length === 1) {
            resolvedTeamId = candidates[0].team_id || null
            existingId = candidates[0].id
          }
        }

        const key = `${row.player_id}::${resolvedTeamId}::${row.game_type || 'regular'}`
        existingId = existingId || existingStatsByKey.get(key)
        if (!existingId) {
          const candidates = existingStatsByPlayerGameType.get(playerGameTypeKey) || []
          const nullTeamCandidate = candidates.find((candidate) => !candidate.team_id)
          const invalidTeamCandidate = candidates.find((candidate) => {
            if (!candidate.team_id) return false
            const candidateTeam = teams.find((teamRow) => String(teamRow.id) === String(candidate.team_id))
            return isInvalidGeneratedTeamName(candidateTeam?.name)
          })
          if (nullTeamCandidate) {
            existingId = nullTeamCandidate.id
          } else if (invalidTeamCandidate) {
            existingId = invalidTeamCandidate.id
          }
        }
        if (existingId) {
          responseSummary.stats.updated += 1
        } else {
          responseSummary.stats.created += 1
        }

        return {
          id: existingId || crypto.randomUUID(),
          ...row,
          team_id: resolvedTeamId,
        }
      })

      const { error: upsertStatsError } = await supabaseAdmin.from('stats').upsert(upsertRows)

      if (upsertStatsError) {
        return NextResponse.json({ error: upsertStatsError.message }, { status: 500 })
      }
    }
  }

  if (matchesSheetUrl) {
    const matchesResponse = await fetch(matchesSheetUrl, { cache: 'no-store' })
    if (!matchesResponse.ok) {
      return NextResponse.json(
        { error: `Could not fetch matches sheet (${matchesResponse.status}).` },
        { status: 400 }
      )
    }

    const matchRows = parseCsv(await matchesResponse.text())
    responseSummary.matches.parsed += matchRows.length
    const preparedMatchRows: Array<Record<string, string | number | null>> = []

    matchRows.forEach((row, index) => {
      const homeTeamName = getCell(row, ['home_team', 'home team', 'home'])
      const visitingTeamName = getCell(row, ['visiting_team', 'visiting team', 'away_team', 'away team', 'visiting', 'away'])
      const matchDate = getCell(row, ['match_date', 'date', 'datetime', 'game_date'])
      if (!matchDate) {
        responseSummary.matches.skipped += 1
        responseSummary.matches.warnings.push(`Match row ${index + 2}: missing date.`)
        return
      }

      const homeTeam =
        teamLookup.get(normalizeLookupValue(homeTeamName)) ||
        findFuzzyMatch(homeTeamName, teams)
      const visitingTeam =
        teamLookup.get(normalizeLookupValue(visitingTeamName)) ||
        findFuzzyMatch(visitingTeamName, teams)

      if (!homeTeam || !visitingTeam) {
        responseSummary.matches.skipped += 1
        responseSummary.matches.warnings.push(
          `Match row ${index + 2}: could not match ${!homeTeam ? `home team "${homeTeamName}"` : ''}${!homeTeam && !visitingTeam ? ' and ' : ''}${!visitingTeam ? `visiting team "${visitingTeamName}"` : ''}.`
        )
        return
      }

      const homeScore = toNullableNumber(getCell(row, ['home_score', 'home score']))
      const visitingScore = toNullableNumber(getCell(row, ['visiting_score', 'visiting score', 'away_score', 'away score']))

      preparedMatchRows.push({
        league_id: selectedLeague.id,
        season_id: selectedSeason.id,
        match_date: matchDate,
        home_team_id: homeTeam.id,
        visiting_team_id: visitingTeam.id,
        home_score: homeScore,
        visiting_score: visitingScore,
        score_note: getCell(row, ['score_note', 'note']) || null,
        status: normalizeMatchStatus(getCell(row, ['status']), homeScore, visitingScore),
        venue: getCell(row, ['venue', 'arena']) || null,
        attendance: toNullableNumber(getCell(row, ['attendance'])),
      })
      responseSummary.matches.matched += 1
    })

    if (preparedMatchRows.length) {
      const { data: existingMatches, error: existingMatchesError } = await supabaseAdmin
        .from('league_matches')
        .select('id, match_date, home_team_id, visiting_team_id')
        .eq('league_id', selectedLeague.id)
        .eq('season_id', selectedSeason.id)

      if (existingMatchesError) {
        return NextResponse.json({ error: existingMatchesError.message }, { status: 500 })
      }

      const existingMatchesByKey = new Map(
        ((existingMatches as Array<{ id: string; match_date?: string | null; home_team_id?: string | null; visiting_team_id?: string | null }>) || []).map((row) => [
          `${row.match_date}::${row.home_team_id}::${row.visiting_team_id}`,
          row.id,
        ])
      )

      const upsertMatches = preparedMatchRows.map((row) => {
        const key = `${row.match_date}::${row.home_team_id}::${row.visiting_team_id}`
        const existingId = existingMatchesByKey.get(key)

        if (existingId) {
          responseSummary.matches.updated += 1
        } else {
          responseSummary.matches.created += 1
        }

        return {
          id: existingId || crypto.randomUUID(),
          ...row,
        }
      })

      const { error: upsertMatchesError } = await supabaseAdmin
        .from('league_matches')
        .upsert(upsertMatches)

      if (upsertMatchesError) {
        return NextResponse.json({ error: upsertMatchesError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    message: 'Sheet import finished.',
    summary: responseSummary,
    requirements: {
      statsColumns:
        'player, team, optional season/league, optional game_type, optional position, gp, goals, assists, points, hits, plus_minus, shots, toi, saves/goalie fields',
      matchColumns:
        'date, home_team, visiting_team, optional season/league, optional home_score, visiting_score, score_note, status, venue, attendance',
    },
    behavior: {
      statsTabs:
        'If you paste the main Google Sheet link, the importer will scan tab names and auto-classify tabs containing words like "regular season", "regular", "playoff", or "playoffs".',
    },
  })
}
