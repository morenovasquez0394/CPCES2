// --- START OF FILE script.js ---

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQrqzUTJjixGy2vv1JKetMApWrZbp6sivsDrSCZaQni-UybsGiCO_DJzoeV5oM3Nevvw/exec';
        
let usuarios = [];
let patio = [];
let historialEntradas = [];
let solicitudesDespacho = [];
let rampas = []; 
let auditoria = []; 
let tiemposCiclos = []; 
let usuarioLogueado = null;
let html5QrcodeScanner = null;

// ---> NUEVO: Variable para recordar el estado anterior del chofer <---
let estadoChoferAnterior = null; 

// PALETA DE ESTADOS UNIVERSAL
const ESTADOS_UI = {
    "EN_PATIO": { label: "En Patio", class: "bg-blue-900/40 text-blue-400 border-blue-500", text: "text-blue-400" },
    "ASIGNADO": { label: "Asignado", class: "bg-yellow-900/40 text-yellow-400 border-yellow-500 animate-pulse", text: "text-yellow-400" },
    "EN_RAMPA": { label: "En Rampa", class: "bg-emerald-900/40 text-emerald-400 border-emerald-500", text: "text-emerald-400" },
    "CARGA_LISTA": { label: "Carga Lista", class: "bg-purple-900/40 text-purple-400 border-purple-500 animate-pulse", text: "text-purple-400" },
    "CARGADO": { label: "Cargado", class: "bg-orange-900/40 text-orange-400 border-orange-500", text: "text-orange-400" },
    "ENVIADO_A_TIENDA": { label: "A Tienda", class: "bg-cyan-900/40 text-cyan-400 border-cyan-500", text: "text-cyan-400" },
    "FUERA_DEL_RECINTO": { label: "Abortado", class: "bg-red-900/40 text-red-400 border-red-500", text: "text-red-400" }
};

// CONSTANTES DE TIPOS DE CAMION
const TIPOS_CAMION = ['CAMION_FRIO', 'CAMION_SECO', 'DOLLY', 'FURGON_REF', 'FURGON_SECO', 'RIGIDO'];
const LABELS_CAMION = {
    'CAMION_FRIO': 'Camión Frío',
    'CAMION_SECO': 'Camión Seco',
    'DOLLY': 'Dolly',
    'FURGON_REF': 'Furgón Ref',
    'FURGON_SECO': 'Furgón Seco',
    'RIGIDO': 'Rígido'
};

function setUILoading(isLoading) {
    document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    document.body.style.opacity = isLoading ? '0.7' : '1';
}

async function guardar() {
    setUILoading(true);
    try {
        const dataPayload = { usuarios, patio, historialEntradas, solicitudesDespacho, rampas, auditoria, tiemposCiclos };
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'cors', credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(dataPayload)
        });
    } catch (error) { console.error("Error al guardar:", error); } 
    finally { setUILoading(false); }
}

async function cargar(silencioso = false) {
    if (!silencioso) setUILoading(true);
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error("Error red");
        const data = await response.json();
        
        usuarios = data.usuarios || [];
        patio = data.patio || [];
        historialEntradas = data.historialEntradas || [];
        solicitudesDespacho = data.solicitudesDespacho || [];
        rampas = data.rampas || [];
        auditoria = data.auditoria || [];
        tiemposCiclos = data.tiemposCiclos || [];
    } catch (error) { console.error("Error al cargar:", error); } 
    finally { if (!silencioso) setUILoading(false); }
}

function formatoFechaHora() {
    const d = new Date();
    let mes = (d.getMonth() + 1).toString().padStart(2, '0');
    let dia = d.getDate().toString().padStart(2, '0');
    let anio = d.getFullYear();
    return {
        fecha: `${dia}/${mes}/${anio}`,
        hora: d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })
    };
}

function actualizarReloj() {
    const fh = formatoFechaHora();
    const relojEl = document.getElementById("reloj");
    const fechaEl = document.getElementById("fechaLarga");
    if (relojEl) relojEl.innerText = fh.hora;
    if (fechaEl) fechaEl.innerText = fh.fecha;
}
setInterval(actualizarReloj, 1000);

setInterval(async () => {
    if (!usuarioLogueado) return;
    await cargar(true); 
    refrescarVistasActivas();
}, 8000); 

async function syncManual() {
    await cargar(false);
    refrescarVistasActivas();
}

function refrescarVistasActivas() {
    if (!document.getElementById("patio").classList.contains("hidden")) renderPatio();
    if (!document.getElementById("despacho").classList.contains("hidden")) renderDespacho();
    if (!document.getElementById("chofer").classList.contains("hidden")) cargarInfoChofer();
    if (!document.getElementById("admin").classList.contains("hidden")) renderAuditoria();
    
    if (!document.getElementById("garita").classList.contains("hidden")) renderStatsGarita();
    if (!document.getElementById("patio").classList.contains("hidden")) renderStatsPatio();
}

function registrarAuditoria(ficha, nom, modulo, accion, idCiclo = "N/A") {
    const fh = formatoFechaHora();
    auditoria.unshift({ ciclo: idCiclo, fecha: fh.fecha, hora: fh.hora, ficha: ficha, nom: nom, modulo: modulo, accion: accion });
}

