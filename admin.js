let inventarioGlobal = []; 

// 1. SEGURIDAD
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "login.html";
    } else {
        cargarAdmin();
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 2. CARGAR INVENTARIO
async function cargarAdmin() {
    const lista = document.getElementById('lista-admin');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;">⟳ Cargando...</div>';

    let { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .eq('restaurant_id', CONFIG.RESTAURANT_ID) 
        .order('id', { ascending: false });

    if (error) { 
        alert("Error: " + error.message); 
        return; 
    }
    
    inventarioGlobal = productos || [];

    if (inventarioGlobal.length === 0) {
        lista.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Inventario vacío.</p>';
        return;
    }

    lista.innerHTML = inventarioGlobal.map(item => {
        const esAgotado = item.estado === 'agotado';
        const favColor = item.destacado ? '#F1C40F' : '#444';
        
        return `
            <div class="inventory-item">
                <img src="${item.imagen_url || 'https://via.placeholder.com/60'}" class="item-thumb">
                <div class="item-meta">
                    <span class="item-title">${item.nombre} ${item.destacado ? '🌟' : ''}</span>
                    <span class="item-price">$${item.precio}</span>
                    <span class="item-status ${esAgotado ? 'status-bad' : 'status-ok'}">${esAgotado ? 'AGOTADO' : 'DISPONIBLE'}</span>
                </div>
                <div class="action-btn-group">
                    <button class="icon-btn" onclick="prepararEdicion(${item.id})"><span class="material-icons">edit</span></button>
                    <button class="icon-btn" style="color:${favColor}" onclick="toggleDestacado(${item.id}, ${item.destacado})"><span class="material-icons">star</span></button>
                    <button class="icon-btn" onclick="toggleEstado(${item.id}, '${item.estado}')"><span class="material-icons">${esAgotado ? 'toggle_off' : 'toggle_on'}</span></button>
                    <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})"><span class="material-icons">delete</span></button>
                </div>
            </div>
        `;
    }).join('');
}

// 3. GESTIÓN DE PRODUCTOS
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

            if (fileInput.files.length > 0) {
                const archivo = fileInput.files[0];
                const nombreArchivo = `prod_${Date.now()}.${archivo.name.split('.').pop()}`;
                await supabaseClient.storage.from('imagenes').upload(nombreArchivo, archivo);
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
            
            alert("Operación exitosa");
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

function prepararEdicion(id) {
    const p = inventarioGlobal.find(p => p.id === id);
    if (!p) return;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('precio').value = p.precio;
    document.getElementById('categoria').value = p.categoria;
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('destacado').checked = p.destacado;
    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    form.reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";
}

async function toggleDestacado(id, valor) {
    await supabaseClient.from('productos').update({ destacado: !valor }).eq('id', id);
    cargarAdmin();
}

async function toggleEstado(id, est) {
    await supabaseClient.from('productos').update({ estado: est === 'disponible' ? 'agotado' : 'disponible' }).eq('id', id);
    cargarAdmin();
}

async function eliminarProducto(id) {
    if(confirm("¿Eliminar producto?")) {
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}

document.addEventListener('DOMContentLoaded', checkAuth);
// ==========================================
// LÓGICA DE VISTA PREVIA DE IMAGEN Y CANCELAR
// ==========================================

// 1. Función Global para el botón "Cancelar"
window.cancelarEdicion = function() {
    const form = document.getElementById('form-producto');
    const btnSubmit = document.getElementById('btn-submit');
    const btnCancelar = document.getElementById('btn-cancelar');
    const editIdInput = document.getElementById('edit-id');

    form.reset(); // Limpia los inputs de texto
    editIdInput.value = ''; // Resetea el ID de edición
    btnSubmit.textContent = 'GUARDAR PRODUCTO';
    btnCancelar.style.display = 'none';
    editandoId = null;

    resetearVistaPrevia(); // Limpia la imagen
}

// Función auxiliar para volver al estado inicial de "Toca para subir"
function resetearVistaPrevia() {
    const fileInput = document.getElementById('imagen-file');
    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');

    if (fileInput) fileInput.value = ''; // Limpia el input file
    if (preview) {
        preview.src = '';
        preview.style.display = 'none'; // Oculta la imagen
    }
    if (prompt) prompt.style.display = 'block'; // Muestra el texto y el icono
}


document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los nuevos elementos
    const fileInput = document.getElementById('imagen-file');
    const preview = document.getElementById('imagen-preview');
    const prompt = document.getElementById('upload-prompt');

    // 2. Listener para mostrar vista previa al seleccionar archivo local
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    preview.src = event.target.result; // Asigna la imagen leída
                    preview.style.display = 'block';   // Muestra la etiqueta img
                    prompt.style.display = 'none';     // Oculta el texto de ayuda
                }
                reader.readAsDataURL(file); // Lee el archivo como URL
            } else {
                // Si el usuario cancela la selección de archivo
                 if (!editandoId) resetearVistaPrevia();
            }
        });
    }

    // 3. Modificar el listener de EDITAR para mostrar la imagen existente
    // Busca en tu código actual donde dice: if (e.target.closest('.btn-edit')) { ...
    // Y añade estas líneas justo después de llenar el formulario:
    const originalEditHandler = document.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        if (btnEdit) {
             // ... (tu código que obtiene el producto y llena los inputs) ...
            const id = btnEdit.dataset.id;
            const prod = todosLosProductos.find(p => p.id == id);
             
            if (prod) {
                // Lógica añadida para la vista previa al editar
                if (prod.imagen_url) {
                    preview.src = prod.imagen_url;
                    preview.style.display = 'block';
                    prompt.style.display = 'none';
                } else {
                    resetearVistaPrevia();
                }
            }
        }
    });
});
