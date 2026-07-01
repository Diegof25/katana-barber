// =============================================================
//  KATANA BARBERSHOP — admin.js (SaaS Turnero)
//  Versión completa: tabs, stats, ocupación, horarios, bloqueos,
//  calendario mensual, rango de fechas, JWT para Safari iOS
// =============================================================

const API_BASE = 'https://turnos-backend-p9ka.onrender.com/api';
const SLUG     = 'katana-barbershop';
const API      = `${API_BASE}/${SLUG}`;

let PROFESIONAL_ID = null;

const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── fetch autenticado (con JWT para Safari iOS) ──────────────────
function fetchAdmin(url, options = {}) {
    const opts = {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    };
    try {
        const token = sessionStorage.getItem('admin_token');
        if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    } catch(e) {}
    return fetch(url, opts);
}

// ── Toast ────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'success') {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = `admin-toast toast-${tipo} visible`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// ════════════════════════════════════════════════════════
// SESIÓN
// ════════════════════════════════════════════════════════
async function verificarSesion() {
    try {
        await new Promise(r => setTimeout(r, 200));
        const res  = await fetchAdmin(`${API}/auth/check`);
        const data = await res.json();
        if (data.logueado) {
            PROFESIONAL_ID = data.profesionalId;
            try {
                sessionStorage.setItem('admin_pro_id', data.profesionalId);
                sessionStorage.setItem('admin_logueado', '1');
            } catch(e) {}
            mostrarPanelAdmin();
            return;
        }
    } catch {}

    // Respaldo sessionStorage (Safari iOS)
    try {
        const logueado = sessionStorage.getItem('admin_logueado');
        const proId    = sessionStorage.getItem('admin_pro_id');
        if (logueado === '1' && proId) {
            PROFESIONAL_ID = parseInt(proId);
            mostrarPanelAdmin();
            return;
        }
    } catch(e) {}

    window.location.href = 'login.html';
}

async function cerrarSesion() {
    if (!confirm('¿Cerrar sesión de administrador?')) return;
    try { await fetchAdmin(`${API}/auth/logout`, { method: 'POST' }); } catch {}
    try { sessionStorage.clear(); } catch(e) {}
    window.location.href = 'login.html';
}

function mostrarPanelAdmin() {
    document.getElementById('admin-fecha').value = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires'
    });
    cargarAgenda();
    cargarBloqueos();
    cargarHorariosAdmin();
    cargarCalendarioGeneralData();
}

// ════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════
function cambiarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelector(`[onclick="cambiarTab('${tab}')"]`).classList.add('active');
    if (tab === 'stats') {
        cargarOcupacion();
        cargarStats();
    }
}

