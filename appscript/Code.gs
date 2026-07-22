/**
 * Google Apps Script Web App — saves City Mission Game map data to a Google Sheet.
 *
 * SETUP
 * 1. Create/open a Google Sheet, then Extensions > Apps Script.
 * 2. Paste this file's contents into Code.gs.
 * 3. Deploy > New deployment > type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone (needed for browser fetch from the game)
 * 4. Copy the Web App URL and set it as NEXT_PUBLIC_APPSCRIPT_URL in the Next.js app.
 *
 * The sheet will get two tabs (auto-created on first save):
 * - "Maps": one row per save, with the full map JSON in the last column.
 * - "Nodes": one row per node, flattened for easy filtering/analysis.
 */

var MAPS_SHEET = 'Maps'
var NODES_SHEET = 'Nodes'

var MAPS_HEADERS = ['Timestamp', 'Map ID', 'Map Name', 'Width', 'Height', 'Background', 'Node Count', 'Raw JSON']
var NODES_HEADERS = ['Timestamp', 'Map ID', 'Map Name', 'Node ID', 'Node Name', 'Type', 'Purpose', 'X', 'Y', 'Radius', 'District']

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents)
    var map = payload.map || payload

    if (!map || !map.id || !Array.isArray(map.nodes)) {
      return jsonResponse({ success: false, error: 'Invalid payload: expected { map: { id, nodes, ... } }' })
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var timestamp = new Date()

    appendMapRow(ss, map, timestamp)
    appendNodeRows(ss, map, timestamp)

    return jsonResponse({ success: true, mapId: map.id, nodeCount: map.nodes.length })
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) })
  }
}

function doGet() {
  return jsonResponse({ status: 'ok', message: 'City Mission Game map save endpoint is live.' })
}

function appendMapRow(ss, map, timestamp) {
  var sheet = getOrCreateSheet(ss, MAPS_SHEET, MAPS_HEADERS)
  sheet.appendRow([
    timestamp,
    map.id,
    map.name || '',
    map.width || '',
    map.height || '',
    map.background || '',
    map.nodes.length,
    JSON.stringify(map),
  ])
}

function appendNodeRows(ss, map, timestamp) {
  var sheet = getOrCreateSheet(ss, NODES_SHEET, NODES_HEADERS)
  var rows = map.nodes.map(function (node) {
    return [
      timestamp,
      map.id,
      map.name || '',
      node.id,
      node.name || '',
      node.type || '',
      node.purpose || '',
      node.x,
      node.y,
      node.radius,
      node.district || '',
    ]
  })
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, NODES_HEADERS.length).setValues(rows)
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(headers)
    sheet.setFrozenRows(1)
  }
  return sheet
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
