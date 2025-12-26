// --- script.js CORREGIDO ---

let searchTimeout;
let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;

// 1. CARGAR MENÚ
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    // Loader visible
    if (grid) grid.innerHTML = '<p style="text-align:center; color:#888; grid-column:1/-1; padding:40px;">Cargando carta...</p>';

try {
        if (typeof supabaseClient === 'undefined') {
            throw new Error("Error: Supabase no está conectado.");
        }

        // Cargar productos
        let { data: productos, error } = await supabaseClient
        
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .eq('restaurant_id', CONFIG.RESTAURANT_ID)
            .order('categoria', { ascending: true })
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;


        // Calcular ratings
        todosLosProductos = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

    } catch (err) {
        console.error("Error cargando:", err);
        // Fallback de seguridad
        try {
            let { data: simple } = await supabaseClient.from('productos').select('*').eq('activo', true);
            if (simple) todosLosProductos = simple;
        } catch (e) {}
    }

    renderizarMenu(todosLosProductos);
}

// 2. RENDERIZAR (SIN ANIMACIONES OCULTAS)

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    
    contenedor.style.display = 'block'; 
    contenedor.innerHTML = '';

    const categorias = {
        'entrantes': { nombre: 'Entrantes', icono: '🍟' },
        'completas': { nombre: 'Completas', icono: '🍛' },
        'pizzas': { nombre: 'Pizzas', icono: '🍕' },
        'agregados': { nombre: 'Agregados', icono: '🧀' },
        'spaguettis': { nombre: 'Spaguettis', icono: '🍝' },
        'bebidas': { nombre: 'Bebidas', icono: '🍺' },
        'postre': { nombre: 'Postres', icono: '🍨' }
    };

    Object.keys(categorias).forEach(catKey => {
        const productosCategoria = lista.filter(p => p.categoria === catKey);
        
        if (productosCategoria.length > 0) {
            const catInfo = categorias[catKey];
            
            // Añadimos un ID único a cada sección para el Scroll Spy
            const seccionHTML = `
                <div class="category-section" id="section-${catKey}" data-categoria="${catKey}">
                    <h2 class="category-title-casona">
                        ${catInfo.icono} ${catInfo.nombre}
                    </h2>
                    <div class="horizontal-scroll">
                        ${productosCategoria.map(item => `
                            <div class="card-casona" onclick="abrirDetalle(${item.id})">
                                <div class="card-img-container">
                                    <img src="${item.imagen_url || 'https://via.placeholder.com/300'}" loading="lazy">
                                    ${item.destacado ? '<span class="tag-destacado">TOP</span>' : ''}
                                </div>
                                <div class="card-body">
                                    <h3>${item.nombre}</h3>
                                    <div class="card-footer">
                                        <span class="card-price">$${item.precio}</span>
                                        </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            contenedor.innerHTML += seccionHTML;
        }
    });

    // Reiniciamos el observador de scroll después de renderizar
    setTimeout(activarScrollSpyCategorias, 500);
}

// Nueva función de Scroll Spy para Secciones
const activarScrollSpyCategorias = () => {
    const sections = document.querySelectorAll('.category-section');
    const buttons = document.querySelectorAll('.filter-btn');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const catKey = entry.target.getAttribute('data-categoria');
                
                buttons.forEach(btn => {
                    btn.classList.remove('active');
                    // Comprobamos si el onclick del botón coincide con la categoría
                    if (btn.getAttribute('onclick').includes(`'${catKey}'`)) {
                        btn.classList.add('active');
                        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                });
            }
        });
    }, { 
        rootMargin: '-20% 0px -70% 0px', // Detecta la sección cuando entra en la parte superior
        threshold: 0 
    });

    sections.forEach(section => observer.observe(section));
};

// 3. DETALLE
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    // Llenar datos
    const imgEl = document.getElementById('det-img');
    const box = document.getElementById('box-curiosidad');
    
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    
    const ratingBig = productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --';
    setText('det-rating-big', ratingBig);

  
    
    // ANIMACIÓN DE ENTRADA
    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.style.display = 'flex'; // 1. Hacer visible el contenedor
        // Pequeño delay para permitir que el navegador procese el display:flex antes de animar
        setTimeout(() => {
            modal.classList.add('active'); // 2. Activar animación CSS
        }, 10);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.classList.remove('active'); // 1. Iniciar animación de salida
        
        // 2. Esperar a que termine la animación (350ms) antes de ocultar
        setTimeout(() => {
            modal.style.display = 'none';
        }, 350);
    }
}

