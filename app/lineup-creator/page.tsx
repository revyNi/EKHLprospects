'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type TeamRecord = {
  id: string
  name: string
  logo_url?: string | null
}

type PlayerRecord = {
  id: string
  name: string
  display_name?: string | null
  position?: string | null
  nationality?: string | null
  image_url?: string | null
  team_id?: string | null
  teams?: TeamRecord | TeamRecord[] | null
}

type SlotType = 'forward' | 'winger' | 'defender' | 'winger_or_defender' | 'goalie'

type BubbleSlot = {
  id: string
  label: string
  type: SlotType
  x: number
  y: number
}

type FormationDefinition = {
  label: string
  help: string
  slots: BubbleSlot[]
}

type DisplayMode = 'club' | 'country'

const formations: Record<string, FormationDefinition> = {
  '2-1': {
    label: '2-1',
    help: '2 forwards, 1 defender',
    slots: [
      { id: 'f1', label: 'Forward', type: 'forward', x: 39, y: 22 },
      { id: 'f2', label: 'Forward', type: 'forward', x: 61, y: 22 },
      { id: 'd1', label: 'Defender', type: 'defender', x: 50, y: 46 },
      { id: 'g1', label: 'Goalie', type: 'goalie', x: 50, y: 83 },
    ],
  },
  '1-2': {
    label: '1-2',
    help: '1 forward, 2 defenders/wingers',
    slots: [
      { id: 'f1', label: 'Forward', type: 'forward', x: 50, y: 20 },
      { id: 'dw1', label: 'Winger / Defender', type: 'winger_or_defender', x: 39, y: 46 },
      { id: 'dw2', label: 'Winger / Defender', type: 'winger_or_defender', x: 61, y: 46 },
      { id: 'g1', label: 'Goalie', type: 'goalie', x: 50, y: 83 },
    ],
  },
  '1-1-1': {
    label: '1-1-1',
    help: '1 forward, 1 winger, 1 defender',
    slots: [
      { id: 'f1', label: 'Forward', type: 'forward', x: 50, y: 24 },
      { id: 'w1', label: 'Winger', type: 'winger', x: 50, y: 43 },
      { id: 'd1', label: 'Defender', type: 'defender', x: 50, y: 62 },
      { id: 'g1', label: 'Goalie', type: 'goalie', x: 50, y: 86 },
    ],
  },
  '3-0': {
    label: '3-0',
    help: '3 forwards',
    slots: [
      { id: 'f1', label: 'Forward', type: 'forward', x: 34, y: 28 },
      { id: 'f2', label: 'Forward', type: 'forward', x: 50, y: 22 },
      { id: 'f3', label: 'Forward', type: 'forward', x: 66, y: 28 },
      { id: 'g1', label: 'Goalie', type: 'goalie', x: 50, y: 83 },
    ],
  },
  '0-3': {
    label: '0-3',
    help: '3 defenders',
    slots: [
      { id: 'd1', label: 'Defender', type: 'defender', x: 38, y: 64 },
      { id: 'd2', label: 'Defender', type: 'defender', x: 50, y: 58 },
      { id: 'd3', label: 'Defender', type: 'defender', x: 62, y: 64 },
      { id: 'g1', label: 'Goalie', type: 'goalie', x: 50, y: 83 },
    ],
  },
}

function getPrimaryTeam(teamValue?: TeamRecord | TeamRecord[] | null) {
  return Array.isArray(teamValue) ? teamValue[0] || null : teamValue || null
}

function normalizePosition(position?: string | null) {
  return (position || '').trim().toUpperCase()
}

function isPlayerCompatible(player: PlayerRecord, slotType: SlotType) {
  const position = normalizePosition(player.position)

  if (slotType === 'goalie') return position.includes('G')
  if (slotType === 'defender') return position.includes('D')
  if (slotType === 'winger') return position.includes('LW') || position.includes('RW') || position === 'W' || position === 'F'
  if (slotType === 'winger_or_defender') return position.includes('D') || position.includes('LW') || position.includes('RW') || position === 'W' || position === 'F'
  return position.includes('C') || position.includes('LW') || position.includes('RW') || position === 'F' || position === 'W'
}