// ════════════════════════════════════════════════════════
// AGENDA
// ════════════════════════════════════════════════════════
function formatearHora(isoString) {
    return new Date(isoString).toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

async function cargarAgenda() {
    const fecha    = document.getElementById('admin-fecha').value;
    const tabla    = document.getElementById('admin-tabla');
    const statsEl  = document.getElementById('admin-stats-dia');
    const contador = document.getElementById('contador');

    tabla.innerHTML = '<p class="empty-msg">Cargando...</p>';

    try {
        const res = await fetchAdmin(`${API}/turnos?fecha=${fecha}`);

        if (res.status === 403 || res.status === 401) {
            try { sessionStorage.clear(); } catch(e) {}
            window.location.href = 'login.html';
            return;
        }

        const data   = await res.json();
        const turnos = Array.isArray(data) ? data : (data.turnos || []);
        const stats  = data.stats || null;

        contador.innerText = `${turnos.length} TURNOS`;

        if (stats) {
            statsEl.innerHTML = `
                <div class="stats-dia-grid">
                    <div class="stat-dia-card"><span>CAJA DEL DÍA</span><strong style="color:#2ecc71">$${Number(stats.caja || 0).toLocaleString('es-AR')}</strong></div>
                    <div class="stat-dia-card"><span>TOTAL TURNOS</span><strong>${stats.total || turnos.length}</strong></div>
                    <div class="stat-dia-card"><span>COBRADOS</span><strong style="color:#2ecc71">${stats.cobrados || 0}</strong></div>
                    <div class="stat-dia-card"><span>PENDIENTES</span><strong style="color:#f1c40f">${stats.pendientes || 0}</strong></div>
                </div>`;
        } else {
            let sumaPagado = 0, sumaPendiente = 0, cobrados = 0, pendientes = 0;
            turnos.forEach(t => {
                const precio = parseFloat(t.servicio_precio) || 0;
                if (t.pagado) { sumaPagado += precio; cobrados++; }
                else          { sumaPendiente += precio; pendientes++; }
            });
            statsEl.innerHTML = `
                <div class="stats-dia-grid">
                    <div class="stat-dia-card"><span>CAJA DEL DÍA</span><strong style="color:#2ecc71">$${sumaPagado.toLocaleString('es-AR')}</strong></div>
                    <div class="stat-dia-card"><span>TOTAL TURNOS</span><strong>${turnos.length}</strong></div>
                    <div class="stat-dia-card"><span>COBRADOS</span><strong style="color:#2ecc71">${cobrados}</strong></div>
                    <div class="stat-dia-card"><span>POR COBRAR</span><strong style="color:#f1c40f">$${sumaPendiente.toLocaleString('es-AR')}</strong></div>
                </div>`;
        }

        renderTabla(turnos, tabla);

    } catch (e) {
        console.error(e);
        tabla.innerHTML = '<p class="empty-msg">Error al cargar los turnos.</p>';
    }
}

function renderTabla(turnos, tabla) {
    if (!turnos.length) {
        tabla.innerHTML = '<div class="no-datos"><i class="fas fa-calendar-check"></i><span>La agenda está limpia por ahora.</span></div>';
        return;
    }

    tabla.innerHTML = `
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Hora</th><th>Cliente</th><th>Contacto</th>
                        <th>Servicio</th><th>Estado</th><th>Pago</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${turnos.map(t => {
                        const hora      = formatearHora(t.fecha_hora);
                        const telLimpio = (t.cliente_tel || '').replace(/\D/g, '');
                        const precio    = parseFloat(t.servicio_precio) || 0;
                        const celdaCobro = t.pagado
                            ? `<span class="badge badge-confirmado"><i class="fas fa-check-circle"></i> ${t.metodo_pago || 'cobrado'}</span>`
                            : `<button class="btn-cobrar" onclick="abrirModalCobro(${t.id},'${(t.servicio_nombre||'').replace(/'/g,"\\'")}',${precio})"><i class="fas fa-dollar-sign"></i> COBRAR</button>`;
                        return `
                            <tr id="row-${t.id}">
                                <td><strong style="color:var(--accent);font-size:1rem">${hora} hs</strong></td>
                                <td>
                                    <strong>${t.cliente_nombre}</strong>
                                    ${t.notas ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">${t.notas}</div>` : ''}
                                </td>
                                <td>${telLimpio ? `<a href="https://wa.me/54${telLimpio}" target="_blank" class="btn-ws"><i class="fab fa-whatsapp"></i> WS</a>` : '—'}</td>
                                <td style="font-size:.85rem">${t.servicio_nombre || '—'}<br><span style="color:#2ecc71;font-weight:700">$${precio.toLocaleString('es-AR')}</span></td>
                                <td><span class="badge badge-${t.estado || 'pendiente'}">${t.estado || 'pendiente'}</span></td>
                                <td>${celdaCobro}</td>
                                <td>
                                    <div class="acciones-btns">
                                        ${t.estado !== 'confirmado' ? `<button class="btn-accion btn-confirmar" onclick="cambiarEstado(${t.id},'confirmado')" title="Confirmar">✓</button>` : ''}
                                        ${t.estado !== 'cancelado'  ? `<button class="btn-accion btn-cancelar"  onclick="cambiarEstado(${t.id},'cancelado')"  title="Cancelar">✗</button>`  : ''}
                                        <button class="btn-accion btn-eliminar" onclick="eliminarTurno(${t.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div class="turnos-cards-mobile">
            ${turnos.map(t => {
                const hora      = formatearHora(t.fecha_hora);
                const telLimpio = (t.cliente_tel || '').replace(/\D/g, '');
                const precio    = parseFloat(t.servicio_precio) || 0;
                return `
                    <div class="turno-card-mobile">
                        <div class="turno-card-mobile-header">
                            <span class="turno-card-mobile-hora">${hora} hs</span>
                            <span class="badge badge-${t.estado || 'pendiente'}">${t.estado || 'pendiente'}</span>
                        </div>
                        <div class="turno-card-mobile-nombre">${t.cliente_nombre}</div>
                        <div class="turno-card-mobile-servicio">${t.servicio_nombre || '—'} <span style="color:#2ecc71;font-weight:700">$${precio.toLocaleString('es-AR')}</span></div>
                        ${t.notas ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${t.notas}</div>` : ''}
                        ${telLimpio ? `<a href="https://wa.me/54${telLimpio}" target="_blank" class="btn-ws" style="margin-top:8px;display:inline-flex"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                        <div class="turno-card-mobile-acciones">
                            ${!t.pagado ? `<button class="btn-cobrar" onclick="abrirModalCobro(${t.id},'${(t.servicio_nombre||'').replace(/'/g,"\\'")}',${precio})"><i class="fas fa-dollar-sign"></i> COBRAR</button>`
                                        : `<span class="badge badge-confirmado"><i class="fas fa-check-circle"></i> ${t.metodo_pago || 'cobrado'}</span>`}
                            ${t.estado !== 'confirmado' ? `<button class="btn-accion btn-confirmar" onclick="cambiarEstado(${t.id},'confirmado')">✓ Confirmar</button>` : ''}
                            ${t.estado !== 'cancelado'  ? `<button class="btn-accion btn-cancelar"  onclick="cambiarEstado(${t.id},'cancelado')">✗ Cancelar</button>`  : ''}
                            <button class="btn-accion btn-eliminar" onclick="eliminarTurno(${t.id})"><i class="fas fa-trash-alt"></i> Eliminar</button>
                        </div>
                    </div>`;
            }).join('')}
        </div>`;
}

