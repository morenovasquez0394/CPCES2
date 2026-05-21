// --- START OF FILE script.js (CON CARGA INCREMENTAL) ---

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBGO96_Vvtna84xGKW31Xi0FodTiYFstUc_RPmXcq-tTRBbcYZoh_SMgiDZjd3xZYP2A/exec';

// (El resto de tu código inicial como 'parseDateString', 'enviarTelegram', variables, etc., sigue aquí...)
// ▼▼▼ EL CÓDIGO ACTUALIZADO EMPIEZA AQUÍ ▼▼▼

function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }
  const genericDate = new Date(dateStr);
  if (!isNaN(genericDate.getTime())) return genericDate;
  return null;
}

// ... (todas las demás funciones como enviarTelegram, etc. permanecen igual) ...
// ...
// LA ÚNICA FUNCIÓN QUE CAMBIA ES cargar()

/**
 * Función de carga de datos MEJORADA.
 * Ahora pide cargas incrementales después de la primera vez.
 */
async function cargar(silencioso = false) {
    if (!silencioso) setUILoading(true);
    try {
        // Si tenemos un 'serverLastUpdate', lo enviamos al servidor.
        const urlFetch = serverLastUpdate ? `${SCRIPT_URL}?lastUpdate=${serverLastUpdate}` : SCRIPT_URL;
        
        const response = await fetch(urlFetch);
        if (!response.ok) throw new Error(`Error de red al cargar: ${response.status}`);
        const data = await response.json();

        // CASO 1: Es una actualización incremental (delta)
        if (data.updates) {
            console.log("Procesando actualización incremental...", data.updates);

            // Mapeo de claves de la respuesta a los arrays locales
            const dataMap = {
                usuarios: { array: usuarios, idKey: 'cod' },
                patio: { array: patio, idKey: 'idCiclo' },
                historialEntradas: { array: historialEntradas, idKey: 'idCiclo' },
                solicitudesDespacho: { array: solicitudesDespacho, idKey: 'rampa' },
                rampas: { array: rampas, idKey: 'rampa_id' },
                auditoria: { array: auditoria, idKey: null }, // Solo se añaden
                tiemposCiclos: { array: tiemposCiclos, idKey: 'ciclo' },
                configuracion: { array: configuracion, idKey: 'clave' }
            };

            // Recorremos las claves que el servidor nos envió en 'updates'
            for (const key in data.updates) {
                if (dataMap[key]) {
                    const { array, idKey } = dataMap[key];
                    const updatedItems = data.updates[key];

                    updatedItems.forEach(item => {
                        // Para arrays sin ID (como auditoria), simplemente los añadimos al principio
                        if (!idKey) {
                            array.unshift(item);
                            return;
                        }

                        const index = array.findIndex(existing => existing[idKey] === item[idKey]);
                        if (index > -1) {
                            // Si el item ya existe, lo actualizamos
                            array[index] = { ...array[index], ...item };
                        } else {
                            // Si es nuevo, lo añadimos
                            array.push(item);
                        }
                    });
                }
            }
            // Guardamos la nueva marca de tiempo del servidor
            serverLastUpdate = data.newLastUpdate;

        // CASO 2: Es la primera carga o una carga completa
        } else if (data.lastUpdate) {
            console.log("Procesando carga completa...");
            usuarios = data.usuarios || [];
            patio = data.patio || [];
            historialEntradas = data.historialEntradas || [];
            solicitudesDespacho = data.solicitudesDespacho || [];
            rampas = data.rampas || [];
            auditoria = data.auditoria || [];
            tiemposCiclos = data.tiemposCiclos || [];
            configuracion = data.configuracion || [];
            
            // Guardamos la marca de tiempo para la próxima vez
            serverLastUpdate = data.lastUpdate;
        }

        // El resto de la lógica de configuración sigue igual...
        const cfgRampas = configuracion.find(c => c.clave === 'RAMPAS');
        if (cfgRampas && cfgRampas.valor) TOTAL_RAMPAS = parseInt(cfgRampas.valor);

        const cfgTiendas = configuracion.find(c => c.clave === 'TIENDAS');
        if (cfgTiendas && cfgTiendas.valor) TIENDAS_LIST = cfgTiendas.valor.split('\n').map(t => t.trim()).filter(t => t);

        const cfgCamiones = configuracion.find(c => c.clave === 'CAMIONES');
        if (cfgCamiones && cfgCamiones.valor) {
            let nuevosCamiones = {};
            cfgCamiones.valor.split('\n').forEach(l => {
                let p = l.split(',');
                if(p.length >= 2) nuevosCamiones[p[0].trim()] = p[1].trim();
            });
            if(Object.keys(nuevosCamiones).length > 0) TIPOS_CAMION = nuevosCamiones;
        }

        if(document.getElementById("configRampas")) document.getElementById("configRampas").value = TOTAL_RAMPAS;
        if(document.getElementById("configTiendas")) document.getElementById("configTiendas").value = TIENDAS_LIST.join('\n');
        if(document.getElementById("configCamiones")) document.getElementById("configCamiones").value = Object.keys(TIPOS_CAMION).map(k => `${k},${TIPOS_CAMION[k]}`).join('\n');

        const selAdmin = document.getElementById('regTipoCamion');
        if (selAdmin) {
            selAdmin.innerHTML = '';
            Object.keys(TIPOS_CAMION).forEach(k => selAdmin.add(new Option(TIPOS_CAMION[k], k)));
        }

    } catch (error) { 
        console.error("Fallo al cargar datos desde Google:", error); 
    } 
    finally { if (!silencioso) setUILoading(false); }
}

// El resto de tu código (desde guardarAjustesSistema hasta el final)
// permanece exactamente igual. Solo asegúrate de reemplazar esta función cargar().

// (Aquí iría todo el resto de tu código sin cambios...)
// ...
