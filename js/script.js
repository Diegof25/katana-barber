// =============================================================
//  KATANA BARBERSHOP — script.js
//  Backend: SaaS Turnero
// =============================================================

const API_BASE = 'https://turnos-backend-p9ka.onrender.com/api';
const SLUG     = 'katana-barbershop';
const API      = `${API_BASE}/${SLUG}`;

// Mapa de WhatsApp por profesional_id
const WHATSAPP_MAP = {
    3: '5493454181909', // Luciano Lima
    4: '5493454247258', // Walter Leiva
    5: '5493454036340', // Valentín Bernardez
    6: '5493454144992', // Nacho Trinidad
    7: '5493454105436'  // Dylan Alvez
};

let servicioSeleccionado = null;
let profesionalSeleccionado = null;
let calendario = null;

// Cache de servicios completos (id, nombre, precio, duracion_min) —
// se necesita la duración para calcular el turno del acompañante.
let SERVICIOS_CACHE = [];

// Cache de los horarios disponibles del día/barbero actualmente
// cargados — se usa para verificar que el horario del acompañante
// esté realmente libre antes de intentar guardarlo.
let HORARIOS_DISPONIBLES_CACHE = [];

// ------------------------------------------------------------------
// 1. Cargar Barberos (profesionales en el SaaS)
// ------------------------------------------------------------------
async function cargarBarberos() {
    try {
        const res = await fetch(`${API}/profesionales`);
        const profesionales = await res.json();
        const selectBarbero = document.getElementById('select-barbero');

        selectBarbero.innerHTML = '<option value="" disabled selected>Seleccioná al barbero...</option>';

        profesionales.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nombre;
            selectBarbero.appendChild(option);
        });

        selectBarbero.addEventListener('change', async (e) => {
            profesionalSeleccionado = e.target.value;

            // Traer horarios del profesional para bloquear días en el calendario
            const res = await fetch(`${API}/profesionales/${profesionalSeleccionado}/horarios`);
            const horarios = await res.json();

            if (horarios && horarios.length > 0) {
                // Construir array de días activos (tienen mañana o tarde activa)
                const diasActivos = horarios
                    .filter(h => h.manana_activa || h.tarde_activa)
                    .map(h => h.dia_semana);

                calendario.set('disable', [
                    function(date) {
                        return !diasActivos.includes(date.getDay());
                    }
                ]);
            }

            // Resetear fecha y hora
            document.getElementById('fecha').value = '';
            document.getElementById('select-hora').innerHTML = '<option value="">Seleccioná un día primero</option>';
            document.getElementById('select-hora').disabled = true;
            HORARIOS_DISPONIBLES_CACHE = [];
            actualizarInfoAcompanante();
        });

    } catch (error) {
        console.error('Error al cargar barberos:', error);
    }
}

// ------------------------------------------------------------------
// 2. Cargar Servicios
// ------------------------------------------------------------------
async function cargarServicios() {
    try {
        const res = await fetch(`${API}/servicios`);
        const servicios = await res.json();
        SERVICIOS_CACHE = servicios;

        const selectServicio = document.getElementById('select-servicio');
        selectServicio.innerHTML = '<option value="" disabled selected>Elegí un servicio...</option>';

        servicios.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;

            const precioFormateado = Number(s.precio).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            option.textContent = `${s.nombre} - $${precioFormateado}`;
            selectServicio.appendChild(option);
        });

        selectServicio.addEventListener('change', (e) => {
            servicioSeleccionado = e.target.value;
            actualizarInfoAcompanante();
        });

    } catch (error) {
        console.error('Error al cargar servicios:', error);
    }
}

// ------------------------------------------------------------------
// 3. Inicializar Flatpickr
// ------------------------------------------------------------------
const hoy = new Date();
const limiteDosSemanas = new Date(hoy);
limiteDosSemanas.setDate(hoy.getDate() + 14);

calendario = flatpickr('#fecha', {
    locale: 'es',
    minDate: 'today',
    maxDate: limiteDosSemanas,
    onChange: function(selectedDates, dateStr) {
        cargarHorariosDisponibles(dateStr);
    }
});

