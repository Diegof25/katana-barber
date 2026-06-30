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

        selectHora.innerHTML = '<option value="">-- Seleccioná la hora --</option>';

        if (!data.horarios || data.horarios.length === 0) {
            selectHora.innerHTML = '<option value="">Sin turnos disponibles</option>';
            return;
        }

        data.horarios.forEach(hora => {
            const option = document.createElement('option');
            option.value = hora;
            option.textContent = `${hora} hs`;
            selectHora.appendChild(option);
        });

        selectHora.disabled = false;

    } catch (error) {
        selectHora.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// ------------------------------------------------------------------
// 5. Confirmar Reserva
// ------------------------------------------------------------------
document.getElementById('btn-confirmar').onclick = async () => {
    const nombre   = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const fecha    = document.getElementById('fecha').value;
    const hora     = document.getElementById('select-hora').value;

    const selectServicio  = document.getElementById('select-servicio');
    const selectBarbero   = document.getElementById('select-barbero');

    if (!selectBarbero || !selectBarbero.value) return alert('Por favor, seleccioná un barbero.');
    if (!selectServicio.value)                  return alert('Por favor, seleccioná un servicio.');
    if (!nombre || !telefono || !fecha || !hora) return alert('Completá todos los campos.');

    const servicioId     = selectServicio.value;
    const nombreServicio = selectServicio.options[selectServicio.selectedIndex].text;
    const profesionalId  = parseInt(selectBarbero.value);
    const nombreBarbero  = selectBarbero.options[selectBarbero.selectedIndex].text;
    const nroBarbero     = WHATSAPP_MAP[profesionalId];

    // Formato requerido por el SaaS: "YYYY-MM-DDTHH:MM:00-03:00"
    const fechaHoraSaaS = `${fecha}T${hora}:00-03:00`;

    const body = {
        profesional_id: profesionalId,
        servicio_id:    parseInt(servicioId),
        cliente_nombre: nombre,
        cliente_tel:    telefono.replace(/\D/g, ''), // solo números
        fecha_hora:     fechaHoraSaaS,
        notas:          ''
    };

    try {
        const res = await fetch(`${API}/turnos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

const result = await res.json();
console.log('Respuesta del servidor:', result);

if (result.success) {
            const options = { weekday: 'long', day: '2-digit', month: '2-digit' };
            const fechaLinda = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', options);
            const diaCapitalizado = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);

            const mensajeWsp = encodeURIComponent(
                `*¡TURNO RESERVADO CON ${nombreBarbero.toUpperCase()}!* ✂️\n\n` +
                `Hola, soy *${nombre}*.\n` +
                `Confirmé mi turno desde la web:\n\n` +
                `💈 *Servicio:* ${nombreServicio}\n` +
                `📅 *Fecha:* ${diaCapitalizado}\n` +
                `⏰ *Hora:* ${hora} hs\n\n` +
                `¡Nos vemos pronto!`
            );

            alert(`✅ ¡Turno guardado con ${nombreBarbero}! Ahora te redirigimos a su WhatsApp.`);
            window.location.href = `https://wa.me/${nroBarbero}?text=${mensajeWsp}`;
            setTimeout(() => { window.location.reload(); }, 1500);

        } else {
            alert('❌ Error: ' + (result.error || 'No se pudo guardar el turno'));
        }

    } catch (error) {
        alert('❌ Error de conexión al servidor');
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