function calcularDiferenciaMinutos(inicio, fin) {
    if (!inicio || !fin) return "N/A";
    const diffMin = Math.floor((fin - inicio) / 60000);
    if (diffMin < 0) return "0m";
    if (diffMin < 60) return `${diffMin}m`;
    return `${Math.floor(diffMin/60)}h ${diffMin%60}m`;
}

function intentarLogin() {
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value.trim();
    const user = usuarios.find(x => x.cod === u);
    if (user) {
        if (user.pass === "") {
            if (p === "") { 
                usuarioLogueado = user;
                document.getElementById("loginForm").classList.add("hidden");
                document.getElementById("changePassForm").classList.remove("hidden");
                return;
            } else return document.getElementById("loginError").innerText = "❌ USUARIO NUEVO: DEJA LA CLAVE EN BLANCO";
        }
        if (user.pass === p) {
            usuarioLogueado = user;
            entrarAlSistema();
        } else document.getElementById("loginError").innerText = "❌ CLAVE INCORRECTA";
    } else document.getElementById("loginError").innerText = "❌ USUARIO NO ENCONTRADO";
}

function entrarAlSistema() {
    loginScreen.classList.add("hidden");
    menuPrincipal.classList.remove("hidden");
    document.getElementById("welcomeMsg").innerText = `OPERADOR: ${usuarioLogueado.nom} | ROL: ${usuarioLogueado.rol}`;
    filtrarMenu(usuarioLogueado.rol);
}

function filtrarMenu(rol) {
    document.querySelectorAll("#botonesAcceso button").forEach(b => b.classList.add("hidden"));
    if (rol === "ADMIN") document.querySelectorAll("#botonesAcceso button").forEach(b => b.classList.remove("hidden"));
    else {
        const btn = document.getElementById("btn-" + rol);
        if (btn) btn.classList.remove("hidden");
    }
}

async function guardarNuevaPass() {
    const p1 = document.getElementById("newPass1").value;
    const p2 = document.getElementById("newPass2").value;
    if (p1.length < 4) return alert("Clave demasiado corta.");
    if (p1 !== p2) return alert("Las claves no coinciden.");
    const userIndex = usuarios.findIndex(u => u.cod === usuarioLogueado.cod);
    if (userIndex !== -1) {
        usuarios[userIndex].pass = p1;
        usuarioLogueado.pass = p1;
        await guardar();
        entrarAlSistema();
    }
}

function abrirModulo(m) {
    menuPrincipal.classList.add("hidden");
    app.classList.remove("hidden");
    document.querySelectorAll("#app > div.flex-1 > div").forEach(x => x.classList.add("hidden"));
    document.getElementById(m).classList.remove("hidden");
    document.getElementById("tituloModulo").innerText = m.toUpperCase();
    actualizarReloj();
    
    document.getElementById("headerStats").innerHTML = "";
    
    if (m === 'admin') { actualizarListaUsuarios(); renderAuditoria(); }
    if (m === 'garita') { renderHistorialGarita(); renderStatsGarita(); }
    if (m === 'patio') { renderPatio(); renderStatsPatio(); }
    if (m === 'despacho') renderDespacho();
    if (m === 'chofer') cargarInfoChofer();
}
function volverMenu() { app.classList.add("hidden"); menuPrincipal.classList.remove("hidden"); }
function cerrarSesion() { location.reload(); }

function switchAdminTab(tab) {
    document.getElementById("adminFormSection").classList.toggle("hidden", tab !== 'form');
    document.getElementById("adminAuditSection").classList.toggle("hidden", tab !== 'audit');
    document.getElementById("btnTabForm").className = tab === 'form' ? "bg-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all" : "bg-slate-800 text-slate-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all";
    document.getElementById("btnTabAudit").className = tab === 'audit' ? "bg-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all" : "bg-slate-800 text-slate-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all";
}

function ajustarFormularioAdmin() {
    const tipo = document.getElementById("filtroTipo").value;
    const isChofer = tipo === "CHOFER";
    document.getElementById("contPos").classList.toggle("hidden", isChofer);
    document.getElementById("contTel").classList.toggle("hidden", !isChofer);
    document.getElementById("contComp").classList.toggle("hidden", !isChofer);
    document.getElementById("contTipoCam").classList.toggle("hidden", !isChofer);
}

async function crearUsuario() {
    const tipo = document.getElementById("filtroTipo").value;
    const cod  = document.getElementById("regCodigo").value.trim();
    const nom  = document.getElementById("regNombre").value.trim();
    const pass = document.getElementById("regPassword").value.trim(); 
    
    if (!cod || !nom) return;
    
    let nuevo = { cod, nom, rol: tipo, pass: pass }; 
    
    if (tipo === "CHOFER") {
        nuevo.tel = document.getElementById("regTelefono").value;
        nuevo.comp = document.getElementById("regCompania").value;
        nuevo.tipoCamion = document.getElementById("regTipoCamion").value;
    } else nuevo.pos = document.getElementById("regPosicion").value;
    usuarios.push(nuevo);
    await guardar();
    actualizarListaUsuarios();
    alert("VINCULADO.");
    document.getElementById("regCodigo").value = "";
    document.getElementById("regNombre").value = "";
    document.getElementById("regPassword").value = "";
    document.getElementById("regCodigo").focus();
}