// ------------------------------------------------------------------
// 4. Cargar horarios disponibles
// ------------------------------------------------------------------
async function cargarHorariosDisponibles(fechaElegida) {
    if (!profesionalSeleccionado) {
        alert('Por favor, seleccioná un barbero primero.');
        document.getElementById('fecha').value = '';
        return;
    }

    const selectHora = document.getElementById('select-hora');
    selectHora.disabled = true;
    selectHora.innerHTML = '<option>Cargando...</option>';

    try {
        const res = await fetch(
            `${API}/turnos/horarios-disponibles?fecha=${fechaElegida}&profesional_id=${profesionalSeleccionado}`
        );
        const data = await res.json();

        HORARIOS_DISPONIBLES_CACHE = data.horarios || [];

        selectHora.innerHTML = '<option value="">-- Seleccioná la hora --</option>';

        if (!data.horarios || data.horarios.length === 0) {
            selectHora.innerHTML = '<option value="">Sin turnos disponibles</option>';
            actualizarInfoAcompanante();
            return;
        }

        data.horarios.forEach(hora => {
            const option = document.createElement('option');
            option.value = hora;
            option.textContent = `${hora} hs`;
            selectHora.appendChild(option);
        });

        selectHora.disabled = false;
        selectHora.addEventListener('change', actualizarInfoAcompanante);
        actualizarInfoAcompanante();

    } catch (error) {
        selectHora.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// ------------------------------------------------------------------
// 4b. Acompañante (turno seguido) — mostrar/ocultar y calcular hora
// ------------------------------------------------------------------
function sumarMinutos(horaStr, minutos) {
    const [h, m] = horaStr.split(':').map(Number);
    const total  = h * 60 + m + minutos;
    const hh     = Math.floor(total / 60) % 24;
    const mm     = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function obtenerHoraAcompanante() {
    const hora = document.getElementById('select-hora').value;
    const servicioId = document.getElementById('select-servicio').value;
    if (!hora || !servicioId) return null;

    const servicio = SERVICIOS_CACHE.find(s => String(s.id) === String(servicioId));
    const duracion = servicio ? (parseInt(servicio.duracion_min) || 30) : 30;

    return sumarMinutos(hora, duracion);
}

function actualizarInfoAcompanante() {
    const checkAcompanante = document.getElementById('check-acompanante');
    const infoEl = document.getElementById('acompanante-hora-info');
    if (!checkAcompanante || !checkAcompanante.checked || !infoEl) return;

    const horaAcomp = obtenerHoraAcompanante();

    if (!horaAcomp) {
        infoEl.className = 'neutro';
        infoEl.textContent = 'Elegí barbero, servicio y horario para calcular el turno del acompañante.';
        return;
    }

    const disponible = HORARIOS_DISPONIBLES_CACHE.includes(horaAcomp);

    if (disponible) {
        infoEl.className = 'ok';
        infoEl.textContent = `✅ El acompañante quedaría a las ${horaAcomp} hs (turno seguido, mismo barbero).`;
    } else {
        infoEl.className = 'bad';
        infoEl.textContent = `⚠️ A las ${horaAcomp} hs ese horario no está disponible. Probá con otro horario de inicio, o desmarcá el acompañante y coordinalo por WhatsApp.`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const checkAcompanante   = document.getElementById('check-acompanante');
    const camposAcompanante  = document.getElementById('acompanante-fields');

    if (checkAcompanante && camposAcompanante) {
        checkAcompanante.addEventListener('change', () => {
            camposAcompanante.classList.toggle('visible', checkAcompanante.checked);
            actualizarInfoAcompanante();
        });
    }
});

// ------------------------------------------------------------------
// 5. Confirmar Reserva
// ------------------------------------------------------------------

// Bandera para evitar que un segundo click (o un doble-tap en el celular)
// dispare otro guardado mientras el primero todavía está en curso.
let reservaEnCurso = false;

document.getElementById('btn-confirmar').onclick = async () => {
    // Corte inmediato: si ya hay una reserva en camino, ignoramos el click.
    if (reservaEnCurso) return;

    const nombre   = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const fecha    = document.getElementById('fecha').value;
    const hora     = document.getElementById('select-hora').value;

    const selectServicio  = document.getElementById('select-servicio');
    const selectBarbero   = document.getElementById('select-barbero');
    const checkAcompanante = document.getElementById('check-acompanante');
    const conAcompanante   = checkAcompanante && checkAcompanante.checked;

    if (!selectBarbero || !selectBarbero.value) return alert('Por favor, seleccioná un barbero.');
    if (!selectServicio.value)                  return alert('Por favor, seleccioná un servicio.');
    if (!nombre || !telefono || !fecha || !hora) return alert('Completá todos los campos.');

    let nombreAcompanante = '';
    let horaAcompanante   = null;

    if (conAcompanante) {
        nombreAcompanante = document.getElementById('acompanante-nombre').value.trim();
        if (!nombreAcompanante) return alert('Ingresá el nombre del acompañante, o desmarcá la opción.');

        horaAcompanante = obtenerHoraAcompanante();
        if (!horaAcompanante || !HORARIOS_DISPONIBLES_CACHE.includes(horaAcompanante)) {
            return alert('El horario del acompañante no está disponible. Elegí otro horario de inicio para el turno principal, o coordiná el segundo turno por WhatsApp.');
        }
    }

    const servicioId     = selectServicio.value;
    const nombreServicio = selectServicio.options[selectServicio.selectedIndex].text;
    const profesionalId  = parseInt(selectBarbero.value);
    const nombreBarbero  = selectBarbero.options[selectBarbero.selectedIndex].text;
    const nroBarbero     = WHATSAPP_MAP[profesionalId];

    // Formato requerido por el SaaS: "YYYY-MM-DDTHH:MM:00-03:00"
    const fechaHoraSaaS = `${fecha}T${hora}:00-03:00`;

    // A partir de acá ya se está enviando: bloqueamos el botón y avisamos
    // visualmente, así nadie hace click 3 veces pensando que "no anduvo".
    const btnConfirmar   = document.getElementById('btn-confirmar');
    const textoOriginal  = btnConfirmar.innerHTML;
    reservaEnCurso = true;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';

    try {
        let res, result;

        if (conAcompanante) {
            // Reserva doble: 2 turnos seguidos, atómico en el backend
            // (si el segundo horario ya se ocupó, no se guarda ninguno).
            res = await fetch(`${API}/turnos/doble`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profesional_id: profesionalId,
                    servicio_id:    parseInt(servicioId),
                    cliente_nombre: nombre,
                    cliente_tel:    telefono.replace(/\D/g, ''),
                    fecha_hora:     fechaHoraSaaS,
                    notas:          '',
                    acompanante_nombre: nombreAcompanante
                })
            });
        } else {
            res = await fetch(`${API}/turnos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profesional_id: profesionalId,
                    servicio_id:    parseInt(servicioId),
                    cliente_nombre: nombre,
                    cliente_tel:    telefono.replace(/\D/g, ''),
                    fecha_hora:     fechaHoraSaaS,
                    notas:          ''
                })
            });
        }

        const okStatus = res.ok;
        result = await res.json();
        console.log('Respuesta del servidor:', result);

        if (okStatus) {
            const options = { weekday: 'long', day: '2-digit', month: '2-digit' };
            const fechaLinda = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', options);
            const diaCapitalizado = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);

            let mensajeWsp;
            if (conAcompanante) {
                mensajeWsp = encodeURIComponent(
                    `*¡TURNOS RESERVADOS CON ${nombreBarbero.toUpperCase()}!* ✂️\n\n` +
                    `Hola, soy *${nombre}*.\n` +
                    `Confirmé 2 turnos seguidos desde la web:\n\n` +
                    `💈 *Servicio:* ${nombreServicio}\n` +
                    `📅 *Fecha:* ${diaCapitalizado}\n` +
                    `⏰ *Turno 1 (${nombre}):* ${hora} hs\n` +
                    `⏰ *Turno 2 (${nombreAcompanante}):* ${horaAcompanante} hs\n\n` +
                    `¡Nos vemos pronto!`
                );
                alert(`✅ ¡Turnos guardados con ${nombreBarbero}! ${nombre} a las ${hora} hs y ${nombreAcompanante} a las ${horaAcompanante} hs. Ahora te redirigimos a su WhatsApp.`);
            } else {
                mensajeWsp = encodeURIComponent(
                    `*¡TURNO RESERVADO CON ${nombreBarbero.toUpperCase()}!* ✂️\n\n` +
                    `Hola, soy *${nombre}*.\n` +
                    `Confirmé mi turno desde la web:\n\n` +
                    `💈 *Servicio:* ${nombreServicio}\n` +
                    `📅 *Fecha:* ${diaCapitalizado}\n` +
                    `⏰ *Hora:* ${hora} hs\n\n` +
                    `¡Nos vemos pronto!`
                );
                alert(`✅ ¡Turno guardado con ${nombreBarbero}! Ahora te redirigimos a su WhatsApp.`);
            }

            window.location.href = `https://wa.me/${nroBarbero}?text=${mensajeWsp}`;
            setTimeout(() => { window.location.reload(); }, 1500);
            // No reactivamos el botón acá a propósito: la página se va a
            // recargar sola en un instante (redirección a WhatsApp + reload).

        } else {
            alert('❌ Error: ' + (result.error || 'No se pudo guardar el turno'));
            reservaEnCurso = false;
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = textoOriginal;
        }

    } catch (error) {
        alert('❌ Error de conexión al servidor');
        reservaEnCurso = false;
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = textoOriginal;
    }
};

// ------------------------------------------------------------------
// 6. Menú mobile + carga inicial
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    cargarServicios();
    cargarBarberos();

    const menuBtn  = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }
});