function formatSlotTypeLabel(slotType: SlotType) {
  if (slotType === 'winger_or_defender') return 'W / D'
  return slotType.replace('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

export default function LineupCreatorPage() {
  const [formationKey, setFormationKey] = useState<keyof typeof formations>('2-1')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('club')
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, PlayerRecord | null>>({})
  const [lineupName, setLineupName] = useState('')

  useEffect(() => {
    let isMounted = true

    async function fetchPlayers() {
      setIsLoading(true)

      const { data } = await supabase
        .from('players')
        .select('id, name, display_name, position, nationality, image_url, team_id, teams(id, name, logo_url)')
        .order('name', { ascending: true })
        .limit(500)

      if (!isMounted) return
      setPlayers((data as PlayerRecord[]) || [])
      setIsLoading(false)
    }

    void fetchPlayers()

    return () => {
      isMounted = false
    }
  }, [])

  const formation = formations[formationKey]
  const activeSlot = formation.slots.find((slot) => slot.id === activeSlotId) || null

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    const source = players.filter((player) => {
      if (!normalizedSearch) return true

      const team = getPrimaryTeam(player.teams)
      return [player.name, player.display_name, player.position, player.nationality, team?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })

    if (!activeSlot) return source

    return [...source].sort((a, b) => {
      const aMatch = isPlayerCompatible(a, activeSlot.type) ? 1 : 0
      const bMatch = isPlayerCompatible(b, activeSlot.type) ? 1 : 0
      return bMatch - aMatch || a.name.localeCompare(b.name)
    })
  }, [activeSlot, players, searchValue])

  function openSlot(slotId: string) {
    setActiveSlotId(slotId)
    setSearchValue('')
  }

  function closePicker() {
    setActiveSlotId(null)
    setSearchValue('')
  }

  function assignPlayer(player: PlayerRecord) {
    if (!activeSlot) return

    setSelectedPlayers((current) => ({
      ...current,
      [activeSlot.id]: player,
    }))
    closePicker()
  }

  function clearLineup() {
    setSelectedPlayers({})
    setLineupName('')
    closePicker()
  }

  function removePlayer(slotId: string) {
    setSelectedPlayers((current) => ({
      ...current,
      [slotId]: null,
    }))
  }

  return (
    <div className="motion-page-root" style={pageWrap}>
      <div className="motion-hero-card motion-section-card" style={builderShell}>
        <div style={builderHeader}>
          <div>
            <div style={builderTitle}>Lineup Creator</div>
            <div style={builderSubtitle}>Build a premium 3+1 hockey lineup and switch between club and country views.</div>
          </div>
          <div style={builderBadge}>3+1</div>
        </div>

        <div style={controlBar}>
          <div style={controlRowLeft}>
            <label style={formationSelectWrap}>
              <select
                value={formationKey}
                onChange={(event) => {
                  setFormationKey(event.target.value as keyof typeof formations)
                  setActiveSlotId(null)
                }}
                style={formationSelect}
              >
                {Object.entries(formations).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setDisplayMode('club')}
              style={displayMode === 'club' ? toggleButtonActive : toggleButton}
            >
              Club
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('country')}
              style={displayMode === 'country' ? toggleButtonActive : toggleButton}
            >
              Country
            </button>
          </div>

          <button type="button" onClick={clearLineup} style={clearButton}>
            Clear lineup
          </button>
        </div>

        <div style={formationHelp}>{formation.help}</div>

        <div style={rinkWrap}>
          <div style={rinkStage}>
            <div style={rinkSurface}>
            <div style={rinkBoards} />
            <div style={goalLineTop} />
            <div style={goalLineBottom} />
            <div style={middleRedLine} />
            <div style={blueLineTop} />
            <div style={blueLineBottom} />
              <div style={centerCircle} />
              <div style={faceoffTopLeft} />
              <div style={faceoffTopRight} />
              <div style={faceoffBottomLeft} />
              <div style={faceoffBottomRight} />
              <div style={goalCreaseTop} />
              <div style={goalCreaseBottom} />
              <div style={goalFrameTop} />
              <div style={goalFrameBottom} />

              {formation.slots.map((slot) => {
                const selectedPlayer = selectedPlayers[slot.id]
                const team = getPrimaryTeam(selectedPlayer?.teams)
                const detailText =
                  displayMode === 'club'
                    ? team?.name || 'No club'
                    : selectedPlayer?.nationality || 'No country'

                return (
                  <div
                    key={slot.id}
                  style={{
                    ...bubbleWrap,
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                    <button
                      type="button"
                      onClick={() => openSlot(slot.id)}
                      style={selectedPlayer ? playerBubbleButton : emptyBubbleButton}
                    >
                      {selectedPlayer?.image_url ? (
                        <img src={selectedPlayer.image_url} alt={selectedPlayer.name} style={bubbleImage} />
                      ) : (
                        <div style={bubbleFallback}>{selectedPlayer?.name?.slice(0, 1) || '+'}</div>
                      )}
                    </button>

                    <div style={bubbleTextWrap}>
                      <div style={bubbleName}>{selectedPlayer?.display_name || selectedPlayer?.name || slot.label}</div>
                      <div style={bubbleMeta}>
                        {selectedPlayer ? detailText : `${formatSlotTypeLabel(slot.type)} slot`}
                      </div>
                    </div>

                    {selectedPlayer ? (
                      <button type="button" onClick={() => removePlayer(slot.id)} style={removeBubbleButton}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={lineupNameRow}>
          <input
            value={lineupName}
            onChange={(event) => setLineupName(event.target.value)}
            placeholder="Enter lineup name"
            style={lineupNameInput}
          />
        </div>
      </div>

      {activeSlot ? (
        <div style={pickerOverlay} onClick={closePicker}>
          <div style={pickerCard} onClick={(event) => event.stopPropagation()} className="motion-modal-card">
            <div style={pickerHeader}>
              <div>
                <div style={pickerTitle}>Add Player</div>
                <div style={pickerSubtitle}>
                  {activeSlot.label} · {formatSlotTypeLabel(activeSlot.type)}
                </div>
              </div>
              <button type="button" onClick={closePicker} style={pickerClose}>
                Close
              </button>
            </div>

            <div style={pickerBody}>
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search players, clubs, countries"
                style={pickerSearch}
              />

              <div style={pickerList}>
                {isLoading ? (
                  <div style={pickerEmpty}>Loading players...</div>
                ) : filteredPlayers.length ? (
                  filteredPlayers.slice(0, 80).map((player) => {
                    const isCompatible = isPlayerCompatible(player, activeSlot.type)
                    const team = getPrimaryTeam(player.teams)

                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => assignPlayer(player)}
                        style={isCompatible ? pickerItem : pickerItemMuted}
                      >
                        <div style={pickerPlayerMain}>
                          <div style={pickerThumb}>
                            {player.image_url ? (
                              <img src={player.image_url} alt={player.name} style={pickerThumbImage} />
                            ) : (
                              <span style={pickerThumbFallback}>{player.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div style={pickerCopy}>
                            <div style={pickerPlayerName}>{player.display_name || player.name}</div>
                            <div style={pickerPlayerMeta}>
                              {[player.position, team?.name || player.nationality].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div style={isCompatible ? pickerFitBadge : pickerFitBadgeMuted}>
                          {isCompatible ? 'Fits' : 'Any'}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div style={pickerEmpty}>No players found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const pageWrap: React.CSSProperties = {
  width: 'min(1320px, calc(100vw - 28px))',
  margin: '0 auto',
  padding: '24px 0 42px',
}

const builderShell: React.CSSProperties = {
  border: '1px solid rgba(30, 42, 53, 0.14)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, #1d1f22, #131517)',
  padding: 0,
  boxShadow: '0 28px 60px rgba(8, 15, 22, 0.24)',
  overflow: 'hidden',
}

const builderHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '22px 24px 18px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const builderTitle: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: '-0.03em',
}

const builderSubtitle: React.CSSProperties = {
  color: '#95a8b7',
  fontSize: 14,
  lineHeight: 1.5,
  marginTop: 6,
}

const builderBadge: React.CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(90, 220, 109, 0.34)',
  background: 'rgba(47, 168, 82, 0.14)',
  color: '#82e395',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.06em',
  padding: '10px 12px',
  textTransform: 'uppercase',
}

const controlBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  padding: '18px 24px 14px',
}

const controlRowLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const formationSelectWrap: React.CSSProperties = {
  position: 'relative',
}

const formationSelect: React.CSSProperties = {
  height: 40,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 999,
  background: '#25272a',
  color: '#f4fbff',
  fontSize: 14,
  fontWeight: 800,
  padding: '0 16px',
}

const toggleButton: React.CSSProperties = {
  height: 38,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 999,
  background: '#313336',
  color: '#f5fbff',
  fontSize: 14,
  fontWeight: 800,
  padding: '0 18px',
}

const toggleButtonActive: React.CSSProperties = {
  ...toggleButton,
  background: '#ffffff',
  color: '#173349',
  boxShadow: '0 10px 18px rgba(0,0,0,0.18)',
}

const clearButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#5ee179',
  fontSize: 15,
  fontWeight: 800,
  padding: 0,
}

const formationHelp: React.CSSProperties = {
  color: '#95a8b7',
  fontSize: 13,
  padding: '0 24px 10px',
}

const rinkWrap: React.CSSProperties = {
  padding: '0 24px 24px',
}

const rinkStage: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '8px 0 6px',
}

const rinkSurface: React.CSSProperties = {
  position: 'relative',
  width: 'min(100%, 560px)',
  height: 820,
  borderRadius: 30,
  background:
    'radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 30%), linear-gradient(180deg, #323437, #25272a)',
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.18)',
}

const rinkBoards: React.CSSProperties = {
  position: 'absolute',
  inset: '4.5% 18% 4.5%',
  border: '4px solid rgba(255,255,255,0.085)',
  borderRadius: 30,
}

const goalLineTop: React.CSSProperties = {
  position: 'absolute',
  left: '20.8%',
  right: '20.8%',
  top: '10.8%',
  height: 2,
  background: 'rgba(214, 44, 58, 0.52)',
}

const goalLineBottom: React.CSSProperties = {
  ...goalLineTop,
  top: '89.8%',
}

const middleRedLine: React.CSSProperties = {
  position: 'absolute',
  left: '20.8%',
  right: '20.8%',
  top: '50%',
  height: 2,
  transform: 'translateY(-50%)',
  background: 'rgba(214, 44, 58, 0.6)',
}

const blueLineTop: React.CSSProperties = {
  position: 'absolute',
  left: '20.8%',
  right: '20.8%',
  top: '35%',
  height: 2,
  background: 'rgba(73, 145, 227, 0.65)',
}

const blueLineBottom: React.CSSProperties = {
  ...blueLineTop,
  top: '65%',
}

const centerCircle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 96,
  height: 96,
  border: '2px solid rgba(255,255,255,0.08)',
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)',
}

const faceoffTopLeft: React.CSSProperties = {
  position: 'absolute',
  left: '33%',
  top: '18.8%',
  width: 56,
  height: 56,
  border: '1.5px solid rgba(255,255,255,0.07)',
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)',
}

const faceoffTopRight: React.CSSProperties = {
  ...faceoffTopLeft,
  left: '67.5%',
}

const faceoffBottomLeft: React.CSSProperties = {
  ...faceoffTopLeft,
  top: '81.6%',
}

const faceoffBottomRight: React.CSSProperties = {
  ...faceoffTopRight,
  top: '81.6%',
}

const goalCreaseTop: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '11.2%',
  width: 46,
  height: 26,
  border: '2px solid rgba(73, 145, 227, 0.7)',
  borderBottomLeftRadius: 28,
  borderBottomRightRadius: 28,
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  transform: 'translateX(-50%)',
  zIndex: 2,
}

const goalCreaseBottom: React.CSSProperties = {
  ...goalCreaseTop,
  top: 'auto',
  bottom: '11.2%',
  borderBottomLeftRadius: 12,
  borderBottomRightRadius: 12,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
}

const goalFrameTop: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '9.1%',
  width: 18,
  height: 12,
  border: '1.5px solid rgba(214, 44, 58, 0.7)',
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  borderBottomLeftRadius: 10,
  borderBottomRightRadius: 10,
  transform: 'translateX(-50%)',
  zIndex: 1,
}

const goalFrameBottom: React.CSSProperties = {
  ...goalFrameTop,
  top: 'auto',
  bottom: '9.1%',
  transform: 'translateX(-50%)',
}

const bubbleWrap: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 7,
  width: 116,
  zIndex: 2,
}

const emptyBubbleButton: React.CSSProperties = {
  width: 66,
  height: 66,
  border: '2px dashed rgba(255,255,255,0.22)',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

const playerBubbleButton: React.CSSProperties = {
  ...emptyBubbleButton,
  border: '2px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.08)',
}

const bubbleImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '50%',
}

const bubbleFallback: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 22,
  fontWeight: 800,
}

const bubbleTextWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  textAlign: 'center',
}

const bubbleName: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.15,
}

const bubbleMeta: React.CSSProperties = {
  color: '#9eb0bd',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.3,
}

const removeBubbleButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#6be883',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: 0,
}

const lineupNameRow: React.CSSProperties = {
  padding: '0 24px 24px',
  display: 'flex',
  justifyContent: 'center',
}

const lineupNameInput: React.CSSProperties = {
  width: 'min(100%, 420px)',
  height: 46,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 999,
  background: '#2a2c2f',
  color: '#f5fbff',
  fontSize: 14,
  textAlign: 'center',
  padding: '0 18px',
}

const pickerOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 14, 22, 0.6)',
  zIndex: 1200,
  display: 'flex',
  justifyContent: 'flex-end',
}

const pickerCard: React.CSSProperties = {
  width: 'min(460px, 100vw)',
  height: '100vh',
  background: 'linear-gradient(180deg, #10161c, #151c22)',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '-18px 0 42px rgba(0,0,0,0.24)',
  display: 'flex',
  flexDirection: 'column',
}

const pickerHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '20px 20px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const pickerTitle: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 22,
  fontWeight: 800,
}

