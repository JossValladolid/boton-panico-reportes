function mostrarJSONEnTabla(jsonData) {
    const tablaContenedor = document.getElementById('tabla-contenedor');
    const tabla = document.createElement('table');
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
function obtenerTareasYActualizarTabla() {
    fetch("http://localhost:8000/tasks/")
    .then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then((data) => {
        console.log("Tareas actualizadas:", data);
        mostrarJSONEnTabla(data);
    })
    .catch((error) => {
        console.error("Error al obtener las tareas:", error);
        document.getElementById('tabla-contenedor').textContent = 'Error al cargar los datos.';
    });
}
obtenerTareasYActualizarTabla();
setInterval(obtenerTareasYActualizarTabla, 3000);