// ------------------------------------------------------------------
// 7. Navbar Scroll
// ------------------------------------------------------------------
window.addEventListener('scroll', function() {
    const nav = document.querySelector('.navbar');
    if (nav) {
        window.scrollY > 50 ? nav.classList.add('scrolled') : nav.classList.remove('scrolled');
    }
});

// ------------------------------------------------------------------
// 8. Galería — cambiar barbero
// ------------------------------------------------------------------
function mostrarGaleria(nombreBarbero) {
    document.querySelectorAll('.galeria-barbero').forEach(gal => {
        gal.classList.add('galeria-oculta');
    });

    const seleccionada = document.getElementById(`galeria-${nombreBarbero}`);
    if (seleccionada) {
        seleccionada.classList.remove('galeria-oculta');
        const track = seleccionada.querySelector('.carousel-track');
        if (track) track.style.transform = 'translateX(0px)';
    }

    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    window.dispatchEvent(new Event('resize'));
}

// ------------------------------------------------------------------
// 9. Carrusel universal
// ------------------------------------------------------------------
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.carousel-btn');
    if (!btn) return;

    const container = btn.closest('.carousel-container');
    const track     = container.querySelector('.carousel-track');
    const slides    = Array.from(track.children);

    if (slides.length === 0) return;

    const slideWidth     = slides[0].getBoundingClientRect().width + 20;
    const style          = window.getComputedStyle(track);
    const matrix         = new WebKitCSSMatrix(style.transform);
    const currentTransform = matrix.m41;

    if (btn.classList.contains('next')) {
        const maxScroll = -(track.scrollWidth - container.offsetWidth);
        if (currentTransform > maxScroll + 10) {
            track.style.transform = `translateX(${currentTransform - slideWidth}px)`;
        } else {
            track.style.transform = 'translateX(0px)';
        }
    } else if (btn.classList.contains('prev')) {
        if (currentTransform < -10) {
            track.style.transform = `translateX(${currentTransform + slideWidth}px)`;
        }
    }
});

// ------------------------------------------------------------------
// 10. Videos — play/pause al click
// ------------------------------------------------------------------
document.querySelectorAll('.carousel-slide').forEach(item => {
    item.addEventListener('click', function() {
        const video = this.querySelector('video');
        if (video) {
            if (video.paused) {
                document.querySelectorAll('video').forEach(v => v.pause());
                video.play();
                this.classList.add('playing');
            } else {
                video.pause();
                this.classList.remove('playing');
            }
        }
    });
});