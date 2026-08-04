'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import HUD from '@/components/HUD'
import Compass from '@/components/Compass'
import VirtualJoystick from '@/components/VirtualJoystick'
import LevelSelect from '@/components/LevelSelect'
import { GameLevel, GameRef } from '@/game/types'
import { fetchTemplateLevel } from '@/game/levels/levelLoader'
import { saveRecentLevelId, loadRecentLevelId, loadCustomLevel, loadLockedTemplateLevel } from '@/lib/storage'

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
})

interface MissionInfo {
  nodeName: string
  purpose: string
  nodeId: string
  district?: string
}

export default function HomePage() {
  const [mission, setMission] = useState<MissionInfo | null>(null)
  const [completedCount, setCompletedCount] = useState(0)
  const joystickRef = useRef<{ setInput: (dx: number, dy: number) => void } | null>(null)
  const gameRef = useRef<GameRef | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<GameLevel | null>(null)
  const [levelData, setLevelData] = useState<GameLevel | undefined>(undefined)
  const [showLevelSelect, setShowLevelSelect] = useState(true)

  function prepareLevel(level: GameLevel): GameLevel {
    const { missionOrder, ...levelWithoutOrder } = level
    return levelWithoutOrder as GameLevel
  }

  useEffect(() => {
    const recentId = loadRecentLevelId()
    if (recentId) {
      if (recentId === 'level_1' || recentId === 'level_2' || recentId === 'level_3') {
        const lockedTemplate = loadLockedTemplateLevel(recentId)
        if (lockedTemplate) {
          const prepped = prepareLevel(lockedTemplate)
          setSelectedLevel(prepped)
          setLevelData(prepped)
          setShowLevelSelect(false)
        } else {
          fetchAndStartLevel(recentId).catch(() => setShowLevelSelect(true))
        }
      } else {
        const custom = loadCustomLevel(recentId)
        if (custom) {
          const prepped = prepareLevel(custom)
          setSelectedLevel(prepped)
          setLevelData(prepped)
          setShowLevelSelect(false)
        } else {
          setShowLevelSelect(true)
        }
      }
    }
  }, [])

  async function fetchAndStartLevel(levelId: string): Promise<void> {
    const isTemplate = levelId === 'level_1' || levelId === 'level_2' || levelId === 'level_3'
    const lockedTemplate = isTemplate ? loadLockedTemplateLevel(levelId) : null
    const custom = isTemplate ? null : loadCustomLevel(levelId)
    const level = lockedTemplate || custom || await fetchTemplateLevel(levelId)
    const prepped = prepareLevel(level)
    setSelectedLevel(prepped)
    setLevelData(prepped)
    setShowLevelSelect(false)
    saveRecentLevelId(levelId)
  }

  function handleSelectLevel(level: GameLevel | null, isTemplate: boolean): void {
    if (!level) return
    if (isTemplate) {
      saveRecentLevelId(level.id)
      fetchAndStartLevel(level.id)
    } else {
      const prepped = prepareLevel(level)
      setSelectedLevel(prepped)
      setLevelData(prepped)
      setShowLevelSelect(false)
      saveRecentLevelId(level.id)
    }
  }

  function handleBackToMenu(): void {
    setShowLevelSelect(true)
    setLevelData(undefined)
    setSelectedLevel(null)
    setMission(null)
    setCompletedCount(0)
  }

  const handleMissionUpdate = useCallback((m: MissionInfo | null) => {
    setMission(m)
  }, [])

  const handleMissionComplete = useCallback((count: number) => {
    setCompletedCount(count)
  }, [])

  if (showLevelSelect) {
    return (
      <main className="w-full h-full">
        <LevelSelect onSelectLevel={handleSelectLevel} />
      </main>
    )
  }

  return (
    <main className="w-full h-full relative">
      <GameCanvas
        mode="game"
        levelData={levelData}
        onMissionUpdate={handleMissionUpdate}
        onMissionComplete={handleMissionComplete}
        joystickRef={joystickRef}
        gameRef={gameRef}
      />
      <HUD
        mission={mission}
        completedCount={completedCount}
        onMenu={handleBackToMenu}
      />
      <Compass />
      <VirtualJoystick
        onInput={(dx, dy) => {
          joystickRef.current?.setInput(dx, dy)
        }}
      />
    </main>
  )
}