document.addEventListener('DOMContentLoaded', function() {
  // Elementos del DOM
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mainContent = document.querySelector('.main-content');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');

  // Toggle sidebar
  sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('expanded');
  });

  function mostrarJSONEnTabla(jsonData) {
    const tablaContenedor = document.getElementById('reportes-table');
    const tabla = document.createElement('tabla-reportes');
    if (jsonData && jsonData.length > 0) {
      const thead = document.createElement('thead');
      const encabezadoFila = document.createElement('tr');
      const columnas = Object.keys(jsonData[0]);
      columnas.forEach(columna => {
        const th = document.createElement('th');
        th.textContent = columna.toUpperCase();
        encabezadoFila.appendChild(th);
      });
      thead.appendChild(encabezadoFila);
      tabla.appendChild(thead);
      const tbody = document.createElement('tbody');
      jsonData.forEach(filaData => {
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
    } else {
      tablaContenedor.textContent = 'No hay datos para mostrar.';
    }
  }

  function cargarTabla() {
    fetch("http://localhost:8000/tasks/")
    .then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then((data) => {
        console.log("Tareas actualizadas:", data);
        document.getElementById('errorFetch').textContent = '';
        mostrarJSONEnTabla(data);
    })
    .catch((error) => {
      console.error("Error al obtener las tareas:", error);
  
      const errorElement = document.getElementById('errorFetch');
      errorElement.textContent = 'Error al cargar los datos';
      errorElement.classList.add('blink');
  
      // Elimina la tabla
      const tablaContenedor = document.getElementById('reportes-table');
      tablaContenedor.innerHTML = '';
  });
  }
  
  cargarTabla();
  setInterval(cargarTabla, 3000);
});

////////////////////////////////////////////////////////////////////////////////////
