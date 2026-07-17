'use client'

import { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import EditorPanel from '@/components/EditorPanel'
import { GameMap, GameLevel, GameRef } from '@/game/types'
import { saveMap, saveCustomLevel, loadCustomLevel, loadLockedTemplateLevel, saveLockedTemplateLevel, deleteLockedTemplateLevel } from '@/lib/storage'
import { fetchTemplateLevel, TEMPLATE_LEVEL_IDS } from '@/game/levels/levelLoader'

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
})

function EditorPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const levelId = searchParams.get('levelId')

  const gameRef = useRef<GameRef | null>(null)
  const [selectedNode, setSelectedNode] = useState<GameMap['nodes'][0] | undefined>(undefined)
  const [customLevelId, setCustomLevelId] = useState<string | null>(levelId)
  const [levelData, setLevelData] = useState<GameLevel | undefined>(undefined)
  const [missionOrder, setMissionOrder] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!levelId)
  const [isTemplateLevel, setIsTemplateLevel] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    if (!levelId) {
      setLoading(false)
      return
    }
    setLoading(true)
    if (TEMPLATE_LEVEL_IDS.includes(levelId)) {
      const lockedTemplate = loadLockedTemplateLevel(levelId)
      if (lockedTemplate) {
        setLevelData(lockedTemplate)
        setMissionOrder(lockedTemplate.missionOrder || [])
        setCustomLevelId(null)
        setIsTemplateLevel(true)
        setIsLocked(true)
        setLoading(false)
      } else {
        fetchTemplateLevel(levelId).then((template) => {
          setLevelData(template)
          setMissionOrder(template.missionOrder || [])
          setCustomLevelId(null)
          setIsTemplateLevel(true)
          setIsLocked(false)
          setLoading(false)
        }).catch(() => {
          setSaveError('Failed to load template level.')
          setLoading(false)
        })
      }
    } else {
      const custom = loadCustomLevel(levelId)
      if (custom) {
        setLevelData(custom)
        setMissionOrder(custom.missionOrder || [])
        setCustomLevelId(levelId)
        setIsTemplateLevel(false)
        setIsLocked(!!custom.locked)
        setLoading(false)
      } else {
        setSaveError('Level not found.')
        setLoading(false)
      }
    }
  }, [levelId])

  useEffect(() => {
    if (saveError) {
      const id = setTimeout(() => setSaveError(null), 6000)
      return () => clearTimeout(id)
    }
  }, [saveError])

  const handleNodeSelect = useCallback((node: GameMap['nodes'][0] | undefined) => {
    setSelectedNode(node)
  }, [])

  const handleMissionOrderChange = useCallback((order: string[]) => {
    if (isLocked || isTemplateLevel) return
    setMissionOrder(order)
    if (customLevelId && levelData) {
      const updated: GameLevel = {
        ...levelData,
        missionOrder: order,
        kind: 'custom',
        updatedAt: new Date().toISOString(),
      }
      const result = saveCustomLevel(updated)
      if (result.success) {
        setLevelData(updated)
        setSaveError(null)
      } else {
        setSaveError(result.error)
        setLevelData(updated)
      }
    }
  }, [customLevelId, levelData, isLocked, isTemplateLevel])

  const handleImportedMissionOrder = useCallback((order: string[]) => {
    if (isLocked) return
    setMissionOrder(order)
    if (!isTemplateLevel && customLevelId && levelData) {
      const updated: GameLevel = {
        ...levelData,
        missionOrder: order,
        kind: 'custom',
        updatedAt: new Date().toISOString(),
      }
      const result = saveCustomLevel(updated)
      if (result.success) {
        setLevelData(updated)
        setSaveError(null)
      } else {
        setSaveError(result.error)
        setLevelData(updated)
      }
    }
  }, [customLevelId, levelData, isLocked, isTemplateLevel])

  const handleMapUpdate = useCallback((map: GameMap) => {
    if (isLocked) return
    if (isTemplateLevel && levelData) {
      setLevelData({
        ...levelData,
        nodes: map.nodes,
        name: map.name,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    if (customLevelId && levelData) {
      const updated: GameLevel = {
        ...levelData,
        nodes: map.nodes,
        name: map.name,
        kind: 'custom',
        updatedAt: new Date().toISOString(),
      }
      const result = saveCustomLevel(updated)
      if (result.success) {
        setLevelData(updated)
        setSaveError(null)
      } else {
        setSaveError(result.error)
        setLevelData(updated)
      }
    } else {
      const result = saveMap(map)
      if (!result.success) {
        setSaveError(result.error)
      }
    }
  }, [customLevelId, levelData, isLocked, isTemplateLevel])

  const handleSaveAndLockTemplate = useCallback(() => {
    if (!levelData || !isTemplateLevel || isLocked) return
    const map = gameRef.current?.getMapData()
    const updated: GameLevel = {
      ...levelData,
      nodes: map?.nodes || levelData.nodes,
      missionOrder,
      locked: true,
      templateOverride: true,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const result = saveLockedTemplateLevel(updated)
    if (result.success) {
      setLevelData(updated)
      setIsLocked(true)
      setSaveError(null)
    } else {
      setSaveError(result.error)
    }
  }, [levelData, isTemplateLevel, isLocked, missionOrder])

  const handleUnlockTemplate = useCallback(async () => {
    if (!levelData || !isTemplateLevel || !isLocked) return
    const result = deleteLockedTemplateLevel(levelData.id)
    if (!result.success) {
      setSaveError(result.error)
      return
    }

    try {
      const template = await fetchTemplateLevel(levelData.id)
      setLevelData(template)
      setMissionOrder(template.missionOrder || [])
      setIsLocked(false)
      setSaveError(null)
    } catch {
      setSaveError('Template unlocked, but failed to reload editable template.')
      setIsLocked(false)
    }
  }, [levelData, isTemplateLevel, isLocked])

  return (
    <main className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/90 flex-shrink-0 z-30">
        <button
          onClick={() => router.push('/')}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
        >
          ← Back
        </button>
        <span className="text-gray-300 text-sm truncate">
          {levelData?.name || 'Editor'}
        </span>
      </div>
      {saveError && (
        <div className="px-4 py-2 bg-red-900/80 text-red-200 text-sm flex-shrink-0">
          ⚠ Save failed: {saveError}
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading level...
        </div>
      ) : (
        <div className="flex-1 h-full min-h-0 flex">
          <div className="flex-1 h-full min-w-0" style={{ background: '#1a1a2e' }}>
            <GameCanvas
              key={`editor-${levelData?.id}-${levelData?.background}-${isLocked ? 'locked' : 'editable'}`}
              mode="editor"
              onNodeSelect={handleNodeSelect}
              onMapChange={handleMapUpdate}
              gameRef={gameRef}
              levelData={levelData}
              editorReadOnly={isLocked}
              editorPlacementOnly={isTemplateLevel}
            />
          </div>
          <EditorPanel
            selectedNode={selectedNode}
            gameRef={gameRef}
            onMapUpdate={handleMapUpdate}
            customLevelId={customLevelId}
            levelData={levelData}
            missionOrder={missionOrder}
            onMissionOrderChange={handleMissionOrderChange}
            onImportedMissionOrder={handleImportedMissionOrder}
            isTemplateLevel={isTemplateLevel}
            isLocked={isLocked}
            onSaveAndLockTemplate={handleSaveAndLockTemplate}
            onUnlockTemplate={handleUnlockTemplate}
          />
        </div>
      )}
    </main>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center text-white">Loading editor...</div>}>
      <EditorPageInner />
    </Suspense>
  )
}
