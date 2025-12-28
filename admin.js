// 1. VARIABLES GLOBALES
let inventarioGlobal = []; 

// 2. SEGURIDAD: VERIFICAR SESIÓN
async function checkAuth() {
    console.log("Verificando sesión...");
    if (typeof supabaseClient === 'undefined') {
        alert("Error: Supabase no está cargado. Revisa tu archivo config.js");
        return;
    }
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        console.log("Sin sesión activa, redirigiendo a login...");
        window.location.href = "login.html";
    } else {
        console.log("Sesión iniciada. Cargando inventario...");
        cargarAdmin();
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 3. CARGAR INVENTARIO
async function cargarAdmin() {
    const lista = document.getElementById('lista-admin');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;">⟳ Conectando con la base de datos...</div>';

    try {
        // Verificamos que el CONFIG exista
        if (typeof CONFIG === 'undefined' || !CONFIG.RESTAURANT_ID) {
            throw new Error("El ID del restaurante no está configurado en config.js");
        }

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('activo', true)
            .eq('restaurant_id', CONFIG.RESTAURANT_ID) 
            .order('id', { ascending: false });

        if (error) throw error;
        
        inventarioGlobal = productos || [];
        console.log("Productos cargados:", inventarioGlobal.length);

        if (inventarioGlobal.length === 0) {
            lista.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Tu inventario está vacío. Agrega tu primer producto a la izquierda.</p>';
            return;
        }

        lista.innerHTML = inventarioGlobal.map(item => {
            const esAgotado = item.estado === 'agotado';
            const favColor = item.destacado ? '#2ECC71' : '#444'; // Verde si es destacado
            
            return `
                <div class="inventory-item">
                    <img src="${item.imagen_url || 'https://via.placeholder.com/60'}" class="item-thumb" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="item-meta">
                        <span class="item-title">${item.nombre} ${item.destacado ? '🌟' : ''}</span>
                        <span class="item-price">$${item.precio}</span>
                        <span class="item-status ${esAgotado ? 'status-bad' : 'status-ok'}">${esAgotado ? 'AGOTADO' : 'DISPONIBLE'}</span>
                    </div>
                    <div class="action-btn-group">
                        <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar"><span class="material-icons">edit</span></button>
                        <button class="icon-btn" style="color:${favColor}" onclick="toggleDestacado(${item.id}, ${item.destacado})" title="Destacar"><span class="material-icons">star</span></button>
                        <button class="icon-btn" onclick="toggleEstado(${item.id}, '${item.estado}')" title="Agotar/Activar"><span class="material-icons">${esAgotado ? 'toggle_off' : 'toggle_on'}</span></button>
                        <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Eliminar"><span class="material-icons">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error crítico en cargarAdmin:", err);
        lista.innerHTML = `<div style="color:#ff5252; padding:20px; text-align:center;">
            <strong>Error al cargar:</strong><br>${err.message}
        </div>`;
    }
}

// 4. GESTIÓN DE FORMULARIO
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

            // Subida de imagen
            if (fileInput && fileInput.files.length > 0) {
                const archivo = fileInput.files[0];
                const nombreArchivo = `prod_${Date.now()}.${archivo.name.split('.').pop()}`;
                const { error: uploadError } = await supabaseClient.storage.from('imagenes').upload(nombreArchivo, archivo);
                if (uploadError) throw uploadError;

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
            
            alert("Operación realizada con éxito");
            cancelarEdicion();
            cargarAdmin();
        } catch (error) {
            alert("Error en la operación: " + error.message);
        } finally {
            btn.textContent = idEdicion ? "ACTUALIZAR PRODUCTO" : "GUARDAR PRODUCTO";
            btn.disabled = false;
        }
    });
}

// 5. EDICIÓN Y VISTA PREVIA
function prepararEdicion(id) {
    const p = inventarioGlobal.find(p => p.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('precio').value = p.precio;
    document.getElementById('categoria').value = p.categoria;
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('destacado').checked = p.destacado;

    // Vista previa
    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');
    if (preview && p.imagen_url) {
        preview.src = p.imagen_url;
        preview.style.display = 'block';
        if (prompt) prompt.style.display = 'none';
    }

    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    if (form) form.reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";

    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (prompt) prompt.style.display = 'block';
}

// Detector de cambio para la vista previa
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

// 6. ACCIONES RÁPIDAS
async function toggleDestacado(id, valor) {
    const { error } = await supabaseClient.from('productos').update({ destacado: !valor }).eq('id', id);
    if (error) alert("Error: " + error.message);
    cargarAdmin();
}

async function toggleEstado(id, est) {
    const nuevoEstado = est === 'disponible' ? 'agotado' : 'disponible';
    const { error } = await supabaseClient.from('productos').update({ estado: nuevoEstado }).eq('id', id);
    if (error) alert("Error: " + error.message);
    cargarAdmin();
}

async function eliminarProducto(id) {
    if(confirm("¿Estás seguro de eliminar este producto?")) {
        const { error } = await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        if (error) alert("Error: " + error.message);
        cargarAdmin();
    }
}

// INICIO
document.addEventListener('DOMContentLoaded', checkAuth);
