import { GameMap, GameLevel, MapNode } from '@/game/types'
import { normalizeLevel, TEMPLATE_LEVEL_IDS } from '@/game/levels/levelLoader'

const STORAGE_KEY = 'city_mission_save'
const CUSTOM_LEVELS_KEY = 'custom_levels'
const LEVEL_META_KEY = 'level_meta'
const TEMPLATE_OVERRIDES_KEY = 'template_level_overrides'

export type StorageResult = { success: true } | { success: false; error: string }

export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return 'Storage is full. Please delete unused custom levels or reduce background image size.'
    }
    return `Storage error: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown storage error'
}

export function safeSetLocalStorage(key: string, value: string): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  try {
    localStorage.setItem(key, value)
    return { success: true }
  } catch (error) {
    return { success: false, error: getStorageErrorMessage(error) }
  }
}

export function saveMap(map: GameMap): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  try {
    const json = JSON.stringify(map)
    return safeSetLocalStorage(STORAGE_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to serialize map: ${getStorageErrorMessage(error)}` }
  }
}

export function loadMap(): GameMap | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as GameMap
  } catch {
    return null
  }
}

export function saveCompletedCount(count: number): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  const value = String(count)
  return safeSetLocalStorage('city_mission_count', value)
}

export function loadCompletedCount(): number {
  if (typeof window === 'undefined') return 0
  return Number(localStorage.getItem('city_mission_count') || '0')
}

export function clearSave(): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('city_mission_count')
    return { success: true }
  } catch (error) {
    return { success: false, error: getStorageErrorMessage(error) }
  }
}

export function saveCustomLevel(level: GameLevel): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }

  const customLevels = loadCustomLevels()

  const cleaned: GameLevel = {
    ...level,
    kind: 'custom',
    baseMap: undefined,
    updatedAt: new Date().toISOString(),
    createdAt: level.createdAt || new Date().toISOString(),
  }

  customLevels[level.id] = cleaned

  try {
    const json = JSON.stringify(customLevels)
    return safeSetLocalStorage(CUSTOM_LEVELS_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to serialize custom level: ${getStorageErrorMessage(error)}` }
  }
}

export function loadCustomLevels(): Record<string, GameLevel> {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(CUSTOM_LEVELS_KEY)
  if (!data) return {}
  try {
    const parsed = JSON.parse(data) as Record<string, GameLevel>
    for (const key of Object.keys(parsed)) {
      parsed[key] = normalizeLevel(parsed[key])
    }
    return parsed
  } catch {
    return {}
  }
}

export function loadCustomLevel(levelId: string): GameLevel | null {
  const levels = loadCustomLevels()
  return levels[levelId] || null
}

export function saveLockedTemplateLevel(level: GameLevel): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }

  const overrides = loadLockedTemplateLevels()
  const now = new Date().toISOString()
  const lockedLevel: GameLevel = {
    ...level,
    kind: 'template',
    baseMap: undefined,
    locked: true,
    lockedAt: level.lockedAt || now,
    templateOverride: true,
    updatedAt: now,
  }

  overrides[level.id] = lockedLevel

  try {
    const json = JSON.stringify(overrides)
    return safeSetLocalStorage(TEMPLATE_OVERRIDES_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to save locked template: ${getStorageErrorMessage(error)}` }
  }
}

export function loadLockedTemplateLevels(): Record<string, GameLevel> {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(TEMPLATE_OVERRIDES_KEY)
  if (!data) return {}
  try {
    const parsed = JSON.parse(data) as Record<string, GameLevel>
    for (const key of Object.keys(parsed)) {
      parsed[key] = normalizeLevel(parsed[key])
    }
    return parsed
  } catch {
    return {}
  }
}

export function loadLockedTemplateLevel(levelId: string): GameLevel | null {
  const levels = loadLockedTemplateLevels()
  return levels[levelId] || null
}

export function deleteLockedTemplateLevel(levelId: string): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  const overrides = loadLockedTemplateLevels()
  delete overrides[levelId]
  try {
    const json = JSON.stringify(overrides)
    return safeSetLocalStorage(TEMPLATE_OVERRIDES_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to unlock template: ${getStorageErrorMessage(error)}` }
  }
}

export function deleteCustomLevel(levelId: string): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  const customLevels = loadCustomLevels()
  delete customLevels[levelId]
  try {
    const json = JSON.stringify(customLevels)
    return safeSetLocalStorage(CUSTOM_LEVELS_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to delete custom level: ${getStorageErrorMessage(error)}` }
  }
}

export function saveRecentLevelId(levelId: string): StorageResult {
  if (typeof window === 'undefined') return { success: false, error: 'Storage not available (server-side)' }
  try {
    const json = JSON.stringify({ recentLevelId: levelId })
    return safeSetLocalStorage(LEVEL_META_KEY, json)
  } catch (error) {
    return { success: false, error: `Failed to save recent level: ${getStorageErrorMessage(error)}` }
  }
}

export function loadRecentLevelId(): string | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(LEVEL_META_KEY)
  if (!data) return null
  try {
    const meta = JSON.parse(data)
    return meta.recentLevelId || null
  } catch {
    return null
  }
}

export function generateLevelId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyCustomLevel(name: string, mapWidth: number = 2400, mapHeight: number = 1600, background: string = '/maps/maps.png'): GameLevel {
  const id = generateLevelId()
  return {
    id,
    name,
    kind: 'custom',
    baseMapId: '',
    background,
    mapWidth,
    mapHeight,
    spawn: { x: mapWidth / 2, y: mapHeight / 2 },
    nodes: [
      {
        id: 'spawn',
        name: 'Home',
        type: 'residential',
        purpose: 'spawn',
        x: 50,
        y: 50,
        radius: 3,
        district: 'CENTER',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
