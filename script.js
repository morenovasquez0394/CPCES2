// --- START OF FILE script.js ---

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBGO96_Vvtna84xGKW31Xi0FodTiYFstUc_RPmXcq-tTRBbcYZoh_SMgiDZjd3xZYP2A/exec';

async function enviarTelegram(mensaje, fichaDestino = null){
    if (!fichaDestino) {
        console.warn("enviarTelegram llamado sin fichaDestino. Mensaje no enviado.");
        return; 
    }
    try {
        const payload = {
            action: "sendTelegram",
            ficha: fichaDestino,
            message: mensaje
        };
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        console.log(`Notificación de Telegram enviada a ${fichaDestino} via Apps Script.`);
    } catch(e) {
        console.error("Error al enviar Telegram via Apps Script:", e);
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
let TIPOS_CAMION = {'CAMION_FRIO':'CAMION FRIO ❄️','CAMION_SECO':'CAMION SECO','DOLLY':'DOLLY','FURGON_REF':'FURGON REF ❄️','FURGON_SECO':'FURGON SECO','RIGIDO':'RIGIDO'};

const ESTADOS_UI = {
    "EN_PATIO": { label: "En Patio", text: "text-blue-400" },
    "ASIGNADO": { label: "Asignado", text: "text-yellow-400" },
    "EN_RAMPA": { label: "En Rampa", text: "text-emerald-400" },
    "CARGA_LISTA": { label: "Carga Lista", text: "text-purple-400" },
    "CARGADO": { label: "📦 Cargado", text: "text-orange-400" },
    "ENVIADO_A_TIENDA": { label: "A Tienda", text: "text-cyan-400" },
    "FUERA_DEL_RECINTO": { label: "Abortado", text: "text-red-400" }
};

function setUILoading(isLoading){
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
    configuracion = [{ clave: 'RAMPAS', valor: valRampas }, { clave: 'TIENDAS', valor: valTiendas }, { clave: 'CAMIONES', valor: valCamiones }];
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
    return { fecha: `${dia}/${mes}/${anio}`, hora: d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }) };
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
    if (!document.getElementById("garita").classList.contains("hidden")) { renderHistorialGarita(); }
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
    
    if (m === 'admin') { switchAdminTab('form'); actualizarListaUsuarios(); renderAuditoria(); }
    if (m === 'garita') { renderHistorialGarita(); }
    if (m === 'patio') { renderPatio(); }
    if (m === 'despacho') renderDespacho();
    if (m === 'chofer') cargarInfoChofer();
}

function volverMenu() { 
    localStorage.setItem('cpces_modulo', 'menu');
    app.classList.add("hidden"); 
    menuPrincipal.classList.remove("hidden"); 
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
    document.getElementById("contTelegramChatId").classList.toggle("hidden", !isChofer); 
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
        nuevo.telegram_chat_id = document.getElementById("regTelegramChatId").value.trim();
    } else nuevo.pos = document.getElementById("regPosicion").value;
    usuarios.push(nuevo);
    await guardar();
    actualizarListaUsuarios();
    alert("VINCULADO.");
    document.getElementById("regCodigo").value = "";
    document.getElementById("regNombre").value = "";
    document.getElementById("regPassword").value = "";
    if (tipo === "CHOFER") document.getElementById("regTelegramChatId").value = ""; 
    document.getElementById("regCodigo").focus();
}