// 4. OPINIONES
function abrirOpinionDesdeDetalle() {
    const modalDetalle = document.getElementById('modal-detalle');
    const modalOpinion = document.getElementById('modal-opinion');
    
    // Cierra detalle
    modalDetalle.classList.remove('active');
    setTimeout(() => {
        modalDetalle.style.display = 'none';
        
        // Abre opinión inmediatamente después
        modalOpinion.style.display = 'flex';
        setTimeout(() => modalOpinion.classList.add('active'), 10);
        
        puntuacion = 0;
        actualizarEstrellas();
    }, 300); // Espera un poco menos para que se sienta fluido
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 350);
    }
}

const starsContainer = document.getElementById('stars-container');
if(starsContainer) {
    starsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            puntuacion = parseInt(e.target.dataset.val);
            actualizarEstrellas();
        }
    });
}

function actualizarEstrellas() {
    document.querySelectorAll('#stars-container span').forEach(s => {
        const val = parseInt(s.dataset.val);
        s.style.color = val <= puntuacion ? 'var(--gold)' : '#444';
        s.textContent = val <= puntuacion ? '★' : '☆';
    });
}

async function enviarOpinion() {
    if (puntuacion === 0) { alert("¡Puntúa con estrellas!"); return; }
    
    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;
    const btn = document.querySelector('#modal-opinion .btn-big-action');

    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: productoActual.id,
        cliente_nombre: nombre,
        comentario: comentario,
        puntuacion: puntuacion
    }]);

    if (!error) {
        showToast("¡Gracias! Tu opinión ha sido registrada.", "success");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu(); 
    } else {
        showToast("Error: " + error.message, "error");
    }
    if(btn) { btn.textContent = "ENVIAR"; btn.disabled = false; }
}

// 5. FILTROS
function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.value = '';
    
    const lista = cat === 'todos' ? todosLosProductos : todosLosProductos.filter(p => p.categoria === cat);
    renderizarMenu(lista);
}

const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                p.nombre.toLowerCase().includes(term) || 
                (p.descripcion && p.descripcion.toLowerCase().includes(term))
            );
            renderizarMenu(lista);
        }, 300);
    });
}

document.addEventListener('DOMContentLoaded', cargarMenu);

// --- SISTEMA DE NOTIFICACIONES PREMIUM ---
function showToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    // Crear el elemento HTML
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // Icono según tipo
    const icono = tipo === 'success' ? '✨' : '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icono}</span>
        <span class="toast-msg">${mensaje}</span>
    `;

    // Agregar al contenedor
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400); // Esperar a que termine la animación
    }, 4000);
}
// Función para detectar la categoría en pantalla y marcar el botón
const activarScrollSpy = () => {
    const cards = document.querySelectorAll('.card');
    const buttons = document.querySelectorAll('.filter-btn');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Buscamos el ID del producto en el atributo onclick de la card
                const onclickAttr = entry.target.getAttribute('onclick');
                if (!onclickAttr) return;
                
                const idMatch = onclickAttr.match(/\d+/);
                if (idMatch) {
                    const producto = todosLosProductos.find(p => p.id == idMatch[0]);
                    if (producto) {
                        buttons.forEach(btn => {
                            btn.classList.remove('active');
                            // Si el botón tiene la función filtrar con la categoría del producto, se activa
                            if (btn.getAttribute('onclick').includes(`'${producto.categoria}'`)) {
                                btn.classList.add('active');
                                // Desplazamiento automático del menú de filtros para que el botón sea visible
                                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                            }
                        });
                    }
                }
            }
        });
    }, { threshold: 0.6 }); // Se activa cuando el 60% del plato es visible

    cards.forEach(card => observer.observe(card));
};

// Modificamos ligeramente la función renderizarMenu para que active el observador
const originalRenderizarMenu = renderizarMenu;
renderizarMenu = (lista) => {
    originalRenderizarMenu(lista);
    // Esperamos un momento a que las imágenes carguen para calcular bien las posiciones
    setTimeout(activarScrollSpy, 800); 

};


