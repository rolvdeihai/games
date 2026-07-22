import type { GameMap } from '@/game/types'

const APPSCRIPT_URL = process.env.NEXT_PUBLIC_APPSCRIPT_URL

export interface AppscriptSaveResult {
  success: boolean
  error?: string
}

export async function saveMapToSheet(map: GameMap): Promise<AppscriptSaveResult> {
  if (!APPSCRIPT_URL) {
    return { success: false, error: 'NEXT_PUBLIC_APPSCRIPT_URL is not set' }
  }

  try {
    const res = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      // text/plain avoids a CORS preflight; Apps Script still parses e.postData.contents as JSON.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ map }),
    })
    const data = await res.json()
    if (!data.success) {
      return { success: false, error: data.error || 'Unknown error' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