function actualizarListaUsuarios() {
    document.getElementById("listaUsuarios").innerHTML = usuarios.map(u => `<tr class="hover:bg-slate-800/20 transition-all group"><td class="p-6"><span class="font-mono font-black text-blue-400 bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10">${u.cod}</span></td><td class="p-6"><div class="font-black text-slate-200 text-sm uppercase">${u.nom}</div><div class="text-[9px] text-slate-600 uppercase tracking-widest font-bold">${u.rol}</div></td><td class="p-6 text-[10px] text-slate-500 font-bold italic uppercase tracking-tighter">${u.tipoCamion || u.pos || '-'}</td><td class="p-6 text-right">${u.cod !== 'admin' ? `<button onclick="eliminarUser('${u.cod}')" class="text-red-900 group-hover:text-red-500 font-black text-[9px] uppercase tracking-widest transition-colors">Remover</button>`: '<span class="text-slate-800 font-black text-[8px] tracking-widest">SISTEMA</span>'}</td></tr>`).join("");
}

async function eliminarUser(cod) {
    if (confirm("¿Eliminar usuario?")) {
        usuarios = usuarios.filter(u => u.cod !== cod);
        await guardar();
        actualizarListaUsuarios();
    }
}

function renderAuditoria() {
    document.getElementById("listaAuditoriaCuerpo").innerHTML = auditoria.map(a => `<tr class="hover:bg-slate-800/30"><td class="p-4 text-[10px] text-slate-400 font-mono">${a.fecha || 'N/A'} <br> <span class="text-white font-bold">${a.hora || ''}</span></td><td class="p-4 text-[9px] text-slate-600 font-bold uppercase tracking-widest">${a.ciclo}</td><td class="p-4 font-black text-blue-400">${a.ficha}</td><td class="p-4 text-xs font-bold">${a.nom}</td><td class="p-4 text-[9px] text-emerald-500 font-black tracking-widest">${a.modulo}</td><td class="p-4 text-xs text-slate-300 italic">${a.accion}</td></tr>`).join("");
}

function iniciarScanner() {
    document.getElementById("modalScanner").classList.remove("hidden");
    if (html5QrcodeScanner == null) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0, videoConstraints: { facingMode: "environment" } }, 
            false
        );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
}

function detenerScanner() {
    document.getElementById("modalScanner").classList.add("hidden");
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    document.getElementById("fichaEntrada").value = decodedText;
    detenerScanner();
    validarYRegistrar();
}

function onScanFailure(error) {}

async function validarYRegistrar() {
    const fichaInput = document.getElementById("fichaEntrada");
    const ficha = fichaInput.value.trim();
    const msg = document.getElementById("mensajeGarita");
    const vehiculoEnPatio = patio.find(p => p.user === ficha);
    const fh = formatoFechaHora();

    if (vehiculoEnPatio) {
        let esSalidaValida = false;

        const tAhora = Date.now();
        const tEntrada = vehiculoEnPatio.timestamp;
        const tLlegadaRampa = vehiculoEnPatio.t_llegada_rampa || null;
        const tFinCarga = vehiculoEnPatio.t_fin_carga || null;

        if (vehiculoEnPatio.estado === "EN_PATIO") {
            vehiculoEnPatio.estado = "FUERA_DEL_RECINTO"; 
            msg.innerHTML = `<span class='text-red-500 tracking-widest'>CICLO ABORTADO: ${vehiculoEnPatio.nom.split(' ')[0]}</span>`;
            esSalidaValida = true;
            
            tiemposCiclos.unshift({
                fecha: fh.fecha, ficha: ficha, ciclo: vehiculoEnPatio.idCiclo,
                hora_llegada: vehiculoEnPatio.hora,
                tiempo_patio: calcularDiferenciaMinutos(tEntrada, tAhora),
                tiempo_rampa: "N/A", tiempo_cargado: "N/A",
                hora_salida: fh.hora
            });

        } else if (vehiculoEnPatio.estado === "CARGADO" || vehiculoEnPatio.estado === "CARGA_LISTA") {
            if (vehiculoEnPatio.rampa) { 
                const rampaIndex = rampas.findIndex(r => r.rampa_id == vehiculoEnPatio.rampa);
                if(rampaIndex !== -1) rampas[rampaIndex].status = "LIBRE";
                vehiculoEnPatio.rampa = null;
            }
            vehiculoEnPatio.estado = "ENVIADO_A_TIENDA"; 
            msg.innerHTML = `<span class='text-cyan-400 tracking-widest'>SALIDA OK: ${vehiculoEnPatio.nom.split(' ')[0]}</span>`;
            esSalidaValida = true;

            tiemposCiclos.unshift({
                fecha: fh.fecha, ficha: ficha, ciclo: vehiculoEnPatio.idCiclo,
                hora_llegada: vehiculoEnPatio.hora,
                tiempo_patio: calcularDiferenciaMinutos(tEntrada, tLlegadaRampa),
                tiempo_rampa: calcularDiferenciaMinutos(tLlegadaRampa, tFinCarga),
                tiempo_cargado: calcularDiferenciaMinutos(tFinCarga, tAhora), 
                hora_salida: fh.hora
            });

        } else {
            msg.innerHTML = `<span class='text-orange-500 tracking-tighter'>⛔ NO PUEDE SALIR: Está en proceso (${vehiculoEnPatio.estado})</span>`;
        }

        if (esSalidaValida) {
            const vehiculoIndex = patio.findIndex(p => p.user === ficha);
            historialEntradas.unshift({...patio[vehiculoIndex]});
            await guardar();
            renderHistorialGarita();
        }
        fichaInput.value = "";
        return;
    }

    const usuarioInfo = usuarios.find(u => u.cod === ficha);
    if (!usuarioInfo) {
        msg.innerHTML = "<span class='text-red-600 animate-pulse tracking-[0.3em]'>Ficha Inexistente</span>";
        return;
    }
    
    const nuevoIdCiclo = "CYC-" + Date.now().toString().slice(-6);
    const entrada = {
        idCiclo: nuevoIdCiclo,
        user: ficha,
        nom: usuarioInfo.nom,
        tipo: usuarioInfo.tipoCamion || "RIGIDO",
        hora: fh.hora,
        fecha: fh.fecha,
        estado: "EN_PATIO",
        timestamp: Date.now(),
        lastUpdate: Date.now(),
        rampa: null,
        t_llegada_rampa: "", 
        t_fin_carga: ""      
    };

    patio.push(entrada);
    historialEntradas.unshift({...entrada}); 
    
    msg.innerHTML = `<span class='text-emerald-500 tracking-widest'>ACCESO OK: ${usuarioInfo.nom.split(' ')[0]}</span>`;
    fichaInput.value = "";
    await guardar();
    renderHistorialGarita();
}

