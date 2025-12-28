// script.js - VERSIÓN CORREGIDA Y SIN DUPLICADOS
let searchTimeout;
let todosLosProductos = [];
let productoActual = null;
let puntuacionSeleccionada = 0;

// 1. CARGAR MENÚ
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    if (grid) grid.innerHTML = '<p style="text-align:center; color:#888; grid-column:1/-1; padding:40px;">Cargando carta...</p>';
    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Error: Supabase no conectado.");
        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .eq('restaurant_id', CONFIG.RESTAURANT_ID)
            .order('categoria', { ascending: true });
        if (error) throw error;
        todosLosProductos = productos;
        renderizarMenu(todosLosProductos);
    } catch (err) {
        console.error("Error cargando:", err);
    }
}

// 2. RENDERIZAR
function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (lista.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:40px; color:#888;">No hay productos.</p>';
        return;
    }
    const categorias = {
        'entrantes': { nombre: 'Entrantes', icono: '🍟' },
        'completas': { nombre: 'Completas', icono: '🍛' },
        'pizzas': { nombre: 'Pizzas', icono: '🍕' },
        'spaguettis': { nombre: 'Spaguettis', icono: '🍝' },
        'bebidas': { nombre: 'Bebidas', icono: '🍺' },
        'postres': { nombre: 'Postres', icono: '🍨' },
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
                                    <span class="card-price">$${item.precio}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            contenedor.innerHTML += seccionHTML;
        }
    });
    activarVigilanciaCategorias();
}

// 3. DETALLE CON PROMEDIO REAL
async function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-price', `$${productoActual.precio}`);
    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';

    try {
        const { data: notas, error } = await supabaseClient
            .from('opiniones')
            .select('puntuacion')
            .eq('producto_id', id);

        let promedio = "0.0";
        let cantidad = 0;

        if (notas && notas.length > 0) {
            promedio = (notas.reduce((acc, curr) => acc + curr.puntuacion, 0) / notas.length).toFixed(1);
            cantidad = notas.length;
        }

        const notaEl = document.getElementById('det-puntuacion-valor');
        const cantEl = document.getElementById('det-cantidad-opiniones');
        if (notaEl) notaEl.textContent = promedio;
        if (cantEl) cantEl.textContent = `(${cantidad} reseñas)`;
    } catch (err) { console.error(err); }

    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

// 4. LISTA DE OPINIONES
async function abrirListaOpiniones() {
    const contenedor = document.getElementById('contenedor-opiniones-full');
    const modalLista = document.getElementById('modal-lista-opiniones');
    if (!productoActual) return;

    modalLista.style.display = 'flex';
    setTimeout(() => modalLista.classList.add('active'), 10);
    contenedor.innerHTML = '<p style="text-align:center; padding:20px; color:#aaa;">Cargando...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('opiniones')
            .select('*')
            .eq('producto_id', productoActual.id)
            .order('id', { ascending: false });

        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; padding:20px;">Sin reseñas aún.</p>';
            return;
        }

        contenedor.innerHTML = data.map(op => `
            <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:10px; margin-bottom:12px; border-left:3px solid #2ECC71;">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="color:white;">${op.cliente_nombre || 'Anónimo'}</strong>
                    <span style="color:#f1c40f;">${'★'.repeat(op.puntuacion)}</span>
                </div>
                <p style="color:#bbb; font-size:0.85rem; margin-top:8px;">"${op.comentario || ''}"</p>
            </div>
        `).join('');
    } catch (err) { contenedor.innerHTML = '<p>Error.</p>'; }
}

// 5. ENVIAR OPINIÓN
async function enviarOpinion() {
    if (!puntuacionSeleccionada) return alert("Selecciona estrellas");
    const btn = document.getElementById('btn-enviar-opinion');
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.from('opiniones').insert([{
            producto_id: productoActual.id,
            cliente_nombre: document.getElementById('cliente-nombre').value.trim() || "Anónimo",
            comentario: document.getElementById('cliente-comentario').value.trim(),
            puntuacion: puntuacionSeleccionada,
            restaurant_id: CONFIG.RESTAURANT_ID
        }]);
        if (error) throw error;
        alert("✅ Enviada");
        cerrarModalOpiniones();
        abrirDetalle(productoActual.id);
    } catch (err) { alert("Error: " + err.message); }
    finally { btn.disabled = false; }
}

// FUNCIONES AUXILIARES
function setText(id, text) { const el = document.getElementById(id); if(el) el.textContent = text; }
function cerrarDetalle() { const m = document.getElementById('modal-detalle'); m.classList.remove('active'); setTimeout(() => m.style.display='none', 300); }
function cerrarListaOpiniones() { const m = document.getElementById('modal-lista-opiniones'); m.classList.remove('active'); setTimeout(() => m.style.display='none', 300); }
function abrirOpinionDesdeDetalle() { cerrarDetalle(); const m = document.getElementById('modal-opinion'); m.style.display='flex'; setTimeout(()=>m.classList.add('active'), 10); }
function cerrarModalOpiniones() { const m = document.getElementById('modal-opinion'); m.classList.remove('active'); setTimeout(()=>m.style.display='none', 350); }

document.addEventListener('click', (e) => {
    const estrella = e.target.closest('#stars-container span');
    if (estrella) {
        puntuacionSeleccionada = parseInt(estrella.getAttribute('data-val'));
        document.querySelectorAll('#stars-container span').forEach((s, i) => {
            s.style.color = (i < puntuacionSeleccionada) ? '#2ECC71' : '#444';
        });
    }
});

document.addEventListener('DOMContentLoaded', cargarMenu);