function actualizarListaUsuarios() {
    const lista = document.getElementById("listaUsuarios");
    if (!lista) return;

    lista.innerHTML = usuarios.map(u => {
        let detalles = u.tipoCamion || u.pos || '-';
        
        const tgBadge = (u.rol === "CHOFER" && u.telegram_chat_id) 
            ? `<div class="text-[9px] text-purple-400 font-bold mt-1">🆔 TG: ${u.telegram_chat_id}</div>` 
            : "";

        return `
        <tr class="hover:bg-slate-800/20 transition-all group">
            <td class="p-6"><span class="font-mono font-black text-blue-400 bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10">${u.cod}</span></td>
            <td class="p-6">
                <div class="font-black text-slate-200 text-sm uppercase">${u.nom}</div>
                <div class="text-[9px] text-slate-600 uppercase tracking-widest font-bold">${u.rol}</div>
                ${tgBadge}
            </td>
            <td class="p-6 text-[10px] text-slate-500 font-bold italic uppercase tracking-tighter">${detalles}</td>
            <td class="p-6 text-right">
                ${u.cod !== 'admin' ? `<button onclick="eliminarUser('${u.cod}')" class="text-red-900 group-hover:text-red-500 font-black text-[9px] uppercase tracking-widest transition-colors">Remover</button>`: '<span class="text-slate-800 font-black text-[8px] tracking-widest">SISTEMA</span>'}
            </td>
        </tr>`;
    }).join("");
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
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0, videoConstraints: { facingMode: "environment" } }, false);
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

    if (vehiculoEnPatio && (vehiculoEnPatio.estado === 'ENVIADO_A_TIENDA' || vehiculoEnPatio.estado === 'FUERA_DEL_RECINTO')) {
        const vehiculoIndex = patio.findIndex(p => p.user === ficha);
        const nuevoIdCiclo = "CYC-" + Date.now().toString().slice(-6);
        patio[vehiculoIndex] = { ...patio[vehiculoIndex], idCiclo: nuevoIdCiclo, estado: "EN_PATIO", hora: fh.hora, fecha: fh.fecha, timestamp: Date.now(), lastUpdate: Date.now(), rampa: null, tienda: null, t_llegada_rampa: "", t_fin_carga: "" };
        historialEntradas.unshift({ ...patio[vehiculoIndex] });
        msg.innerHTML = `<span class='text-emerald-500 tracking-widest'>RE-INGRESO OK: ${patio[vehiculoIndex].nom.split(' ')[0]}</span>`;
        fichaInput.value = "";
        await guardar();
        renderHistorialGarita();
        return; 
    }

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
            tiemposCiclos.unshift({ fecha: fh.fecha, ficha: ficha, ciclo: vehiculoEnPatio.idCiclo, hora_llegada: vehiculoEnPatio.hora, tiempo_patio: calcularDiferenciaMinutos(tEntrada, tAhora), tiempo_rampa: "N/A", tiempo_cargado: "N/A", hora_salida: fh.hora });
        } else if (vehiculoEnPatio.estado === "CARGADO" || vehiculoEnPatio.estado === "CARGA_LISTA") {
            if (vehiculoEnPatio.rampa) { 
                const rampaIndex = rampas.findIndex(r => r.rampa_id == vehiculoEnPatio.rampa);
                if(rampaIndex !== -1) rampas[rampaIndex].status = "LIBRE";
                vehiculoEnPatio.rampa = null;
            }
            vehiculoEnPatio.estado = "ENVIADO_A_TIENDA"; 
            msg.innerHTML = `<span class='text-cyan-400 tracking-widest'>SALIDA OK: ${vehiculoEnPatio.nom.split(' ')[0]}</span>`; 
            esSalidaValida = true;
            tiemposCiclos.unshift({ fecha: fh.fecha, ficha: ficha, ciclo: vehiculoEnPatio.idCiclo, hora_llegada: vehiculoEnPatio.hora, tiempo_patio: calcularDiferenciaMinutos(tEntrada, tLlegadaRampa), tiempo_rampa: calcularDiferenciaMinutos(tLlegadaRampa, tFinCarga), tiempo_cargado: calcularDiferenciaMinutos(tFinCarga, tAhora), hora_salida: fh.hora });
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
    const entrada = { idCiclo: nuevoIdCiclo, user: ficha, nom: usuarioInfo.nom, tipo: usuarioInfo.tipoCamion || "RIGIDO", hora: fh.hora, fecha: fh.fecha, estado: "EN_PATIO", timestamp: Date.now(), lastUpdate: Date.now(), rampa: null, tienda: null, t_llegada_rampa: "", t_fin_carga: "" };
    patio.push(entrada);
    historialEntradas.unshift({...entrada}); 
    
    msg.innerHTML = `<span class='text-emerald-500 tracking-widest'>ACCESO OK: ${usuarioInfo.nom.split(' ')[0]}</span>`;
    fichaInput.value = "";
    await guardar();
    renderHistorialGarita();
}

