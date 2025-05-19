document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mainContent = document.querySelector('.main-content');
  const searchInput = document.getElementById('search-input');
  const showAllButton = document.getElementById('mostrar-todos-btn');
  const exportarButton = document.getElementById('exportar-button');
  const refreshButton = document.getElementById('refresh-button');
  const errorFetchElement = document.getElementById('errorFetch');
  const overlay = document.createElement('div'); // Crear el overlay
  overlay.classList.add('overlay');
  document.body.appendChild(overlay); // Añadir el overlay al body

  // Inicialmente, el sidebar está oculto y el contenido principal expandido
  let sidebarVisible = false;
  
  // Aplicar clases iniciales para ocultar el sidebar
  sidebar.classList.add('collapsed');
  mainContent.classList.add('expanded');

  // SISTEMA DE PERSISTENCIA: Restaurar el estado de búsqueda al cargar la página
  // Este bloque debe estar al principio para restaurar valores antes de cualquier otra lógica
  const savedSearch = localStorage.getItem('searchValue');
  if (savedSearch) {
    // Restaurar valor de búsqueda
    searchInput.value = savedSearch;
    
    // Deshabilitar autoUpdate inmediatamente
    let autoUpdate = false;
    let hayTextoBusqueda = true;
    
    // Restaurar y ejecutar la búsqueda después de un pequeño retraso 
    // para asegurar que todos los elementos de la página estén cargados
    setTimeout(() => {
      barraDeBusqueda(); // Ejecutar la búsqueda con el valor restaurado
    }, 400);
  }

  sidebarToggle.addEventListener('click', function (event) {
    event.stopPropagation(); // Evitar que el clic se propague
    sidebarVisible = !sidebarVisible;
    
    if (sidebarVisible) {
      sidebar.classList.remove('collapsed');
      sidebar.style.transform = 'translateX(0)'; // Mostrar sidebar
      mainContent.classList.remove('expanded');
      mainContent.style.marginLeft = `${sidebar.offsetWidth}px`; // Importante: ajustar margen del contenido
      overlay.classList.add('active'); // Mostrar overlay
    } else {
      sidebar.classList.add('collapsed');
      sidebar.style.transform = 'translateX(-100%)'; // Ocultar completamente
      mainContent.classList.add('expanded');
      mainContent.style.marginLeft = '0'; // Reiniciar margen
      overlay.classList.remove('active'); // Ocultar overlay
    }
  });

  // Cerrar sidebar al hacer clic en cualquier parte que no sea el sidebar
  document.addEventListener('click', function(event) {
    if (sidebarVisible && 
        !sidebar.contains(event.target) && 
        !sidebarToggle.contains(event.target)) {
      sidebarVisible = false;
      sidebar.classList.add('collapsed');
      sidebar.style.transform = 'translateX(-100%)'; // Ocultar completamente
      mainContent.classList.add('expanded');
      mainContent.style.marginLeft = '0'; // Reiniciar margen
      overlay.classList.remove('active'); // Ocultar overlay
    }
  });

  // Prevenir que clics dentro del sidebar cierren el sidebar
  sidebar.addEventListener('click', function(event) {
    event.stopPropagation();
  });

  let valores = "";
  let datosActuales = []; // Variable global para almacenar el JSON
  let autoUpdate = savedSearch ? false : true; // Si hay búsqueda guardada, desactivar autoUpdate
  
  // Variable para mantener el estado de si hay texto en la barra de búsqueda
  let hayTextoBusqueda = savedSearch ? true : false; // Si hay búsqueda guardada, activar hayTextoBusqueda

  function barraDeBusqueda() {
    const valorBusqueda = searchInput.value.trim();

    // Actualizar el estado del texto de búsqueda
    hayTextoBusqueda = valorBusqueda !== "";
    
    // Guardar el valor de búsqueda en localStorage para persistencia
    if (hayTextoBusqueda) {
      localStorage.setItem('searchValue', valorBusqueda);
    } else {
      localStorage.removeItem('searchValue');
    }

    if (!hayTextoBusqueda) {
      valores = "";
      autoUpdate = true; // Solo permitimos actualización automática cuando no hay búsqueda
      cargarTabla(valores);
      return;
    }

    try {
      // Analizar la consulta de búsqueda
      const parametrosBusqueda = parsearConsulta(valorBusqueda);
      autoUpdate = false; // Desactivamos la actualización automática cuando hay búsqueda
      cargarTabla(parametrosBusqueda);
    } catch (error) {
      autoUpdate = false;
      const tablaContenedor = document.getElementById('reportes-table');
      tablaContenedor.textContent = '';
      mostrarError(`Error en la sintaxis de búsqueda: ${error.message}`);
    }
  }

  // Función centralizada para mostrar errores
  function mostrarError(mensaje) {
    errorFetchElement.textContent = mensaje;
    errorFetchElement.style.display = 'block';
  }

  // Función para limpiar mensajes de error
  function limpiarError() {
    errorFetchElement.textContent = '';
    errorFetchElement.style.display = 'none';
  }

  // Verificar si hay texto en la barra de búsqueda cada vez que el foco cambia
  searchInput.addEventListener('blur', function() {
    // Guardamos el valor actual en localStorage cada vez que se pierde el foco
    const currentValue = searchInput.value.trim();
    if (currentValue !== "") {
      localStorage.setItem('searchValue', currentValue);
      hayTextoBusqueda = true;
      autoUpdate = false;
    } else {
      localStorage.removeItem('searchValue');
    }
  });

  searchInput.addEventListener('focus', function() {
    // Si hay texto en la barra de búsqueda, mantener autoUpdate en false
    if (searchInput.value.trim() !== "") {
      hayTextoBusqueda = true;
      autoUpdate = false;
    }
  });

  function parsearConsulta(consulta) {
    // Dividir por "OR" primero (simbolizado por "|")
    const gruposOR = consulta.split("|").map(g => g.trim());
    
    // Objeto para almacenar los parámetros de búsqueda
    const parametros = {
      nom: [],
      cod: [],
      id: [],
      des: []
    };
    
    // Procesar cada grupo OR
    gruposOR.forEach(grupo => {
      // Si está entre paréntesis, eliminarlos
      grupo = grupo.replace(/^\(|\)$/g, '').trim();
      
      // Dividir por "AND" (simbolizado por "&")
      const condicionesAND = grupo.split("&").map(c => c.trim());
      
      // Objeto temporal para este grupo AND
      const grupoTemp = {
        nom: [],
        cod: [],
        id: [],
        des: []
      };
      
      // Procesar cada condición
      condicionesAND.forEach(condicion => {
        const partes = condicion.split("=");
        if (partes.length !== 2) {
          throw new Error(`Formato incorrecto en la condición "${condicion}". Use formato "campo=valor"`);
        }
        
        const [clave, valor] = partes.map(p => p.trim());
        
        if (!["nom", "cod", "id", "des"].includes(clave)) {
          throw new Error(`Campo no válido: "${clave}". Campos permitidos: nom, cod, id, des`);
        }
        
        if (!valor) {
          throw new Error(`Valor no especificado para el campo "${clave}"`);
        }
        
        // Si es una condición AND dentro de un grupo, la añadimos al grupo temporal
        if (condicionesAND.length > 1) {
          grupoTemp[clave].push(valor);
        } else {
          // Si es una condición sola, la añadimos directamente a los parámetros principales
          parametros[clave].push(valor);
        }
      });
      
      // Si tenemos un grupo AND (múltiples condiciones), generamos una representación combinada
      if (condicionesAND.length > 1) {
        // Creamos una representación especial para condiciones combinadas
        // Por ejemplo "nom=Isaac&des=acoso" se convierte en "nom=Isaac:des=acoso"
        let combinacion = "";
        
        for (const [campo, valores] of Object.entries(grupoTemp)) {
          if (valores.length > 0) {
            if (combinacion) combinacion += ":";
            combinacion += `${campo}=${valores.join(',')}`;
          }
        }
        
        if (combinacion) {
          // Añadimos esta combinación a un campo especial para el backend
          if (!parametros['combinado']) parametros['combinado'] = [];
          parametros['combinado'].push(combinacion);
        }
      }
    });
    
    // Convertir el objeto de parámetros a una cadena de consulta URL
    return Object.entries(parametros)
      .filter(([_, valores]) => valores.length > 0)
      .map(([campo, valores]) => {
        return valores.map(valor => `${campo}=${encodeURIComponent(valor)}`).join('&');
      })
      .join('&');
  }

  showAllButton.addEventListener('click', function () {
    searchInput.value = "";
    valores = "";
    hayTextoBusqueda = false;
    autoUpdate = true; // Reactivar al mostrar todo
    localStorage.removeItem('searchValue'); // Eliminar cualquier búsqueda guardada
    limpiarError(); // Limpiar mensajes de error previos
    cargarTabla(valores);  
  });

  document.addEventListener('keypress', function(event) {    
    var searchInputFocused = (document.activeElement === searchInput);
    if (event.key === "Enter" && searchInputFocused) {
      barraDeBusqueda();
    }
  });

  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    if (selection && selection.toString().length > 0) {
      autoUpdate = false; // Pausa si hay texto seleccionado
    } else if (!hayTextoBusqueda) {
      // Solo reactivar autoUpdate si no hay texto en la barra de búsqueda
      autoUpdate = true;
    }
  });

  // Interceptar todos los formularios para guardar el estado antes del envío
  document.addEventListener('submit', function(e) {
    // Guardar el valor de búsqueda actual en localStorage antes del envío
    const currentValue = searchInput.value.trim();
    if (currentValue !== "") {
      localStorage.setItem('searchValue', currentValue);
    }
  });

  function formatearEncabezado(texto) {
    if (texto === "id") {
      return "ID";
    } 
    return texto
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());            
  }

  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  const liveSearch = debounce(() => {
    barraDeBusqueda();
  }, 400); // medio segundo de espera

  searchInput.addEventListener('input', function () {
    // Verificar inmediatamente si hay texto y actualizar las variables
    hayTextoBusqueda = searchInput.value.trim() !== "";
    autoUpdate = !hayTextoBusqueda; // Desactivar autoUpdate si hay texto
    liveSearch();       // Llamada diferida
  });

  function mostrarJSONEnTabla(jsonData) {
    const tablaContenedor = document.getElementById('reportes-table');
    const tabla = document.createElement('table');
    tabla.classList.add('table');

    // Si viene un solo objeto, lo convertimos en array
    const datos = Array.isArray(jsonData) ? jsonData : [jsonData];

    if (datos.length > 0) {
      const thead = document.createElement('thead');
      const encabezadoFila = document.createElement('tr');
      const columnas = Object.keys(datos[0]);

      columnas.forEach(columna => {
        const th = document.createElement('th');
        th.textContent = formatearEncabezado(columna);
        encabezadoFila.appendChild(th);
      });
      thead.appendChild(encabezadoFila);
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      datos.forEach(filaData => {
        const fila = document.createElement('tr');
        columnas.forEach(columna => {
          const celda = document.createElement('td');
          celda.textContent = filaData[columna];
          fila.appendChild(celda);
        });
        tbody.appendChild(fila);
      });
      tabla.appendChild(tbody);
      tablaContenedor.innerHTML = '';
      tablaContenedor.appendChild(tabla);
      limpiarError(); // Limpiar cualquier error previo cuando se muestran datos
    } else {
      tablaContenedor.textContent = '';
      mostrarError('No se encontraron resultados para la búsqueda actual');
    }
  }

  function cargarTabla(busqueda) {
    let url = "http://localhost:8000/search-advanced?";
    if (busqueda && busqueda !== "") {
      url += busqueda;
    }
    
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          // Proporcionar mensajes específicos según el código de estado HTTP
          switch(response.status) {
            case 400:
              throw new Error('Solicitud incorrecta: parámetros de búsqueda inválidos');
            case 401:
              throw new Error('No autorizado: debe iniciar sesión para acceder a estos datos');
            case 403:
              throw new Error('Acceso prohibido: no tiene permisos para realizar esta búsqueda');
            case 404:
              throw new Error('Recurso no encontrado: la URL de búsqueda es incorrecta');
            case 500:
              throw new Error('Error interno del servidor: por favor intente más tarde');
            case 503:
              throw new Error('Servicio no disponible: el servidor está en mantenimiento');
            default:
              throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
          }
        }
        return response.json();
      })
      .then((data) => {
        console.log("Datos actualizados:", data);
        datosActuales = data;
        limpiarError();
        
        if (Array.isArray(data) && data.length === 0) {
          // Mensaje específico para arrays vacíos (búsqueda sin resultados)
          mostrarError('La búsqueda no produjo resultados. Intente con otros términos.');
          const tablaContenedor = document.getElementById('reportes-table');
          tablaContenedor.innerHTML = '';
        } else {
          mostrarJSONEnTabla(data);
        }
        
        // Si hay resultados de búsqueda, deshabilitamos la actualización automática
        if (busqueda && busqueda !== "") {
          hayTextoBusqueda = true;
          autoUpdate = false;
        }
      })
      .catch((error) => {
        // No reiniciar valores si hay una búsqueda activa
        if (!hayTextoBusqueda) {
          valores = "";
        }
        datosActuales = [];
        console.error("Error al obtener datos:", error);
        
        // Determinar si es un error de conexión o un error controlado
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          mostrarError('Error de conexión: No se pudo conectar con el servidor. Verifique su conexión a internet o si el servidor está funcionando.');
        } else {
          // Usar el mensaje de error específico que generamos arriba
          mostrarError(error.message || 'Error desconocido al cargar los datos');
        }
        
        const tablaContenedor = document.getElementById('reportes-table');
        tablaContenedor.innerHTML = '';
      });
  }
  
  // Primera carga automática - comprobar si hay una búsqueda guardada
  if (!localStorage.getItem('searchValue')) {
    cargarTabla(valores);
  }

  // Actualiza cada 3 segundos, pero solo si autoUpdate es true
  setInterval(() => {
    // Verificar antes de cada intento de actualización si hay texto en el campo de búsqueda
    hayTextoBusqueda = searchInput.value.trim() !== "";
    
    // Solo actualizar si autoUpdate es true Y no hay texto en la búsqueda
    if (autoUpdate && !hayTextoBusqueda) {
      cargarTabla(valores);
    }
  }, 3000);
  
  // Botón de exportar
  function exportData(datosActuales) {
    if (!datosActuales || datosActuales.length === 0) {
      mostrarError("No hay datos disponibles para exportar. Realice una búsqueda válida primero.");
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(datosActuales);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes");

      const fechaActual = new Date();
      const fecha = fechaActual.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
      const nombreArchivo = `reportes_${fecha}.xlsx`;

      XLSX.writeFile(workbook, nombreArchivo);
      limpiarError(); // Limpiar cualquier error previo
    } catch (error) {
      console.error("Error al exportar datos:", error);
      mostrarError("Error al exportar: " + (error.message || "No se pudo generar el archivo Excel"));
    }
  }

  exportarButton.addEventListener('click', function () {
    exportData(datosActuales);
  });

  refreshButton.addEventListener('click', function () {
    cargarTabla(parsearConsulta(searchInput.value.trim()));
  });

  // Asegurarse de escuchar también la pérdida de foco a nivel de ventana
  // para casos como cierre de pestaña, recargas, etc.
  window.addEventListener('beforeunload', function() {
    const currentValue = searchInput.value.trim();
    if (currentValue !== "") {
      localStorage.setItem('searchValue', currentValue);
    }
  });

  // Para manejar el menú en móviles
  if (window.innerWidth <= 576) {
    // El sidebar ya está inicialmente oculto por la configuración global
    sidebarToggle.addEventListener('click', function(event) {
      event.stopPropagation();
      
      if (sidebar.classList.contains('visible')) {
        sidebar.classList.remove('visible');
        sidebar.style.transform = 'translateX(-100%)';
        mainContent.style.marginLeft = '0';
        overlay.classList.remove('active-mobile');
      } else {
        sidebar.classList.add('visible');
        sidebar.style.transform = 'translateX(0)'; // Mostrar sidebar en móvil
        mainContent.style.marginLeft = `${sidebar.offsetWidth}px`; // También en móvil
        overlay.classList.add('active-mobile');
      }
    });
    
    // Añadir manejador para clics en móvil fuera del sidebar
    document.addEventListener('click', function(event) {
      if (window.innerWidth <= 576 && 
          !sidebar.contains(event.target) && 
          !sidebarToggle.contains(event.target) &&
          sidebar.classList.contains('visible')) {
        sidebar.classList.remove('visible');
        sidebar.style.transform = 'translateX(-100%)';
        mainContent.style.marginLeft = '0';
        overlay.classList.remove('active-mobile');
      }
    });
  }

  // Guardar el estado de búsqueda también cuando se cierra la página
  window.addEventListener('pagehide', function() {
    const currentValue = searchInput.value.trim();
    if (currentValue !== "") {
      localStorage.setItem('searchValue', currentValue);
    }
  });
});