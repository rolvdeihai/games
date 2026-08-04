'use client'

import { useRef, useEffect, useCallback } from 'react'
import * as Phaser from 'phaser'
import { BootScene } from '@/game/scenes/BootScene'
import { MenuScene } from '@/game/scenes/MenuScene'
import { GameScene, GameSceneData } from '@/game/scenes/GameScene'
import { EditorScene, EditorSceneData } from '@/game/scenes/EditorScene'
import { GameMap, GameLevel, GameRef } from '@/game/types'

interface GameCanvasProps {
  mode: 'game' | 'editor'
  mapData?: GameMap
  levelData?: GameLevel
  onMissionUpdate?: (mission: { nodeName: string; purpose: string; nodeId: string; district?: string } | null) => void
  onMissionComplete?: (count: number) => void
  onMapChange?: (map: GameMap) => void
  onNodeSelect?: (node: GameMap['nodes'][0] | undefined) => void
  onEditorNotice?: (msg: string) => void
  gameRef?: React.MutableRefObject<GameRef | null>
  joystickRef?: React.MutableRefObject<{ setInput: (dx: number, dy: number) => void } | null>
  editorReadOnly?: boolean
  editorPlacementOnly?: boolean
}

export default function GameCanvas({
  mode,
  mapData,
  levelData,
  onMissionUpdate,
  onMissionComplete,
  onMapChange,
  onNodeSelect,
  onEditorNotice,
  gameRef,
  joystickRef,
  editorReadOnly = false,
  editorPlacementOnly = false,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameInstanceRef = useRef<Phaser.Game | null>(null)

  const initGame = useCallback(() => {
    if (!containerRef.current || gameInstanceRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 2400,
      height: 1600,
      backgroundColor: '#1a1a2e',
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, MenuScene, GameScene, EditorScene],
      input: {
        keyboard: true,
        mouse: true,
        touch: true,
      },
      pixelArt: false,
      antialias: true,
    }

    const game = new Phaser.Game(config)
    gameInstanceRef.current = game

    const startSceneKey = mode === 'editor' ? 'EditorScene' : 'GameScene'

    game.events.once('ready', () => {
      const sharedData: Record<string, unknown> = {}

      if (mode === 'game') {
        sharedData.mapData = mapData
        sharedData.levelData = levelData
        sharedData.onMissionUpdate = onMissionUpdate
        sharedData.onComplete = onMissionComplete
        sharedData.joystickRef = joystickRef
      } else {
        sharedData.mapData = mapData
        sharedData.levelData = levelData
        sharedData.onMapChange = onMapChange
        sharedData.onNodeSelect = onNodeSelect
        sharedData.onNotice = onEditorNotice
        sharedData.readOnly = editorReadOnly
        sharedData.placementOnly = editorPlacementOnly
      }

      game.scene.start(startSceneKey, sharedData)
    })

    if (gameRef) {
      gameRef.current = {
        getScene: () => game.scene.getScene(startSceneKey),
        getMapData: () => {
          const scene = game.scene.getScene(startSceneKey)
          if (!scene) return null
          if ('getMapData' in scene) return (scene as GameScene).getMapData()
          return (scene as EditorScene).getMapSystem().getMap()
        },
        editNode: (id: string, updates: Record<string, unknown>) => {
          const scene = game.scene.getScene('EditorScene') as EditorScene
          scene?.getEditorSystem().editNode(id, updates)
        },
        deleteNode: (id: string) => {
          const scene = game.scene.getScene('EditorScene') as EditorScene
          scene?.getEditorSystem().deleteNode(id)
        },
        exportMap: () => {
          const scene = game.scene.getScene('EditorScene') as EditorScene
          return scene?.getEditorSystem().exportMap() || null
        },
        importMap: (map: GameMap) => {
          const scene = game.scene.getScene('EditorScene') as EditorScene
          scene?.getEditorSystem().importMap(map)
        },
        selectNode: (id: string) => {
          const scene = game.scene.getScene('EditorScene') as EditorScene
          scene?.getEditorSystem().selectNode(id)
        },
      }
    }
  }, [mode, mapData, levelData, onMissionUpdate, onMissionComplete, onMapChange, onNodeSelect, onEditorNotice, gameRef, joystickRef, editorReadOnly, editorPlacementOnly])

  useEffect(() => {
    initGame()

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true)
        gameInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (gameInstanceRef.current) {
      const game = gameInstanceRef.current
      const currentScene = game.scene.getScenes(true)[0]
      if (currentScene) {
        const targetKey = mode === 'editor' ? 'EditorScene' : 'GameScene'
        if (currentScene.scene.key !== targetKey) {
          const data: Record<string, unknown> = {}
          if (mode === 'game') {
            data.mapData = mapData
            data.levelData = levelData
            data.onMissionUpdate = onMissionUpdate
            data.onComplete = onMissionComplete
            data.joystickRef = joystickRef
          } else {
            data.mapData = mapData
            data.onMapChange = onMapChange
            data.onNodeSelect = onNodeSelect
            data.onNotice = onEditorNotice
            data.readOnly = editorReadOnly
            data.placementOnly = editorPlacementOnly
          }
          game.scene.start(targetKey, data)
        }
      }
    }
  }, [mode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // If the user is typing in an input/textarea, stop the event from reaching Phaser
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest?.('input, textarea, [contenteditable="true"]')
      ) {
        e.stopPropagation();
      }
    };
    // Use capture phase to intercept before Phaser's listener
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: 'none', background: '#1a1a2e' }}
    />
  )
}
