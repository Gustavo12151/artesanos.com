// public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded - app.js cargado.');

    // 1. Lógica para el formulario de Subir Imagen
    const formSubirImagen = document.getElementById('formSubirImagen');
    if (formSubirImagen) {
        console.log('🔍 Formulario de Subir Imagen encontrado.');
        formSubirImagen.addEventListener('submit', async e => {
            e.preventDefault();
            console.log('➡️ Evento submit de Subir Imagen interceptado.');

            const formData = new FormData(formSubirImagen);

            // Manejo de álbumes (existente o nuevo)
            const albumSelect = document.getElementById('albumSelect');
            const selectedAlbumValue = albumSelect.value;

            if (selectedAlbumValue === 'new_album') {
                const newAlbumNameInput = document.getElementById('newAlbumName');
                if (newAlbumNameInput.value.trim() === '') {
                    alert('Por favor, ingresa un nombre para el nuevo álbum.');
                    return;
                }
                formData.append('new_album_name', newAlbumNameInput.value.trim());
                formData.append('album_id', ''); // Asegura que album_id está vacío
            } else {
                formData.append('album_id', selectedAlbumValue);
                formData.append('new_album_name', ''); // Asegura que new_album_name está vacío
            }
            
            try {
                const res = await fetch('/imagenes/subir', {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();

                if (data.exito) {
                    formSubirImagen.reset();
                    const uploadModal = bootstrap.Modal.getInstance(document.getElementById('uploadImageModal'));
                    if (uploadModal) {
                        uploadModal.hide();
                    }
                    
                    alert('¡Imagen publicada con éxito!');
                    window.location.reload(); // Recargar la página para actualizar el feed
                } else {
                    alert('Error al subir la imagen: ' + (data.mensaje || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error al subir la imagen:', error);
                alert('Hubo un error en la conexión al subir la imagen.');
            }
        });

        // Lógica para mostrar/ocultar el campo de nuevo álbum
        const albumSelect = document.getElementById('albumSelect');
        const newAlbumNameInput = document.getElementById('newAlbumName');

        if (albumSelect && newAlbumNameInput) {
            albumSelect.addEventListener('change', () => {
                if (albumSelect.value === 'new_album') {
                    newAlbumNameInput.style.display = 'block';
                    newAlbumNameInput.setAttribute('required', 'required');
                } else {
                    newAlbumNameInput.style.display = 'none';
                    newAlbumNameInput.removeAttribute('required');
                    newAlbumNameInput.value = '';
                }
            });
        }
    } else {
        console.warn('⚠️ Formulario de Subir Imagen no encontrado.');
    }

    // 2. Lógica para añadir comentarios (usando AJAX para una UX más fluida)
    const commentForms = document.querySelectorAll('form[action="/comentarios/agregar"]');
    console.log(`🔍 Encontrados ${commentForms.length} formularios de comentario.`);

    if (commentForms.length > 0) {
        commentForms.forEach((form, index) => {
            console.log(`⚙️ Adjuntando listener a formulario de comentario #${index + 1}.`);
            form.addEventListener('submit', async e => {
                e.preventDefault(); // ¡Esta línea es CLAVE!
                console.log(`➡️ Evento submit de Comentario en formulario #${index + 1} interceptado.`);

                const imagenId = form.querySelector('input[name="imagen_id"]').value;
                const textareaComentario = form.querySelector('textarea[name="contenido"]');
                const contenido = textareaComentario.value.trim();

                if (!contenido) {
                    alert('El comentario no puede estar vacío.');
                    return;
                }

                try {
                    const response = await fetch(`/comentarios/agregar`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ imagen_id: imagenId, contenido: contenido })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        // REMOVIDO: alert(result.mensaje); // Ya no mostramos alert para éxito
                        textareaComentario.value = ''; // Limpiar el textarea
                        
                        // Insertar el comentario dinámicamente en el modal
                        const commentsDisplay = document.getElementById(`comentarios-imagen-${imagenId}`);
                        if (commentsDisplay && result.comentario) {
                            console.log('✨ Comentario agregado exitosamente, actualizando DOM.');
                            // Eliminar el mensaje "No hay comentarios aún." si existe
                            const noComentariosMsg = commentsDisplay.querySelector('p.text-muted');
                            if (noComentariosMsg && noComentariosMsg.textContent === 'No hay comentarios aún.') {
                                noComentariosMsg.remove();
                            }

                            // Crear y añadir el nuevo comentario
                            const nuevoComentario = result.comentario;
                            const nuevoComentarioDiv = document.createElement('div');
                            nuevoComentarioDiv.className = 'comment-item mb-2 pb-2 border-bottom'; // Mantener el estilo que ya tenías
                            nuevoComentarioDiv.innerHTML = `
                                <strong>${nuevoComentario.autor_comentario_nombre} ${nuevoComentario.autor_comentario_apellido || ''}:</strong>
                                <p class="mb-0 comment-content">${nuevoComentario.contenido}</p>
                                <small class="text-muted comment-date">${new Date(nuevoComentario.creado_en).toLocaleString()}</small>
                            `;
                            commentsDisplay.appendChild(nuevoComentarioDiv);
                        } else {
                            console.warn('⚠️ No se pudo encontrar el contenedor de comentarios o faltan datos del comentario.');
                        }
                    } else {
                        alert('Error al comentar: ' + (result.mensaje || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error de red al comentar:', error);
                    alert('Error de conexión al añadir comentario. Inténtalo de nuevo.');
                }
            });
        });
    } else {
        console.warn('⚠️ No se encontraron formularios de comentario con action="/comentarios/agregar".');
    }


    // 3. Lógica para Compartir Imagen (usando AJAX)
    const shareForms = document.querySelectorAll('form[action="/compartir"]');
    if (shareForms.length > 0) {
        console.log(`🔍 Encontrados ${shareForms.length} formularios de compartir.`);
        shareForms.forEach(form => {
            form.addEventListener('submit', async e => {
                e.preventDefault();
                console.log('➡️ Evento submit de Compartir Imagen interceptado.');

                const imagenId = form.querySelector('input[name="imagen_id"]').value;
                const selectAmigo = form.querySelector('select[name="usuario_destino"]');
                const usuarioDestinoId = selectAmigo.value;

                if (!usuarioDestinoId) {
                    alert('Por favor, selecciona un amigo para compartir.');
                    return;
                }

                try {
                    const response = await fetch(`/compartir`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ imagen_id: imagenId, usuario_destino: usuarioDestinoId })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        alert(result.mensaje);
                        const shareModal = bootstrap.Modal.getInstance(document.getElementById(`shareModal-${imagenId}`));
                        if (shareModal) {
                            shareModal.hide();
                        }
                        window.location.reload(); // Recargar la página
                    } else {
                        alert('Error al compartir: ' + (result.mensaje || 'Error desconocido'));
                    }
                } catch (error) {
                    console.error('Error de red al compartir:', error);
                    alert('Error de conexión al compartir la imagen. Inténtalo de nuevo.');
                }
            });
        });
    } else {
        console.warn('⚠️ No se encontraron formularios de compartir con action="/compartir".');
    }


    // 4. Funciones para ACEPTAR y RECHAZAR solicitudes de amistad (usan confirm/alert nativos)
    // Se asume que estos botones están en el DOM al cargar.
    window.aceptarSolicitud = async function(solicitudId) {
        if (!confirm('¿Estás seguro de que quieres aceptar esta solicitud de amistad?')) {
            return;
        }
        try {
            const response = await fetch('/amistad/aceptar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solicitud_id: solicitudId }) });
            const result = await response.json();
            if (response.ok) {
                alert(result.mensaje);
                window.location.reload(); // Recargar para actualizar el badge y la lista
            } else { alert('Error al aceptar: ' + (result.mensaje || 'Error desconocido')); }
        } catch (error) { console.error('Error de red al aceptar solicitud:', error); alert('Error de conexión al aceptar la solicitud. Inténtalo de nuevo.'); }
    };

    window.rechazarSolicitud = async function(solicitudId) {
        if (!confirm('¿Estás seguro de que quieres rechazar esta solicitud de amistad?')) {
            return;
        }
        try {
            const response = await fetch('/amistad/rechazar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solicitud_id: solicitudId }) });
            const result = await response.json();
            if (response.ok) {
                alert(result.mensaje);
                window.location.reload(); // Recargar para actualizar la lista
            } else { alert('Error al rechazar: ' + (result.mensaje || 'Error desconocido')); }
        } catch (error) { console.error('Error de red al rechazar solicitud:', error); alert('Error de conexión al rechazar la solicitud. Inténtalo de nuevo.'); }
    };

    // 5. Lógica para el formulario de búsqueda de amigos (AJAX)
    const searchFriendsForm = document.getElementById('searchFriendsForm');
    const searchResultsContainer = document.getElementById('searchResultsContainer');

    if (searchFriendsForm && searchResultsContainer) {
        console.log('🔍 Formulario de Buscar Amigos encontrado.');
        searchFriendsForm.addEventListener('submit', async e => {
            e.preventDefault();
            console.log('➡️ Evento submit de Buscar Amigos interceptado.');

            const searchTerm = document.getElementById('searchFriendName').value.trim();

            if (!searchTerm) {
                searchResultsContainer.innerHTML = '<p class="text-muted">Ingresa un nombre para buscar amigos.</p>';
                return;
            }

            searchResultsContainer.innerHTML = '<p class="text-muted">Buscando...</p>';

            try {
                const response = await fetch(`/buscar-amigo-ajax?nombre=${encodeURIComponent(searchTerm)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                const results = await response.json();

                if (response.ok) {
                    if (results.length > 0) {
                        let resultsHtml = '<h5 class="text-muted">Resultados de búsqueda:</h5>';
                        results.forEach(amigo => {
                            resultsHtml += `
                                <div class="d-flex justify-content-between align-items-center border p-2 mb-2 bg-white rounded shadow-sm">
                                    <span>${amigo.nombre} ${amigo.apellido || ''}</span>
                                    <form method="POST" action="/amistad/solicitar">
                                        <input type="hidden" name="amigo_id" value="${amigo.id}">
                                        <button class="btn btn-sm btn-outline-primary" type="submit">Enviar solicitud</button>
                                    </form>
                                </div>
                            `;
                        });
                        searchResultsContainer.innerHTML = resultsHtml;
                    } else {
                        searchResultsContainer.innerHTML = '<p class="text-muted">No se encontraron amigos con ese nombre.</p>';
                    }
                } else {
                    searchResultsContainer.innerHTML = `<p class="text-danger">Error al buscar amigos: ${results.mensaje || 'Error desconocido'}</p>`;
                }

            } catch (error) {
                console.error('Error de red al buscar amigos:', error);
                searchResultsContainer.innerHTML = '<p class="text-danger">Error de conexión al buscar amigos. Inténtalo de nuevo.</p>';
            }
        });
    } else {
        console.warn('⚠️ Formulario de Buscar Amigos no encontrado.');
    }
});
