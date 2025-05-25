// ============================================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================================

const API_URL = "http://localhost:8000"

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN Y SEGURIDAD
// ============================================================================

// Función centralizada para manejar peticiones con manejo de errores de autenticación
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem("access_token")

  if (!token) {
    handleAuthError()
    return null
  }

  const defaultOptions = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  }

  const finalOptions = { ...defaultOptions, ...options }

  try {
    const response = await fetch(url, finalOptions)

    // Manejar errores de autenticación de forma centralizada
    if (response.status === 401 || response.status === 403) {
      console.warn("Token expirado o inválido, cerrando sesión...")
      handleAuthError()
      return null
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  } catch (error) {
    console.error("Error en petición autenticada:", error)
    throw error
  }
}

// Función centralizada para manejar errores de autenticación
function handleAuthError() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("searchValue")
  alert("Tu sesión ha expirado. Serás redirigido al login.")
  window.location.href = "index.html"
}

// Función para verificar si el token sigue siendo válido
async function verifyTokenValidity() {
  try {
    const response = await authenticatedFetch(`${API_URL}/me`)
    return response !== null
  } catch (error) {
    console.error("Error verificando token:", error)
    return false
  }
}

// Protección del panel de administración mejorada
async function verificarAdmin() {
  const token = localStorage.getItem("access_token")

  if (!token) {
    window.location.href = "index.html"
    return false
  }

  try {
    const response = await authenticatedFetch(`${API_URL}/me`)
    if (!response) return false // Ya manejado por authenticatedFetch

    const user = await response.json()
    if (user.rol !== "admin") {
      alert("Acceso denegado: no eres administrador")
      localStorage.removeItem("access_token")
      window.location.href = "admin-login.html"
      return false
    }
    return true
  } catch (error) {
    console.error("Error al verificar admin:", error)
    handleAuthError()
    return false
  }
}
// Ejecutar verificación de admin al cargar
;(async () => {
  await verificarAdmin()
})()

// ============================================================================
// FUNCIONES DE VERIFICACIÓN DE ESTADO DE REPORTES
// ============================================================================

function estaReporteCancelado(reporte) {
  if (reporte.status && typeof reporte.status === "string") {
    const statusLower = reporte.status.toLowerCase()
    if (
      statusLower.includes("cancelado") ||
      statusLower.includes("cancelled") ||
      statusLower.includes("inactive") ||
      statusLower.includes("inactivo")
    ) {
      return true
    }
  }

  if (reporte.cancelled === true || reporte.cancelado === true) {
    return true
  }

  if (reporte.estado && typeof reporte.estado === "string") {
    const estadoLower = reporte.estado.toLowerCase()
    if (estadoLower.includes("cancelado") || estadoLower.includes("inactivo")) {
      return true
    }
  }

  return false
}

function estaReporteCompletado(reporte) {
  if (reporte.status && typeof reporte.status === "string") {
    const statusLower = reporte.status.toLowerCase()
    if (statusLower.includes("completado") || statusLower.includes("completed") || statusLower.includes("finalizado")) {
      return true
    }
  }

  if (reporte.estado && typeof reporte.estado === "string") {
    const estadoLower = reporte.estado.toLowerCase()
    if (estadoLower.includes("completado") || estadoLower.includes("finalizado")) {
      return true
    }
  }

  return false
}

function estaReportePendiente(reporte) {
  if (reporte.status && typeof reporte.status === "string") {
    const statusLower = reporte.status.toLowerCase()
    if (statusLower.includes("pendiente") || statusLower.includes("pending")) {
      return true
    }
  }

  if (reporte.estado && typeof reporte.estado === "string") {
    const estadoLower = reporte.estado.toLowerCase()
    if (estadoLower.includes("pendiente") || estadoLower.includes("pending")) {
      return true
    }
  }

  return false
}

