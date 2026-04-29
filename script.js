function renderPatio() {
    const filtroId = (document.getElementById("filtro_id") ? document.getElementById("filtro_id").value : "").toLowerCase();
    
    // 1. DIBUJAR KPIs LATERALES
    const kpiPatioList = (estados) => {
        const f = patio.filter(p => estados.includes(p.estado));
        if (f.length === 0) return `<li class="text-slate-600 italic text-[10px]">Sin unidades</li>`;
        const conteo = {};
        f.forEach(p => {
            let tipoNorm = (p.tipo || 'RIGIDO').replace(/ /g, '_').toUpperCase();
            let t = TIPOS_CAMION[tipoNorm] ? TIPOS_CAMION[tipoNorm].replace(' ❄️', '') : (p.tipo || 'RIGIDO');
            conteo[t] = (conteo[t] || 0) + 1;
        });
        let html = Object.keys(conteo).map(t => `<li class="flex justify-between items-center"><span class="text-slate-300">${t}</span><span class="text-white font-black bg-slate-800 px-2 py-0.5 rounded">${conteo[t]}</span></li>`).join("");
        html += `<li class="border-t border-white/10 mt-2 pt-2 flex justify-between items-center"><span class="text-slate-500">Total</span><span class="text-white font-black">${f.length}</span></li>`;
        return html;
    };

    document.getElementById("listaKpiPatio").innerHTML = kpiPatioList(["EN_PATIO", "ASIGNADO"]);
    document.getElementById("listaKpiRampa").innerHTML = kpiPatioList(["EN_RAMPA", "CARGA_LISTA"]);
    
    // 2. FILTRAR Y ORDENAR TABLA
    const prioridadOrden = { "EN_PATIO": 1, "ASIGNADO": 2, "EN_RAMPA": 3, "CARGA_LISTA": 4, "CARGADO": 5, "ENVIADO_A_TIENDA": 6, "FUERA_DEL_RECINTO": 7 };

    const listado = patio
        .filter(u => !filtroId || u.user.toLowerCase().includes(filtroId) || u.nom.toLowerCase().includes(filtroId))
        .sort((a, b) => {
            const pA = prioridadOrden[a.estado] || 99;
            const pB = prioridadOrden[b.estado] || 99;
            if (pA !== pB) return pA - pB; 
            return a.timestamp - b.timestamp; 
        });

    // Actualizar contador superior derecho
    if(document.getElementById("totalVehiculosHeader")) {
        document.getElementById("totalVehiculosHeader").innerText = `Total vehículos: ${listado.length}`;
    }

    // 3. DIBUJAR FILAS CON EL NUEVO DISEÑO GAMER
    document.getElementById("tablaPatioCuerpo").innerHTML = listado.map((u, index) => {
        const min = Math.floor((Date.now() - (u.lastUpdate || u.timestamp)) / 60000);
        const ui = ESTADOS_UI[u.estado] || { label: u.estado, class: "text-slate-400" };
        
        const ubicacionTexto = (u.estado === 'ENVIADO_A_TIENDA' && u.tienda) ? u.tienda : (u.rampa ? 'Rampa ' + u.rampa : 'Patio Central');
        
        // Color de fila alterno sutil
        const bgRow = index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent';

        // Botones estilo juego (Azules, redondos con icono)
        let accionesHtml = `<button onclick="cambiarEstadoManualmente('${u.user}')" class="bg-blue-600 hover:bg-blue-400 text-white p-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-[0_0_10px_rgba(37,99,235,0.4)] hover:scale-110 tooltip" title="Modificar">⚙️</button>`;
        if (u.estado === 'EN_PATIO') {
            accionesHtml += `<button onclick="asignarRampa('${u.user}')" class="bg-blue-500 hover:bg-blue-300 text-white p-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:scale-110 tooltip" title="Asignar">🎯</button>`;
        }

        return `<tr class="${bgRow} hover:bg-white/[0.05] transition-colors group">
            <td class="p-3 rounded-l-xl">
                <div class="flex items-center gap-3">
                    <span class="text-xl opacity-50 group-hover:opacity-100 transition-opacity">🚚</span>
                    <div>
                        <div class="font-bold text-slate-200 text-sm">${u.user}</div>
                        <div class="text-[9px] text-slate-500 uppercase">${u.nom.split(' ')[0]}</div>
                    </div>
                </div>
            </td>
            <td class="p-3 text-center text-slate-400 font-medium">${u.tipo}</td>
            <td class="p-3 text-center">
                <span class="bg-slate-950/50 border border-slate-700/50 px-3 py-1 rounded text-slate-300">${ubicacionTexto}</span>
            </td>
            <td class="p-3 text-right font-mono text-amber-500 font-bold tracking-wider">${u.estado === 'ENVIADO_A_TIENDA' || u.estado === 'FUERA_DEL_RECINTO' ? '-' : min + ' m'}</td>
            <td class="p-3 text-right font-black ${ui.text}">${ui.label}</td>
            <td class="p-3 rounded-r-xl text-center">
                <div class="flex items-center justify-center gap-2">${accionesHtml}</div>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="6" class="text-center text-slate-600 py-20 italic text-sm bg-slate-900/20 rounded-xl border border-dashed border-slate-700/50">No hay vehículos en el mercado activo</td></tr>`;
    
    renderStatsPatio(); 
}
