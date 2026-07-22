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

    // Handle delete action
    if (payload.action === 'delete' && payload.mapId) {
      var ss = SpreadsheetApp.getActiveSpreadsheet()
      deleteMapRows(ss, payload.mapId)
      return jsonResponse({ success: true, message: 'Deleted map ' + payload.mapId })
    }

    // Default save action
    var map = payload.map || payload

    if (!map || !map.id || !Array.isArray(map.nodes)) {
      return jsonResponse({ success: false, error: 'Invalid payload' })
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var timestamp = new Date()

    // Delete existing rows for this map before saving new ones (acts like an overwrite/update)
    deleteMapRows(ss, map.id)

    appendMapRow(ss, map, timestamp)
    appendNodeRows(ss, map, timestamp)

    return jsonResponse({ success: true, mapId: map.id, nodeCount: map.nodes.length })
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) })
  }
}

function deleteMapRows(ss, mapId) {
  // Delete from Maps sheet
  var mapsSheet = ss.getSheetByName(MAPS_SHEET)
  if (mapsSheet) {
    var data = mapsSheet.getDataRange().getValues()
    // Loop backwards so deleting rows doesn't mess up indices
    for (var i = data.length - 1; i > 0; i--) {
      // Map ID is in column 2 (index 1)
      if (data[i][1] === mapId) {
        mapsSheet.deleteRow(i + 1)
      }
    }
  }

  // Delete from Nodes sheet
  var nodesSheet = ss.getSheetByName(NODES_SHEET)
  if (nodesSheet) {
    var data = nodesSheet.getDataRange().getValues()
    for (var i = data.length - 1; i > 0; i--) {
      // Map ID is in column 2 (index 1)
      if (data[i][1] === mapId) {
        nodesSheet.deleteRow(i + 1)
      }
    }
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
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers)
    sheet.setFrozenRows(1)
  }
  return sheet
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
