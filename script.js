// script.js - VERSIÓN FINAL CORREGIDA

let searchTimeout;
let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;

// 1. CARGAR MENÚ
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    if (grid) grid.innerHTML = '<p style="text-align:center; color:#888; grid-column:1/-1; padding:40px;">Cargando carta...</p>';

    try {
        if (typeof supabaseClient === 'undefined') {
            throw new Error("Error: Supabase no está conectado.");
        }

        // CORRECCIÓN DE COLUMNA: Filtramos por 'restaurant_id'
        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .eq('restaurant_id', CONFIG.RESTAURANT_ID) // [cite: 91, 145-146]
            .order('categoria', { ascending: true })
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        todosLosProductos = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

    } catch (err) {
        console.error("Error cargando:", err);
    }

    renderizarMenu(todosLosProductos);
}

// 2. RENDERIZAR
function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    
    contenedor.style.display = 'block'; 
    contenedor.innerHTML = '';

    const categorias = {
        'entrantes': { nombre: 'Entrantes', icono: '🍟' },
        'completas': { nombre: 'Completas', icono: '🍛' },
        'pizzas': { nombre: 'Pizzas', icono: '🍕' },
        'spaguettis': { nombre: 'Spaguettis', icono: '🍝' },
        'bebidas': { nombre: 'Bebidas', icono: '🍺' },
        'postres': { nombre: 'Postres', icono: '🍨' }, // Sincronizado con admin
        'agregados': { nombre: 'Agregados', icono: '🧀' }
    };

    Object.keys(categorias).forEach(catKey => {
        const productosCategoria = lista.filter(p => p.categoria === catKey);
        if (productosCategoria.length > 0) {
            const catInfo = categorias[catKey];
            const seccionHTML = `
                <div class="category-section" id="section-${catKey}" data-categoria="${catKey}">
                    <h2 class="category-title-casona">${catInfo.icono} ${catInfo.nombre}</h2>
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
    activarVigilanciaCategorias();
}

// 3. DETALLE
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    
    const ratingBig = productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --';
    setText('det-rating-big', ratingBig);

    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 350);
    }
}
function filtrar(cat, btn) {
    // 1. Cambiar el estado visual de los botones
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    // 2. Si se elige 'todos' o 'inicio', volver arriba y mostrar todo
    if (cat === 'todos') {
        renderizarMenu(todosLosProductos); // Asegura que se vea todo
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // 3. ASEGURAR que el menú completo esté renderizado 
    // (Por si antes el usuario usó el buscador y ocultó cosas)
    const buscador = document.getElementById('search-input');
    if (buscador && buscador.value !== "") {
        buscador.value = ""; // Limpiamos buscador
        renderizarMenu(todosLosProductos); // Mostramos todo
    }

    // 4. HACER SCROLL a la sección correspondiente
    // Tu script.js ya crea divs con id="section-pizzas", etc.
    const seccionDestino = document.getElementById(`section-${cat}`);
    
    if (seccionDestino) {
        const posicion = seccionDestino.offsetTop - 120; // -120px para que el menú fijo no tape el título
        window.scrollTo({
            top: posicion,
            behavior: 'smooth'
        });
    }
}

    
// Función para el botón Inicio
function irAlInicio(btn) {
    // 1. Sube la pantalla al inicio suavemente
    window.scrollTo({ top: 0,behavior: 'smooth'});

    // 2. Resetea el buscador si tuviera texto
    const inputBusqueda = document.getElementById('search-input');
    if (inputBusqueda) inputBusqueda.value = "";

    // 3. Muestra todos los productos usando tu función filtrar existente
    filtrar('todos', btn);
}
document.addEventListener('DOMContentLoaded', cargarMenu);
// --- LÓGICA DEL BUSCADOR ---
document.addEventListener('input', (e) => {
    // Verificamos que el cambio sea en el input de búsqueda
    if (e.target.id === 'search-input') {
        // Limpiamos el timeout anterior para no filtrar en cada letra (Debounce)
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
            const busqueda = e.target.value.toLowerCase().trim();

            if (busqueda === "") {
                // Si borra todo, mostramos el menú original completo
                renderizarMenu(todosLosProductos);
            } else {
                // Filtramos sobre el array global que cargaste en cargarMenu()
                const filtrados = todosLosProductos.filter(p => 
                    p.nombre.toLowerCase().includes(busqueda) || 
                    (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
                );
                // Dibujamos solo los resultados encontrados
                renderizarMenu(filtrados);
            }
        }, 300); // Espera 300ms después de que el usuario deja de escribir
    }
});
// --- SISTEMA DE ILUMINACIÓN AUTOMÁTICA DE CATEGORÍAS ---

const opcionesScroll = {
    // Detectamos cuando la sección está a 150px del tope (ajuste para el menú fijo)
    rootMargin: '-150px 0px -70% 0px', 
    threshold: 0
};

const observadorScroll = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Obtenemos la categoría desde el atributo data-categoria que ya tienes
            const categoriaActiva = entry.target.getAttribute('data-categoria');
            actualizarBotonActivo(categoriaActiva);
        }
    });
}, opcionesScroll);

function actualizarBotonActivo(cat) {
    const botones = document.querySelectorAll('.filter-btn');
    botones.forEach(btn => {
        btn.classList.remove('active');
        // Si el botón tiene la función filtrar con esa categoría, lo alumbramos
        if (btn.getAttribute('onclick').includes(`'${cat}'`)) {
            btn.classList.add('active'); //
            
            // Opcional: Hace que el menú de botones se mueva solo si el botón queda oculto
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });
}

// Función para empezar a vigilar las secciones
function activarVigilanciaCategorias() {
    const secciones = document.querySelectorAll('.category-section');
    secciones.forEach(sec => observadorScroll.observe(sec));
}









