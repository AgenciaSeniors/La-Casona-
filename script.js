// script.js - VERSIÓN FINAL CORREGIDA

let searchTimeout;
let todosLosProductos = [];
let productoActual = null;
let puntuacionSeleccionada = 0;

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
if (lista.length === 0) {
    contenedor.innerHTML = `
        <div style="text-align:center; grid-column:1/-1; padding:40px; color:#888;">
            <span class="material-icons" style="font-size:3rem; display:block; margin-bottom:10px;"></span>
            No se encontraron productos para tu búsqueda.
        </div>`;
    return;
}
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

async function abrirDetalle(id) {
    // 1. Forzamos que el ID sea un número para evitar errores de búsqueda
    const idNumero = Number(id);
    productoActual = todosLosProductos.find(p => p.id === idNumero);
    
    if (!productoActual) {
        console.error("No se encontró el producto con ID:", id);
        return;
    }

    // 2. Llenar textos básicos (Corregido 'det-price')
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-price', `$${productoActual.precio}`); // Cambiado det-precio -> det-price
    
    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';

    // 3. BUSCAR RESEÑAS REALES PARA EL PROMEDIO
    try {
        const { data: notas, error } = await supabaseClient
            .from('opiniones')
            .select('puntuacion')
            .eq('producto_id', idNumero);

        if (error) throw error;

        let promedioTotal = "0.0";
        let cantidadTotal = 0;

        if (notas && notas.length > 0) {
            const suma = notas.reduce((acc, curr) => acc + curr.puntuacion, 0);
            promedioTotal = (suma / notas.length).toFixed(1);
            cantidadTotal = notas.length;
        }

        // 4. Actualizamos el HTML (Aseguramos que los IDs existan)
        const notaValor = document.getElementById('det-puntuacion-valor');
        const cantidadTexto = document.getElementById('det-cantidad-opiniones');
        
        if (notaValor) notaValor.textContent = promedioTotal;
        if (cantidadTexto) cantidadTexto.textContent = `(${cantidadTotal} reseñas)`;

    } catch (err) {
        console.error("Error obteniendo promedio:", err);
    }

    // 5. Mostrar el modal con la animación
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
// 1. Funciones para controlar los modales de opinión
function abrirOpinionDesdeDetalle() {
    cerrarDetalle(); // Cierra el detalle del plato primero
    const modalOp = document.getElementById('modal-opinion');
    if (modalOp) {
        modalOp.style.display = 'flex';
        setTimeout(() => modalOp.classList.add('active'), 10);
        resetearFormularioOpinion();
    }
}

function cerrarModalOpiniones() {
    const modalOp = document.getElementById('modal-opinion');
    if (modalOp) {
        modalOp.classList.remove('active');
        setTimeout(() => modalOp.style.display = 'none', 350);
    }
}

function resetearFormularioOpinion() {
    puntuacionSeleccionada = 0; // Asegúrate de tener esta variable let puntuacionSeleccionada = 0; al inicio del script
    const estrellas = document.querySelectorAll('#stars-container span');
    estrellas.forEach(s => s.style.color = '#444');
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-comentario').value = '';
}
// ... (todas tus otras funciones: cargarMenu, abrirDetalle, etc.)

// --- ÚLTIMA PARTE DEL ARCHIVO ---

// Listener robusto para las estrellas
document.addEventListener('click', (e) => {
    // Verificamos si lo que tocaste es una estrella (span) dentro del contenedor
    const estrella = e.target.closest('#stars-container span');
    
    if (estrella) {
        // Guardamos el valor (1 al 5) en la variable global que pusimos arriba
        puntuacionSeleccionada = parseInt(estrella.getAttribute('data-val'));
        
        // Pintamos de verde las seleccionadas y de gris las demás
        const todasLasEstrellas = document.querySelectorAll('#stars-container span');
        todasLasEstrellas.forEach((s, i) => {
            s.style.color = (i < puntuacionSeleccionada) ? '#2ECC71' : '#444';
        });
        
        console.log("Puntuación elegida:", puntuacionSeleccionada);
    }
});

// Al final siempre va el DOMContentLoaded
document.addEventListener('DOMContentLoaded', cargarMenu);
async function enviarOpinion() {
    // 1. Validaciones de seguridad
    if (!puntuacionSeleccionada || puntuacionSeleccionada === 0) {
        alert("⚠️ Por favor, selecciona una puntuación con las estrellas.");
        return;
    }

    // 2. BUSCAMOS LOS ELEMENTOS (Asegúrate de que estos IDs coincidan con tu index.html)
    // Probablemente en tu HTML se llaman 'cliente-nombre' y 'cliente-comentario' sin la S
    const elNombre = document.getElementById('cliente-nombre'); 
    const elComentario = document.getElementById('cliente-comentario');

    // Aquí es donde ocurría el error: verificamos que los cuadros existan antes de leer su .value
    if (!elNombre || !elComentario) {
        alert("❌ Error técnico: No se encuentran los cuadros de texto en el HTML. Revisa los IDs.");
        return;
    }

    const btn = document.getElementById('btn-enviar-opinion');
    btn.disabled = true;
    btn.textContent = "ENVIANDO...";

    try {
        // 3. ENVÍO A SUPABASE
        const { error } = await supabaseClient
            .from('opiniones')
            .insert([{
                producto_id: productoActual.id, 
                cliente_nombre: elNombre.value.trim() || "Anónimo", // 'clientes' con S porque así se llama tu COLUMNA en Supabase
                comentario: elComentario.value.trim(),      // Revisa si en Supabase es 'comentario' o 'comentarios'
                puntuacion: puntuacionSeleccionada,
                restaurant_id: CONFIG.RESTAURANT_ID
            }]);

        if (error) throw error;

        alert("✅ ¡Gracias! Tu opinión ha sido enviada.");
        cerrarModalOpiniones();
        
    } catch (err) {
        console.error("Error al enviar:", err);
        alert("❌ No se pudo enviar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "ENVIAR OPINIÓN";
    }
}
async function abrirListaOpiniones() {
    const contenedor = document.getElementById('contenedor-opiniones-full');
    const modalLista = document.getElementById('modal-lista-opiniones');
    
    if (!productoActual) return;

    modalLista.style.display = 'flex';
    setTimeout(() => modalLista.classList.add('active'), 10);
    
    contenedor.innerHTML = '<p style="text-align:center; padding:20px; color:#aaa;">Buscando reseñas...</p>';

    try {
        // Pedimos los comentarios actualizados
        const { data: opiniones, error } = await supabaseClient
            .from('opiniones')
            .select('*')
            .eq('producto_id', productoActual.id)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!opiniones || opiniones.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">Aún no hay comentarios. ¡Sé el primero!</p>';
            return;
        }

        // Pintamos la lista con las estrellas al lado
        contenedor.innerHTML = opiniones.map(op => `
            <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 10px; margin-bottom: 12px; border-left: 3px solid #2ECC71;">
                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                    <strong style="color:white; font-size:0.9rem;">${op.cliente_nombre || 'Anónimo'}</strong>
                    <span style="color:#f1c40f; font-size:0.8rem;">${'★'.repeat(op.puntuacion)}</span>
                </div>
                <p style="color:#bbb; font-size:0.85rem; margin-top:8px; line-height:1.4;">
                    "${op.comentario || 'Sin comentario escrito.'}"
                </p>
            </div>
        `).join('');

    } catch (err) {
        contenedor.innerHTML = '<p style="color:red; text-align:center;">Error de conexión.</p>';
    }
}
function cerrarListaOpiniones() {
    const modalLista = document.getElementById('modal-lista-opiniones');
    if(modalLista) {
        modalLista.classList.remove('active');
        setTimeout(() => modalLista.style.display = 'none', 300);
    }
}