async function cambiarEstado(id, estado) {
    try {
        const res = await fetchAdmin(`${API}/turnos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado })
        });
        if (!res.ok) throw new Error();
        mostrarToast(`Turno ${estado === 'confirmado' ? 'confirmado ✓' : 'cancelado ✓'}`, estado === 'confirmado' ? 'success' : 'warning');
        cargarAgenda();
        cargarCalendarioGeneralData();
    } catch { mostrarToast('No se pudo actualizar.', 'error'); }
}

async function eliminarTurno(id) {
    if (!confirm('¿Eliminar este turno? Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetchAdmin(`${API}/turnos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        mostrarToast('Turno eliminado ✓', 'success');
        cargarAgenda();
        cargarCalendarioGeneralData();
    } catch { mostrarToast('No se pudo eliminar.', 'error'); }
}

// ════════════════════════════════════════════════════════
// CALENDARIO MENSUAL (FullCalendar)
// ════════════════════════════════════════════════════════
let calendarGeneral = null;

function inicializarCalendarioGeneral(turnos) {
    const calendarEl = document.getElementById('calendario-general-admin');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    const eventos = turnos.map(t => {
        let color = '#ffb400';
        if (t.estado === 'confirmado') color = '#2ecc71';
        if (t.estado === 'cancelado')  color = '#ff4444';
        return {
            id:              t.id,
            title:           `${t.cliente_nombre}`,
            start:           t.fecha_hora,
            backgroundColor: color,
            borderColor:     color
        };
    });

    if (calendarGeneral) calendarGeneral.destroy();

    calendarGeneral = new FullCalendar.Calendar(calendarEl, {
        initialView:   'dayGridMonth',
        locale:        'es',
        firstDay:      1,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        buttonText:    { today: 'Hoy', month: 'Mes', week: 'Semana' },
        events:        eventos,
        eventClick: function(info) {
            const fecha = info.event.startStr.split('T')[0];
            const input = document.getElementById('admin-fecha');
            if (input) {
                input.value = fecha;
                cargarAgenda();
                cambiarTab('agenda');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },
        height:      'auto',
        aspectRatio: 1.4
    });

    calendarGeneral.render();
}

async function cargarCalendarioGeneralData() {
    try {
        const res = await fetchAdmin(`${API}/turnos`);
        if (res.ok) {
            const data   = await res.json();
            const turnos = Array.isArray(data) ? data : (data.turnos || []);
            inicializarCalendarioGeneral(turnos);
        }
    } catch {}
}

// ════════════════════════════════════════════════════════
// MODAL COBRO
// ════════════════════════════════════════════════════════
function abrirModalCobro(turnoId, servicioNombre, precioBase) {
    let modal = document.getElementById('modal-cobro');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-cobro';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3><i class="fas fa-dollar-sign" style="color:var(--accent)"></i> Registrar cobro</h3>
                <button class="modal-close" onclick="cerrarModalCobro()">✕</button>
            </div>
            <div class="modal-servicio-nombre">${servicioNombre}</div>
            <div class="modal-row">
                <label class="modal-label">Precio base</label>
                <div class="modal-precio-base">$${Number(precioBase).toLocaleString('es-AR')}</div>
            </div>
            <div class="modal-row">
                <label class="modal-label">Método de pago</label>
                <div class="modal-metodos">
                    <button class="metodo-btn active" id="metodo-efectivo"       onclick="seleccionarMetodo('efectivo')">💵 Efectivo</button>
                    <button class="metodo-btn"         id="metodo-transferencia" onclick="seleccionarMetodo('transferencia')">📲 Transferencia</button>
                    <button class="metodo-btn"         id="metodo-debito"        onclick="seleccionarMetodo('debito')">💳 Débito</button>
                </div>
            </div>
            <button class="btn-modal-confirmar" onclick="confirmarCobro(${turnoId},${precioBase})">
                <i class="fas fa-check-circle"></i> CONFIRMAR COBRO
            </button>
        </div>`;
    modal.classList.add('visible');
    modal._metodo = 'efectivo';
}

function seleccionarMetodo(metodo) {
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`metodo-${metodo}`)?.classList.add('active');
    document.getElementById('modal-cobro')._metodo = metodo;
}

function cerrarModalCobro() {
    document.getElementById('modal-cobro')?.classList.remove('visible');
}

async function confirmarCobro(turnoId, precioBase) {
    const modal  = document.getElementById('modal-cobro');
    const metodo = modal?._metodo || 'efectivo';
    try {
        const res = await fetchAdmin(`${API}/turnos/${turnoId}`, {
            method: 'PATCH',
            body: JSON.stringify({ pagado: true, metodo_pago: metodo })
        });
        if (!res.ok) throw new Error();
        mostrarToast(`Cobro registrado: $${Number(precioBase).toLocaleString('es-AR')} ✓`, 'success');
        cerrarModalCobro();
        cargarAgenda();
    } catch { mostrarToast('No se pudo registrar el cobro.', 'error'); }
}

// ════════════════════════════════════════════════════════
// TURNO MANUAL
// ════════════════════════════════════════════════════════
async function abrirModalTurnoManual() {
    let modal = document.getElementById('modal-turno-manual');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-turno-manual';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    const fechaDefault = document.getElementById('admin-fecha')?.value
        || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle" style="color:var(--accent)"></i> Cargar turno manual</h3>
                <button class="modal-close" onclick="cerrarModalTurnoManual()">✕</button>
            </div>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:20px">Para clientes que reservan por teléfono o WhatsApp</p>
            <div class="modal-row">
                <label class="modal-label">Nombre del cliente *</label>
                <input type="text" id="manual-nombre" class="input-modal" placeholder="Ej: Juan González" />
            </div>
            <div class="modal-row">
                <label class="modal-label">Teléfono *</label>
                <input type="tel" id="manual-telefono" class="input-modal" placeholder="Ej: 3454123456" />
            </div>
            <div class="modal-row">
                <label class="modal-label">Servicio *</label>
                <select id="manual-servicio" class="input-modal" onchange="cargarHorariosManual()">
                    <option value="">Cargando servicios...</option>
                </select>
            </div>
            <div class="modal-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div>
                    <label class="modal-label">Fecha *</label>
                    <input type="date" id="manual-fecha" class="input-modal" value="${fechaDefault}" onchange="cargarHorariosManual()" />
                </div>
                <div>
                    <label class="modal-label">Hora *</label>
                    <select id="manual-hora" class="input-modal" disabled>
                        <option value="">Elegí fecha primero</option>
                    </select>
                </div>
            </div>
            <div class="modal-row">
                <label class="modal-label">Notas <span style="font-weight:300">(opcional)</span></label>
                <input type="text" id="manual-notas" class="input-modal" placeholder="Observaciones..." />
            </div>
            <p id="manual-error" style="color:#ff4444;font-size:.8rem;display:none;margin-bottom:10px"></p>
            <button class="btn-modal-confirmar" onclick="guardarTurnoManual()">
                <i class="fas fa-check-circle"></i> GUARDAR TURNO
            </button>
        </div>`;
    modal.classList.add('visible');
    await cargarServiciosManual();
}

function cerrarModalTurnoManual() {
    document.getElementById('modal-turno-manual')?.classList.remove('visible');
}

async function cargarServiciosManual() {
    const select = document.getElementById('manual-servicio');
    if (!select) return;
    try {
        const res      = await fetchAdmin(`${API}/servicios`);
        const servicios = await res.json();
        select.innerHTML = '<option value="">Seleccioná un servicio</option>' +
            servicios.map(s => `<option value="${s.id}">${s.nombre} — $${Number(s.precio).toLocaleString('es-AR')}</option>`).join('');
    } catch { select.innerHTML = '<option value="">Error al cargar servicios</option>'; }
}

async function cargarHorariosManual() {
    const fecha      = document.getElementById('manual-fecha')?.value;
    const servicioId = document.getElementById('manual-servicio')?.value;
    const selectHora = document.getElementById('manual-hora');
    if (!fecha || !servicioId || !PROFESIONAL_ID) {
        selectHora.innerHTML = '<option value="">Elegí fecha y servicio</option>';
        selectHora.disabled  = true;
        return;
    }
    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
    selectHora.disabled  = true;
    try {
        const res  = await fetchAdmin(`${API}/turnos/horarios-disponibles?fecha=${fecha}&profesional_id=${PROFESIONAL_ID}&servicio_id=${servicioId}`);
        const data = await res.json();
        if (data.horarios && data.horarios.length > 0) {
            selectHora.innerHTML = '<option value="">Seleccioná una hora</option>' +
                data.horarios.map(h => `<option value="${h}">${h} hs</option>`).join('');
            selectHora.disabled = false;
        } else {
            selectHora.innerHTML = `<option value="">${data.mensaje || 'Sin horarios disponibles'}</option>`;
        }
    } catch { selectHora.innerHTML = '<option value="">Error al cargar horarios</option>'; }
}

async function guardarTurnoManual() {
    const nombre     = document.getElementById('manual-nombre')?.value.trim();
    const telefono   = document.getElementById('manual-telefono')?.value.trim();
    const servicioId = document.getElementById('manual-servicio')?.value;
    const fecha      = document.getElementById('manual-fecha')?.value;
    const hora       = document.getElementById('manual-hora')?.value;
    const notas      = document.getElementById('manual-notas')?.value.trim();
    const errorEl    = document.getElementById('manual-error');
    errorEl.style.display = 'none';
    if (!nombre || !telefono || !servicioId || !fecha || !hora) {
        errorEl.textContent   = 'Completá todos los campos obligatorios (*)';
        errorEl.style.display = 'block';
        return;
    }
    try {
        const res = await fetchAdmin(`${API}/turnos`, {
            method: 'POST',
            body: JSON.stringify({
                profesional_id: PROFESIONAL_ID,
                servicio_id:    parseInt(servicioId),
                cliente_nombre: nombre,
                cliente_tel:    telefono.replace(/\D/g, ''),
                fecha_hora:     `${fecha}T${hora}:00-03:00`,
                notas:          notas || ''
            })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al guardar'); }
        mostrarToast('Turno cargado ✓', 'success');
        cerrarModalTurnoManual();
        const fechaAgenda = document.getElementById('admin-fecha')?.value;
        if (fechaAgenda === fecha) cargarAgenda();
        cargarCalendarioGeneralData();
    } catch (err) {
        errorEl.textContent   = err.message || 'Error de conexión.';
        errorEl.style.display = 'block';
    }
}

// ════════════════════════════════════════════════════════
// ESTADÍSTICAS — OCUPACIÓN
// ════════════════════════════════════════════════════════
async function cargarOcupacion() {
    const contenedor = document.getElementById('ocupacion-stats');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Cargando ocupación...</p>';
    try {
        const res = await fetchAdmin(`${API}/profesionales/${PROFESIONAL_ID}/ocupacion`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        const colorBarra = d.porcentaje >= 80 ? '#2ecc71' : d.porcentaje >= 50 ? '#ffb400' : '#ff4444';
        const circunf    = Math.round(2 * Math.PI * 34);
        const arco       = Math.round(circunf * d.porcentaje / 100);
        let variacionHtml = '';
        if (d.variacion !== null && d.variacion !== undefined) {
            const v = parseFloat(d.variacion);
            if      (v > 0) variacionHtml = `<span class="ocup-variacion positiva">▲ +${v}% vs semana pasada</span>`;
            else if (v < 0) variacionHtml = `<span class="ocup-variacion negativa">▼ ${v}% vs semana pasada</span>`;
            else            variacionHtml = `<span class="ocup-variacion neutral">= igual que la semana pasada</span>`;
        } else {
            variacionHtml = `<span class="ocup-variacion neutral">Sin datos semana anterior</span>`;
        }
        const turnosPorDia = d.turnos_por_dia || [];
        const maxTurnos    = Math.max(...turnosPorDia.map(t => t.total), 1);
        const barrasDia    = DIAS_CORTO.map((dia, i) => {
            const datos  = turnosPorDia.find(t => t.dia === i) || { total: 0 };
            const altura = datos.total > 0 ? Math.max(Math.round((datos.total / maxTurnos) * 60), 4) : 3;
            return `
                <div class="dia-bar-wrap">
                    <div class="dia-bar-num">${datos.total > 0 ? datos.total : ''}</div>
                    <div class="dia-bar" style="height:${altura}px;background:${datos.total > 0 ? colorBarra : '#252525'}"></div>
                    <div class="dia-bar-label">${dia}</div>
                </div>`;
        }).join('');
        contenedor.innerHTML = `
            <div class="ocup-card">
                <div class="ocup-header">
                    <div>
                        <div class="ocup-eyebrow">ESTA SEMANA</div>
                        <div class="ocup-pct">${d.porcentaje}<span class="ocup-pct-sym">%</span></div>
                        <div class="ocup-sub">${d.semana_actual} turno${d.semana_actual !== 1 ? 's' : ''} de ${d.slots_posibles || '?'} posibles</div>
                        ${variacionHtml}
                    </div>
                    <div class="ocup-ring-wrap">
                        <svg viewBox="0 0 80 80" class="ocup-ring">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#252525" stroke-width="8"/>
                            <circle cx="40" cy="40" r="34" fill="none" stroke="${colorBarra}" stroke-width="8"
                                stroke-dasharray="${arco} ${circunf}" stroke-linecap="round" transform="rotate(-90 40 40)"/>
                        </svg>
                        <div class="ocup-ring-label" style="color:${colorBarra}">${d.porcentaje}%</div>
                    </div>
                </div>
                <div class="ocup-dias-titulo">TURNOS POR DÍA ESTA SEMANA</div>
                <div class="ocup-dias-barras">${barrasDia}</div>
                ${d.mejor_dia !== undefined && d.mejor_dia !== null ? `<div class="ocup-mejor-dia">⭐ Mejor día histórico: <strong>${DIAS_NOMBRE[d.mejor_dia.dia || d.mejor_dia]}</strong></div>` : ''}
            </div>`;
    } catch {
        contenedor.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">No se pudo cargar la ocupación.</p>';
    }
}

// ════════════════════════════════════════════════════════
// ESTADÍSTICAS — MENSUALES
// ════════════════════════════════════════════════════════
async function cargarStats() {
    const mes  = document.getElementById('stats-mes')?.value  || (new Date().getMonth() + 1);
    const anio = document.getElementById('stats-anio')?.value || new Date().getFullYear();
    const cont = document.getElementById('stats-resultado');
    if (!cont) return;
    try {
        const res = await fetchAdmin(`${API}/turnos/stats?mes=${mes}&anio=${anio}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        cont.innerHTML = `
            <div class="stats-mes-grid">
                <div class="stat-mes-card"><span>TOTAL TURNOS</span><strong>${d.total_turnos || 0}</strong></div>
                <div class="stat-mes-card"><span>COBRADOS</span><strong style="color:#2ecc71">${d.cobrados || 0}</strong></div>
                <div class="stat-mes-card"><span>PENDIENTES</span><strong style="color:#f1c40f">${d.pendientes || 0}</strong></div>
                <div class="stat-mes-card"><span>RECAUDADO</span><strong style="color:var(--accent);font-size:1.4rem">$${Number(d.recaudado || 0).toLocaleString('es-AR')}</strong></div>
            </div>`;
    } catch {
        cont.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:16px 0">No se pudieron cargar las estadísticas.</p>';
    }
}

// ════════════════════════════════════════════════════════
// ESTADÍSTICAS — RANGO DE FECHAS
// ════════════════════════════════════════════════════════
async function buscarRangoPersonalizado() {
    const desde = document.getElementById('stats-rango-desde').value;
    const hasta = document.getElementById('stats-rango-hasta').value;
    const cont  = document.getElementById('rango-resultado');
    if (!desde || !hasta) { mostrarToast('Seleccioná las dos fechas.', 'error'); return; }

    try {
        const res = await fetchAdmin(`${API}/turnos/stats-rango?desde=${desde}&hasta=${hasta}`);
        if (!res.ok) throw new Error();
        const d = await res.json();

        document.getElementById('rango-total-turnos').textContent   = d.total_turnos    || 0;
        document.getElementById('rango-clientes-unicos').textContent = d.clientes_unicos || 0;
        document.getElementById('rango-recaudado').textContent       = Number(d.recaudado || 0).toLocaleString('es-AR');
        cont.classList.remove('hidden');

        await cargarGraficoRango(desde, hasta);
    } catch { mostrarToast('Error al buscar el rango.', 'error'); }
}

async function cargarGraficoRango(desde, hasta) {
    const wrap = document.getElementById('rango-grafico-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">Cargando gráfico...</p>';

    try {
        const res  = await fetchAdmin(`${API}/turnos/stats-rango-dias?desde=${desde}&hasta=${hasta}`);
        if (!res.ok) throw new Error();
        const dias = await res.json();

        if (!dias.length) {
            wrap.innerHTML = `<div class="rango-grafico-card"><div class="rango-grafico-titulo">Turnos por día</div><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.85rem">Sin turnos en este período</div></div>`;
            return;
        }

        const maxTurnos = Math.max(...dias.map(d => d.total), 1);
        const barras = dias.map(d => {
            const [, mes, dia] = d.fecha.split('-');
            const altura = d.total > 0 ? Math.max(Math.round((d.total / maxTurnos) * 70), 4) : 2;
            return `
                <div class="rango-bar-wrap">
                    <div class="rango-bar-num">${d.total > 0 ? d.total : ''}</div>
                    <div class="rango-bar" style="height:${altura}px"></div>
                    <div class="rango-bar-label">${dia}/${mes}</div>
                </div>`;
        }).join('');

        wrap.innerHTML = `
            <div class="rango-grafico-card">
                <div class="rango-grafico-titulo">TURNOS POR DÍA DEL PERÍODO</div>
                <div class="rango-barras-scroll">${barras}</div>
            </div>`;
    } catch {
        wrap.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">No se pudo cargar el gráfico.</p>';
    }
}

// ════════════════════════════════════════════════════════
// HORARIOS POR DÍA
// ════════════════════════════════════════════════════════
let horariosLocales = [];

function inicializarHorarios() {
    horariosLocales = Array.from({ length: 7 }, (_, i) => ({
        dia_semana: i, manana_activa: false, manana_inicio: '09:00', manana_fin: '12:00',
        tarde_activa: false, tarde_inicio: '14:00', tarde_fin: '20:00', intervalo: 30
    }));
}

async function cargarHorariosAdmin() {
    if (!PROFESIONAL_ID) return;
    inicializarHorarios();
    try {
        const res = await fetchAdmin(`${API}/profesionales/${PROFESIONAL_ID}/horarios`);
        if (!res.ok) return;
        const dias = await res.json();
        if (dias && dias.length > 0) {
            horariosLocales = dias.map(d => ({
                dia_semana:    d.dia_semana,
                manana_activa: !!d.manana_activa,
                manana_inicio: d.manana_inicio?.slice(0,5) || '09:00',
                manana_fin:    d.manana_fin?.slice(0,5)    || '12:00',
                tarde_activa:  !!d.tarde_activa,
                tarde_inicio:  d.tarde_inicio?.slice(0,5)  || '14:00',
                tarde_fin:     d.tarde_fin?.slice(0,5)     || '20:00',
                intervalo:     d.intervalo || 30
            }));
        }
    } catch {}
    renderHorariosUI();
}

function renderHorariosUI() {
    const contenedor = document.getElementById('horarios-por-dia');
    if (!contenedor) return;
    contenedor.innerHTML = horariosLocales.map((dia, i) => `
        <div class="dia-horario-card ${dia.manana_activa || dia.tarde_activa ? 'activo' : ''}" id="dia-card-${i}">
            <div class="dia-horario-header">
                <span class="dia-horario-nombre">${DIAS_NOMBRE[i]}</span>
                <div class="dia-horario-toggles">
                    <label class="toggle-dia"><input type="checkbox" ${dia.manana_activa ? 'checked' : ''} onchange="toggleTurno(${i},'manana',this.checked)" /><span>Mañana</span></label>
                    <label class="toggle-dia"><input type="checkbox" ${dia.tarde_activa  ? 'checked' : ''} onchange="toggleTurno(${i},'tarde',this.checked)"  /><span>Tarde</span></label>
                </div>
            </div>
            <div class="dia-horario-turnos">
                <div class="turno-bloque ${dia.manana_activa ? '' : 'turno-desactivado'}" id="bloque-man-${i}">
                    <div class="turno-bloque-titulo">🌅 Mañana</div>
                    <div class="turno-times">
                        <div><label class="label-horario">Desde</label><input type="time" class="input-horario" value="${dia.manana_inicio}" onchange="actualizarHorario(${i},'manana_inicio',this.value)" /></div>
                        <div><label class="label-horario">Hasta</label><input type="time" class="input-horario" value="${dia.manana_fin}"    onchange="actualizarHorario(${i},'manana_fin',this.value)"    /></div>
                    </div>
                </div>
                <div class="turno-bloque ${dia.tarde_activa ? '' : 'turno-desactivado'}" id="bloque-tar-${i}">
                    <div class="turno-bloque-titulo">🌆 Tarde</div>
                    <div class="turno-times">
                        <div><label class="label-horario">Desde</label><input type="time" class="input-horario" value="${dia.tarde_inicio}" onchange="actualizarHorario(${i},'tarde_inicio',this.value)" /></div>
                        <div><label class="label-horario">Hasta</label><input type="time" class="input-horario" value="${dia.tarde_fin}"    onchange="actualizarHorario(${i},'tarde_fin',this.value)"    /></div>
                    </div>
                </div>
            </div>
            <div class="dia-intervalo">
                <label class="label-horario">Intervalo entre turnos</label>
                <select class="input-horario" style="width:auto" onchange="actualizarHorario(${i},'intervalo',parseInt(this.value))">
                    ${[15,20,30,45,60,90,120].map(m => `<option value="${m}" ${dia.intervalo == m ? 'selected' : ''}>${m} min</option>`).join('')}
                </select>
            </div>
        </div>`).join('');
}

function toggleTurno(diaIdx, turno, activo) {
    horariosLocales[diaIdx][turno === 'manana' ? 'manana_activa' : 'tarde_activa'] = activo;
    document.getElementById(`bloque-${turno === 'manana' ? 'man' : 'tar'}-${diaIdx}`)?.classList.toggle('turno-desactivado', !activo);
    document.getElementById(`dia-card-${diaIdx}`)?.classList.toggle('activo', horariosLocales[diaIdx].manana_activa || horariosLocales[diaIdx].tarde_activa);
}

function actualizarHorario(diaIdx, campo, valor) {
    horariosLocales[diaIdx][campo] = valor;
}

async function guardarHorariosAdmin() {
    if (!PROFESIONAL_ID) { mostrarToast('No hay profesional identificado.', 'error'); return; }
    try {
        const res = await fetchAdmin(`${API}/profesionales/${PROFESIONAL_ID}/horarios`, {
            method: 'POST',
            body: JSON.stringify({ dias: horariosLocales })
        });
        mostrarToast(res.ok ? 'Horarios guardados ✓' : 'Error al guardar.', res.ok ? 'success' : 'error');
    } catch { mostrarToast('Error de conexión.', 'error'); }
}

// ════════════════════════════════════════════════════════
// BLOQUEOS
// ════════════════════════════════════════════════════════
async function crearBloqueoRango() {
    const fecha  = document.getElementById('bloqueo-fecha').value;
    const desde  = document.getElementById('bloqueo-desde').value;
    const hasta  = document.getElementById('bloqueo-hasta').value;
    const motivo = document.getElementById('bloqueo-motivo').value.trim();
    if (!fecha || !desde || !hasta) { mostrarToast('Completá fecha y horario.', 'error'); return; }
    try {
        const res = await fetchAdmin(`${API}/turnos/bloquear`, {
            method: 'POST',
            body: JSON.stringify({ profesional_id: PROFESIONAL_ID, fecha, tipo: 'parcial', hora_inicio: desde, hora_fin: hasta, motivo: motivo || null })
        });
        if (res.ok) {
            mostrarToast('Horario bloqueado ✓', 'success');
            document.getElementById('bloqueo-desde').value  = '';
            document.getElementById('bloqueo-hasta').value  = '';
            document.getElementById('bloqueo-motivo').value = '';
            cargarBloqueos();
        } else { mostrarToast('Error al bloquear.', 'error'); }
    } catch { mostrarToast('Error de conexión.', 'error'); }
}

async function bloquearDiaCompleto() {
    const fecha  = document.getElementById('bloqueo-fecha').value;
    const motivo = document.getElementById('bloqueo-motivo').value.trim();
    if (!fecha) { mostrarToast('Seleccioná una fecha.', 'error'); return; }
    if (!confirm(`¿Bloquear el día completo del ${fecha}?`)) return;
    try {
        const res = await fetchAdmin(`${API}/turnos/bloquear`, {
            method: 'POST',
            body: JSON.stringify({ profesional_id: PROFESIONAL_ID, fecha, tipo: 'todo', motivo: motivo || null })
        });
        if (res.ok) {
            mostrarToast(`Día ${fecha} bloqueado ✓`, 'success');
            document.getElementById('bloqueo-motivo').value = '';
            cargarBloqueos();
        } else { mostrarToast('Error al bloquear.', 'error'); }
    } catch { mostrarToast('Error de conexión.', 'error'); }
}

async function cargarBloqueos() {
    const lista = document.getElementById('lista-bloqueos');
    if (!lista) return;
    try {
        const res      = await fetchAdmin(`${API}/turnos/bloqueos`);
        const bloqueos = await res.json();
        if (!bloqueos.length) {
            lista.innerHTML = '<p style="font-size:.8rem;color:var(--text-muted)">Sin bloqueos activos ✓</p>';
            return;
        }
        lista.innerHTML = bloqueos.map(b => {
            const fecha   = (b.fecha || '').split('T')[0];
            const [a,m,d] = fecha.split('-');
            const esTodo  = b.tipo === 'todo';
            const horario = !esTodo && b.hora_inicio && b.hora_fin ? `${b.hora_inicio.slice(0,5)} — ${b.hora_fin.slice(0,5)}` : '';
            return `
                <div class="bloqueo-item">
                    <div class="bloqueo-info">
                        <strong>${d}/${m}/${a}</strong>
                        <span class="bloqueo-tipo ${esTodo ? '' : 'parcial'}">${esTodo ? 'Día completo' : 'Rango'}</span>
                        ${horario ? `<span style="font-size:.75rem;color:var(--text-muted)">🕐 ${horario}</span>` : ''}
                        ${b.motivo ? `<span style="font-size:.75rem;color:var(--text-muted)">· ${b.motivo}</span>` : ''}
                    </div>
                    <button class="btn-mini-delete" onclick="eliminarBloqueo(${b.id})">×</button>
                </div>`;
        }).join('');
    } catch {}
}

async function eliminarBloqueo(id) {
    if (!confirm('¿Eliminar este bloqueo?')) return;
    try {
        const res = await fetchAdmin(`${API}/turnos/bloqueos/${id}`, { method: 'DELETE' });
        if (res.ok) { mostrarToast('Bloqueo eliminado ✓', 'success'); cargarBloqueos(); }
    } catch { mostrarToast('Error al eliminar.', 'error'); }
}

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    const selectAnio = document.getElementById('stats-anio');
    if (selectAnio) selectAnio.value = new Date().getFullYear();
    const selectMes = document.getElementById('stats-mes');
    if (selectMes) selectMes.value = new Date().getMonth() + 1;
});