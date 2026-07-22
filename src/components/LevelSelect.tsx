'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GameLevel } from '@/game/types'
import { loadCustomLevels, deleteCustomLevel, createEmptyCustomLevel, saveCustomLevel } from '@/lib/storage'
import { deleteMapFromSheet } from '@/lib/appscript'
import { TEMPLATE_LEVEL_IDS } from '@/game/levels/levelLoader'

interface LevelSelectProps {
  onSelectLevel: (level: GameLevel | null, skipMenu: boolean) => void
}

const TEMPLATE_LABELS: Record<string, string> = {
  level_1: 'Level 1 – Downtown City Services',
  level_2: 'Level 2 – Tourism Island City',
  level_3: 'Level 3 – Mountain Temple Complex',
}

export default function LevelSelect({ onSelectLevel }: LevelSelectProps) {
  const router = useRouter()
  const [customLevels, setCustomLevels] = useState<GameLevel[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    refreshCustomLevels()
  }, [])

  useEffect(() => {
    if (errorMessage) {
      const id = setTimeout(() => setErrorMessage(null), 5000)
      return () => clearTimeout(id)
    }
  }, [errorMessage])

  function refreshCustomLevels(): void {
    const levels = loadCustomLevels()
    setCustomLevels(Object.values(levels))
  }

  function handleTemplateClick(levelId: string): void {
    onSelectLevel({ id: levelId, name: '', kind: 'template', baseMapId: '', background: '', mapWidth: 2400, mapHeight: 1600, spawn: { x: 0, y: 0 }, nodes: [] }, true)
  }

  function handleCustomClick(level: GameLevel): void {
    onSelectLevel(level, false)
  }

  async function handleDeleteCustom(levelId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    const result = deleteCustomLevel(levelId)
    if (!result.success) {
      setErrorMessage(result.error)
    } else {
      // Also delete from Google Sheet if linked
      await deleteMapFromSheet(levelId)
    }
    refreshCustomLevels()
  }

  function handleCreateCustom(): void {
    if (!newName.trim()) return
    const level = createEmptyCustomLevel(newName.trim())
    const result = saveCustomLevel(level)
    if (!result.success) {
      setErrorMessage(result.error)
      return
    }
    setNewName('')
    setShowCreate(false)
    refreshCustomLevels()
    onSelectLevel(level, false)
  }

  function handleEditCustom(level: GameLevel, e: React.MouseEvent): void {
    e.stopPropagation()
    router.push(`/editor?levelId=${encodeURIComponent(level.id)}`)
  }

  function handleEditTemplate(levelId: string, e: React.MouseEvent): void {
    e.stopPropagation()
    router.push(`/editor?levelId=${encodeURIComponent(levelId)}`)
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] p-4">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-4xl font-bold text-white text-center">CITY MISSION</h1>

        {errorMessage && (
          <div className="px-3 py-2 bg-red-900/80 text-red-200 text-sm rounded">
            {errorMessage}
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-300">Template Levels</h2>
          {TEMPLATE_LEVEL_IDS.map((id) => (
            <div key={id} className="flex items-center gap-2">
              <button
                onClick={() => handleTemplateClick(id)}
                className="flex-1 px-4 py-3 bg-green-700 hover:bg-green-600 rounded-lg text-white text-left font-medium transition-colors"
              >
                {TEMPLATE_LABELS[id] || id}
              </button>
              <button
                onClick={(e) => handleEditTemplate(id, e)}
                className="px-3 py-2 bg-yellow-700/60 hover:bg-yellow-700 rounded text-white text-xs"
                title="Clone & Edit"
              >
                Edit
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-300">Custom Levels</h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
            >
              + New
            </button>
          </div>

          {showCreate && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCustom()}
                placeholder="Level name..."
                className="flex-1 px-3 py-1.5 bg-gray-800 rounded text-white text-sm placeholder-gray-500"
                autoFocus
              />
              <button
                onClick={handleCreateCustom}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-white text-sm"
              >
                Create
              </button>
            </div>
          )}

          {customLevels.length === 0 && !showCreate && (
            <p className="text-gray-500 text-sm">No custom levels yet. Create one!</p>
          )}

          {customLevels.map((level) => (
            <div
              key={level.id}
              className="flex items-center gap-2"
            >
              <button
                onClick={() => handleCustomClick(level)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-left text-sm transition-colors"
              >
                <span>{level.name}</span>
                <span className="text-gray-500 ml-2">
                  ({level.nodes.length} nodes)
                </span>
              </button>
              <button
                onClick={(e) => handleEditCustom(level, e)}
                className="px-3 py-2 bg-yellow-700/60 hover:bg-yellow-700 rounded text-white text-xs"
                title="Edit"
              >
                Edit
              </button>
              <button
                onClick={(e) => handleDeleteCustom(level.id, e)}
                className="px-3 py-2 bg-red-700/60 hover:bg-red-700 rounded text-white text-xs"
                title="Delete"
              >
                Del
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
