// src/components/EditorPanel.tsx

'use client'

import { useState, useEffect } from 'react'
import { GameMap, MapNode, GameLevel, GameRef } from '@/game/types'
import { saveCustomLevel } from '@/lib/storage'
import { saveMapToSheet } from '@/lib/appscript'

const MAX_BG_UPLOAD_BYTES = 1 * 1024 * 1024

const NODE_TYPES = [
  'residential', 'restaurant', 'supermarket', 'office', 'park',
  'hospital', 'school', 'cafe', 'gym', 'beauty', 'barber',
  'entertainment', 'police', 'bank', 'church', 'library',
  'military', 'parking', 'butcher', 'service', 'auto', 'social',
]

interface EditorPanelProps {
  selectedNode: MapNode | undefined
  gameRef: React.MutableRefObject<GameRef | null>
  onMapUpdate: (map: GameMap) => void
  customLevelId?: string | null
  levelData?: GameLevel
  missionOrder: string[]
  onMissionOrderChange: (order: string[]) => void
  onImportedMissionOrder?: (order: string[]) => void
  isTemplateLevel?: boolean
  isLocked?: boolean
  onSaveAndLockTemplate?: () => void
  onUnlockTemplate?: () => void
}

export default function EditorPanel({
  selectedNode,
  gameRef,
  onMapUpdate,
  customLevelId,
  levelData,
  missionOrder,
  onMissionOrderChange,
  onImportedMissionOrder,
  isTemplateLevel = false,
  isLocked = false,
  onSaveAndLockTemplate,
  onUnlockTemplate,
}: EditorPanelProps) {
  const [editForm, setEditForm] = useState<MapNode | null>(null)
  const [notice, setNotice] = useState('')
  const [nodeList, setNodeList] = useState<MapNode[]>(levelData?.nodes || [])
  const [levelName, setLevelName] = useState(levelData?.name || '')
  const [bgUrl, setBgUrl] = useState(levelData?.background || '/maps/maps.png')
  const [showAddMission, setShowAddMission] = useState(false)
  const [savingToSheet, setSavingToSheet] = useState(false)

  useEffect(() => {
    if (selectedNode) {
      setEditForm({ ...selectedNode })
    }
    refreshNodeList()
  }, [selectedNode])

  useEffect(() => {
    const id = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    if (levelData) {
      setLevelName(levelData.name)
      setBgUrl(levelData.background)
      setNodeList(levelData.nodes || [])   // ✅ fallback
    }
  }, [levelData])

  // Inside refreshNodeList
  function refreshNodeList(): void {
    const map = gameRef.current?.getMapData()
    if (map) setNodeList(map.nodes || [])   // ✅ fallback
  }

  function handleMoveMissionUp(index: number): void {
    if (isLocked) return
    if (index <= 0) return
    const next = [...missionOrder]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onMissionOrderChange(next)
  }

  function handleMoveMissionDown(index: number): void {
    if (isLocked) return
    if (index >= missionOrder.length - 1) return
    const next = [...missionOrder]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onMissionOrderChange(next)
  }

  function handleRemoveMission(index: number): void {
    if (isLocked) return
    const next = missionOrder.filter((_, i) => i !== index)
    onMissionOrderChange(next)
  }

  function handleAddMission(nodeId: string): void {
    if (isLocked) return
    const next = [...missionOrder, nodeId]
    onMissionOrderChange(next)
    setShowAddMission(false)
  }

  const missionNodeMap = new Map(nodeList.map((n) => [n.id, n]))
  const orderedNodes = missionOrder.map((id) => missionNodeMap.get(id)).filter(Boolean) as MapNode[]
  const availableForMission = nodeList.filter(
    (n) => n.purpose !== 'spawn' && !missionOrder.includes(n.id),
  )

  function handleEditSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (isLocked) return
    if (!editForm) return
    const updates = isTemplateLevel
      ? {
          name: editForm.name,
          x: Number(editForm.x),
          y: Number(editForm.y),
        }
      : {
          name: editForm.name,
          type: editForm.type,
          purpose: editForm.purpose,
          radius: Number(editForm.radius),
          district: editForm.district || undefined,
          x: Number(editForm.x),
          y: Number(editForm.y),
        }
    gameRef.current?.editNode(editForm.id, updates)
    const map = gameRef.current?.getMapData()
    if (map) onMapUpdate(map)
    setNotice('Node updated!')
    refreshNodeList()
  }

  function handleDelete(): void {
    if (isLocked) return
    if (!selectedNode) return
    gameRef.current?.deleteNode(selectedNode.id)
    const map = gameRef.current?.getMapData()
    if (map) onMapUpdate(map)
    setNotice('Node deleted!')
    refreshNodeList()
  }

  function handleExport(): void {
    const map = gameRef.current?.exportMap()
    if (!map) return

    const exportData = levelData
      ? { level: levelData, map }
      : { map }

    const json = JSON.stringify(exportData, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setNotice('Map copied to clipboard!')
    })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = levelData ? `${levelData.name.replace(/\s+/g, '_').toLowerCase()}.json` : 'map.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSaveToSheet(): Promise<void> {
    const map = gameRef.current?.exportMap()
    if (!map) return

    setSavingToSheet(true)
    const result = await saveMapToSheet(map)
    setSavingToSheet(false)
    setNotice(result.success ? 'Map saved to Google Sheet!' : `Sheet save failed: ${result.error}`)
  }

  function handleImport(): void {
    if (isLocked) {
      setNotice('Template is locked.')
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)

        let map: GameMap
        if (data.map && data.level) {
          const rawMap = data.map
          const rawLevel = data.level

          map = {
            id: rawMap.id || rawLevel.id || 'imported_map',
            name: rawMap.name || rawLevel.name || 'Imported Map',
            width: rawMap.width || rawMap.mapWidth || rawLevel.mapWidth || 2400,
            height: rawMap.height || rawMap.mapHeight || rawLevel.mapHeight || 1600,
            background: rawMap.background || rawLevel.background || '/maps/maps.png',
            nodes: rawMap.nodes || rawLevel.nodes || [],
          }

          if (customLevelId) {
            const updated: GameLevel = {
              id: customLevelId,
              name: rawLevel.name || rawMap.name || 'Imported Level',
              kind: 'custom',
              baseMapId: rawLevel.baseMapId || '',
              background: rawMap.background || rawLevel.background || '/maps/maps.png',
              mapWidth: rawMap.width || rawMap.mapWidth || rawLevel.mapWidth || 2400,
              mapHeight: rawMap.height || rawMap.mapHeight || rawLevel.mapHeight || 1600,
              spawn: rawLevel.spawn || { x: 50, y: 50 },
              nodes: rawMap.nodes || rawLevel.nodes || [],
              roads: rawLevel.roads,
              createdAt: rawLevel.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            const result = saveCustomLevel(updated)
            if (result.success) {
              setLevelName(updated.name)
              setBgUrl(updated.background)
            } else {
              setNotice(`Save failed: ${result.error}`)
            }
          }
          if (Array.isArray(rawLevel.missionOrder)) {
            onImportedMissionOrder?.(rawLevel.missionOrder)
          }
        } else if (data.nodes) {
          map = data as GameMap
        } else if (data.id && data.nodes) {
          map = {
            id: data.id,
            name: data.name || 'Imported Map',
            width: data.width || data.mapWidth || 2400,
            height: data.height || data.mapHeight || 1600,
            background: data.background || '/maps/maps.png',
            nodes: data.nodes,
          }
          if (Array.isArray(data.missionOrder)) {
            onImportedMissionOrder?.(data.missionOrder)
          }
        } else {
          setNotice('Invalid format! Expected map or level JSON.')
          return
        }

        gameRef.current?.importMap(map)
        if (onMapUpdate) onMapUpdate(map)
        setNotice('Map imported!')
        refreshNodeList()
      } catch {
        setNotice('Invalid JSON!')
      }
    }
    input.click()
  }

  function handleBackgroundUpload(): void {
    if (isLocked) {
      setNotice('Template is locked.')
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        setNotice('Error: Only image files are accepted.')
        return
      }

      if (file.size > MAX_BG_UPLOAD_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        setNotice(`Error: File is ${sizeMB} MB. Maximum allowed is 1 MB. Please use a smaller or compressed image.`)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setBgUrl(dataUrl)

        if (customLevelId && levelData) {
          const updated: GameLevel = {
            ...levelData,
            background: dataUrl,
            updatedAt: new Date().toISOString(),
          }
          const result = saveCustomLevel(updated)
          if (!result.success) {
            setNotice(`Save failed: ${result.error}`)
          } else {
            setNotice('Background updated! Reload editor to apply.')
          }
        }
      }
      reader.onerror = () => {
        setNotice('Error: Failed to read image file.')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function handleSaveLevelMeta(): void {
    if (isLocked) return
    if (!customLevelId || !levelData) return
    const updated: GameLevel = {
      ...levelData,
      name: levelName,
      background: bgUrl,
      updatedAt: new Date().toISOString(),
    }
    const result = saveCustomLevel(updated)
    if (result.success) {
      setNotice('Level saved!')
    } else {
      setNotice(`Save failed: ${result.error}`)
    }
  }

  function handleSelectFromList(id: string): void {
    gameRef.current?.selectNode(id)
    const map = gameRef.current?.getMapData()
    if (map) {
      const node = map.nodes.find((n) => n.id === id)
      if (node) setEditForm({ ...node })
    }
  }

  const isCustomLevel = !!customLevelId && !isTemplateLevel
  const canEditPlacement = !isLocked

  return (
    <div className="w-80 bg-gray-900/95 p-4 overflow-y-auto z-20 text-white flex-shrink-0 h-full">
      <h3 className="text-lg font-bold mb-2">Editor Panel</h3>

      {isTemplateLevel && (
        <div className={`mb-4 p-3 rounded space-y-2 ${isLocked ? 'bg-red-950/70' : 'bg-yellow-950/60'}`}>
          <h4 className={`text-sm font-semibold ${isLocked ? 'text-red-200' : 'text-yellow-200'}`}>
            {isLocked ? 'Template Locked' : 'Template Mode'}
          </h4>
          <p className="text-xs text-gray-300">
            {isLocked
              ? 'This level placement has been saved and can no longer be edited.'
              : 'All node properties are editable while unlocked. Click "Save & Lock" to freeze.'}
          </p>
          {!isLocked && (
            <button
              onClick={onSaveAndLockTemplate}
              className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-sm font-medium text-black"
            >
              Save & Lock
            </button>
          )}
          {isLocked && (
            <button
              onClick={onUnlockTemplate}
              className="w-full px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium"
            >
              Unlock
            </button>
          )}
        </div>
      )}

      {isCustomLevel && (
        <div className="mb-4 p-3 bg-gray-800 rounded space-y-2">
          <h4 className="text-sm font-semibold text-yellow-400">Custom Level</h4>

          <div>
            <label className="text-xs text-gray-400">Level Name</label>
            <input
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Background</label>
            <div className="flex gap-1">
              <input
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
                placeholder="/maps/maps.png or data:..."
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm truncate"
              />
              <button
                type="button"
                onClick={handleBackgroundUpload}
                className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs whitespace-nowrap"
              >
                Upload
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveLevelMeta}
            className="w-full px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm font-medium"
          >
            Save Level
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleExport}
          className="flex-1 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm"
        >
          Export
        </button>
        <button
          onClick={handleImport}
          disabled={isLocked}
          className="flex-1 px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-700 rounded text-sm"
        >
          Import
        </button>
        <button
          onClick={handleSaveToSheet}
          disabled={savingToSheet}
          className="flex-1 px-3 py-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-700 rounded text-sm"
        >
          {savingToSheet ? 'Saving...' : 'Save to Sheet'}
        </button>
      </div>

      {notice && (
        <div className="text-xs text-yellow-300 mb-2">{notice}</div>
      )}

      {/* Mission Order */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold">Mission Order ({missionOrder.length})</h4>
          <button
            onClick={() => setShowAddMission(!showAddMission)}
            disabled={isLocked}
            className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-700 rounded text-xs"
          >
            {showAddMission ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {showAddMission && (
          <div className="max-h-28 overflow-y-auto mb-2 space-y-0.5 bg-gray-800 rounded p-1">
            {availableForMission.length === 0 ? (
              <p className="text-xs text-gray-500 px-1">All nodes already in order.</p>
            ) : (
              availableForMission.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleAddMission(n.id)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-white/10"
                >
                  + {n.name} <span className="text-gray-400">({n.purpose})</span>
                </button>
              ))
            )}
          </div>
        )}

        {orderedNodes.length === 0 ? (
          <p className="text-xs text-gray-500">No mission order set. Random missions will be used.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {orderedNodes.map((n, i) => (
              <div
                key={n.id}
                className="flex items-center gap-1 text-xs bg-gray-800 rounded px-1.5 py-1"
              >
                <span className="text-gray-500 w-5 text-right shrink-0">{i + 1}.</span>
                <span className="flex-1 truncate">{n.name}</span>
                <span className="text-gray-400 shrink-0">({n.purpose})</span>
                <button
                  onClick={() => handleMoveMissionUp(i)}
                  disabled={i === 0 || isLocked}
                  className="px-1 text-gray-400 hover:text-white disabled:opacity-30 shrink-0"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveMissionDown(i)}
                  disabled={i === orderedNodes.length - 1 || isLocked}
                  className="px-1 text-gray-400 hover:text-white disabled:opacity-30 shrink-0"
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  onClick={() => handleRemoveMission(i)}
                  disabled={isLocked}
                  className="px-1 text-red-400 hover:text-red-300 disabled:opacity-30 shrink-0"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-1">Nodes ({nodeList.length})</h4>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {nodeList.map((n) => (
            <button
              key={n.id}
              onClick={() => handleSelectFromList(n.id)}
              className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-white/10 ${
                selectedNode?.id === n.id ? 'bg-white/20 ring-1 ring-yellow-400' : ''
              }`}
            >
              {n.name} <span className="text-gray-400">({n.type})</span>
            </button>
          ))}
        </div>
      </div>

      {editForm && (
        <form onSubmit={handleEditSubmit} className="space-y-2">
          <h4 className="text-sm font-semibold">Edit Node</h4>

          <div>
            <label className="text-xs text-gray-400">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              disabled={isLocked}
              className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Type</label>
            <select
              value={editForm.type}
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              disabled={isLocked}
              className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
            >
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Purpose</label>
            <select
              value={editForm.purpose}
              onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
              disabled={isLocked}
              className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
            >
              <option value="eat">Eat</option>
              <option value="shop">Shop</option>
              <option value="work">Work</option>
              <option value="rest">Rest</option>
              <option value="visit">Visit</option>
              <option value="deliver">Deliver</option>
              <option value="play">Play</option>
              <option value="social">Social</option>
              <option value="service">Service</option>
              <option value="spawn">Spawn</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Radius (%)</label>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={editForm.radius}
              onChange={(e) => setEditForm({ ...editForm, radius: Number(e.target.value) })}
              disabled={isLocked}
              className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">District</label>
            <input
              value={editForm.district ?? ''}
              onChange={(e) => setEditForm({ ...editForm, district: e.target.value || undefined })}
              disabled={isLocked}
              placeholder="e.g. CITY CENTER"
              className="w-full px-2 py-1 bg-gray-800 rounded text-sm placeholder-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">X (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={editForm.x}
                onChange={(e) => setEditForm({ ...editForm, x: Number(e.target.value) })}
                disabled={!canEditPlacement}
                className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Y (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={editForm.y}
                onChange={(e) => setEditForm({ ...editForm, y: Number(e.target.value) })}
                disabled={!canEditPlacement}
                className="w-full px-2 py-1 bg-gray-800 rounded text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!canEditPlacement}
              className="flex-1 px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-green-700 rounded text-sm"
            >
              {isTemplateLevel ? 'Apply Position' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLocked}
              className="flex-1 px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-700 rounded text-sm"
            >
              Delete
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 text-xs text-gray-500">
        {!isLocked && <p>All node properties are editable.</p>}
        {isLocked && <p>Locked: inspect only</p>}
        <p>Drag node to move</p>
        <p>Use X/Y fields for precise placement</p>
        <p>Right-drag: pan camera</p>
        <p>Q/E: zoom</p>
      </div>
    </div>
  )
}