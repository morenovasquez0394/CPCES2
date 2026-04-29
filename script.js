// --- START OF FILE script.js ---

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzf62YCzWmjWGZtxIUhHUJNIyYJrrOEDK2XpMLpSORo9YkzkQLUYmLMGMf2X4bQRESMDw/exec';

// 🔔 TELEGRAM INTEGRADO (SEGURO - NO AFECTA NADA SI NO SE USA)
const TELEGRAM_TOKEN = "bot8583613125:AAHzBuNxZeb-NXzM8v57rJNmE4PBoFnpUMc";
const TELEGRAM_CHAT_ID = "6708256846";

async function enviarTelegram(mensaje){
    if(!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
    try{
        await fetch(`https://api.telegram.org/bot${"bot8583613125:AAHzBuNxZeb-NXzM8v57rJNmE4PBoFnpUMc}/sendMessage`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
                chat_id: 6708256846,
                text: "prueba"
            })
        });
    }catch(e){
        console.log("Telegram error", e);
    }
}

let usuarios = [];
let patio = [];
let historialEntradas = [];
let solicitudesDespacho = [];
let rampas = []; 
let auditoria = []; 
let tiemposCiclos = []; 
let configuracion = []; 

let usuarioLogueado = null;
let html5QrcodeScanner = null;
let estadoChoferAnterior = null; 
let serverLastUpdate = null;

let TOTAL_RAMPAS = 24; 
let TIENDAS_LIST = ["1100-WC","1200-SV","1300-SI","1400-EN","1500-ST","1600-NC","1700-RC","1800-IN","1900-ES","2000-LA","2100-P27","2200-BN","2300-PRO","2400-OZ","2500-VM","2700-LUP","2800-CHA","2900-HIP","3000-PON","3200-JM","3300-LV","3400-CRO","3500-SC","3600-NAC","3900-SFM","4100-PC","4200-YA","4500-HIG"];

let TIPOS_CAMION = {
    'CAMION_FRIO':'CAMION FRIO ❄️',
    'CAMION_SECO':'CAMION SECO',
    'DOLLY':'DOLLY',
    'FURGON_REF':'FURGON REF ❄️',
    'FURGON_SECO':'FURGON SECO',
    'RIGIDO':'RIGIDO'
};

const ESTADOS_UI = {
    "EN_PATIO": { label: "En Patio", text: "text-blue-400" },
    "ASIGNADO": { label: "Asignado", text: "text-yellow-400" },
    "EN_RAMPA": { label: "En Rampa", text: "text-emerald-400" },
    "CARGA_LISTA": { label: "Carga Lista", text: "text-purple-400" },
    "CARGADO": { label: "📦 Cargado", text: "text-orange-400" }, // 🔥 MEJORA VISUAL
    "ENVIADO_A_TIENDA": { label: "A Tienda", text: "text-cyan-400" },
    "FUERA_DEL_RECINTO": { label: "Abortado", text: "text-red-400" }
};

function setUILoading(isLoading){
    document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    document.body.style.opacity = isLoading ? '0.7' : '1';
}

/* =========================
   ASIGNAR RAMPA (MODIFICADO)
========================= */
async function asignarRampa(ficha){

    let opcionesRampas = [];

    for(let i=1;i<=TOTAL_RAMPAS;i++){
        let ocupado = patio.find(p=>p.rampa==i && p.estado!="ENVIADO_A_TIENDA" && p.estado!="FUERA_DEL_RECINTO");
        let solicitud = solicitudesDespacho.find(s=>s.rampa==i);

        let label = ocupado ? `OCUPADA (${ocupado.user})` :
                    solicitud ? `SOLICITUD` : `LIBRE`;

        opcionesRampas.push({
            value:i,
            label:`RAMPA ${i} - ${label}`
        });
    }

    abrirSelectorModal(`ASIGNAR RAMPA A ${ficha}`, opcionesRampas, async (rNum)=>{

        const idx = patio.findIndex(p=>p.user===ficha);

        patio[idx].estado = "ASIGNADO";
        patio[idx].rampa = rNum;
        patio[idx].lastUpdate = Date.now();

        solicitudesDespacho = solicitudesDespacho.filter(s=>s.rampa!=rNum);

        registrarAuditoria(ficha, patio[idx].nom, "PATIO", `Asignado a Rampa ${rNum}`);

        // 🔔 TELEGRAM
        await enviarTelegram(`🚛 Unidad ${ficha} asignada a Rampa ${rNum}`);

        await guardar();
        renderPatio();
    });
}

/* =========================
   FINALIZAR CARGA (MODIFICADO)
========================= */
async function finalizarCarga(r){

    const idx = patio.findIndex(p=>p.rampa==r && p.estado!="ENVIADO_A_TIENDA");
    if(idx===-1) return;

    abrirSelectorModal("SELECCIONAR DESTINO", TIENDAS_LIST.map(t=>({value:t,label:t})), async (tienda)=>{

        patio[idx].estado = "CARGA_LISTA";
        patio[idx].t_fin_carga = Date.now();
        patio[idx].tienda = tienda;

        registrarAuditoria(patio[idx].user, patio[idx].nom, "DESPACHO", `Carga lista en rampa ${r}`);

        // 🔔 TELEGRAM
        await enviarTelegram(`📦 Carga lista en Rampa ${r} destino ${tienda}`);

        await guardar();
        renderDespacho();
    });
}

/* =========================
   CHOFER CONFIRMA SALIDA (MODIFICADO)
========================= */
async function choferConfirmaCarga(){

    const idx = patio.findIndex(p=>p.user===usuarioLogueado.cod && p.estado!="ENVIADO_A_TIENDA");
    if(idx===-1) return;

    const rampaLiberada = patio[idx].rampa;

    patio[idx].estado = "CARGADO";
    patio[idx].rampa = null;
    patio[idx].lastUpdate = Date.now();

    registrarAuditoria(patio[idx].user, patio[idx].nom, "CHOFER", `Salió de rampa ${rampaLiberada}`);

    // 🔔 TELEGRAM
    await enviarTelegram(`✅ Unidad ${patio[idx].user} salió de rampa ${rampaLiberada}`);

    await guardar();
    cargarInfoChofer();
}
