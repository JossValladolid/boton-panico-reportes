const API_URL = "http://localhost:8000"

// FUNCIONES DE CARGA DE LIBRERÍAS EXTERNAS

/**
 * Carga la librería XLSX para exportación de archivos Excel
 */
function loadXLSX() {
  return new Promise((resolve, reject) => {
    // Si XLSX ya está cargado, resolver inmediatamente
    if (window.XLSX) {
      resolve(window.XLSX)
      return
    }

    // Crear script tag para cargar XLSX desde CDN
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"

    script.onload = () => {
      if (window.XLSX) {
        console.log("XLSX cargado exitosamente")
        resolve(window.XLSX)
      } else {
        reject(new Error("Error cargando XLSX"))
      }
    }

    script.onerror = () => reject(new Error("Error cargando XLSX desde CDN"))
    document.head.appendChild(script)
  })
}



// FUNCIONES DE AUTENTICACIÓN Y SEGURIDAD
/**
 * Realiza peticiones HTTP autenticadas con token JWT
 */
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem("access_token")

  // Si no hay token, manejar error de autenticación
  if (!token) {
    handleAuthError()
    return null
  }

  // Configurar headers por defecto con el token
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

    // Si el token es inválido o expiró
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

/**
 * Maneja errores de autenticación limpiando datos y redirigiendo al login
 */
function handleAuthError() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("searchValue")
  alert("Tu sesión ha expirado. Serás redirigido al login.")
  window.location.href = "index.html"
}

/**
 * Verifica si el token actual es válido
 */
async function verifyTokenValidity() {
  try {
    const response = await authenticatedFetch(`${API_URL}/me`)
    return response !== null
  } catch (error) {
    console.error("Error verificando token:", error)
    return false
  }
}

/**
 * Verifica que el usuario actual sea administrador
 */
