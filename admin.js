// 1. VARIABLES DE ESTADO
let inventarioGlobal = []; 

// 2. NÚCLEO DE CARGA Y SEGURIDAD
async function checkAuth() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.error("Supabase no detectado");
            return;
        }
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = "login.html";
        } else {
            cargarAdmin();
        }
    } catch (err) {
        console.error("Error en Auth:", err);
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 3. MOTOR DE RENDERIZADO (El corazón del inventario)
async function cargarAdmin() {
    const lista = document.getElementById('lista-admin');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;">⟳ Cargando inventario...</div>';

    try {
        // Validación de Configuración
        if (typeof CONFIG === 'undefined' || !CONFIG.RESTAURANT_ID) {
            throw new Error("ID de restaurante no configurado en config.js");
        }

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('activo', true)
            .eq('restaurant_id', CONFIG.RESTAURANT_ID) 
            .order('id', { ascending: false });

        if (error) throw error;
        
        inventarioGlobal = productos || [];

        if (inventarioGlobal.length === 0) {
            lista.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos. Agrega uno nuevo.</p>';
            return;
        }

        // Generación del HTML con "Safety Checks" para evitar que el bucle se rompa
        lista.innerHTML = inventarioGlobal.map(item => {
            const esAgotado = item.estado === 'agotado';
            const starColor = item.destacado ? '#2ECC71' : '#444'; // Color verde Casona
            
            return `
                <div class="inventory-item">
                    <img src="${item.imagen_url || 'https://via.placeholder.com/60'}" 
                         class="item-thumb" 
                         onerror="this.src='https://via.placeholder.com/60'">
                    <div class="item-meta">
                        <span class="item-title">${item.nombre || 'Sin nombre'} ${item.destacado ? '🌟' : ''}</span>
                        <span class="item-price">$${item.precio || 0}</span>
                        <span class="item-status ${esAgotado ? 'status-bad' : 'status-ok'}">${esAgotado ? 'AGOTADO' : 'DISPONIBLE'}</span>
                    </div>
                    <div class="action-btn-group">
                        <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar"><span class="material-icons">edit</span></button>
                        <button class="icon-btn" style="color:${starColor}" onclick="toggleDestacado(${item.id}, ${item.destacado})" title="Destacar"><span class="material-icons">star</span></button>
                        <button class="icon-btn" onclick="toggleEstado(${item.id}, '${item.estado}')" title="Alternar Estado"><span class="material-icons">${esAgotado ? 'toggle_off' : 'toggle_on'}</span></button>
                        <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Eliminar"><span class="material-icons">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Fallo en cargarAdmin:", err);
        lista.innerHTML = `<p style="color:#ff5252; padding:20px; text-align:center;">Error de conexión: ${err.message}</p>`;
    }
}

// 4. GESTIÓN DE PRODUCTOS (Insert/Update)
const form = document.getElementById('form-producto');
if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit');
        const idEdicion = document.getElementById('edit-id').value;
        
        btn.textContent = "Procesando..."; 
        btn.disabled = true;

        try {
            const fileInput = document.getElementById('imagen-file');
            let urlImagen = null;

            // Subida de imagen con validación de bucket
            if (fileInput && fileInput.files.length > 0) {
                const archivo = fileInput.files[0];
                const nombreArchivo = `prod_${Date.now()}.${archivo.name.split('.').pop()}`;
                const { error: upErr } = await supabaseClient.storage.from('imagenes').upload(nombreArchivo, archivo);
                if (upErr) throw upErr;

                const { data } = supabaseClient.storage.from('imagenes').getPublicUrl(nombreArchivo);
                urlImagen = data.publicUrl;
            }

            const datos = {
                nombre: document.getElementById('nombre').value,
                precio: parseFloat(document.getElementById('precio').value),
                categoria: document.getElementById('categoria').value,
                descripcion: document.getElementById('descripcion').value,
                destacado: document.getElementById('destacado').checked,
                restaurant_id: CONFIG.RESTAURANT_ID
            };

            if (urlImagen) datos.imagen_url = urlImagen;

            const { error } = idEdicion 
                ? await supabaseClient.from('productos').update(datos).eq('id', idEdicion)
                : await supabaseClient.from('productos').insert([{...datos, estado: 'disponible', activo: true}]);

            if (error) throw error;
            
            alert("¡Guardado correctamente!");
            cancelarEdicion();
            cargarAdmin();
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.textContent = idEdicion ? "ACTUALIZAR PRODUCTO" : "GUARDAR PRODUCTO";
            btn.disabled = false;
        }
    });
}

// 5. EDICIÓN Y VISTA PREVIA SEGURA
function prepararEdicion(id) {
    const p = inventarioGlobal.find(p => p.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('precio').value = p.precio;
    document.getElementById('categoria').value = p.categoria;
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('destacado').checked = p.destacado;

    // Vista previa con chequeo de existencia de elementos
    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');
    if (preview && p.imagen_url) {
        preview.src = p.imagen_url;
        preview.style.display = 'block';
        if (prompt) prompt.style.display = 'none';
    }

    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    const btnCancel = document.getElementById('btn-cancelar');
    if (btnCancel) btnCancel.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    if (form) form.reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    const btnCancel = document.getElementById('btn-cancelar');
    if (btnCancel) btnCancel.style.display = "none";

    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (prompt) prompt.style.display = 'block';
}

// 6. ACCIONES RÁPIDAS
async function toggleDestacado(id, valor) {
    await supabaseClient.from('productos').update({ destacado: !valor }).eq('id', id);
    cargarAdmin();
}

async function toggleEstado(id, est) {
    const nuevo = est === 'disponible' ? 'agotado' : 'disponible';
    await supabaseClient.from('productos').update({ estado: nuevo }).eq('id', id);
    cargarAdmin();
}

async function eliminarProducto(id) {
    if(confirm("¿Eliminar este producto?")) {
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}

// Detector de vista previa
document.addEventListener('change', (e) => {
    if (e.target.id === 'imagen-file') {
        const file = e.target.files[0];
        const preview = document.getElementById('imagen-preview');
        const prompt = document.getElementById('upload-prompt');
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                preview.src = ev.target.result;
                preview.style.display = 'block';
                if (prompt) prompt.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    }
});

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', checkAuth);
