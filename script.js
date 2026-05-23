/**
 * Sincroniza y actualiza los nuevos indicadores visuales del panel de patio.
 */
function actualizarIndicadoresNuevoPatio() {
    try {
        // 1. Unidades en Patio (Total)
        const totalEnPatio = (typeof patio !== 'undefined') ? patio.length : 0;
        const kpiPatioTotal = document.getElementById('kpiPatioTotal');
        if (kpiPatioTotal) kpiPatioTotal.innerText = totalEnPatio;

        // 2. Viajes de Hoy (Mapeado desde el indicador original del Header 'kpiViajes')
        const kpiViajesOriginal = document.getElementById('kpiViajes');
        if (kpiViajesOriginal) {
            const viajesHoy = kpiViajesOriginal.innerText || "0";
            
            const kpiViajesHoy = document.getElementById('kpiViajesHoy');
            if (kpiViajesHoy) kpiViajesHoy.innerText = viajesHoy;

            const footerViajesCount = document.getElementById('footerViajesCount');
            if (footerViajesCount) footerViajesCount.innerText = viajesHoy + " Viajes";
        }

        // 3. Unidades Despachadas (Lee el conteo de la lista oculta o del array local)
        let totalDespachadas = 0;
        const listaDespachadasOriginal = document.getElementById('listaKpiDespachadas');
        
        if (listaDespachadasOriginal && listaDespachadasOriginal.children.length > 0) {
            totalDespachadas = listaDespachadasOriginal.children.length;
        } else if (typeof patio !== 'undefined') {
            // Conteo alternativo filtrando unidades que ya fueron despachadas
            totalDespachadas = patio.filter(item => item.estado && item.estado.toUpperCase() === 'DESPACHADO').length;
        }

        const footerDespachadasCount = document.getElementById('footerDespachadasCount');
        if (footerDespachadasCount) footerDespachadasCount.innerText = totalDespachadas + " Unidades";

        // 4. Actualización del reloj en el Pie de Página
        const relojHeader = document.getElementById('reloj');
        const relojFooter = document.getElementById('relojFooter');
        if (relojHeader && relojFooter) {
            relojFooter.innerText = relojHeader.innerText;
        }

        const fechaHeader = document.getElementById('fechaLarga');
        const fechaFooter = document.getElementById('fechaFooter');
        if (fechaHeader && fechaFooter) {
            fechaFooter.innerText = fechaHeader.innerText || new Date().toLocaleDateString('es-ES');
        }

    } catch (e) {
        console.warn("Advertencia al sincronizar indicadores del patio:", e);
    }
}
