// --- START OF FILE Google Apps Script ---

const TELEGRAM_BOT_TOKEN = "8583613125:AAHzBuNxZeb-NXzM8v57rJNmE4PBoFnpUMc"; 

const SHEET_NAMES = {
  USERS: "Usuarios",
  PATIO: "Patio",
  HISTORY: "Historial",
  REQUESTS: "Solicitudes",
  RAMPS: "Rampas",
  AUDIT: "Auditoria",
  TIMES: "TiemposCiclos",
  CONFIG: "Configuracion" 
};

function sheetDataToObjectArray(sheetData) {
  if (!sheetData || sheetData.length < 2) return []; 
  const headers = sheetData[0].map(h => h.toString().trim());
  const objects = [];
  for (let i = 1; i < sheetData.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = sheetData[i][j];
    }
    objects.push(obj);
  }
  return objects;
}

// MODIFICADA: Ahora asegura que todas las columnas existan al guardar
function objectArrayToSheetData(objectArray, sheetName) {
  if (!objectArray || objectArray.length === 0) return [[], []];

  let headers;
  if (sheetName === SHEET_NAMES.USERS) {
    // Definición estricta de columnas para Usuarios para evitar pérdidas
    headers = ["cod", "nom", "rol", "pass", "tel", "comp", "tipoCamion", "telegram_chat_id", "pos"];
  } else {
    // Para otras hojas, detecta todas las llaves únicas presentes en todos los objetos
    const allKeys = new Set();
    objectArray.forEach(obj => Object.keys(obj).forEach(key => allKeys.add(key)));
    headers = Array.from(allKeys);
  }

  const values = objectArray.map(obj => headers.map(header => (obj[header] !== undefined && obj[header] !== null) ? obj[header] : ""));
  return [headers, ...values];
}

function sendTelegramMessageToChatId(chatId, message) {
  const token = TELEGRAM_BOT_TOKEN; 
  if (!token) return { ok: false, error: "TOKEN no configurado." };
  const telegramApiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })
  };
  try {
    const response = UrlFetchApp.fetch(telegramApiUrl, payload);
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function doGet(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const serverLastUpdate = props.getProperty('lastUpdate') || "0";
    let clientLastUpdate = e?.parameter?.lastUpdate;

    if (clientLastUpdate && clientLastUpdate === serverLastUpdate) {
      return ContentService.createTextOutput(JSON.stringify({ changed: false })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = {};
    const sheets = [
      { key: 'usuarios', name: SHEET_NAMES.USERS },
      { key: 'patio', name: SHEET_NAMES.PATIO },
      { key: 'historialEntradas', name: SHEET_NAMES.HISTORY },
      { key: 'solicitudesDespacho', name: SHEET_NAMES.REQUESTS },
      { key: 'rampas', name: SHEET_NAMES.RAMPS },
      { key: 'auditoria', name: SHEET_NAMES.AUDIT },
      { key: 'tiemposCiclos', name: SHEET_NAMES.TIMES },
      { key: 'configuracion', name: SHEET_NAMES.CONFIG } 
    ];
    
    sheets.forEach(s => {
      let sheet = ss.getSheetByName(s.name) || ss.insertSheet(s.name);
      // Validación de cabeceras en Usuarios
      if (s.name === SHEET_NAMES.USERS) {
        const headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
        if (!headers.includes("telegram_chat_id")) {
          sheet.getRange(1, Math.max(headers.length + 1, 8)).setValue("telegram_chat_id");
        }
      }
      data[s.key] = sheetDataToObjectArray(sheet.getDataRange().getValues());
    });

    data.lastUpdate = serverLastUpdate;
    data.changed = true;
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) { 
    return ContentService.createTextOutput(JSON.stringify({ error: error.message })).setMimeType(ContentService.MimeType.JSON); 
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (requestData.action === "sendTelegram") {
      const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
      const usersData = usersSheet.getDataRange().getValues();
      const headers = usersData[0];
      const chatIDCol = headers.indexOf("telegram_chat_id");
      const fichaCol = headers.indexOf("cod");

      let targetChatId = null;
      for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][fichaCol] == requestData.ficha) {
          targetChatId = usersData[i][chatIDCol];
          break;
        }
      }

      if (targetChatId) {
        const res = sendTelegramMessageToChatId(targetChatId, requestData.message);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", telegram: res })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ID no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    const dataMap = {
      [SHEET_NAMES.USERS]: requestData.usuarios,
      [SHEET_NAMES.PATIO]: requestData.patio,
      [SHEET_NAMES.HISTORY]: requestData.historialEntradas,
      [SHEET_NAMES.REQUESTS]: requestData.solicitudesDespacho,
      [SHEET_NAMES.RAMPS]: requestData.rampas,
      [SHEET_NAMES.AUDIT]: requestData.auditoria,
      [SHEET_NAMES.TIMES]: requestData.tiemposCiclos,
      [SHEET_NAMES.CONFIG]: requestData.configuracion
    };
    
    for (const sheetName in dataMap) {
      if (Array.isArray(dataMap[sheetName])) {
        let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
        sheet.clear(); 
        if (dataMap[sheetName].length > 0) {
          const sheetData = objectArrayToSheetData(dataMap[sheetName], sheetName);
          sheet.getRange(1, 1, sheetData.length, sheetData[0].length).setValues(sheetData);
        }
      }
    }

    PropertiesService.getScriptProperties().setProperty('lastUpdate', Date.now().toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) { 
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON); 
  }
}
