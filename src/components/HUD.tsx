'use client'

import { useState, useEffect } from 'react'

interface MissionInfo {
  nodeName: string
  purpose: string
  nodeId: string
  district?: string
}

interface HUDProps {
  mission: MissionInfo | null
  completedCount: number
  onMenu?: () => void
}

const PURPOSE_ICON: Record<string, string> = {
  eat: '🍽',
  shop: '🛍',
  work: '💼',
  rest: '🌿',
  visit: '📍',
  deliver: '📦',
  play: '🎮',
  social: '👥',
  service: '🔧',
}

const PURPOSE_ACTIVITY: Record<string, string> = {
  eat: 'Eat at',
  shop: 'Shop at',
  work: 'Work at',
  rest: 'Relax at',
  visit: 'Visit',
  deliver: 'Deliver to',
  play: 'Play at',
  social: 'Meet at',
  service: 'Service at',
}

export default function HUD({ mission, completedCount, onMenu }: HUDProps) {
  const [showMission, setShowMission] = useState(true)
  const [showControls, setShowControls] = useState(true)

  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768
      setShowMission(isDesktop)
      setShowControls(isDesktop)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const icon = mission ? (PURPOSE_ICON[mission.purpose] ?? '📍') : ''
  const activity = mission ? (PURPOSE_ACTIVITY[mission.purpose] ?? mission.purpose) : ''

  return (
    <div className="absolute top-0 left-0 right-0 p-3 pointer-events-none z-10">
      <div className="flex justify-between items-start gap-2">

        {/* Left panel: mission toggle + content */}
        <div className="pointer-events-auto flex items-start gap-2">
          <button
            onClick={() => setShowMission(!showMission)}
            className="bg-black/65 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-lg hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 text-white"
            aria-label={showMission ? 'Hide mission' : 'Show mission'}
          >
            {showMission ? '✕' : '🎯'}
          </button>

          {showMission && (
            <div className="bg-black/65 backdrop-blur-sm rounded-xl px-4 py-2 min-w-[180px] shadow-lg transition-all duration-200">
              <div className="text-white text-sm font-bold leading-tight">
                Missions:{' '}
                <span className="text-green-400 text-base">{completedCount}</span>
              </div>

              {mission ? (
                <div className="mt-1 space-y-0.5">
                  {mission.district && (
                    <div className="text-yellow-400/80 text-[10px] uppercase tracking-widest font-semibold">
                      {mission.district}
                    </div>
                  )}
                  <div className="text-white text-sm font-semibold">
                    {icon} {activity} {mission.nodeName}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-xs mt-1">No active mission</div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Menu + Controls toggle */}
        <div className="pointer-events-auto flex items-start gap-2">
          {/* Menu button */}
          {onMenu && (
            <button
              onClick={onMenu}
              className="bg-black/65 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-xl hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 text-white"
              aria-label="Menu"
            >
              ☰
            </button>
          )}

          {/* Controls toggle button */}
          <div className="relative">
            <button
              onClick={() => setShowControls(!showControls)}
              className="bg-black/65 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-xl hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white"
              aria-label={showControls ? 'Hide controls' : 'Show controls'}
            >
              {showControls ? '✕' : '⌨️'}
            </button>

            {showControls && (
              <div className="absolute top-12 right-0 bg-black/65 backdrop-blur-sm rounded-xl px-4 py-3 text-gray-300 text-xs leading-relaxed w-[180px] shadow-lg transition-all duration-200">
                <div>WASD / Arrows — move</div>
                <div>Q / E — zoom out / in</div>
                <div>
                  <span className="text-yellow-300">D</span> — debug overlay
                </div>
                <div>
                  <span className="text-yellow-300">R</span> — reachability
                </div>
                <div>
                  <span className="text-yellow-300">P</span> — playtest mode
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}