function renderStatsGarita() {
    const container = document.getElementById("headerStats");
    if (!container || document.getElementById("garita").classList.contains("hidden")) return;

    const hoy = formatoFechaHora().fecha;
    
    let entradas = { total: 0 };
    let salidas = { total: 0 };
    TIPOS_CAMION.forEach(t => { entradas[t] = 0; salidas[t] = 0; });

    historialEntradas.forEach(op => {
        if (op.fecha && op.fecha.includes(hoy.split('/')[0])) {
            const tipo = TIPOS_CAMION.includes(op.tipo) ? op.tipo : 'RIGIDO';
            if (op.estado === 'EN_PATIO') {
                entradas[tipo]++;
                entradas.total++;
            } else if (op.estado === 'ENVIADO_A_TIENDA' || op.estado === 'FUERA_DEL_RECINTO') {
                salidas[tipo]++;
                salidas.total++;
            }
        }
    });

    let thCols = TIPOS_CAMION.map(t => `<th class="pb-1">${LABELS_CAMION[t]}</th>`).join('');
    let tdEntradas = TIPOS_CAMION.map(t => `<td class="py-1.5 text-emerald-400/80">${entradas[t]}</td>`).join('');
    let tdSalidas = TIPOS_CAMION.map(t => `<td class="py-1.5 text-cyan-400/80">${salidas[t]}</td>`).join('');

    container.innerHTML = `
        <div class="w-full overflow-x-auto bg-slate-900/50 rounded-[1rem] p-2 px-4 text-[9px] md:text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-slate-700/50 shadow-inner">
            <table class="w-full text-center min-w-[600px]">
                <thead>
                    <tr class="text-slate-500 border-b border-slate-700/50">
                        <th class="pb-1 text-left">Hoy</th>
                        ${thCols}
                        <th class="pb-1 text-white border-l border-slate-700/50 pl-2">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b border-slate-800/50">
                        <td class="py-1.5 text-left text-emerald-500">Entradas</td>
                        ${tdEntradas}
                        <td class="py-1.5 font-black text-white border-l border-slate-700/50 pl-2">${entradas.total}</td>
                    </tr>
                    <tr>
                        <td class="py-1.5 text-left text-cyan-500">Salidas</td>
                        ${tdSalidas}
                        <td class="py-1.5 font-black text-white border-l border-slate-700/50 pl-2">${salidas.total}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function renderStatsPatio() {
    const container = document.getElementById("headerStats");
    if (!container || document.getElementById("patio").classList.contains("hidden")) return;

    let stats = { TOTALES: { patio: 0, rampa: 0, cargado: 0, viajes: 0, total: 0 } };
    TIPOS_CAMION.forEach(t => { stats[t] = { patio: 0, rampa: 0, cargado: 0, viajes: 0, total: 0 }; });

    patio.forEach(p => {
        const t = TIPOS_CAMION.includes(p.tipo) ? p.tipo : 'RIGIDO';
        if (p.estado === 'EN_PATIO' || p.estado === 'ASIGNADO') { stats[t].patio++; stats.TOTALES.patio++; }
        else if (p.estado === 'EN_RAMPA' || p.estado === 'CARGA_LISTA') { stats[t].rampa++; stats.TOTALES.rampa++; }
        else if (p.estado === 'CARGADO') { stats[t].cargado++; stats.TOTALES.cargado++; }
    });

    const hoy = formatoFechaHora().fecha;
    historialEntradas.forEach(h => {
        if (h.fecha && h.fecha.includes(hoy.split('/')[0]) && h.estado === 'ENVIADO_A_TIENDA') {
            const t = TIPOS_CAMION.includes(h.tipo) ? h.tipo : 'RIGIDO';
            stats[t].viajes++;
            stats.TOTALES.viajes++;
        }
    });

    let htmlRows = TIPOS_CAMION.map(t => {
        stats[t].total = stats[t].patio + stats[t].rampa + stats[t].cargado;
        return `
            <tr class="border-b border-slate-800/50">
                <td class="py-1 text-left text-slate-400">${LABELS_CAMION[t]}</td>
                <td class="py-1">${stats[t].patio}</td>
                <td class="py-1">${stats[t].rampa}</td>
                <td class="py-1">${stats[t].cargado}</td>
                <td class="py-1 text-white">${stats[t].total}</td>
                <td class="w-4"></td> <!-- Separador -->
                <td class="py-1 text-cyan-400/80 font-bold border-l border-slate-700/50 pl-4">${stats[t].viajes}</td>
            </tr>
        `;
    }).join('');

    stats.TOTALES.total = stats.TOTALES.patio + stats.TOTALES.rampa + stats.TOTALES.cargado;

    const kpiElement = document.getElementById("kpiViajes");
    if (kpiElement) kpiElement.innerText = stats.TOTALES.viajes;

    container.innerHTML = `
        <div class="w-full overflow-x-auto bg-slate-900/50 rounded-[1rem] p-2 px-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest border border-slate-700/50 shadow-inner">
            <table class="w-full text-center min-w-[500px]">
                <thead>
                    <tr class="text-slate-500 border-b border-slate-700/50">
                        <th class="pb-1 text-left">Tipo</th>
                        <th class="pb-1 text-blue-400">Patio</th>
                        <th class="pb-1 text-emerald-400">Rampa</th>
                        <th class="pb-1 text-orange-400">Cargado</th>
                        <th class="pb-1 text-white">Activos</th>
                        <th class="w-4"></th> <!-- Separador -->
                        <th class="pb-1 text-cyan-400 border-l border-slate-700/50 pl-4">Viajes</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                    <tr>
                        <td class="py-1.5 text-left text-white font-black">Total</td>
                        <td class="py-1.5 text-blue-400 font-black">${stats.TOTALES.patio}</td>
                        <td class="py-1.5 text-emerald-400 font-black">${stats.TOTALES.rampa}</td>
                        <td class="py-1.5 text-orange-400 font-black">${stats.TOTALES.cargado}</td>
                        <td class="py-1.5 text-white font-black">${stats.TOTALES.total}</td>
                        <td class="w-4"></td> <!-- Separador -->
                        <td class="py-1.5 text-cyan-400 font-black border-l border-slate-700/50 pl-4">${stats.TOTALES.viajes}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function renderHistorialGarita() {
    const container = document.getElementById("historialGarita");
    document.getElementById("countHistorial").innerText = historialEntradas.length + " Reg";
    container.innerHTML = historialEntradas.map(h => {
        let fechaLimpia = h.fecha;
        if (fechaLimpia && fechaLimpia.includes('T')) fechaLimpia = fechaLimpia.split('T')[0];
        
        let borderColor = ""; let bgColor = ""; let textColor = ""; let etiqueta = "";

        if (h.estado === 'ENVIADO_A_TIENDA') {
            borderColor = "border-cyan-500"; bgColor = "bg-cyan-900/10"; textColor = "text-cyan-400"; etiqueta = "SALIDA";
        } else if (h.estado === 'FUERA_DEL_RECINTO') {
            borderColor = "border-red-500"; bgColor = "bg-red-900/10"; textColor = "text-red-400"; etiqueta = "SALIDA ABORTADA";
        } else {
            borderColor = "border-emerald-500"; bgColor = "bg-emerald-900/10"; textColor = "text-emerald-400"; etiqueta = "ENTRADA";
        }
        
        return `<div class="glass p-6 rounded-[2rem] flex justify-between items-center border-l-4 ${borderColor} ${bgColor} hover:bg-slate-800/40 transition-all mb-3">
            <div>
                <span class="text-[11px] font-black text-white tracking-tighter uppercase">${h.user} <span class="text-slate-700 mx-2">|</span> ${h.tipo}</span>
                <div class="text-[10px] italic historial-item font-bold mt-1 uppercase tracking-tight">${h.nom} - <span class="${textColor} font-black">${etiqueta}</span></div>
            </div>
            <div class="text-right">
                <div class="text-[8px] font-black text-slate-500 mb-1 tracking-widest uppercase">${fechaLimpia}</div>
                <div class="text-sm font-black text-slate-300">${h.hora}</div>
            </div>
        </div>`;
    }).join("");
    
    renderStatsGarita(); 
}

function renderPatio() {
    const filtro = (document.getElementById("filtroPatio").value || "").toLowerCase();
    
    const kpiPatioList = (estados) => {
        const f = patio.filter(p => estados.includes(p.estado));
        if (f.length === 0) return `<li class="text-slate-600 italic text-[10px]">Sin unidades</li>`;
        const tipos = [...new Set(f.map(p => p.tipo))];
        let html = tipos.map(t => `<li class="flex justify-between"><span class="text-slate-400 truncate mr-2">${t}</span><span class="text-white font-black">${f.filter(p => p.tipo === t).length}</span></li>`).join("");
        html += `<li class="border-t border-slate-700 mt-1 pt-1 flex justify-between"><span class="text-slate-300">Total</span><span class="text-white font-black">${f.length}</span></li>`;
        return html;
    };
    document.getElementById("listaKpiPatio").innerHTML = kpiPatioList(["EN_PATIO", "ASIGNADO"]);
    document.getElementById("listaKpiRampa").innerHTML = kpiPatioList(["EN_RAMPA", "CARGA_LISTA"]);
    
    const prioridadOrden = { "EN_PATIO": 1, "ASIGNADO": 2, "EN_RAMPA": 3, "CARGA_LISTA": 4, "CARGADO": 5, "ENVIADO_A_TIENDA": 6, "FUERA_DEL_RECINTO": 7 };

    const listado = patio
        .filter(u => !filtro || u.user.toLowerCase().includes(filtro) || u.nom.toLowerCase().includes(filtro) || (u.tipo || "").toLowerCase().includes(filtro))
        .sort((a, b) => {
            const pA = prioridadOrden[a.estado] || 99;
            const pB = prioridadOrden[b.estado] || 99;
            if (pA !== pB) return pA - pB; 
            return a.timestamp - b.timestamp; 
        });

    document.getElementById("tablaPatioCuerpo").innerHTML = listado.map(u => {
        const min = Math.floor((Date.now() - (u.lastUpdate || u.timestamp)) / 60000);
        const ui = ESTADOS_UI[u.estado] || { label: u.estado, class: "bg-slate-700 text-slate-300 border-slate-500" };
        
        return `<tr>
            <td class="font-black ${u.rampa ? 'text-emerald-400' : 'text-slate-600'}">${u.rampa ? 'R-' + u.rampa : '—'}</td>
            <td class="font-bold text-white">${u.user}</td>
            <td class="text-slate-400 max-w-[150px] truncate">${u.nom}</td>
            <td class="text-[10px] font-bold text-slate-400 uppercase">${u.tipo}</td>
            <td class="font-mono text-slate-500">${u.estado === 'ENVIADO_A_TIENDA' || u.estado === 'FUERA_DEL_RECINTO' ? '-' : min + 'm'}</td>
            <td><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border-b-2 ${ui.class}">${ui.label}</span></td>
            <td class="text-right">${u.estado === 'EN_PATIO' ? `<button onclick="asignarRampa('${u.user}')" class="bg-blue-600 hover:bg-blue-500 p-1.5 px-3 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 text-white border-none">Asignar</button>`: ''}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="7" class="text-center text-slate-600 py-12 italic text-sm">Sin unidades registradas</td></tr>`;
    
    document.getElementById("listaSolicitudesDespacho").innerHTML = solicitudesDespacho.map(s => `<div class="glass border border-blue-500/20 p-3 rounded-xl pulse-blue text-[10px]"><p class="text-blue-400 font-black">RAMPA ${s.rampa}</p><p class="text-slate-500 font-bold">${s.tipoReq || 'CUALQUIERA'}</p></div>`).join("") || "";
    
    renderStatsPatio(); 
}

async function asignarRampa(ficha) {
    const rampaInput = prompt("Ingrese número de Rampa (1-24):");
    if (!rampaInput) return;
    const rNum = parseInt(rampaInput);
    if (isNaN(rNum) || rNum < 1 || rNum > 24) return alert("Número de rampa inválido.");
    const ocupanteActual = patio.find(p => p.rampa == rNum && p.estado !== "ENVIADO_A_TIENDA");
    if (ocupanteActual) return alert(`⛔ ERROR: La rampa ${rNum} ya está ocupada.`);
    const rampaObj = rampas.find(r => r.rampa_id == rNum);
    if (rampaObj && rampaObj.status === "AVERIADA") return alert("⛔ RAMPA BLOQUEADA.");
    
    const idx = patio.findIndex(p => p.user === ficha);
    if (idx === -1) return;
    
    patio[idx].estado = "ASIGNADO"; 
    patio[idx].rampa = rNum;
    patio[idx].lastUpdate = Date.now();
    solicitudesDespacho = solicitudesDespacho.filter(s => s.rampa != rNum);
    registrarAuditoria(ficha, patio[idx].nom, "PATIO", `Asignado a Rampa ${rNum}`, patio[idx].idCiclo);
    document.getElementById("driverMsg").innerText = `Notificación enviada al chofer de la unidad ${ficha}.`;
    document.getElementById("driverAlert").classList.remove("hidden");
    await guardar();
    renderPatio();
}

function renderDespacho() {
    const grid = document.getElementById("gridDespacho");
    grid.innerHTML = "";
    for (let i = 1; i <= 24; i++) {
        const u = patio.find(p => p.rampa == i && p.estado !== "ENVIADO_A_TIENDA" && p.estado !== "FUERA_DEL_RECINTO");
        const rampaObj = rampas.find(r => r.rampa_id == i);
        const st = rampaObj ? rampaObj.status : "LIBRE";
        let content = "", cardStyle = "neon-card rounded-[2rem] p-6 text-center flex flex-col justify-center min-h-[140px] relative";

        if (st === "AVERIADA") {
            cardStyle += " neon-border-red";
            content = `<div class="text-red-500 font-black text-sm">🛠️ AVERIADA</div><button onclick="setSt(${i},'LIBRE')" class="mt-3 text-[8px] underline text-slate-400 hover:text-white transition-colors">Reparar</button>`;
        } else if (u) { 
            const btnReasignar = `<button onclick="reasignarRampa('${u.user}', ${i})" class="absolute top-3 right-3 text-[10px] text-slate-500 hover:text-blue-400 font-bold">🔄 Mover</button>`;
            if (u.estado === 'EN_RAMPA') {
                cardStyle += " neon-border-emerald";
                content = `${btnReasignar}<div class="text-emerald-400 font-black text-sm mt-2">${u.user}</div><div class="text-[9px] font-bold opacity-50 mt-0.5 uppercase truncate text-white">${u.nom.split(' ')[0]}</div><button onclick="finalizarCarga(${i})" class="mt-3 bg-emerald-600 hover:bg-emerald-500 w-full py-2 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 text-white border-none">Finalizar Carga</button>`;
            } else if (u.estado === 'ASIGNADO') {
                cardStyle += " neon-border-yellow animate-pulse";
                content = `${btnReasignar}<div class="text-yellow-400 font-black text-sm mt-2">${u.user}</div><div class="text-[9px] font-bold opacity-50 mt-0.5 uppercase truncate text-white">${u.nom.split(' ')[0]}</div><div class="text-yellow-400 text-[8px] font-black mt-2">⌛ ESPERANDO LLEGADA</div>`;
            } else if (u.estado === 'CARGA_LISTA') {
                cardStyle += " neon-border-purple animate-pulse";
                content = `${btnReasignar}<div class="text-purple-400 font-black text-sm mt-2">${u.user}</div><div class="text-[9px] font-bold opacity-50 mt-0.5 uppercase truncate text-white">${u.nom.split(' ')[0]}</div><div class="text-purple-400 text-[8px] font-black mt-2">⌛ ESPERANDO SALIDA</div>`;
            } else {
                cardStyle += " neon-border-red";
                content = `<div class="text-red-400 font-black text-sm">${u.user}</div><div class="text-red-400 text-[8px] font-black mt-2">⚠️ ATASCADO</div>`;
            }
        } else {
            const solicitud = solicitudesDespacho.find(s => s.rampa == i);
            if (solicitud) cardStyle += " pulse-blue";
            content = `<div class="font-black text-[10px] ${solicitud ? 'text-blue-400' : 'text-slate-600'}">${solicitud ? `🔵 SOLICITUD: ${solicitud.tipoReq}` : 'VACÍA'}</div><div class="flex gap-2 mt-4"><button onclick="setSt(${i},'SOLICITUD')" class="bg-blue-900/30 hover:bg-blue-900/60 text-blue-400 p-1 flex-1 rounded text-[7px] font-black uppercase transition-all border-none">Solicitar</button><button onclick="setSt(${i},'AVERIADA')" class="bg-red-900/30 hover:bg-red-900/60 text-red-400 p-1 flex-1 rounded text-[7px] font-black uppercase transition-all border-none">Avería</button></div>`;
        }
        grid.innerHTML += `<div class="${cardStyle}"><div class="text-[8px] font-black opacity-25 mb-2 uppercase tracking-widest text-left text-white">Rampa ${i}</div>${content}</div>`;
    }
}

async function setSt(i, s) {
    const rampaIndex = rampas.findIndex(r => r.rampa_id == i);
    if(rampaIndex !== -1) rampas[rampaIndex].status = s;
    if (s === "SOLICITUD") {
        const tipoReq = prompt("¿Qué tipo de camión necesita? (Ej: Contenedor)", "");
        if (!solicitudesDespacho.find(x => x.rampa == i)) {
            solicitudesDespacho.push({ rampa: i, tipoReq: tipoReq || "CUALQUIERA" });
            registrarAuditoria("N/A", "DESPACHO", "DESPACHO", `Solicitó Camión en Rampa ${i}`);
        }
    } else solicitudesDespacho = solicitudesDespacho.filter(x => x.rampa != i);
    await guardar();
    renderDespacho();
}

async function reasignarRampa(ficha, rampaActual) {
    const rNueva = prompt(`Mover unidad ${ficha}.\nIngrese NUEVA rampa (1-24):`);
    if(!rNueva) return;
    const n = parseInt(rNueva);
    if(isNaN(n) || n < 1 || n > 24) return alert("Número de rampa inválido.");
    if(n === rampaActual) return;
    
    const ocupada = patio.find(p => p.rampa == n && p.estado !== "ENVIADO_A_TIENDA");
    if(ocupada) return alert(`⛔ Rampa ${n} ocupada.`);
    
    const pIdx = patio.findIndex(p => p.user === ficha);
    patio[pIdx].rampa = n;

    const oldR = rampas.findIndex(r => r.rampa_id == rampaActual);
    if(oldR !== -1) rampas[oldR].status = "LIBRE";
    const newR = rampas.findIndex(r => r.rampa_id == n);
    if(newR !== -1) rampas[newR].status = "OCUPADA";

    registrarAuditoria(ficha, patio[pIdx].nom, "DESPACHO", `Movido de Rampa ${rampaActual} a ${n}`, patio[pIdx].idCiclo);
    await guardar();
    renderDespacho();
}

async function finalizarCarga(r) {
    const idx = patio.findIndex(p => p.rampa == r && p.estado !== "ENVIADO_A_TIENDA");
    if (idx === -1) return;
    patio[idx].estado = "CARGA_LISTA";
    patio[idx].t_fin_carga = Date.now(); 
    registrarAuditoria(patio[idx].user, patio[idx].nom, "DESPACHO", `Carga Finalizada en Rampa ${r}`, patio[idx].idCiclo);
    await guardar();
    renderDespacho();
}

// ---> NUEVO: Función auxiliar para reproducir sonido y vibrar <---
function reproducirAlerta() {
    try {
        const audio = new Audio('alerta.mp3');
        audio.play().catch(e => console.log("El navegador bloqueó el sonido automático.", e));
        
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([1000, 500, 1000]); 
        }
    } catch (error) {
        console.error("Error al reproducir alerta:", error);
    }
}

function cargarInfoChofer() {
    if (!usuarioLogueado) return;
    const vehiculo = patio.find(p => p.user === usuarioLogueado.cod && p.estado !== "ENVIADO_A_TIENDA" && p.estado !== "FUERA_DEL_RECINTO");
    document.getElementById("infoChoferNombre").innerText = usuarioLogueado.nom;
    const infoDiv = document.getElementById("infoChofer"), accionDiv = document.getElementById("accionChofer");

    // ---> INICIO LÓGICA DE ALARMA <---
    let estadoActual = vehiculo ? vehiculo.estado : "FUERA";
    
    // Comprueba si el estado guardado es distinto al estado actual
    if (estadoChoferAnterior !== null && estadoChoferAnterior !== estadoActual) {
        // Si el nuevo estado es "Asignado a rampa" o "Carga lista para salir", suena y vibra
        if (estadoActual === "ASIGNADO" || estadoActual === "CARGA_LISTA") {
            reproducirAlerta(); 
        }
    }
    
    // Actualiza la memoria con el estado actual para la próxima vez
    estadoChoferAnterior = estadoActual;
    // ---> FIN LÓGICA DE ALARMA <---

    if (!vehiculo) {
        infoDiv.innerHTML = '<span class="text-slate-500 text-base font-bold">Fuera de Recinto / En Tienda</span>';
        accionDiv.innerHTML = '';
        return;
    }

    switch (vehiculo.estado) {
        case "EN_PATIO":
            infoDiv.innerHTML = '<span class="text-blue-400">EN PATIO</span>'; accionDiv.innerHTML = '<p class="text-xs text-slate-500 mt-4">Aguarde asignación de rampa</p>'; break;
        case "ASIGNADO":
            infoDiv.innerHTML = `<span class="text-yellow-400 animate-pulse">¡ASIGNACIÓN!</span>`; accionDiv.innerHTML = `<div class="text-center space-y-4"><p class="text-lg text-slate-200">Diríjase a la <b class="text-yellow-400 text-2xl">Rampa ${vehiculo.rampa}</b></p><button onclick="choferConfirmaAsignacion()" class="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl text-lg uppercase shadow-xl active:scale-95 transition-transform">He llegado a la rampa</button></div>`; break;
        case "EN_RAMPA":
            infoDiv.innerHTML = `<span class="text-emerald-400">EN RAMPA ${vehiculo.rampa}</span>`; accionDiv.innerHTML = '<p class="text-xs text-slate-500 mt-4">Proceso de carga en curso...</p>'; break;
        case "CARGA_LISTA":
            infoDiv.innerHTML = `<span class="text-purple-400 animate-pulse">¡CARGA LISTA!</span>`; accionDiv.innerHTML = `<div class="text-center space-y-4"><p class="text-lg text-slate-200">Su carga en <b class="text-purple-400 text-2xl">Rampa ${vehiculo.rampa}</b> finalizó.</p><button onclick="choferConfirmaCarga()" class="w-full bg-purple-500 hover:bg-purple-400 text-white font-black py-4 rounded-2xl text-lg uppercase shadow-xl active:scale-95 transition-transform border-none">Confirmar Salida</button></div>`; break;
        case "CARGADO":
            infoDiv.innerHTML = `<span class="text-orange-400">CARGADO</span>`; accionDiv.innerHTML = '<p class="text-xs text-slate-400 mt-4">Diríjase a la garita para registrar su salida.</p>'; break;
    }
}

async function choferConfirmaAsignacion() {
    const idx = patio.findIndex(p => p.user === usuarioLogueado.cod && p.estado !== "ENVIADO_A_TIENDA");
    if (idx === -1 || patio[idx].estado !== 'ASIGNADO') return;
    patio[idx].estado = 'EN_RAMPA';
    patio[idx].t_llegada_rampa = Date.now(); 
    patio[idx].lastUpdate = Date.now();
    const rampaIndex = rampas.findIndex(r => r.rampa_id == patio[idx].rampa);
    if(rampaIndex !== -1) rampas[rampaIndex].status = "OCUPADA";
    registrarAuditoria(patio[idx].user, patio[idx].nom, "CHOFER", `Llegó a Rampa ${patio[idx].rampa}`, patio[idx].idCiclo);
    await guardar();
    cargarInfoChofer(); 
}

async function choferConfirmaCarga() {
    const idx = patio.findIndex(p => p.user === usuarioLogueado.cod && p.estado !== "ENVIADO_A_TIENDA");
    if (idx === -1 || patio[idx].estado !== 'CARGA_LISTA') return;
    const rampaLiberada = patio[idx].rampa;
    patio[idx].estado = 'CARGADO';
    patio[idx].rampa = null; 
    patio[idx].lastUpdate = Date.now();
    const rampaIndex = rampas.findIndex(r => r.rampa_id == rampaLiberada);
    if(rampaIndex !== -1) rampas[rampaIndex].status = "LIBRE";
    registrarAuditoria(patio[idx].user, patio[idx].nom, "CHOFER", `Liberó Rampa ${rampaLiberada}`, patio[idx].idCiclo);
    await guardar();
    cargarInfoChofer(); 
}

document.addEventListener('DOMContentLoaded', async () => { actualizarReloj(); await cargar(false); });