const pickerSubtitle: React.CSSProperties = {
  color: '#8ea3b2',
  fontSize: 13,
  marginTop: 4,
}

const pickerClose: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 999,
  background: 'transparent',
  color: '#f5fbff',
  fontSize: 13,
  fontWeight: 800,
  padding: '9px 14px',
}

const pickerBody: React.CSSProperties = {
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minHeight: 0,
  flex: 1,
}

const pickerSearch: React.CSSProperties = {
  height: 44,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  background: '#1d262d',
  color: '#f5fbff',
  fontSize: 14,
  padding: '0 14px',
}

const pickerList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflowY: 'auto',
  minHeight: 0,
}

const pickerItem: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  background: '#1b232b',
  color: '#f5fbff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: 12,
  textAlign: 'left',
}

const pickerItemMuted: React.CSSProperties = {
  ...pickerItem,
  background: '#171d23',
  opacity: 0.86,
}

const pickerPlayerMain: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
}

const pickerThumb: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  overflow: 'hidden',
  background: '#31414d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const pickerThumbImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const pickerThumbFallback: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 18,
  fontWeight: 800,
}

const pickerCopy: React.CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const pickerPlayerName: React.CSSProperties = {
  color: '#f5fbff',
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.2,
}

const pickerPlayerMeta: React.CSSProperties = {
  color: '#92a6b5',
  fontSize: 12,
  lineHeight: 1.35,
}

const pickerFitBadge: React.CSSProperties = {
  borderRadius: 999,
  background: 'rgba(47, 168, 82, 0.16)',
  color: '#86e59b',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  padding: '7px 10px',
  flexShrink: 0,
}

const pickerFitBadgeMuted: React.CSSProperties = {
  ...pickerFitBadge,
  background: 'rgba(255,255,255,0.08)',
  color: '#b2c3ce',
}

const pickerEmpty: React.CSSProperties = {
  border: '1px dashed rgba(255,255,255,0.12)',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.03)',
  color: '#90a4b3',
  padding: '18px 16px',
  textAlign: 'center',
  fontSize: 14,
  fontWeight: 700,
}
