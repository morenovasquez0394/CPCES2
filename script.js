// --- START OF FILE script.js ---

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhY8yFiFjFjdcPFWHIZl_xcVzRvTlYOj1StYzeS7TaFBhKVgBkuCW252N58Vd7hQ4dsA/exec';
        
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

// ==========================================
// VARIABLES DINÁMICAS (AJUSTES DEL SISTEMA)
// ==========================================
let TOTAL_RAMPAS = 24; 
let TIENDAS_LIST = [
    "1100-WC", "1200-SV", "1300-SI", "1400-EN", "1500-ST", "1600-NC", 
    "1700-RC", "1800-IN", "1900-ES", "2000-LA", "2100-P27", "2200-BN", 
    "2300-PRO", "2400-OZ", "2500-VM", "2700-LUP", "2800-CHA", "2900-HIP", 
    "3000-PON", "3200-JM", "3300-LV", "3400-CRO", "3500-SC", "3600-NAC", 
    "3900-SFM", "4100-PC", "4200-YA", "4500-HIG"
];
let TIPOS_CAMION = {
    'CAMION_FRIO': 'CAMION FRIO ❄️',
    'CAMION_SECO': 'CAMION SECO',
    'DOLLY': 'DOLLY',
    'FURGON_REF': 'FURGON REF ❄️',
    'FURGON_SECO': 'FURGON SECO',
    'RIGIDO': 'RIGIDO'
};

const ESTADOS_UI = {
    "EN_PATIO": { label: "En Patio", class: "bg-blue-900/40 text-blue-400 border-blue-500", text: "text-blue-400" },
    "ASIGNADO": { label: "Asignado", class: "bg-yellow-900/40 text-yellow-400 border-yellow-500 animate-pulse", text: "text-yellow-400" },
    "EN_RAMPA": { label: "En Rampa", class: "bg-emerald-900/40 text-emerald-400 border-emerald-500", text: "text-emerald-400" },
    "CARGA_LISTA": { label: "Carga Lista", class: "bg-purple-900/40 text-purple-400 border-purple-500 animate-pulse", text: "text-purple-400" },
    "CARGADO": { label: "Cargado", class: "bg-orange-900/40 text-orange-400 border-orange-500", text: "text-orange-400" },
    "ENVIADO_A_TIENDA": { label: "A Tienda", class: "bg-cyan-900/40 text-cyan-400 border-cyan-500", text: "text-cyan-400" },
    "FUERA_DEL_RECINTO": { label: "Abortado", class: "bg-red-900/40 text-red-400 border-red-500", text: "text-red-400" }
};

function setUILoading(isLoading) {
    document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    document.body.style.opacity = isLoading ? '0.7' : '1';
}

async function guardar() {
    setUILoading(true);
    try {
        const dataPayload = { usuarios, patio, historialEntradas, solicitudesDespacho, rampas, auditoria, tiemposCiclos, configuracion };
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
        const urlFetch = serverLastUpdate ? `${SCRIPT_URL}?lastUpdate=${serverLastUpdate}` : SCRIPT_URL;
        
        const response = await fetch(urlFetch);
        if (!response.ok) throw new Error("Error red");
        const data = await response.json();
        
        if (data.changed === false) return;
        if (data.lastUpdate) serverLastUpdate = data.lastUpdate;
        
        usuarios = data.usuarios || [];
        patio = data.patio || [];
        historialEntradas = data.historialEntradas || [];
        solicitudesDespacho = data.solicitudesDespacho || [];
        rampas = data.rampas || [];
        auditoria = data.auditoria || [];
        tiemposCiclos = data.tiemposCiclos || [];
        configuracion = data.configuracion || [];

        // --- LECTURA DE AJUSTES DINÁMICOS ---
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
        console.error("Error al cargar:", error); 
    } 
    finally { if (!silencioso) setUILoading(false); }
}

async function guardarAjustesSistema() {
    if(!confirm("¿Estás seguro de modificar la estructura del sistema?")) return;

    const valRampas = document.getElementById("configRampas").value;
    const valTiendas = document.getElementById("configTiendas").value;
    const valCamiones = document.getElementById("configCamiones").value;

    configuracion = [
        { clave: 'RAMPAS', valor: valRampas },
        { clave: 'TIENDAS', valor: valTiendas },
        { clave: 'CAMIONES', valor: valCamiones }
    ];

    registrarAuditoria("SISTEMA", "ADMIN", "CONFIGURACIÓN", "Se modificaron parámetros del núcleo");

    await guardar();
    await cargar(false);
    alert("✅ SISTEMA ACTUALIZADO CORRECTAMENTE");
    if (!document.getElementById("despacho").classList.contains("hidden")) renderDespacho();
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
    if (document.getElementById("reloj")) document.getElementById("reloj").innerText = fh.hora;
    if (document.getElementById("fechaLarga")) document.getElementById("fechaLarga").innerText = fh.fecha;
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
    if (usuarios.length === 0) {
        document.getElementById("loginError").innerText = "⏳ Sincronizando datos, espere unos segundos y vuelva a intentar";
        return;
    }
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
    localStorage.setItem('cpces_user', JSON.stringify(usuarioLogueado));
    localStorage.setItem('cpces_modulo', 'menu');
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
    localStorage.setItem('cpces_modulo', m);
    menuPrincipal.classList.add("hidden");
    app.classList.remove("hidden");
    document.querySelectorAll("#app > div.flex-1 > div").forEach(x => x.classList.add("hidden"));
    document.getElementById(m).classList.remove("hidden");
    document.getElementById("tituloModulo").innerText = m.toUpperCase();
    actualizarReloj();
    document.getElementById("headerStats").innerHTML = "";
    
    if (m === 'admin') { 
        switchAdminTab('form'); // <-- Garantiza que no aparezca vacía la pantalla
        actualizarListaUsuarios(); 
        renderAuditoria(); 
    }
    if (m === 'garita') { renderHistorialGarita(); renderStatsGarita(); }
    if (m === 'patio') { renderPatio(); renderStatsPatio(); }
    if (m === 'despacho') renderDespacho();
    if (m === 'chofer') cargarInfoChofer();
}

function volverMenu() { 
    localStorage.setItem('cpces_modulo', 'menu');
    app.classList.add("hidden"); 
    menuPrincipal.classList.remove("hidden"); 
    
    // <-- ESTO SOLUCIONA QUE LOS BOTONES NO DESAPAREZCAN AL VOLVER -->
    if(usuarioLogueado) {
        document.getElementById("welcomeMsg").innerText = `OPERADOR: ${usuarioLogueado.nom} | ROL: ${usuarioLogueado.rol}`;
        filtrarMenu(usuarioLogueado.rol);
    }
}

function cerrarSesion() { 
    localStorage.removeItem('cpces_user');
    localStorage.removeItem('cpces_modulo');
    location.reload(); 
}

function switchAdminTab(tab) {
    document.getElementById("adminFormSection").classList.toggle("hidden", tab !== 'form');
    document.getElementById("adminAuditSection").classList.toggle("hidden", tab !== 'audit');
    document.getElementById("adminConfigSection").classList.toggle("hidden", tab !== 'config'); 
    
    const activeClass = "bg-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2";
    const inactiveClass = "bg-slate-800 text-slate-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all whitespace-nowrap flex items-center gap-2";
    
    document.getElementById("btnTabForm").className = tab === 'form' ? activeClass : inactiveClass;
    document.getElementById("btnTabAudit").className = tab === 'audit' ? activeClass : inactiveClass;
    document.getElementById("btnTabConfig").className = tab === 'config' ? activeClass : inactiveClass;
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