function renderHistorialGarita() {
    const container = document.getElementById("historialGarita");
    document.getElementById("countHistorial").innerText = historialEntradas.length + " Reg";
    container.innerHTML = historialEntradas.map(h => {
        let fechaLimpia = h.fecha;
        if (fechaLimpia && fechaLimpia.includes('T')) fechaLimpia = fechaLimpia.split('T')[0];
        let borderColor = "", bgColor = "", textColor = "", etiqueta = "";
        if (h.estado === 'ENVIADO_A_TIENDA') { borderColor = "border-cyan-500"; bgColor = "bg-cyan-900/10"; textColor = "text-cyan-400"; etiqueta = "SALIDA"; } 
        else if (h.estado === 'FUERA_DEL_RECINTO') { borderColor = "border-red-500"; bgColor = "bg-red-900/10"; textColor = "text-red-400"; etiqueta = "SALIDA ABORTADA"; } 
        else { borderColor = "border-emerald-500"; bgColor = "bg-emerald-900/10"; textColor = "text-emerald-400"; etiqueta = "ENTRADA"; }
        
        return `<div class="glass p-6 rounded-[2rem] flex justify-between items-center border-l-4 ${borderColor} ${bgColor} hover:bg-slate-800/40 transition-all mb-3"><div><span class="text-[11px] font-black text-white tracking-tighter uppercase">${h.user} <span class="text-slate-700 mx-2">|</span> ${h.tipo}</span><div class="text-[10px] italic historial-item font-bold mt-1 uppercase tracking-tight">${h.nom} - <span class="${textColor} font-black">${etiqueta}</span></div></div><div class="text-right"><div class="text-[8px] font-black text-slate-500 mb-1 tracking-widest uppercase">${fechaLimpia}</div><div class="text-sm font-black text-slate-300">${h.hora}</div></div></div>`;
    }).join("");
}

function abrirSelectorModal(titulo, opciones, callback) {
    const modal = document.getElementById('selectorModal');
    const container = document.getElementById('selectorOptionsContainer');
    document.getElementById('selectorModalTitle').innerText = titulo;
    
    container.innerHTML = '';
    opciones.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-4 rounded-xl bg-slate-800 hover:bg-blue-600 transition-all font-bold uppercase text-[10px] tracking-widest border border-slate-700 hover:border-white/50";
        btn.innerHTML = opt.label;
        btn.onclick = () => {
            modal.classList.add('hidden');
            callback(opt.value);
        };
        container.appendChild(btn);
    });
    
    modal.classList.remove('hidden');
}

function cerrarSelectorModal() {
    document.getElementById('selectorModal').classList.add('hidden');
}

async function cambiarEstadoManualmente(ficha) {
    const opts = Object.keys(ESTADOS_UI).map(key => ({ value: key, label: ESTADOS_UI[key].label }));
    
    abrirSelectorModal(`NUEVO ESTADO PARA ${ficha}`, opts, async (nuevoEstado) => {
        const idx = patio.findIndex(p => p.user === ficha);
        const vehiculo = patio[idx];
        const estadoAnterior = vehiculo.estado;

        if (nuevoEstado === "ENVIADO_A_TIENDA" || nuevoEstado === "FUERA_DEL_RECINTO" || nuevoEstado === "CARGADO" || nuevoEstado === "EN_PATIO") {
            if (vehiculo.rampa) {
                const rIndex = rampas.findIndex(r => r.rampa_id == vehiculo.rampa);
                if (rIndex !== -1) rampas[rIndex].status = "LIBRE";
                vehiculo.rampa = null;
            }
        }

        if(nuevoEstado === "EN_RAMPA" && !vehiculo.t_llegada_rampa) vehiculo.t_llegada_rampa = Date.now();
        if(nuevoEstado === "CARGA_LISTA" && !vehiculo.t_fin_carga) vehiculo.t_fin_carga = Date.now();

        vehiculo.estado = nuevoEstado;
        vehiculo.lastUpdate = Date.now();
        
        registrarAuditoria(ficha, vehiculo.nom, "PATIO (Manual)", `Cambió de ${estadoAnterior} a ${nuevoEstado}`, vehiculo.idCiclo);
        await guardar();
        renderPatio();
    });
}