// ============================================================================
// INICIALIZACIÓN DEL DOM Y EVENT LISTENERS
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // ============================================================================
  // ELEMENTOS DEL DOM
  // ============================================================================

  const sidebar = document.querySelector(".sidebar")
  const sidebarToggle = document.getElementById("sidebar-toggle")
  const mainContent = document.querySelector(".main-content")
  const searchInput = document.getElementById("search-input")
  const showAllButton = document.getElementById("mostrar-todos-btn")
  const exportarButton = document.getElementById("exportar-button")
  const refreshButton = document.getElementById("refresh-button")
  const logoutButton = document.getElementById("logout-button")
  const errorFetchElement = document.getElementById("errorFetch")
  const overlay = document.createElement("div")
  overlay.classList.add("overlay")
  document.body.appendChild(overlay)

  // ============================================================================
  // VARIABLES LOCALES
  // ============================================================================

  let valores = ""
  let datosActuales = []
  let autoUpdate = true
  let hayTextoBusqueda = false

  // ============================================================================
  // FUNCIONES DE MODAL DE CANCELACIÓN
  // ============================================================================

  // Crear modal de cancelación
  function crearModalCancelacion(reporteId, botonAccion) {
    // Remover modal existente si existe
    const modalExistente = document.getElementById("modal-cancelacion")
    if (modalExistente) {
      modalExistente.remove()
    }

    // Crear modal
    const modal = document.createElement("div")
    modal.id = "modal-cancelacion"
    modal.className = "modal-cancelacion"

    // Obtener posición del botón de acción
    const rect = botonAccion.getBoundingClientRect()

    modal.innerHTML = `
      <div class="modal-content-cancelacion">
        <div class="modal-header-cancelacion">
          <h4>Cancelar Reporte</h4>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body-cancelacion">
          <label for="razon-cancelacion">Razón de la cancelación:</label>
          <textarea id="razon-cancelacion" placeholder="Ingrese la razón de la cancelación..." rows="3"></textarea>
        </div>
        <div class="modal-footer-cancelacion">
          <button class="btn-modal-cancelar">Cancelar</button>
          <button class="btn-modal-confirmar">Confirmar</button>
        </div>
      </div>
    `

    // Posicionar modal cerca del botón
    modal.style.position = "fixed"
    modal.style.left = `${rect.left}px`
    modal.style.top = `${rect.bottom + 10}px`
    modal.style.zIndex = "1000"

    // Ajustar posición si se sale de la pantalla
    document.body.appendChild(modal)
    const modalRect = modal.getBoundingClientRect()

    if (modalRect.right > window.innerWidth) {
      modal.style.left = `${window.innerWidth - modalRect.width - 20}px`
    }

    if (modalRect.bottom > window.innerHeight) {
      modal.style.top = `${rect.top - modalRect.height - 10}px`
    }

    // Event listeners del modal
    const closeButton = modal.querySelector(".modal-close")
    const cancelButton = modal.querySelector(".btn-modal-cancelar")
    const confirmButton = modal.querySelector(".btn-modal-confirmar")

    const closeModal = () => {
      modal.remove()
    }

    closeButton.addEventListener("click", closeModal)
    cancelButton.addEventListener("click", closeModal)

    confirmButton.addEventListener("click", () => {
      confirmarCancelacion(reporteId)
    })

    // Enfocar textarea
    setTimeout(() => {
      document.getElementById("razon-cancelacion").focus()
    }, 100)
  }

  // ============================================================================
  // FUNCIONES DE ACCIONES DE REPORTES
  // ============================================================================

  // Confirmar cancelación
  async function confirmarCancelacion(reporteId) {
    const razonUsuario = document.getElementById("razon-cancelacion").value.trim()
    const razon = `(admin) ${razonUsuario}`

    if (!razonUsuario) {
      alert("Por favor, ingrese una razón para la cancelación.")
      return
    }

    // Desactivar autoupdate durante la acción
    autoUpdate = false

    try {
      // Primero cambiar el estado a "Cancelado"
      const statusResponse = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/estado`, {
        method: "PUT",
        body: JSON.stringify({
          id: reporteId,
          estado: "Cancelado",
        }),
      })

      if (!statusResponse) return

      // Luego actualizar la razón de cancelación
      const razonResponse = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/${encodeURIComponent(razon)}`, {
        method: "PUT",
      })

      if (!razonResponse) return

      alert("Reporte cancelado exitosamente")
      document.getElementById("modal-cancelacion").remove()

      // Recargar tabla
      const searchValue = searchInput.value.trim()
      cargarTabla(searchValue ? parsearConsulta(searchValue) : "")

      // Reactivar autoupdate después de un delay si no hay búsqueda
      setTimeout(() => {
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }, 2000)
    } catch (error) {
      console.error("Error al cancelar reporte:", error)
      alert("Error al cancelar el reporte: " + error.message)
      // Reactivar autoupdate en caso de error
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  // Cambiar estado a pendiente
  async function cambiarEstadoPendiente(reporteId) {
    // Desactivar autoupdate durante la acción
    autoUpdate = false

    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/estado`, {
        method: "PUT",
        body: JSON.stringify({
          id: reporteId,
          estado: "Pendiente",
        }),
      })

      if (!response) return

      alert("Formulario enviado correctamente")

      // Recargar tabla
      const searchValue = searchInput.value.trim()
      cargarTabla(searchValue ? parsearConsulta(searchValue) : "")

      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    } catch (error) {
      console.error("Error al cambiar estado:", error)
      alert("Error al cambiar el estado: " + error.message)
      // Reactivar autoupdate en caso de error
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  // Eliminar reporte
  async function eliminarReporte(id) {
    if (!confirm(`¿Deseas eliminar el reporte con ID ${id}?`)) {
      return
    }

    // Desactivar autoupdate durante la acción
    autoUpdate = false

    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
      })

      if (!response) return

      alert("Reporte eliminado exitosamente")
      cargarTabla(searchInput.value.trim() ? parsearConsulta(searchInput.value.trim()) : "")

      // Reactivar autoupdate después de un delay si no hay búsqueda
      setTimeout(() => {
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }, 2000)
    } catch (error) {
      console.error("Error al eliminar:", error)
      mostrarError("No se pudo eliminar el reporte: " + error.message)
      // Reactivar autoupdate en caso de error
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  // ============================================================================
  // FUNCIONES DE DROPDOWN Y RESTRICCIONES
  // ============================================================================

  // Función para verificar si un reporte está cancelado/pendiente y deshabilitar opciones
  function aplicarRestriccionesPorEstado(reporteId, dropdownMenu) {
    setTimeout(() => {
      const fila = document.querySelector(`tr[data-reporte-id="${reporteId}"]`)
      if (!fila) return

      const opcionFormulario = dropdownMenu.querySelector('.dropdown-item[data-action="formulario"]')
      const opcionCancelar = dropdownMenu.querySelector('.dropdown-item[data-action="cancelar"]')

      // Detectar estado por clases de la fila
      const estaCancelado = fila.classList.contains("cancelled")
      const estaPendiente = fila.classList.contains("pending")
      const estaCompletado = fila.classList.contains("completed")

      // Bloquear "Formulario" solo si está cancelado o pendiente
      if (estaCancelado || estaPendiente) {
        if (opcionFormulario) {
          opcionFormulario.style.opacity = "0.5"
          opcionFormulario.style.cursor = "not-allowed"
          opcionFormulario.style.pointerEvents = "none"
          opcionFormulario.title = "No disponible para reportes cancelados o pendientes"
        }
      } else {
        // Habilitar opción formulario en cualquier otro caso (incluido completado)
        if (opcionFormulario) {
          opcionFormulario.style.opacity = "1"
          opcionFormulario.style.cursor = "pointer"
          opcionFormulario.style.pointerEvents = "auto"
          opcionFormulario.title = "Ver formulario"
        }
      }

      // Cancelar se bloquea si está cancelado o completado
      if (estaCancelado || estaCompletado) {
        if (opcionCancelar) {
          opcionCancelar.style.opacity = "0.5"
          opcionCancelar.style.cursor = "not-allowed"
          opcionCancelar.style.pointerEvents = "none"
          opcionCancelar.title = estaCompletado
            ? "No disponible para reportes completados"
            : "No disponible para reportes cancelados"
        }
      } else {
        if (opcionCancelar) {
          opcionCancelar.style.opacity = "1"
          opcionCancelar.style.cursor = "pointer"
          opcionCancelar.style.pointerEvents = "auto"
          opcionCancelar.title = "Cancelar reporte"
        }
      }
    }, 50)
  }

  // Crear dropdown de acciones
  function crearDropdownAcciones(reporteId) {
    const dropdownContainer = document.createElement("div")
    dropdownContainer.className = "dropdown-acciones"

    const dropdownButton = document.createElement("button")
    dropdownButton.className = "dropdown-button"
    dropdownButton.innerHTML = 'Acciones <span class="dropdown-arrow">▼</span>'

    const dropdownMenu = document.createElement("div")
    dropdownMenu.className = "dropdown-menu"

    // Crear opciones con data attributes para identificarlas
    dropdownMenu.innerHTML = `
    <div class="dropdown-item" data-action="formulario">
      <i class="fas fa-edit"></i> Formulario
    </div>
    <div class="dropdown-item" data-action="cancelar">
      <i class="fas fa-times"></i> Cancelar
    </div>
    <div class="dropdown-item dropdown-item-danger" data-action="eliminar">
      <i class="fas fa-trash"></i> Eliminar
    </div>
  `

    dropdownContainer.appendChild(dropdownButton)
    dropdownContainer.appendChild(dropdownMenu)

    // Event listeners para las opciones del dropdown
    const opcionFormulario = dropdownMenu.querySelector('[data-action="formulario"]')
    const opcionCancelar = dropdownMenu.querySelector('[data-action="cancelar"]')
    const opcionEliminar = dropdownMenu.querySelector('[data-action="eliminar"]')

    opcionFormulario.addEventListener("click", async (e) => {
      e.stopPropagation()
      if (opcionFormulario.style.pointerEvents !== "none") {
        const fila = document.querySelector(`tr[data-reporte-id="${reporteId}"]`)
        if (fila && fila.classList.contains("cancelled")) return
        if (fila && fila.classList.contains("pending")) return

        if (fila && fila.classList.contains("completed")) {
          // Si está completado, mostrar el modal con el formulario
          await mostrarModalFormulario(reporteId, dropdownButton)
        } else {
          // Si está activo, cambiar a pendiente
          await cambiarEstadoPendiente(reporteId)
        }
        dropdownMenu.classList.remove("show")
      }
    })

    opcionCancelar.addEventListener("click", (e) => {
      e.stopPropagation()
      if (opcionCancelar.style.pointerEvents !== "none") {
        crearModalCancelacion(reporteId, dropdownButton)
        dropdownMenu.classList.remove("show")
      }
    })

    opcionEliminar.addEventListener("click", (e) => {
      e.stopPropagation()
      eliminarReporte(reporteId)
      dropdownMenu.classList.remove("show")
    })

    // Toggle dropdown
    dropdownButton.addEventListener("click", (e) => {
      e.stopPropagation()

      // Desactivar autoupdate cuando se abre cualquier dropdown
      autoUpdate = false

      // Si este dropdown ya está abierto, cerrarlo
      if (dropdownMenu.classList.contains("show")) {
        dropdownMenu.classList.remove("show")
        dropdownMenu.style.zIndex = "9999"
        // Reactivar autoupdate solo si no hay texto de búsqueda
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
        return
      }

      // Cerrar TODOS los otros dropdowns abiertos primero y resetear su z-index
      document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
        menu.classList.remove("show")
        menu.style.zIndex = "9999"
      })

      // Calcular posición del dropdown centrado respecto al botón
      const rect = dropdownButton.getBoundingClientRect()
      const menuWidth = 150 // Ancho mínimo del dropdown

      // Centrar horizontalmente respecto al botón
      const centerX = rect.left + rect.width / 2 - menuWidth / 2

      dropdownMenu.style.left = `${centerX}px`
      dropdownMenu.style.top = `${rect.bottom + 5}px`

      // Mostrar el dropdown
      dropdownMenu.classList.add("show")

      // Asegurar que este dropdown esté al frente de todos los demás
      dropdownMenu.style.zIndex = "10001"

      // Aplicar restricciones después de mostrar el dropdown
      aplicarRestriccionesPorEstado(reporteId, dropdownMenu)

      // Ajustar posición después de que se renderice para obtener el ancho real
      setTimeout(() => {
        const menuRect = dropdownMenu.getBoundingClientRect()
        const realCenterX = rect.left + rect.width / 2 - menuRect.width / 2

        // Ajustar horizontalmente si se sale por la derecha
        if (realCenterX + menuRect.width > window.innerWidth) {
          dropdownMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`
        }
        // Ajustar horizontalmente si se sale por la izquierda
        else if (realCenterX < 10) {
          dropdownMenu.style.left = "10px"
        }
        // Usar la posición centrada si cabe
        else {
          dropdownMenu.style.left = `${realCenterX}px`
        }

        // Ajustar verticalmente si se sale por abajo
        if (menuRect.bottom > window.innerHeight) {
          dropdownMenu.style.top = `${rect.top - menuRect.height - 5}px`
        }
      }, 10)
    })

    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!dropdownContainer.contains(e.target)) {
        dropdownMenu.classList.remove("show")
        // Resetear z-index cuando se cierra
        dropdownMenu.style.zIndex = "9999"
        // Reactivar autoupdate solo si no hay texto de búsqueda
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }
    })

    return dropdownContainer
  }

  // ============================================================================
  // FUNCIONES DE UTILIDAD Y HELPERS
  // ============================================================================

  function formatearEncabezado(texto) {
    if (texto === "id") {
      return "ID"
    }
    return texto
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  function debounce(func, delay) {
    let timeoutId
    return function (...args) {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje)
    errorFetchElement.textContent = mensaje
    errorFetchElement.style.display = "block"
  }

  function limpiarError() {
    errorFetchElement.textContent = ""
    errorFetchElement.style.display = "none"
  }

  function actualizarEstadoBotonExportar() {
    if (!datosActuales || datosActuales.length === 0) {
      exportarButton.disabled = true
      exportarButton.style.opacity = "0.5"
      exportarButton.style.cursor = "not-allowed"
      exportarButton.title = "No hay datos disponibles para exportar"
    } else {
      exportarButton.disabled = false
      exportarButton.style.opacity = "1"
      exportarButton.style.cursor = "pointer"
      exportarButton.title = "Exportar datos a Excel"
    }
  }

  // ============================================================================
  // FUNCIONES DE BÚSQUEDA Y PARSEO
  // ============================================================================

  function parsearConsulta(consulta) {
    console.log("Parseando consulta:", consulta)

    // Si la consulta no contiene operadores especiales, hacer búsqueda simple
    if (!consulta.includes("=") && !consulta.includes("|") && !consulta.includes("&")) {
      // Búsqueda simple en todos los campos
      return `des=${encodeURIComponent(consulta)}`
    }

    const gruposOR = consulta.split("|").map((g) => g.trim())

    const parametros = {
      cor: [],
      cod: [],
      id: [],
      des: [],
    }

    gruposOR.forEach((grupo) => {
      grupo = grupo.replace(/^$$|$$$/g, "").trim()
      const condicionesAND = grupo.split("&").map((c) => c.trim())
      const grupoTemp = {
        cor: [],
        cod: [],
        id: [],
        des: [],
      }

      condicionesAND.forEach((condicion) => {
        const partes = condicion.split("=")
        if (partes.length !== 2) {
          throw new Error(`Formato incorrecto en la condición "${condicion}". Use formato "campo=valor"`)
        }

        const [clave, valor] = partes.map((p) => p.trim())

        if (!["cor", "cod", "id", "des"].includes(clave)) {
          throw new Error(`Campo no válido: "${clave}". Campos permitidos: cor, cod, id, des`)
        }

        if (!valor) {
          throw new Error(`Valor no especificado para el campo "${clave}"`)
        }

        if (condicionesAND.length > 1) {
          grupoTemp[clave].push(valor)
        } else {
          parametros[clave].push(valor)
        }
      })

      if (condicionesAND.length > 1) {
        let combinacion = ""
        for (const [campo, valores] of Object.entries(grupoTemp)) {
          if (valores.length > 0) {
            if (combinacion) combinacion += ":"
            combinacion += `${campo}=${valores.join(",")}`
          }
        }

        if (combinacion) {
          if (!parametros["combinado"]) parametros["combinado"] = []
          parametros["combinado"].push(combinacion)
        }
      }
    })

    const resultado = Object.entries(parametros)
      .filter(([_, valores]) => valores.length > 0)
      .map(([campo, valores]) => {
        return valores.map((valor) => `${campo}=${encodeURIComponent(valor)}`).join("&")
      })
      .join("&")

    console.log("Resultado del parseo:", resultado)
    return resultado
  }

  function barraDeBusqueda() {
    const valorBusqueda = searchInput.value.trim()
    console.log("Ejecutando búsqueda con valor:", valorBusqueda)

    hayTextoBusqueda = valorBusqueda !== ""

    if (hayTextoBusqueda) {
      localStorage.setItem("searchValue", valorBusqueda)
    } else {
      localStorage.removeItem("searchValue")
    }

    if (!hayTextoBusqueda) {
      valores = ""
      autoUpdate = true
      cargarTabla(valores)
      return
    }

    try {
      const parametrosBusqueda = parsearConsulta(valorBusqueda)
      console.log("Parámetros de búsqueda:", parametrosBusqueda)
      autoUpdate = false
      cargarTabla(parametrosBusqueda)
    } catch (error) {
      console.error("Error en parseo:", error)
      autoUpdate = false
      const tablaContenedor = document.getElementById("reportes-table")
      tablaContenedor.textContent = ""
      mostrarError(`Error en la sintaxis de búsqueda: ${error.message}`)
      // Actualizar estado del botón cuando hay error
      datosActuales = []
      actualizarEstadoBotonExportar()
    }
  }

  function inicializarBusqueda() {
    const savedSearch = localStorage.getItem("searchValue")
    console.log("Búsqueda guardada:", savedSearch)

    if (savedSearch && savedSearch.trim() !== "") {
      // Restaurar el valor en el input
      searchInput.value = savedSearch
      hayTextoBusqueda = true
      autoUpdate = false

      console.log("Ejecutando búsqueda guardada...")
      // Ejecutar la búsqueda después de un breve delay
      setTimeout(() => {
        barraDeBusqueda()
      }, 500)
    } else {
      // Sin búsqueda guardada, cargar todos los datos
      console.log("Sin búsqueda guardada, cargando todos los datos...")
      hayTextoBusqueda = false
      autoUpdate = true
      cargarTabla("")
    }
  }

  // ============================================================================
  // FUNCIONES DE TABLA Y VISUALIZACIÓN
  // ============================================================================

  function aplicarEstilosCancelados(celda, valor, campo) {
    if (campo === "nivel" || campo === "level" || campo === "priority") {
      if (
        celda.classList.contains("level-1") ||
        celda.classList.contains("level-2") ||
        celda.classList.contains("level-3")
      ) {
        celda.classList.add("cancelled")
      }
    }

    if (campo === "status" || campo === "estado") {
      if (celda.classList.contains("status-pending") || celda.classList.contains("status-completed")) {
        celda.className = "status status-cancelled"
      }
    }
  }

  function mostrarJSONEnTabla(jsonData) {
    console.log("Mostrando datos en tabla:", jsonData)
    const tablaContenedor = document.getElementById("reportes-table")
    const tabla = document.createElement("table")
    tabla.classList.add("table")

    const datos = Array.isArray(jsonData) ? jsonData : [jsonData]

    if (datos.length > 0) {
      const thead = document.createElement("thead")
      const encabezadoFila = document.createElement("tr")
      // Filtrar columnas para ocultar usuario_id
      const columnas = Object.keys(datos[0]).filter(
        (columna) => columna !== "usuario_id"
      )

      // Agregar encabezados de las columnas de datos
      columnas.forEach((columna) => {
        const th = document.createElement("th")
        th.textContent = formatearEncabezado(columna)
        encabezadoFila.appendChild(th)
      })

      // Agregar encabezado para la columna de acciones
      const thAcciones = document.createElement("th")
      thAcciones.textContent = "Acciones"
      thAcciones.style.textAlign = "center"
      encabezadoFila.appendChild(thAcciones)

      thead.appendChild(encabezadoFila)
      tabla.appendChild(thead)

      const tbody = document.createElement("tbody")
      datos.forEach((filaData) => {
        const fila = document.createElement("tr")
        fila.setAttribute("data-reporte-id", filaData.id) // Para identificar la fila
        const estaCancelado = estaReporteCancelado(filaData)
        const estaCompletado = estaReporteCompletado(filaData)
        const estaPendiente = estaReportePendiente(filaData)

        if (estaCancelado) {
          fila.classList.add("cancelled")
        }
        if (estaCompletado) {
          fila.classList.add("completed")
        }
        if (estaPendiente) {
          fila.classList.add("pending")
        }

        // Crear celdas para las columnas de datos (sin usuario_id)
        columnas.forEach((columna) => {
          const celda = document.createElement("td")
          const valor = filaData[columna]
          const valorStr = String(valor).toLowerCase()
          const columnaStr = columna.toLowerCase()

          if (valor === null || valor === undefined) {
            celda.textContent = "-"
          } else if (typeof valor === "object") {
            celda.textContent = JSON.stringify(valor)
          } else {
            celda.textContent = valor
          }

          // Estilos por estado - solo visual, sin dropdown
          if ((columnaStr.includes("status") || columnaStr.includes("estado")) && valor) {
            celda.classList.add("status")
            if (valorStr.includes("activo") || valorStr.includes("active")) {
              celda.classList.add("status-active")
            } else if (valorStr.includes("pending") || valorStr.includes("pendiente") || valorStr.includes("proceso")) {
              celda.classList.add("status-pending")
            } else if (
              valorStr.includes("completed") ||
              valorStr.includes("completado") ||
              valorStr.includes("finalizado")
            ) {
              celda.classList.add("status-completed")
            } else if (valorStr.includes("cancelled") || valorStr.includes("cancelado")) {
              celda.classList.add("status-cancelled")
            }
          }

          // Estilos por nivel o prioridad
          if (
            (columnaStr.includes("nivel") || columnaStr.includes("level") || columnaStr.includes("priority")) &&
            valor
          ) {
            if (valorStr.includes("1") || valorStr.includes("bajo") || valorStr.includes("low")) {
              celda.classList.add("level-1")
            } else if (valorStr.includes("2") || valorStr.includes("medio") || valorStr.includes("medium")) {
              celda.classList.add("level-2")
            } else if (valorStr.includes("3") || valorStr.includes("alto") || valorStr.includes("high")) {
              celda.classList.add("level-3")
            }
          }

          // Aplicar estilos de cancelado/completado solo si corresponde
          if (estaCancelado) {
            aplicarEstilosCancelados(celda, String(valor), columna)
          }
          if (estaCompletado) {
            // Si quieres aplicar estilos especiales para completados, puedes hacerlo aquí
          }

          fila.appendChild(celda)
        })

        // Crear celda para dropdown de acciones
        const celdaAcciones = document.createElement("td")
        celdaAcciones.style.textAlign = "center"
        celdaAcciones.className = "acciones-cell"

        const dropdown = crearDropdownAcciones(filaData.id)
        celdaAcciones.appendChild(dropdown)
        fila.appendChild(celdaAcciones)

        tbody.appendChild(fila)
      })

      tabla.appendChild(tbody)
      tablaContenedor.innerHTML = ""
      tablaContenedor.appendChild(tabla)
      limpiarError()

      // Actualizar estado del botón después de mostrar datos
      datosActuales = datos
      actualizarEstadoBotonExportar()
    } else {
      tablaContenedor.innerHTML = ""
      mostrarError("No se encontraron resultados para la búsqueda actual")
      // Limpiar datos y actualizar botón cuando no hay resultados
      datosActuales = []
      actualizarEstadoBotonExportar()
    }
  }

  async function cargarTabla(busqueda) {
    console.log("Cargando tabla con búsqueda:", busqueda)

    let url = `${API_URL}/search-advanced`
    if (busqueda && busqueda !== "") {
      url += `?${busqueda}`
    }

    console.log("URL de petición:", url)

    try {
      const response = await authenticatedFetch(url)
      if (!response) return // Ya manejado por authenticatedFetch

      const data = await response.json()
      console.log("Datos recibidos:", data)
      datosActuales = data
      limpiarError()

      if (Array.isArray(data) && data.length === 0 && !searchInput.value.trim()) {
        mostrarError("Por el momento no se ha generado ningun reporte.")
        const tablaContenedor = document.getElementById("reportes-table")
        tablaContenedor.innerHTML = ""
        // Actualizar botón cuando no hay datos
        actualizarEstadoBotonExportar()
      } else if (Array.isArray(data) && data.length === 0) {
        mostrarError("La búsqueda no produjo resultados. Intente con otros términos.")
        const tablaContenedor = document.getElementById("reportes-table")
        tablaContenedor.innerHTML = ""
        // Actualizar botón cuando no hay resultados de búsqueda
        actualizarEstadoBotonExportar()
      } else {
        mostrarJSONEnTabla(data)
      }

      if (busqueda && busqueda !== "") {
        hayTextoBusqueda = true
        autoUpdate = false
      }
    } catch (error) {
      console.error("Error en petición:", error)

      if (!hayTextoBusqueda) {
        valores = ""
      }
      datosActuales = []
      // Actualizar botón cuando hay error
      actualizarEstadoBotonExportar()

      if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        mostrarError(
          "Error de conexión: No se pudo conectar con el servidor. Verifique su conexión a internet o si el servidor está funcionando.",
        )
      } else {
        mostrarError(error.message || "Error desconocido al cargar los datos")
      }

      const tablaContenedor = document.getElementById("reportes-table")
      tablaContenedor.innerHTML = ""
    }
  }

  // ============================================================================
  // FUNCIONES DE EXPORTACIÓN
  // ============================================================================

  function exportData(datosActuales) {
    // Verificación mejorada con mensaje más claro
    if (!datosActuales || datosActuales.length === 0) {
      mostrarError("No hay datos disponibles para exportar. Cargue datos en la tabla primero.")
      return
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(datosActuales)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes")

      const fechaActual = new Date()
      const fecha = fechaActual.toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "")
      const nombreArchivo = `reportes_${fecha}.xlsx`

      XLSX.writeFile(workbook, nombreArchivo)
      limpiarError()
      console.log(`Archivo exportado exitosamente: ${nombreArchivo}`)
    } catch (error) {
      console.error("Error al exportar datos:", error)
      mostrarError("Error al exportar: " + (error.message || "No se pudo generar el archivo Excel"))
    }
  }

  function refrescarTabla() {
    const valorBusqueda = searchInput.value.trim()
    if (valorBusqueda) {
      cargarTabla(parsearConsulta(valorBusqueda))
    } else {
      cargarTabla("")
    }
  }

  // ============================================================================
  // FUNCIONES DE SIDEBAR Y NAVEGACIÓN
  // ============================================================================

  function initializeSections() {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]')
    const sections = document.querySelectorAll("section[id]")

    // Ocultar todas las secciones excepto la primera
    sections.forEach((section, index) => {
      if (index === 0) {
        section.style.display = "block"
      } else {
        section.style.display = "none"
      }
    })

    // Agregar event listeners a los enlaces del sidebar
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()

        const targetId = link.getAttribute("href").substring(1)
        const targetSection = document.getElementById(targetId)

        if (targetSection) {
          // Ocultar todas las secciones
          sections.forEach((section) => {
            section.style.display = "none"
          })

          // Mostrar la sección seleccionada
          targetSection.style.display = "block"

          // Actualizar estado activo en el sidebar
          const sidebarItems = document.querySelectorAll(".sidebar-nav li")
          sidebarItems.forEach((item) => {
            item.classList.remove("active")
          })

          // Agregar clase activa al elemento padre (li)
          link.parentElement.classList.add("active")

          // Cerrar sidebar despues de seleccionar
          sidebar.classList.add("collapsed")
          sidebar.style.transform = "translateX(-100%)"
          mainContent.classList.add("expanded")
          mainContent.style.marginLeft = "0"
          overlay.classList.remove("active")
          sidebar.classList.remove("visible")

          // Cerrar sidebar en móvil después de seleccionar
          if (window.innerWidth <= 576) {
            sidebar.classList.add("collapsed")
            sidebar.style.transform = "translateX(-100%)"
            mainContent.classList.add("expanded")
            mainContent.style.marginLeft = "0"
            overlay.classList.remove("active")
            sidebar.classList.remove("visible")
            overlay.classList.remove("active-mobile")
          }
        }
      })
    })
  }

  // ============================================================================
  // INICIALIZACIÓN Y CONFIGURACIÓN INICIAL
  // ============================================================================

  // Inicializar el estado del botón de exportar
  actualizarEstadoBotonExportar()

  // Inicializar las secciones
  initializeSections()

  // Inicialmente, el sidebar está oculto y el contenido principal expandido
  sidebar.classList.add("collapsed")
  mainContent.classList.add("expanded")

  // Llamar a la inicialización después de configurar todas las funciones
  setTimeout(inicializarBusqueda, 100)

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  // Funcionalidad del botón de cerrar sesión
  logoutButton.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("searchValue")
      alert("Sesión cerrada exitosamente")
      window.location.href = "index.html"
    }
  })

  // Sidebar toggle
  sidebarToggle.addEventListener("click", (event) => {
    event.stopPropagation()
    const sidebarVisible = !sidebar.classList.contains("collapsed")

    if (!sidebarVisible) {
      sidebar.classList.remove("collapsed")
      sidebar.style.transform = "translateX(0)"
      mainContent.classList.remove("expanded")
      mainContent.style.marginLeft = 0
      overlay.classList.add("active")
    } else {
      sidebar.classList.add("collapsed")
      sidebar.style.transform = "translateX(-100%)"
      mainContent.classList.add("expanded")
      mainContent.style.marginLeft = "0"
      overlay.classList.remove("active")
    }
  })

  // Click fuera del sidebar
  document.addEventListener("click", (event) => {
    const sidebarVisible = !sidebar.classList.contains("collapsed")
    if (sidebarVisible && !sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
      sidebar.classList.add("collapsed")
      sidebar.style.transform = "translateX(-100%)"
      mainContent.classList.add("expanded")
      mainContent.style.marginLeft = "0"
      overlay.classList.remove("active")
    }
  })

  // Prevenir cierre del sidebar al hacer click dentro
  sidebar.addEventListener("click", (event) => {
    event.stopPropagation()
  })

  // Búsqueda
  const liveSearch = debounce(() => {
    barraDeBusqueda()
  }, 400)

  searchInput.addEventListener("input", () => {
    hayTextoBusqueda = searchInput.value.trim() !== ""
    autoUpdate = !hayTextoBusqueda
    liveSearch()
  })

  searchInput.addEventListener("blur", () => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
      hayTextoBusqueda = true
      autoUpdate = false
    } else {
      localStorage.removeItem("searchValue")
      hayTextoBusqueda = false
      autoUpdate = true
    }
  })

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim() !== "") {
      hayTextoBusqueda = true
      autoUpdate = false
    }
  })

  // Botones
  showAllButton.addEventListener("click", () => {
    console.log("Botón mostrar todos clickeado")
    searchInput.value = ""
    valores = ""
    hayTextoBusqueda = false
    autoUpdate = true
    localStorage.removeItem("searchValue")
    limpiarError()
    cargarTabla(valores)
  })

  exportarButton.addEventListener("click", () => {
    if (exportarButton.disabled) {
      mostrarError("No hay datos disponibles para exportar.")
      return
    }
    exportData(datosActuales)
  })

  refreshButton.addEventListener("click", refrescarTabla)

  // Eventos de teclado
  document.addEventListener("keypress", (event) => {
    var searchInputFocused = document.activeElement === searchInput
    if (event.key === "Enter" && searchInputFocused) {
      barraDeBusqueda()
    }
  })

  // Eventos de selección
  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection()
    if (selection && selection.toString().length > 0) {
      autoUpdate = false
    } else if (!hayTextoBusqueda) {
      autoUpdate = true
    }
  })

  // Eventos de formulario
  document.addEventListener("submit", (e) => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

  // Eventos de navegación
  const navItems = document.querySelectorAll(".sidebar-nav li")

  navItems.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const activeItem = document.querySelector(".sidebar-nav li.active")
      if (activeItem && activeItem !== item) {
        activeItem.classList.add("suppress-border")
      }
    })

    item.addEventListener("mouseleave", () => {
      const activeItem = document.querySelector(".sidebar-nav li.active")
      if (activeItem) {
        activeItem.classList.remove("suppress-border")
      }
    })
  })

  // Eventos de ventana
  window.addEventListener("beforeunload", () => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

  window.addEventListener("pagehide", () => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

  // ============================================================================
  // MANEJO MÓVIL
  // ============================================================================

  if (window.innerWidth <= 576) {
    sidebarToggle.addEventListener("click", (event) => {
      event.stopPropagation()

      if (sidebar.classList.contains("visible")) {
        sidebar.classList.remove("visible")
        sidebar.style.transform = "translateX(-100%)"
        mainContent.style.marginLeft = "0"
        overlay.classList.remove("active-mobile")
      } else {
        sidebar.classList.add("visible")
        sidebar.style.transform = "translateX(0)"
        mainContent.style.marginLeft = `${sidebar.offsetWidth}px`
        overlay.classList.add("active-mobile")
      }
    })

    document.addEventListener("click", (event) => {
      if (
        window.innerWidth <= 576 &&
        !sidebar.contains(event.target) &&
        !sidebarToggle.contains(event.target) &&
        sidebar.classList.contains("visible")
      ) {
        sidebar.classList.remove("visible")
        sidebar.style.transform = "translateX(-100%)"
        mainContent.style.marginLeft = "0"
        overlay.classList.remove("active-mobile")
      }
    })
  }

  // ============================================================================
  // INTERVALOS Y ACTUALIZACIONES AUTOMÁTICAS
  // ============================================================================

  // Verificar periódicamente la validez del token y actualizar automáticamente
  setInterval(async () => {
    hayTextoBusqueda = searchInput.value.trim() !== ""

    if (autoUpdate && !hayTextoBusqueda) {
      console.log("Actualizando automáticamente...")
      // Verificar token antes de actualizar
      const isValid = await verifyTokenValidity()
      if (isValid) {
        cargarTabla(valores)
      }
    }
  }, 30000) // Verificar cada 30 segundos

  // Actualización más frecuente de reportes
  setInterval(() => {
    if (autoUpdate && !hayTextoBusqueda) {
      cargarTabla(valores)
    }
  }, 3000)

  // Modal para mostrar formulario completado
  async function mostrarModalFormulario(reporteId, botonAccion) {
    // Remover modal existente si existe
    const modalExistente = document.getElementById("modal-formulario")
    if (modalExistente) {
      modalExistente.remove()
    }

    // Crear overlay para el fondo
    let overlay = document.getElementById("modal-formulario-overlay")
    if (!overlay) {
      overlay = document.createElement("div")
      overlay.id = "modal-formulario-overlay"
      overlay.style.position = "fixed"
      overlay.style.top = "0"
      overlay.style.left = "0"
      overlay.style.width = "100vw"
      overlay.style.height = "100vh"
      overlay.style.background = "rgba(0,0,0,0.35)"
      overlay.style.zIndex = "10000"
      overlay.style.display = "flex"
      overlay.style.alignItems = "center"
      overlay.style.justifyContent = "center"
      document.body.appendChild(overlay)
    }

    // Crear modal
    const modal = document.createElement("div")
    modal.id = "modal-formulario"
    modal.className = "modal-formulario"
    modal.style.background = "#fff"
    modal.style.borderRadius = "12px"
    modal.style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)"
    modal.style.maxWidth = "420px"
    modal.style.width = "95%"
    modal.style.maxHeight = "90vh" // Limita la altura máxima
    modal.style.overflowY = "auto" // Scroll si se excede la altura
    modal.style.padding = "0"
    modal.style.position = "relative"
    modal.style.zIndex = "10001"
    modal.style.animation = "modalFadeIn 0.2s"

    // Mostrar cargando mientras se obtiene el formulario
    modal.innerHTML = `
      <div class="modal-content-formulario" style="padding:0;">
        <div class="modal-header-formulario" style="background:#800000;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;">
          <h4 style="margin:0;font-size:1.15rem;font-weight:600;">Formulario del Reporte</h4>
          <button class="modal-close" style="background:none;border:none;color:#fff;font-size:1.7rem;cursor:pointer;line-height:1;">&times;</button>
        </div>
        <div class="modal-body-formulario" style="padding:24px;">
          <div id="formulario-loading" style="text-align:center;font-size:1.1rem;">Cargando formulario...</div>
        </div>
      </div>
    `
    overlay.appendChild(modal)

    // Cerrar modal
    const closeButton = modal.querySelector(".modal-close")
    closeButton.addEventListener("click", () => {
      overlay.remove()
    })
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove()
    })

    // Obtener datos del formulario
    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/formulario`)
      if (!response) {
        modal.querySelector("#formulario-loading").textContent = "No se pudo obtener el formulario."
        return
      }
      const data = await response.json()
      // Renderizar los datos del formulario (sin el id)
      modal.querySelector(".modal-body-formulario").innerHTML = `
        <table class="formulario-table" style="width:100%;border-collapse:collapse;">
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Nombre(s)</th><td style="padding:8px 6px;">${data.nombres || ""}</td></tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Apellido paterno</th><td style="padding:8px 6px;">${data.apellido_paterno || ""}</td></tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Apellido materno</th><td style="padding:8px 6px;">${data.apellido_materno || ""}</td></tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Código UDG</th><td style="padding:8px 6px;">${data.codigo_udg || ""}</td></tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Fecha nacimiento</th><td style="padding:8px 6px;">${data.fecha_nacimiento || ""}</td></tr>
          <tr>
            <th style="text-align:left;padding:8px 6px;color:#800000;vertical-align:top;">Descripción detallada</th>
            <td style="padding:8px 6px;">
              <div style="max-height:120px;overflow:auto;white-space:pre-wrap;">${data.descripcion_detallada || ""}</div>
            </td>
          </tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Fecha creación</th><td style="padding:8px 6px;">${data.fecha_creacion || ""}</td></tr>
          <tr><th style="text-align:left;padding:8px 6px;color:#800000;">Hora creación</th><td style="padding:8px 6px;">${data.hora_creacion || ""}</td></tr>
        </table>
      `
    } catch (error) {
      modal.querySelector("#formulario-loading").textContent = "Error al cargar el formulario."
    }
  }
})