async function verificarAdmin() {
  const token = localStorage.getItem("access_token")

  if (!token) {
    window.location.href = "index.html"
    return false
  }

  try {
    const response = await authenticatedFetch(`${API_URL}/me`)
    if (!response) return false

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
// Ejecutar verificación de admin al cargar la página
;(async () => {
  await verificarAdmin()
})()



// FUNCIONES DE VERIFICACIÓN DE ESTADO DE REPORTES
/**
 * Verifica si un reporte está cancelado
 */
function estaReporteCancelado(reporte) {
  // Verificar por campo 'status'
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

  // Verificar por campos booleanos
  if (reporte.cancelled === true || reporte.cancelado === true) {
    return true
  }

  // Verificar por campo 'estado'
  if (reporte.estado && typeof reporte.estado === "string") {
    const estadoLower = reporte.estado.toLowerCase()
    if (estadoLower.includes("cancelado") || estadoLower.includes("inactivo")) {
      return true
    }
  }

  return false
}

/**
 * Verifica si un reporte está completado
 */
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

/**
 * Verifica si un reporte está pendiente
 */
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

// FUNCIONES DE MODAL Y UI GENERALES

/**
 * Muestra un modal por su ID
 */
function showModal(modalId) {
  disableBodyScroll()
  document.getElementById(modalId).style.display = "block"
}

/**
 * Oculta un modal por su ID
 */
function hideModal(modalId) {
  enableBodyScroll()
  document.getElementById(modalId).style.display = "none"
}

/**
 * Deshabilita el scroll del body (para modales)
 */
function disableBodyScroll() {
  document.body.classList.add("modal-open")
}

/**
 * Habilita el scroll del body
 */
function enableBodyScroll() {
  document.body.classList.remove("modal-open")
}


// INICIALIZACIÓN PRINCIPAL Y EVENT LISTENERS

/**
 * Función principal que se ejecuta cuando el DOM está listo
 */
document.addEventListener("DOMContentLoaded", async () => {

  // CARGAR XLSX AL INICIO
  try {
    await loadXLSX()
    console.log("XLSX está listo para usar")
  } catch (error) {
    console.error("Error cargando XLSX:", error)
  }


  // REFERENCIAS A ELEMENTOS DEL DOM

  const sidebar = document.querySelector(".sidebar")
  const sidebarToggle = document.getElementById("sidebar-toggle")
  const mainContent = document.querySelector(".main-content")
  const searchInput = document.getElementById("search-input")
  const showAllButton = document.getElementById("mostrar-todos-btn")
  const exportarButton = document.getElementById("exportar-button")
  const refreshButton = document.getElementById("refresh-button")
  const logoutButton = document.getElementById("logout-button")
  const errorFetchElement = document.getElementById("errorFetch")

  // Crear overlay para el sidebar
  const overlay = document.createElement("div")
  overlay.classList.add("overlay")
  document.body.appendChild(overlay)


  // CONFIGURACIÓN DEL BOTÓN DE AYUDA DEL SISTEMA

  const helpButton = document.getElementById("help-button")
  const helpModal = document.getElementById("help-modal")
  const closeHelpModal = document.querySelector(".close-help-modal")

  // Event listener para abrir el modal de ayuda del sistema
  if (helpButton) {
    helpButton.addEventListener("click", (e) => {
      e.preventDefault()
      showModal("help-modal")
    })
  }

  // Event listener para cerrar el modal de ayuda del sistema
  if (closeHelpModal) {
    closeHelpModal.addEventListener("click", () => {
      hideModal("help-modal")
    })
  }

  // Cerrar modal de ayuda al hacer click fuera
  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) {
        hideModal("help-modal")
      }
    })
  }


  // VARIABLES GLOBALES DE ESTADO

  let valores = ""
  let datosActuales = []
  let autoUpdate = true
  let hayTextoBusqueda = false


  // FUNCIONES DE MODAL DE CANCELACIÓN DE REPORTES


  /**
   * Crea y muestra el modal para cancelar un reporte
   */
  function crearModalCancelacion(reporteId, botonAccion) {
    // Remover modal existente si lo hay
    const modalExistente = document.getElementById("modal-cancelacion")
    if (modalExistente) {
      modalExistente.remove()
    }

    // Crear nuevo modal
    const modal = document.createElement("div")
    modal.id = "modal-cancelacion"
    modal.className = "modal-cancelacion"

    // Obtener posición del botón para posicionar el modal
    const rect = botonAccion.getBoundingClientRect()

    // HTML del modal
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

    document.body.appendChild(modal)

    // Ajustar posición si se sale de la pantalla
    const modalRect = modal.getBoundingClientRect()
    if (modalRect.right > window.innerWidth) {
      modal.style.left = `${window.innerWidth - modalRect.width - 20}px`
    }
    if (modalRect.bottom > window.innerHeight) {
      modal.style.top = `${rect.top - modalRect.height - 10}px`
    }

    // Event listeners para los botones del modal
    const closeButton = modal.querySelector(".modal-close")
    const cancelButton = modal.querySelector(".btn-modal-cancelar")
    const confirmButton = modal.querySelector(".btn-modal-confirmar")

    const closeModal = () => modal.remove()

    closeButton.addEventListener("click", closeModal)
    cancelButton.addEventListener("click", closeModal)
    confirmButton.addEventListener("click", () => confirmarCancelacion(reporteId))

    // Enfocar el textarea
    setTimeout(() => {
      document.getElementById("razon-cancelacion").focus()
    }, 100)
  }


  // FUNCIONES DE ACCIONES DE REPORTES
  /**
   * Confirma y ejecuta la cancelación de un reporte
   */
  async function confirmarCancelacion(reporteId) {
    const razonUsuario = document.getElementById("razon-cancelacion").value.trim()
    const razon = `(admin) ${razonUsuario}`

    if (!razonUsuario) {
      alert("Por favor, ingrese una razón para la cancelación.")
      return
    }

    autoUpdate = false

    try {
      // Cambiar estado a "Cancelado"
      const statusResponse = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/estado`, {
        method: "PUT",
        body: JSON.stringify({
          id: reporteId,
          estado: "Cancelado",
        }),
      })

      if (!statusResponse) return

      // Agregar razón de cancelación
      const razonResponse = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/${encodeURIComponent(razon)}`, {
        method: "PUT",
      })

      if (!razonResponse) return

      alert("Reporte cancelado exitosamente")
      document.getElementById("modal-cancelacion").remove()

      // Recargar tabla
      const searchValue = searchInput.value.trim()
      cargarTabla(searchValue ? parsearConsulta(searchValue) : "")

      // Reactivar auto-update después de un tiempo
      setTimeout(() => {
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }, 2000)
    } catch (error) {
      console.error("Error al cancelar reporte:", error)
      alert("Error al cancelar el reporte: " + error.message)
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  /**
   * Cambia el estado de un reporte a "Pendiente"
   */
  async function cambiarEstadoPendiente(reporteId) {
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
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  /**
   * Elimina un reporte permanentemente
   */
  async function eliminarReporte(id) {
    if (!confirm(`¿Deseas eliminar el reporte con ID ${id}?`)) {
      return
    }

    autoUpdate = false

    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
      })

      if (!response) return

      alert("Reporte eliminado exitosamente")
      cargarTabla(searchInput.value.trim() ? parsearConsulta(searchInput.value.trim()) : "")

      setTimeout(() => {
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }, 2000)
    } catch (error) {
      console.error("Error al eliminar:", error)
      mostrarError("No se pudo eliminar el reporte: " + error.message)
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    }
  }

  // FUNCIONES DE ACORDEÓN (PREGUNTAS FRECUENTES)
  /**
   * Configura los event listeners para todos los acordeones
   */
  function setupAccordion() {

    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.removeEventListener("click", handleAccordionClick)
      header.addEventListener("click", handleAccordionClick)
    })
  }

  /**
   * Maneja el click en un header de acordeón
   */
  function handleAccordionClick() {

    this.classList.toggle("active")

    const content = this.nextElementSibling

    if (content && content.classList.contains("accordion-content")) {
      if (content.style.maxHeight && content.style.maxHeight !== "0px") {
        content.style.maxHeight = null
      } else {
        content.style.maxHeight = content.scrollHeight + "px"
      }
    }
  }

  // FUNCIONES DE DROPDOWN Y RESTRICCIONES DE ACCIONES

  /**
   * Aplica restricciones a las opciones del dropdown según el estado del reporte
   */
  function aplicarRestriccionesPorEstado(reporteId, dropdownMenu) {
    setTimeout(() => {
      const fila = document.querySelector(`tr[data-reporte-id="${reporteId}"]`)
      if (!fila) return

      const opcionFormulario = dropdownMenu.querySelector('.dropdown-item[data-action="formulario"]')
      const opcionCancelar = dropdownMenu.querySelector('.dropdown-item[data-action="cancelar"]')

      const estaCancelado = fila.classList.contains("cancelled")
      const estaPendiente = fila.classList.contains("pending")
      const estaCompletado = fila.classList.contains("completed")

      // Restricciones para la opción "Formulario"
      if (estaCancelado || estaPendiente) {
        if (opcionFormulario) {
          opcionFormulario.style.opacity = "0.5"
          opcionFormulario.style.cursor = "not-allowed"
          opcionFormulario.style.pointerEvents = "none"
          opcionFormulario.title = "No disponible para reportes cancelados o pendientes"
        }
      } else {
        if (opcionFormulario) {
          opcionFormulario.style.opacity = "1"
          opcionFormulario.style.cursor = "pointer"
          opcionFormulario.style.pointerEvents = "auto"
          opcionFormulario.title = "Ver formulario"
        }
      }

      // Restricciones para la opción "Cancelar"
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

  /**
   * Crea el dropdown de acciones para un reporte
   */
  function crearDropdownAcciones(reporteId) {
    const dropdownContainer = document.createElement("div")
    dropdownContainer.className = "dropdown-acciones"

    const dropdownButton = document.createElement("button")
    dropdownButton.className = "dropdown-button"
    dropdownButton.innerHTML = 'Acciones <span class="dropdown-arrow">▼</span>'

    const dropdownMenu = document.createElement("div")
    dropdownMenu.className = "dropdown-menu"

    // HTML de las opciones del menú
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

    // Referencias a las opciones
    const opcionFormulario = dropdownMenu.querySelector('[data-action="formulario"]')
    const opcionCancelar = dropdownMenu.querySelector('[data-action="cancelar"]')
    const opcionEliminar = dropdownMenu.querySelector('[data-action="eliminar"]')

    // Event listeners para cada opción
    opcionFormulario.addEventListener("click", async (e) => {
      e.stopPropagation()
      if (opcionFormulario.style.pointerEvents !== "none") {
        const fila = document.querySelector(`tr[data-reporte-id="${reporteId}"]`)
        if (fila && fila.classList.contains("cancelled")) return
        if (fila && fila.classList.contains("pending")) return

        if (fila && fila.classList.contains("completed")) {
          await mostrarModalFormulario(reporteId, dropdownButton)
        } else {
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

    // Event listener para el botón principal del dropdown
    dropdownButton.addEventListener("click", (e) => {
      e.stopPropagation()
      autoUpdate = false

      // Si ya está abierto, cerrarlo
      if (dropdownMenu.classList.contains("show")) {
        dropdownMenu.classList.remove("show")
        dropdownMenu.style.zIndex = "9999"
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
        return
      }

      // Cerrar otros dropdowns abiertos
      document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
        menu.classList.remove("show")
        menu.style.zIndex = "9999"
      })

      // Posicionar y mostrar el menú
      const rect = dropdownButton.getBoundingClientRect()
      const menuWidth = 150
      const centerX = rect.left + rect.width / 2 - menuWidth / 2

      dropdownMenu.style.left = `${centerX}px`
      dropdownMenu.style.top = `${rect.bottom + 5}px`
      dropdownMenu.classList.add("show")
      dropdownMenu.style.zIndex = "10001"

      aplicarRestriccionesPorEstado(reporteId, dropdownMenu)

      // Ajustar posición si se sale de la pantalla
      setTimeout(() => {
        const menuRect = dropdownMenu.getBoundingClientRect()
        const realCenterX = rect.left + rect.width / 2 - menuRect.width / 2

        if (realCenterX + menuRect.width > window.innerWidth) {
          dropdownMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`
        } else if (realCenterX < 10) {
          dropdownMenu.style.left = "10px"
        } else {
          dropdownMenu.style.left = `${realCenterX}px`
        }

        if (menuRect.bottom > window.innerHeight) {
          dropdownMenu.style.top = `${rect.top - menuRect.height - 5}px`
        }
      }, 10)
    })

    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!dropdownContainer.contains(e.target)) {
        dropdownMenu.classList.remove("show")
        dropdownMenu.style.zIndex = "9999"
        if (!hayTextoBusqueda) {
          autoUpdate = true
        }
      }
    })

    return dropdownContainer
  }

  // FUNCIONES DE UTILIDAD Y HELPERS

  /**
   * Formatea el texto de los encabezados de tabla
   */
  function formatearEncabezado(texto) {
    if (texto === "id") {
      return "ID"
    }

    if (texto === "codigo_estudiante"){
     return "Código Estudiante"
    }

    if (texto === "correo_estudiante"){
     return "Correo Estudiante"
    }

    if (texto === "descripcion"){
     return "Descripción"
    }

    if (texto === "estado"){
     return "Estado"
    }

    if (texto === "fecha"){
     return "Fecha"
    }

    if (texto === "hora"){
     return "Hora"
    }

    if (texto === "razon"){
     return "Razón"
    }

    return texto
  }

  /**
   * Crea una función debounced que retrasa la ejecución
   */
  function debounce(func, delay) {
    let timeoutId
    return function (...args) {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  /**
   * Muestra un mensaje de error en la interfaz
   */
  function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje)
    errorFetchElement.textContent = mensaje
    errorFetchElement.style.display = "block"
  }

  /**
   * Limpia el mensaje de error de la interfaz
   */
  function limpiarError() {
    errorFetchElement.textContent = ""
    errorFetchElement.style.display = "none"
  }

  /**
   * Actualiza el estado del botón de exportar según los datos disponibles
   */
  function actualizarEstadoBotonExportar() {
    if (!datosActuales || datosActuales.length === 0) {
      exportarButton.disabled = true
      exportarButton.classList.add("disabled")
      exportarButton.title = "No hay datos disponibles para exportar"
    } else {
      exportarButton.disabled = false
      exportarButton.classList.remove("disabled")
      exportarButton.title = "Exportar datos a Excel"
    }
  }


  // FUNCIONES DE BÚSQUEDA Y PARSEO DE CONSULTAS

  function parsearConsulta(consulta) {
    console.log("Parseando consulta:", consulta)

    // Si no contiene operadores especiales, buscar en descripción
    if (!consulta.includes("=") && !consulta.includes("|") && !consulta.includes("&")) {
      return `des=${encodeURIComponent(consulta)}`
    }

    // Dividir por operador OR (|)
    const gruposOR = consulta.split("|").map((g) => g.trim())

    const parametros = {
      cor: [], // correo
      cod: [], // código
      id: [], // ID
      des: [], // descripción
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

      // Manejar combinaciones AND
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

    // Construir resultado final
    const resultado = Object.entries(parametros)
      .filter(([_, valores]) => valores.length > 0)
      .map(([campo, valores]) => {
        return valores.map((valor) => `${campo}=${encodeURIComponent(valor)}`).join("&")
      })
      .join("&")

    console.log("Resultado del parseo:", resultado)
    return resultado
  }

  /**
   * Ejecuta una búsqueda basada en el valor del input de búsqueda
   */
  function barraDeBusqueda() {
    const valorBusqueda = searchInput.value.trim()
    console.log("Ejecutando búsqueda con valor:", valorBusqueda)

    hayTextoBusqueda = valorBusqueda !== ""

    // Guardar/limpiar búsqueda en localStorage
    if (hayTextoBusqueda) {
      localStorage.setItem("searchValue", valorBusqueda)
    } else {
      localStorage.removeItem("searchValue")
    }

    // Si no hay búsqueda, mostrar todos los datos
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
      datosActuales = []
      actualizarEstadoBotonExportar()
    }
  }

  /**
   * Inicializa la búsqueda al cargar la página (recupera búsqueda guardada)
   */
  function inicializarBusqueda() {
    const savedSearch = localStorage.getItem("searchValue")
    console.log("Búsqueda guardada:", savedSearch)

    if (savedSearch && savedSearch.trim() !== "") {
      searchInput.value = savedSearch
      hayTextoBusqueda = true
      autoUpdate = false

      console.log("Ejecutando búsqueda guardada...")
      setTimeout(() => {
        barraDeBusqueda()
      }, 500)
    } else {
      console.log("Sin búsqueda guardada, cargando todos los datos...")
      hayTextoBusqueda = false
      autoUpdate = true
      cargarTabla("")
    }
  }


  // FUNCIONES DE TABLA Y VISUALIZACIÓN DE DATOS


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

  /*
   * Muestra los datos JSON en formato de tabla HTML
   */
  function mostrarJSONEnTabla(jsonData) {
    console.log("Mostrando datos en tabla:", jsonData)
    const tablaContenedor = document.getElementById("reportes-table")
    const tabla = document.createElement("table")
    tabla.classList.add("table")

    const datos = Array.isArray(jsonData) ? jsonData : [jsonData]

    if (datos.length > 0) {
      // Crear encabezados
      const thead = document.createElement("thead")
      const encabezadoFila = document.createElement("tr")
      const columnas = Object.keys(datos[0]).filter((columna) => columna !== "usuario_id")

      columnas.forEach((columna) => {
        const th = document.createElement("th")
        th.textContent = formatearEncabezado(columna)
        encabezadoFila.appendChild(th)
      })

      // Agregar columna de acciones
      const thAcciones = document.createElement("th")
      thAcciones.textContent = "Acciones"
      thAcciones.style.textAlign = "center"
      encabezadoFila.appendChild(thAcciones)

      thead.appendChild(encabezadoFila)
      tabla.appendChild(thead)

      // Crear filas de datos
      const tbody = document.createElement("tbody")
      datos.forEach((filaData) => {
        const fila = document.createElement("tr")
        fila.setAttribute("data-reporte-id", filaData.id)

        // Determinar estado del reporte
        const estaCancelado = estaReporteCancelado(filaData)
        const estaCompletado = estaReporteCompletado(filaData)
        const estaPendiente = estaReportePendiente(filaData)

        // Aplicar clases CSS según el estado
        if (estaCancelado) fila.classList.add("cancelled")
        if (estaCompletado) fila.classList.add("completed")
        if (estaPendiente) fila.classList.add("pending")

        // Crear celdas de datos
        columnas.forEach((columna) => {
          const celda = document.createElement("td")
          const valor = filaData[columna]
          const valorStr = String(valor).toLowerCase()
          const columnaStr = columna.toLowerCase()

          // Manejar valores nulos/undefined
          if (valor === null || valor === undefined) {
            celda.textContent = "-"
          } else if (typeof valor === "object") {
            celda.textContent = JSON.stringify(valor)
          } else {
            celda.textContent = valor
          }

          // Aplicar estilos especiales según el tipo de campo
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

          // Estilos para niveles de prioridad
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

          // Aplicar estilos de cancelado si corresponde
          if (estaCancelado) {
            aplicarEstilosCancelados(celda, String(valor), columna)
          }

          fila.appendChild(celda)
        })

        // Crear celda de acciones
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

      datosActuales = datos
      actualizarEstadoBotonExportar()
    } else {
      // No hay datos para mostrar
      tablaContenedor.innerHTML = ""
      mostrarError("No se encontraron resultados para la búsqueda actual")
      datosActuales = []
      actualizarEstadoBotonExportar()
    }
  }

  /**
   * Carga datos de la API y los muestra en la tabla
   * @param {string} busqueda - Parámetros de búsqueda para la API
   */
  async function cargarTabla(busqueda) {
    console.log("Cargando tabla con búsqueda:", busqueda)

    let url = `${API_URL}/search-advanced`
    if (busqueda && busqueda !== "") {
      url += `?${busqueda}`
    }

    console.log("URL de petición:", url)

    try {
      const response = await authenticatedFetch(url)
      if (!response) return

      const data = await response.json()
      console.log("Datos recibidos:", data)
      datosActuales = data
      limpiarError()

      // Manejar diferentes casos de respuesta
      if (Array.isArray(data) && data.length === 0 && !searchInput.value.trim()) {
        mostrarError("Por el momento no se ha generado ningun reporte.")
        const tablaContenedor = document.getElementById("reportes-table")
        tablaContenedor.innerHTML = ""
        actualizarEstadoBotonExportar()
      } else if (Array.isArray(data) && data.length === 0) {
        mostrarError("La búsqueda no produjo resultados. Intente con otros términos.")
        const tablaContenedor = document.getElementById("reportes-table")
        tablaContenedor.innerHTML = ""
        actualizarEstadoBotonExportar()
      } else {
        mostrarJSONEnTabla(data)
      }

      // Actualizar estado de búsqueda
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
      actualizarEstadoBotonExportar()

      // Mostrar error específico según el tipo
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


  // FUNCIONES DE EXPORTACIÓN DE DATOS

  /**
   * Exporta los datos actuales a un archivo Excel
   * @param {Array} datosActuales - Datos a exportar
   */
  async function exportData(datosActuales) {
    console.log("Iniciando exportación de datos:", datosActuales)

    if (!datosActuales || datosActuales.length === 0) {
      mostrarError("No hay datos disponibles para exportar. Cargue datos en la tabla primero.")
      return
    }

    // Verificar si XLSX está disponible
    if (!window.XLSX) {
      console.log("XLSX no disponible, intentando cargar...")
      try {
        await loadXLSX()
        console.log("XLSX cargado exitosamente para exportación")
      } catch (error) {
        console.error("Error cargando XLSX para exportación:", error)
        mostrarError(
          "Error: No se pudo cargar la librería de exportación. Por favor, verifique su conexión a internet e intente nuevamente.",
        )
        return
      }
    }

    try {
      console.log("Creando archivo Excel...")

      // Crear hoja de cálculo y libro
      const worksheet = window.XLSX.utils.json_to_sheet(datosActuales)
      const workbook = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes")

      // Generar nombre de archivo con timestamp
      const fechaActual = new Date()
      const fecha = fechaActual.toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "")
      const nombreArchivo = `reportes_${fecha}.xlsx`

      console.log("Descargando archivo:", nombreArchivo)
      window.XLSX.writeFile(workbook, nombreArchivo)
      limpiarError()
      console.log(`Archivo exportado exitosamente: ${nombreArchivo}`)

      // Feedback visual al usuario
      const originalText = exportarButton.textContent
      exportarButton.textContent = "¡Exportado!"
      exportarButton.classList.add("exported")

      setTimeout(() => {
        exportarButton.textContent = originalText
        exportarButton.classList.remove("exported")
      }, 2000)
    } catch (error) {
      console.error("Error al exportar datos:", error)
      mostrarError("Error al exportar: " + (error.message || "No se pudo generar el archivo Excel"))
    }
  }

  /**
   * Refresca la tabla con los datos actuales
   */
  function refrescarTabla() {
    const valorBusqueda = searchInput.value.trim()
    if (valorBusqueda) {
      cargarTabla(parsearConsulta(valorBusqueda))
    } else {
      cargarTabla("")
    }
  }

  // FUNCIONES DE SIDEBAR Y NAVEGACIÓN

  /**
   * Inicializa la navegación entre secciones del sidebar
   */
  function initializeSections() {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]')
    const sections = document.querySelectorAll("section[id]")

    // Mostrar solo la primera sección inicialmente
    sections.forEach((section, index) => {
      if (index === 0) {
        section.style.display = "block"
      } else {
        section.style.display = "none"
      }
    })

    // Event listeners para los enlaces del sidebar
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

          link.parentElement.classList.add("active")

          // Cerrar sidebar en móvil
          sidebar.classList.add("collapsed")
          sidebar.style.transform = "translateX(-100%)"
          mainContent.classList.add("expanded")
          mainContent.style.marginLeft = "0"
          overlay.classList.remove("active")
          sidebar.classList.remove("visible")

          if (window.innerWidth <= 576) {
            sidebar.classList.add("collapsed")
            sidebar.style.transform = "translateX(-100%)"
            mainContent.classList.add("expanded")
            mainContent.style.marginLeft = "0"
            overlay.classList.remove("active")
            sidebar.classList.remove("visible")
            overlay.classList.remove("active-mobile")
          }

          // Configurar acordeones después de cambiar sección
          setTimeout(() => {
            setupAccordion()
          }, 100)
        }
      })
    })
  }


  // MODAL DE FORMULARIO COMPLETADO

  /**
   * Muestra el modal con los detalles del formulario de un reporte
   * @param {number} reporteId - ID del reporte
   * @param {HTMLElement} botonAccion - Botón que activó el modal
   */
  async function mostrarModalFormulario(reporteId, botonAccion) {
    // Remover modal existente
    const modalExistente = document.getElementById("modal-formulario")
    if (modalExistente) {
      modalExistente.remove()
    }

    // Crear overlay
    let overlayElement = document.getElementById("modal-formulario-overlay")
    if (!overlayElement) {
      overlayElement = document.createElement("div")
      overlayElement.id = "modal-formulario-overlay"
      overlayElement.style.position = "fixed"
      overlayElement.style.top = "0"
      overlayElement.style.left = "0"
      overlayElement.style.width = "100vw"
      overlayElement.style.height = "100vh"
      overlayElement.style.background = "rgba(0,0,0,0.35)"
      overlayElement.style.zIndex = "10000"
      overlayElement.style.display = "flex"
      overlayElement.style.alignItems = "center"
      overlayElement.style.justifyContent = "center"
      document.body.appendChild(overlayElement)
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
    modal.style.maxHeight = "90vh"
    modal.style.overflowY = "auto"
    modal.style.padding = "0"
    modal.style.position = "relative"
    modal.style.zIndex = "10001"
    modal.style.animation = "modalFadeIn 0.2s"

    // HTML del modal
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
    overlayElement.appendChild(modal)

    // Event listeners para cerrar
    const closeButton = modal.querySelector(".modal-close")
    closeButton.addEventListener("click", () => {
      overlayElement.remove()
    })
    overlayElement.addEventListener("click", (e) => {
      if (e.target === overlayElement) overlayElement.remove()
    })

    try {
      // Cargar datos del formulario
      const response = await authenticatedFetch(`${API_URL}/tasks/${reporteId}/formulario`)
      if (!response) {
        modal.querySelector("#formulario-loading").textContent = "No se pudo obtener el formulario."
        return
      }

      const data = await response.json()

      // Mostrar datos en tabla
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


  // CONFIGURACIÓN INICIAL

  actualizarEstadoBotonExportar()
  initializeSections()
  setupAccordion()

  // Configurar sidebar como colapsado inicialmente
  sidebar.classList.add("collapsed")
  mainContent.classList.add("expanded")

  // Inicializar búsqueda después de un breve delay
  setTimeout(inicializarBusqueda, 100)


  // EVENT LISTENERS PRINCIPALES

  /**
   * Logout - Cerrar sesión
   */
  logoutButton.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("searchValue")
      alert("Sesión cerrada exitosamente")
      window.location.href = "index.html"
    }
  })

  /**
   * Toggle del sidebar
   */
  sidebarToggle.addEventListener("click", (event) => {
    event.stopPropagation()
    const sidebarVisible = !sidebar.classList.contains("collapsed")

    if (!sidebarVisible) {
      // Mostrar sidebar
      sidebar.classList.remove("collapsed")
      sidebar.style.transform = "translateX(0)"
      mainContent.classList.remove("expanded")
      mainContent.style.marginLeft = 0
      overlay.classList.add("active")
    } else {
      // Ocultar sidebar
      sidebar.classList.add("collapsed")
      sidebar.style.transform = "translateX(-100%)"
      mainContent.classList.add("expanded")
      mainContent.style.marginLeft = "0"
      overlay.classList.remove("active")
    }
  })

  /**
   * Cerrar sidebar al hacer click fuera
   */
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

  /**
   * Prevenir cierre del sidebar al hacer click dentro
   */
  sidebar.addEventListener("click", (event) => {
    event.stopPropagation()
  })

  /**
   * Búsqueda en vivo con debounce
   */
  const liveSearch = debounce(() => {
    barraDeBusqueda()
  }, 400)

  searchInput.addEventListener("input", () => {
    hayTextoBusqueda = searchInput.value.trim() !== ""
    autoUpdate = !hayTextoBusqueda
    liveSearch()
  })

  /**
   * Guardar búsqueda al perder foco
   */
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

  /**
   * Activar búsqueda al enfocar si hay texto
   */
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim() !== "") {
      hayTextoBusqueda = true
      autoUpdate = false
    }
  })

  /**
   * Botón "Mostrar todos"
   */
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

  /**
   * Botón de exportar
   */
  exportarButton.addEventListener("click", () => {
    console.log("Botón exportar clickeado")
    if (exportarButton.disabled) {
      mostrarError("No hay datos disponibles para exportar.")
      return
    }
    exportData(datosActuales)
  })

  /**
   * Botón de refrescar
   */
  refreshButton.addEventListener("click", refrescarTabla)

  /**
   * Búsqueda con Enter
   */
  document.addEventListener("keypress", (event) => {
    var searchInputFocused = document.activeElement === searchInput
    if (event.key === "Enter" && searchInputFocused) {
      barraDeBusqueda()
    }
  })

  /**
   * Pausar auto-update al seleccionar texto
   */
  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection()
    if (selection && selection.toString().length > 0) {
      autoUpdate = false
    } else if (!hayTextoBusqueda) {
      autoUpdate = true
    }
  })

  /**
   * Guardar búsqueda al enviar formulario
   */
  document.addEventListener("submit", (e) => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

  /**
   * Efectos visuales del sidebar
   */
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

  /**
   * Guardar búsqueda antes de cerrar la página
   */
  window.addEventListener("beforeunload", () => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

  /**
   * Guardar búsqueda al ocultar la página
   */
  window.addEventListener("pagehide", () => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })


  // MANEJO ESPECÍFICO PARA DISPOSITIVOS MÓVILES

  if (window.innerWidth <= 576) {
    /**
     * Toggle del sidebar en móvil
     */
    sidebarToggle.addEventListener("click", (event) => {
      event.stopPropagation()

      if (sidebar.classList.contains("visible")) {
        // Ocultar sidebar
        sidebar.classList.remove("visible")
        sidebar.style.transform = "translateX(-100%)"
        mainContent.style.marginLeft = "0"
        overlay.classList.remove("active-mobile")
      } else {
        // Mostrar sidebar
        sidebar.classList.add("visible")
        sidebar.style.transform = "translateX(0)"
        mainContent.style.marginLeft = `${sidebar.offsetWidth}px`
        overlay.classList.add("active-mobile")
      }
    })

    /**
     * Cerrar sidebar en móvil al hacer click fuera
     */
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


  // INTERVALOS Y ACTUALIZACIONES AUTOMÁTICAS

  /**
   * Verificación periódica del token y actualización automática (cada 30 segundos)
   */
  setInterval(async () => {
    hayTextoBusqueda = searchInput.value.trim() !== ""

    if (autoUpdate && !hayTextoBusqueda) {
      console.log("Actualizando automáticamente...")
      const isValid = await verifyTokenValidity()
      if (isValid) {
        cargarTabla(valores)
      }
    }
  }, 30000)

  /**
   * Actualización rápida de datos (cada 3 segundos)
   */
  setInterval(() => {
    if (autoUpdate && !hayTextoBusqueda) {
      cargarTabla(valores)
    }
  }, 3000)


  // CONFIGURACIÓN DEL FORMULARIO DE CONTACTO

  /**
   * Manejo del envío del formulario de contacto
   */
  const contactForm = document.getElementById("contactForm")
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const successMessage = document.getElementById("contactExito")
      if (successMessage) {
        successMessage.textContent = "Mensaje enviado con éxito"
        e.target.reset()
        setTimeout(() => {
          successMessage.textContent = ""
        }, 3000)
      }
    })
  }


  // MANEJO DE EVENTOS DE TECLADO GLOBALES
  /**
   * Cerrar modales con la tecla Escape
   */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Cerrar modal de ayuda si está abierto
      if (helpModal && helpModal.style.display === "block") {
        hideModal("help-modal")
      }

      // Cerrar modal de cancelación si existe
      const modalCancelacion = document.getElementById("modal-cancelacion")
      if (modalCancelacion) {
        modalCancelacion.remove()
      }

      // Cerrar modal de formulario si existe
      const modalFormularioOverlay = document.getElementById("modal-formulario-overlay")
      if (modalFormularioOverlay) {
        modalFormularioOverlay.remove()
      }
    }
  })
})

/*
RESUMEN DE FUNCIONES ORGANIZADAS:

CONFIGURACIÓN Y CONSTANTES:
- API_URL: URL base del servidor

CARGA DE LIBRERÍAS:
- loadXLSX(): Carga librería XLSX para exportar Excel

AUTENTICACIÓN Y SEGURIDAD:
- authenticatedFetch(): Peticiones HTTP autenticadas con token JWT
- handleAuthError(): Maneja errores de autenticación y redirecciona
- verifyTokenValidity(): Verifica validez del token actual
- verificarAdmin(): Verifica permisos de administrador

VERIFICACIÓN DE ESTADOS DE REPORTES:
- estaReporteCancelado(): Verifica si reporte está cancelado
- estaReporteCompletado(): Verifica si reporte está completado
- estaReportePendiente(): Verifica si reporte está pendiente

MODALES Y UI GENERALES:
- showModal()/hideModal(): Mostrar/ocultar modales por ID
- disableBodyScroll()/enableBodyScroll(): Control de scroll del body

MODAL DE CANCELACIÓN:
- crearModalCancelacion(): Crea modal para cancelar reportes con razón

ACCIONES DE REPORTES (CRUD):
- confirmarCancelacion(): Cancela un reporte con razón específica
- cambiarEstadoPendiente(): Cambia estado de reporte a pendiente
- eliminarReporte(): Elimina reporte permanentemente del sistema

ACORDEONES (FAQ):
- setupAccordion(): Configura event listeners para acordeones
- handleAccordionClick(): Maneja clicks y animaciones de acordeones

DROPDOWNS DE ACCIONES:
- aplicarRestriccionesPorEstado(): Aplica restricciones según estado del reporte
- crearDropdownAcciones(): Crea menú dropdown con opciones contextuales

FUNCIONES UTILITARIAS:
- formatearEncabezado(): Formatea texto de encabezados de tabla
- debounce(): Función para retrasar ejecución (búsqueda en vivo)
- mostrarError()/limpiarError(): Manejo y visualización de errores
- actualizarEstadoBotonExportar(): Actualiza estado del botón según datos

SISTEMA DE BÚSQUEDA AVANZADA:
- parsearConsulta(): Parsea consultas con operadores (AND/OR)
- barraDeBusqueda(): Ejecuta búsquedas y maneja resultados
- inicializarBusqueda(): Restaura búsqueda guardada al cargar página

TABLA Y VISUALIZACIÓN DE DATOS:
- aplicarEstilosCancelados(): Aplica estilos especiales a reportes cancelados
- mostrarJSONEnTabla(): Convierte datos JSON a tabla HTML interactiva
- cargarTabla(): Carga datos desde API y los muestra en tabla

EXPORTACIÓN DE DATOS:
- exportData(): Exporta datos actuales a archivo Excel (.xlsx)
- refrescarTabla(): Refresca datos de la tabla manteniendo filtros

NAVEGACIÓN Y SIDEBAR:
- initializeSections(): Inicializa navegación entre secciones del panel

MODAL DE FORMULARIO DETALLADO:
- mostrarModalFormulario(): Muestra detalles completos del formulario de reporte

INICIALIZACIÓN Y CONFIGURACIÓN:
- Event listeners principales (botones, búsqueda, sidebar)
- Configuración inicial del DOM y estado
- Intervalos de actualización automática (3s y 30s)
- Manejo de eventos de teclado (Enter, Escape)
- Soporte responsive para dispositivos móviles
- Persistencia de estado en localStorage
 */