function renderPatio() {
    const filtro = (document.getElementById("filtro_patio_general") ? document.getElementById("filtro_patio_general").value : "").toLowerCase();
    
    const kpiPatioList = (estados) => {
        const f = patio.filter(p => estados.includes(p.estado));
        if (f.length === 0) return `<li class="text-slate-600 italic text-[10px]">Sin unidades</li>`;
        const conteo = {};
        f.forEach(p => {
            let tipoNorm = (p.tipo || 'RIGIDO').replace(/ /g, '_').toUpperCase();
            let t = TIPOS_CAMION[tipoNorm] ? TIPOS_CAMION[tipoNorm].replace(/ \W/g, '') : (p.tipo || 'RIGIDO');
            conteo[t] = (conteo[t] || 0) + 1;
        });
        let html = Object.keys(conteo).map(t => `<li class="flex justify-between items-center"><span class="text-slate-300">${t}</span><span class="text-white font-black bg-slate-800 px-2 py-0.5 rounded">${conteo[t]}</span></li>`).join("");
        html += `<li class="border-t border-white/10 mt-2 pt-2 flex justify-between items-center"><span class="text-slate-500">Total</span><span class="text-white font-black">${f.length}</span></li>`;
        return html;
    };
    document.getElementById("listaKpiPatio").innerHTML = kpiPatioList(["EN_PATIO", "ASIGNADO"]);
    document.getElementById("listaKpiRampa").innerHTML = kpiPatioList(["EN_RAMPA", "CARGA_LISTA", "CARGADO"]);
    
    const hoy = formatoFechaHora().fecha;
    const viajesHoy = historialEntradas.filter(h => h.fecha === hoy && h.estado === 'ENVIADO_A_TIENDA').length;
    document.getElementById("kpiViajes").innerText = viajesHoy;

    const prioridadOrden = { "EN_PATIO": 1, "ASIGNADO": 2, "EN_RAMPA": 3, "CARGA_LISTA": 4, "CARGADO": 5, "ENVIADO_A_TIENDA": 6, "FUERA_DEL_RECINTO": 7 };
    const listado = patio.filter(u => {
        const estadoLabel = (ESTADOS_UI[u.estado] || {}).label || u.estado;
        const ubicacionTexto = (u.rampa ? `R-${u.rampa}` : 'Patio');
        return !filtro || 
               u.user.toLowerCase().includes(filtro) || 
               u.nom.toLowerCase().includes(filtro) ||
               (u.tipo || "").toLowerCase().includes(filtro) ||
               estadoLabel.toLowerCase().includes(filtro) ||
               ubicacionTexto.toLowerCase().includes(filtro);
    }).sort((a, b) => {
        const pA = prioridadOrden[a.estado] || 99;
        const pB = prioridadOrden[b.estado] || 99;
        if (pA !== pB) return pA - pB; 
        return a.timestamp - b.timestamp; 
    });

    if(document.getElementById("totalVehiculosHeader")) {
        document.getElementById("totalVehiculosHeader").innerText = `Total de Unidades: ${listado.length}`;
    }

    document.getElementById("tablaPatioCuerpo").innerHTML = listado.map((u, index) => {
        const min = Math.floor((Date.now() - (u.lastUpdate || u.timestamp)) / 60000);
        const ui = ESTADOS_UI[u.estado] || { label: u.estado, class: "text-slate-400" };
        
        let ubicacionTexto = u.rampa ? `R-${u.rampa}` : 'Patio';
        if (u.estado === 'ENVIADO_A_TIENDA' && u.tienda) ubicacionTexto = u.tienda;
        if (u.estado === 'FUERA_DEL_RECINTO') ubicacionTexto = '—';
        
        const bgRow = index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent';
        
        let truckIcon;
        if (u.tipo && u.tipo.toUpperCase().includes('FURGON SECO')) {
            truckIcon = '<span class="text-2xl">🚛</span>';
        } else if (u.tipo && u.tipo.toUpperCase().includes('FRIO')) {
            truckIcon = '<span class="text-xl text-cyan-400">🚚</span>';
        } else {
            truckIcon = '<span class="text-xl">🚚</span>';
        }

        let accionesHtml = `<button onclick="cambiarEstadoManualmente('${u.user}')" class="bg-blue-600 hover:bg-blue-400 text-white p-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-[0_0_10px_rgba(37,99,235,0.4)] hover:scale-110" title="Modificar">⚙️</button>`;
        if (u.estado === 'EN_PATIO') {
            accionesHtml += `<button onclick="asignarRampa('${u.user}')" class="bg-blue-500 hover:bg-blue-300 text-white p-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:scale-110" title="Asignar">🎯</button>`;
        }

        return `<tr class="${bgRow} hover:bg-white/[0.05] transition-colors group">
            <td class="p-3 rounded-l-xl">
                <div class="flex items-center gap-3">
                    ${truckIcon}
                    <div class="font-bold text-slate-200 text-sm">${u.user}</div>
                </div>
            </td>
            <td class="p-3 text-slate-400 truncate max-w-[150px]">${u.nom}</td>
            <td class="p-3 text-center text-slate-400 font-medium">${u.tipo}</td>
            <td class="p-3 text-center">
                <span class="bg-slate-950/50 border border-slate-700/50 px-3 py-1 rounded text-slate-300">${ubicacionTexto}</span>
            </td>
            <td class="p-3 text-center font-mono text-slate-400">${u.hora}</td>
            <td class="p-3 text-right font-mono text-amber-500 font-bold tracking-wider">${u.estado === 'ENVIADO_A_TIENDA' || u.estado === 'FUERA_DEL_RECINTO' ? '-' : min + ' m'}</td>
            <td class="p-3 text-right font-black ${ui.text}">${ui.label}</td>
            <td class="p-3 rounded-r-xl text-center">
                <div class="flex items-center justify-center gap-2">${accionesHtml}</div>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" class="text-center text-slate-600 py-20 italic text-sm bg-slate-900/20 rounded-xl border border-dashed border-slate-700/50">No hay unidades activas en patio</td></tr>`;
    
    document.getElementById("listaSolicitudesDespacho").innerHTML = solicitudesDespacho.map(s => `<div class="bg-cyan-900/30 border border-cyan-500/20 p-3 rounded-lg text-[10px]"><p class="text-cyan-400 font-black">RAMPA ${s.rampa}</p><p class="text-slate-400 font-bold">${s.tipoReq || 'CUALQUIERA'}</p></div>`).join("") || `<p class="text-slate-600 italic text-[10px]">Sin solicitudes pendientes</p>`;
}

async function asignarRampa(ficha) {
    let opcionesRampas = [];
    
    for (let i = 1; i <= TOTAL_RAMPAS; i++) {
        let st = rampas.find(r => r.rampa_id == i)?.status || "LIBRE";
        let u = patio.find(p => p.rampa == i && p.estado !== "ENVIADO_A_TIENDA" && p.estado !== "FUERA_DEL_RECINTO");
        let tieneSolicitud = solicitudesDespacho.find(s => s.rampa == i);
        
        let labelRight = "", classRight = "", prioridad = 4;

        if (st === "AVERIADA") {
            labelRight = "AVERIADA"; classRight = "text-red-400"; prioridad = 4;
        } else if (u) {
            labelRight = u.user; classRight = "text-emerald-400 font-black"; prioridad = 3;
        } else {
            if (tieneSolicitud) {
                labelRight = `SOLICITUD: ${tieneSolicitud.tipoReq}`; classRight = "text-blue-400 font-black animate-pulse"; prioridad = 1;
            } else {
                labelRight = "VACÍA"; classRight = "text-slate-500"; prioridad = 2;
            }
        }

        opcionesRampas.push({
            value: i,
            label: `<span class="flex justify-between items-center w-full"><span>RAMPA ${i}</span><span class="text-[9px] uppercase tracking-widest ${classRight}">${labelRight}</span></span>`,
            prioridad: prioridad
        });
    }
    
    opcionesRampas.sort((a, b) => a.prioridad - b.prioridad);

    abrirSelectorModal(`ASIGNAR RAMPA A ${ficha}`, opcionesRampas, async (rNum) => {
        const idx = patio.findIndex(p => p.user === ficha);
        patio[idx].estado = "ASIGNADO"; 
        patio[idx].rampa = rNum;
        patio[idx].lastUpdate = Date.now();
        solicitudesDespacho = solicitudesDespacho.filter(s => s.rampa != rNum);
        
        const rIndex = rampas.findIndex(r => r.rampa_id == rNum);
        if(rIndex !== -1) rampas[rIndex].status = "OCUPADA";
        else rampas.push({rampa_id: rNum, status: "OCUPADA"});

        registrarAuditoria(ficha, patio[idx].nom, "PATIO", `Asignado a Rampa ${rNum}`, patio[idx].idCiclo);
        
        await enviarTelegram(`🚛 <b>NUEVA ASIGNACIÓN</b>\n\nLa unidad <b>${ficha}</b> ha sido asignada a la <b>Rampa ${rNum}</b>.`, ficha);

        const driverAlert = document.getElementById("driverAlert");
        if(driverAlert) {
            document.getElementById("driverMsg").innerText = `Notificación enviada al chofer de la unidad ${ficha}.`;
            driverAlert.classList.remove("hidden");
        }
        
        await guardar();
        renderPatio();
    });
}

function renderDespacho() {
    const grid = document.getElementById("gridDespacho");
    grid.innerHTML = "";
    
    for (let i = 1; i <= TOTAL_RAMPAS; i++) {
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
    else rampas.push({rampa_id: i, status: s});
    
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
    const rampasOcupadas = patio.filter(p => p.rampa && p.estado !== "ENVIADO_A_TIENDA").map(p => parseInt(p.rampa));
    const rampasLibres = Array.from({length: TOTAL_RAMPAS}, (_, i) => i + 1).filter(n => !rampasOcupadas.includes(n));
    
    const opts = rampasLibres.map(n => ({ value: n, label: `RAMPA ${n}` }));

    abrirSelectorModal(`MOVER ${ficha} A:`, opts, async (n) => {
        if(n === rampaActual) return;
        const pIdx = patio.findIndex(p => p.user === ficha);
        patio[pIdx].rampa = n;

        const oldR = rampas.findIndex(r => r.rampa_id == rampaActual);
        if(oldR !== -1) rampas[oldR].status = "LIBRE";
        const newR = rampas.findIndex(r => r.rampa_id == n);
        if(newR !== -1) rampas[newR].status = "OCUPADA";
        else rampas.push({rampa_id: n, status: "OCUPADA"});

        registrarAuditoria(ficha, patio[pIdx].nom, "DESPACHO", `Movido de Rampa ${rampaActual} a ${n}`, patio[pIdx].idCiclo);
        await guardar();
        renderDespacho();
    });
}

async function finalizarCarga(r) {
    const idx = patio.findIndex(p => p.rampa == r && p.estado !== "ENVIADO_A_TIENDA");
    if (idx === -1) return;

    const opts = TIENDAS_LIST.map(t => ({ value: t, label: t }));

    abrirSelectorModal(`DESTINO PARA RAMPA ${r}`, opts, async (tiendaFinal) => {
        patio[idx].estado = "CARGA_LISTA";
        patio[idx].t_fin_carga = Date.now(); 
        patio[idx].tienda = tiendaFinal; 
        
        registrarAuditoria(patio[idx].user, patio[idx].nom, "DESPACHO", `Carga Finalizada en Rampa ${r} para ${tiendaFinal}`, patio[idx].idCiclo);
        
        // 🔔 TELEGRAM: Enviar alerta
        await enviarTelegram(`📦 <b>CARGA FINALIZADA</b>\n\nLa unidad <b>${patio[idx].user}</b> está cargada en Rampa ${r}.\nDestino: <b>${tiendaFinal}</b>.`, patio[idx].user);

        await guardar();
        renderDespacho();
    });
}

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

    let estadoActual = vehiculo ? vehiculo.estado : "FUERA";
    
    if (estadoChoferAnterior !== null && estadoChoferAnterior !== estadoActual) {
        if (estadoActual === "ASIGNADO" || estadoActual === "CARGA_LISTA") {
            reproducirAlerta(); 
        }
    }
    
    estadoChoferAnterior = estadoActual;

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
            infoDiv.innerHTML = `<span class="text-purple-400 animate-pulse">¡CARGA LISTA!</span>`; 
            accionDiv.innerHTML = `<div class="text-center space-y-4">
                <p class="text-lg text-slate-200">Su carga en <b class="text-purple-400 text-2xl">Rampa ${vehiculo.rampa}</b> finalizó.</p>
                <p class="text-base text-slate-300">Destino: <b class="text-white">${vehiculo.tienda || 'No especificado'}</b></p>
                <button onclick="choferConfirmaCarga()" class="w-full bg-purple-500 hover:bg-purple-400 text-white font-black py-4 rounded-2xl text-lg uppercase shadow-xl active:scale-95 transition-transform border-none">Confirmar Salida</button>
            </div>`; 
            break;
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
    
    // 🔔 TELEGRAM: Enviar alerta
    await enviarTelegram(`✅ <b>SALIDA DE RAMPA</b>\n\nLa unidad <b>${patio[idx].user}</b> ha abandonado la Rampa ${rampaLiberada} y se dirige a Despacho.`, patio[idx].user);

    await guardar();
    cargarInfoChofer(); 
}

document.addEventListener('DOMContentLoaded', async () => { 
    actualizarReloj(); 
    
    const btnLogin = document.getElementById("btnLogin");
    if(btnLogin) {
        btnLogin.innerText = "⏳ CONECTANDO...";
        btnLogin.disabled = true;
        btnLogin.classList.add("opacity-50", "cursor-not-allowed");
    }
    
    const savedUser = localStorage.getItem('cpces_user');
    const savedModule = localStorage.getItem('cpces_modulo');
    
    if (savedUser) {
        usuarioLogueado = JSON.parse(savedUser);
        document.getElementById("loginScreen").classList.add("hidden");
        
        document.getElementById("welcomeMsg").innerText = `OPERADOR: ${usuarioLogueado.nom} | ROL: ${usuarioLogueado.rol}`;
        filtrarMenu(usuarioLogueado.rol);

        if (!savedModule || savedModule === 'menu') {
            document.getElementById("menuPrincipal").classList.remove("hidden");
        }
    }
    
    await cargar(true); 
    
    if(btnLogin) {
        btnLogin.innerText = "INGRESAR";
        btnLogin.disabled = false;
        btnLogin.classList.remove("opacity-50", "cursor-not-allowed");
        document.getElementById("loginError").innerText = ""; 
    }
    
    if (usuarioLogueado && savedModule && savedModule !== 'menu') {
        abrirModulo(savedModule);
    }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registrado con éxito');
      }, err => {
        console.log('El registro del ServiceWorker falló: ', err);
      });
  });
}
