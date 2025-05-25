const API_URL = "http://localhost:8000"

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

// Función para verificar y esperar a que XLSX esté disponible
function waitForXLSX() {
  return new Promise((resolve, reject) => {
    if (typeof XLSX !== "undefined") {
      console.log("XLSX library loaded successfully")
      resolve(XLSX)
    } else {
      // Esperar hasta 5 segundos para que se cargue
      let attempts = 0
      const maxAttempts = 50
      const checkInterval = setInterval(() => {
        attempts++
        if (typeof XLSX !== "undefined") {
          console.log("XLSX library loaded successfully after waiting")
          clearInterval(checkInterval)
          resolve(XLSX)
        } else if (attempts >= maxAttempts) {
          console.error("XLSX library failed to load after timeout")
          clearInterval(checkInterval)
          reject(new Error("XLSX library failed to load"))
        }
      }, 100)
    }
  })
}

// NUEVA FUNCIÓN: Setup del acordeón para preguntas frecuentes
function setupAccordion() {
  console.log("Configurando acordeón...")
  const accordionHeaders = document.querySelectorAll(".accordion-header")

  accordionHeaders.forEach((header) => {
    // Remover listeners existentes para evitar duplicados
    header.replaceWith(header.cloneNode(true))
  })

  // Volver a obtener los headers después del clonado
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      console.log("Click en accordion header")
      header.classList.toggle("active")
      const content = header.nextElementSibling
      if (content && content.classList.contains("accordion-content")) {
        if (content.style.maxHeight) {
          content.style.maxHeight = null
        } else {
          content.style.maxHeight = content.scrollHeight + "px"
        }
      }
    })
  })
}

// NUEVA FUNCIÓN: Setup del formulario de contacto
function setupContactForm() {
  console.log("Configurando formulario de contacto...")
  const contactForm = document.getElementById("contactForm")

  if (contactForm) {
    // Remover listeners existentes
    const newForm = contactForm.cloneNode(true)
    contactForm.parentNode.replaceChild(newForm, contactForm)

    // Agregar nuevo listener
    document.getElementById("contactForm").addEventListener("submit", (e) => {
      e.preventDefault()
      console.log("Formulario enviado")

      // Obtener los valores del formulario con los IDs correctos
      const nombre = document.getElementById("contactNombre")?.value || ""
      const email = document.getElementById("contactEmail")?.value || ""
      const asunto = document.getElementById("contactAsunto")?.value || ""
      const mensaje = document.getElementById("contactMensaje")?.value || ""

      // Validación básica
      if (!nombre.trim() || !email.trim() || !mensaje.trim()) {
        alert("Por favor, complete todos los campos obligatorios.")
        return
      }

      // Mostrar mensaje de éxito
      const successElement = document.getElementById("contactExito")
      if (successElement) {
        successElement.textContent = "Mensaje enviado con éxito"
        successElement.style.color = "#5cb85c"
        successElement.style.display = "block"
      }

      // Limpiar formulario
      e.target.reset()

      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        if (successElement) {
          successElement.textContent = ""
          successElement.style.display = "none"
        }
      }, 3000)
    })
  } else {
    console.log("Formulario de contacto no encontrado")
  }
}

document.addEventListener("DOMContentLoaded", () => {
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

  // Variables globales
  let valores = ""
  let datosActuales = []
  let autoUpdate = true
  let hayTextoBusqueda = false

  // NUEVA FUNCIÓN: Actualizar estado del botón de exportar
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

  // Inicializar el estado del botón de exportar
  actualizarEstadoBotonExportar()

  // NUEVA FUNCIONALIDAD: Manejo de secciones del sidebar
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
          sidebarVisible = false
          sidebar.classList.add("collapsed")
          sidebar.style.transform = "translateX(-100%)"
          mainContent.classList.add("expanded")
          mainContent.style.marginLeft = "0"
          overlay.classList.remove("active")
          sidebar.classList.remove("visible")

          // Cerrar sidebar en móvil después de seleccionar
          if (window.innerWidth <= 576) {
            sidebarVisible = false
            sidebar.classList.add("collapsed")
            sidebar.style.transform = "translateX(-100%)"
            mainContent.classList.add("expanded")
            mainContent.style.marginLeft = "0"
            overlay.classList.remove("active")
            sidebar.classList.remove("visible")
            overlay.classList.remove("active-mobile")
          }

          // NUEVO: Inicializar acordeón y formulario cuando se cambia a esas secciones
          setTimeout(() => {
            if (targetId === "preguntas-frecuentes") {
              setupAccordion()
            }
            if (targetId === "contactanos") {
              setupContactForm()
            }
          }, 100)
        }
      })
    })
  }

  // Inicializar las secciones
  initializeSections()

  // NUEVO: Inicializar acordeón y formulario de contacto al cargar la página
  setTimeout(() => {
    setupAccordion()
    setupContactForm()
  }, 500)

  // Funcionalidad del botón de cerrar sesión
  logoutButton.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("searchValue")
      alert("Sesión cerrada exitosamente")
      window.location.href = "index.html"
    }
  })

  // Inicialmente, el sidebar está oculto y el contenido principal expandido
  let sidebarVisible = false
  sidebar.classList.add("collapsed")
  mainContent.classList.add("expanded")

  // SISTEMA DE PERSISTENCIA CORREGIDO
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

  // Llamar a la inicialización después de configurar todas las funciones
  setTimeout(inicializarBusqueda, 100)

  sidebarToggle.addEventListener("click", (event) => {
    event.stopPropagation()
    sidebarVisible = !sidebarVisible

    if (sidebarVisible) {
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

  document.addEventListener("click", (event) => {
    if (sidebarVisible && !sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
      sidebarVisible = false
      sidebar.classList.add("collapsed")
      sidebar.style.transform = "translateX(-100%)"
      mainContent.classList.add("expanded")
      mainContent.style.marginLeft = "0"
      overlay.classList.remove("active")
    }
  })

  sidebar.addEventListener("click", (event) => {
    event.stopPropagation()
  })

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

  function mostrarError(mensaje) {
    console.error("Mostrando error:", mensaje)
    errorFetchElement.textContent = mensaje
    errorFetchElement.style.display = "block"
  }

  function limpiarError() {
    errorFetchElement.textContent = ""
    errorFetchElement.style.display = "none"
  }

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

  document.addEventListener("keypress", (event) => {
    var searchInputFocused = document.activeElement === searchInput
    if (event.key === "Enter" && searchInputFocused) {
      barraDeBusqueda()
    }
  })

  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection()
    if (selection && selection.toString().length > 0) {
      autoUpdate = false
    } else if (!hayTextoBusqueda) {
      autoUpdate = true
    }
  })

  document.addEventListener("submit", (e) => {
    const currentValue = searchInput.value.trim()
    if (currentValue !== "") {
      localStorage.setItem("searchValue", currentValue)
    }
  })

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

  const liveSearch = debounce(() => {
    barraDeBusqueda()
  }, 400)

  searchInput.addEventListener("input", () => {
    hayTextoBusqueda = searchInput.value.trim() !== ""
    autoUpdate = !hayTextoBusqueda
    liveSearch()
  })

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

  // Nueva función para verificar si un reporte está completado
  function estaReporteCompletado(reporte) {
    if (reporte.status && typeof reporte.status === "string") {
      const statusLower = reporte.status.toLowerCase()
      if (
        statusLower.includes("completado") ||
        statusLower.includes("completed") ||
        statusLower.includes("finalizado")
      ) {
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

  function crearDropdownEstado(valorActual, taskId, tdElement) {
    const select = document.createElement("select")
    select.classList.add("status-dropdown")
    select.dataset.taskId = taskId

    const estados = [
      { value: "Activo", label: "Activo" },
      { value: "Pendiente", label: "Pendiente" },
      { value: "Completado", label: "Completado" },
      { value: "Cancelado", label: "Cancelado" },
    ]

    estados.forEach((estado) => {
      const option = document.createElement("option")
      option.value = estado.value
      option.textContent = estado.label
      if (valorActual === estado.value) {
        option.selected = true
      }
      select.appendChild(option)
    })

    // Aplicar estilos para estados cancelados y completados
    if (valorActual === "Cancelado" || valorActual === "Completado") {
      select.disabled = true
      select.classList.add(valorActual === "Cancelado" ? "status-cancelled" : "status-completed")
      // Aplicar los mismos estilos de cancelado a completado
      if (valorActual === "Completado") {
        select.classList.add("status-cancelled")
      }
    }

    // Desactivar autoupdate mientras está activo
    select.addEventListener("focus", () => {
      autoUpdate = false
    })

    select.addEventListener("blur", () => {
      if (!hayTextoBusqueda) {
        autoUpdate = true
      }
    })

    // Confirmación antes de actualizar
    select.addEventListener("change", (e) => {
      const nuevoEstado = e.target.value
      const taskId = e.target.dataset.taskId
      const tarea = datosActuales.find((t) => t.id == taskId)
      const estadoAnterior = tarea?.estado

      if (!estadoAnterior || nuevoEstado === estadoAnterior) {
        return
      }

      const confirmar = confirm(`¿Confirmar cambio de estado de "${estadoAnterior}" a "${nuevoEstado}"?`)
      if (!confirmar) {
        e.target.value = estadoAnterior
        return
      }

      actualizarEstadoTarea(taskId, nuevoEstado, e.target, tdElement)
    })

    return select
  }

  async function actualizarEstadoTarea(taskId, nuevoEstado, selectElement, tdElement) {
    const tareaActual = datosActuales.find((t) => t.id == taskId)
    if (!tareaActual) {
      mostrarError("Tarea no encontrada.")
      return
    }

    const descripcionLimpia = tareaActual.descripcion?.trim()
    if (!descripcionLimpia) {
      mostrarError("La descripción no puede estar vacía.")
      return
    }

    selectElement.disabled = true
    selectElement.style.opacity = "0.6"

    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({
          id: Number.parseInt(taskId),
          descripcion: descripcionLimpia,
          estado: nuevoEstado,
        }),
      })

      if (!response) return // Ya manejado por authenticatedFetch

      const tareaActualizada = await response.json()
      console.log("Tarea actualizada exitosamente:", tareaActualizada)
      refrescarTabla()

      const indice = datosActuales.findIndex((t) => t.id == taskId)
      if (indice !== -1) {
        datosActuales[indice].estado = nuevoEstado
      }

      // Aplicar clase al <td>, no al <select>
      if (tdElement) {
        tdElement.className = "status"
        if (nuevoEstado === "Activo") tdElement.classList.add("status-active")
        else if (nuevoEstado === "Pendiente") tdElement.classList.add("status-pending")
        else if (nuevoEstado === "Completado") {
          tdElement.classList.add("status-completed")
          // Aplicar también la clase de cancelado para que tenga los mismos estilos
          tdElement.classList.add("status-cancelled")
        } else if (nuevoEstado === "Cancelado") tdElement.classList.add("status-cancelled")
      }

      // Si el estado es completado, aplicar los estilos visuales pero no deshabilitar el botón
      if (nuevoEstado === "Completado") {
        selectElement.classList.add("status-cancelled")
        selectElement.disabled = true

        // Buscar y habilitar el botón de eliminar en esta fila
        const fila = tdElement.closest("tr")
        if (fila) {
          const botonEliminar = fila.querySelector(".btn-eliminar")
          if (botonEliminar) {
            botonEliminar.classList.remove("disabled")
          }
        }
      }

      limpiarError()
      console.log(`Estado de la tarea ${taskId} actualizado a ${nuevoEstado}`)
    } catch (error) {
      console.error("Error al actualizar estado:", error)

      if (tareaActual) {
        selectElement.value = tareaActual.estado || "Activo"
      }

      mostrarError(`Error al actualizar estado: ${error.message}`)
    } finally {
      selectElement.disabled = nuevoEstado === "Cancelado" || nuevoEstado === "Completado"
      selectElement.style.opacity = "1"
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
      const columnas = Object.keys(datos[0])

      // Agregar encabezados de las columnas de datos
      columnas.forEach((columna) => {
        const th = document.createElement("th")
        th.textContent = formatearEncabezado(columna)
        encabezadoFila.appendChild(th)
      })

      // Agregar encabezado para la columna de eliminar UNA SOLA VEZ
      const thEliminar = document.createElement("th")
      thEliminar.textContent = "Acciones"
      thEliminar.style.textAlign = "center"
      encabezadoFila.appendChild(thEliminar)

      thead.appendChild(encabezadoFila)
      tabla.appendChild(thead)

      const tbody = document.createElement("tbody")
      datos.forEach((filaData) => {
        const fila = document.createElement("tr")
        const estaCancelado = estaReporteCancelado(filaData)
        const estaCompletado = estaReporteCompletado(filaData)

        // Aplicar clase cancelled a la fila si está cancelado o completado
        if (estaCancelado || estaCompletado) {
          fila.classList.add("cancelled")
        }

        // Crear celdas para las columnas de datos
        columnas.forEach((columna) => {
          const celda = document.createElement("td")
          const valor = filaData[columna]
          const valorStr = String(valor).toLowerCase()
          const columnaStr = columna.toLowerCase()

          if ((columnaStr === "estado" || columnaStr === "status") && filaData.id) {
            celda.classList.add("status")

            // Aplicar clase visual al <td> según valor actual
            if (valor === "Activo") celda.classList.add("status-active")
            else if (valor === "Pendiente") celda.classList.add("status-pending")
            else if (valor === "Completado") {
              celda.classList.add("status-completed")
              // Aplicar también la clase de cancelado para que tenga los mismos estilos
              celda.classList.add("status-cancelled")
            } else if (valor === "Cancelado") celda.classList.add("status-cancelled")

            // Crear y añadir el dropdown al <td>, pasando la celda
            const dropdown = crearDropdownEstado(valor, filaData.id, celda)
            celda.appendChild(dropdown)
          } else {
            if (valor === null || valor === undefined) {
              celda.textContent = "-"
            } else if (typeof valor === "object") {
              celda.textContent = JSON.stringify(valor)
            } else {
              celda.textContent = valor
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

            // Estilos por estado si no tiene dropdown (sin ID)
            if ((columnaStr.includes("status") || columnaStr.includes("estado")) && valor && !filaData.id) {
              celda.classList.add("status")
              if (valorStr.includes("pending") || valorStr.includes("pendiente") || valorStr.includes("proceso")) {
                celda.classList.add("status-pending")
              } else if (
                valorStr.includes("completed") ||
                valorStr.includes("completado") ||
                valorStr.includes("finalizado")
              ) {
                celda.classList.add("status-completed")
                // Aplicar también la clase de cancelado para que tenga los mismos estilos
                celda.classList.add("status-cancelled")
              } else if (valorStr.includes("cancelled") || valorStr.includes("cancelado")) {
                celda.classList.add("status-cancelled")
              }
            }
          }

          // Aplicar estilos de cancelado tanto para reportes cancelados como completados
          if (estaCancelado || estaCompletado) {
            aplicarEstilosCancelados(celda, String(valor), columna)
          }

          fila.appendChild(celda)
        })

        // Crear celda para botón de eliminar
        const celdaEliminar = document.createElement("td")
        celdaEliminar.style.textAlign = "center"

        const botonEliminar = document.createElement("button")
        botonEliminar.textContent = "Eliminar"
        botonEliminar.classList.add("btn-eliminar")

        botonEliminar.addEventListener("click", () => {
          if (confirm(`¿Deseas eliminar el reporte con ID ${filaData.id}?`)) {
            eliminarReporte(filaData.id)
          }
        })

        celdaEliminar.appendChild(botonEliminar)
        fila.appendChild(celdaEliminar)

        tbody.appendChild(fila)
      })

      tabla.appendChild(tbody)
      tablaContenedor.innerHTML = ""
      tablaContenedor.appendChild(tabla)
      limpiarError()

      // ACTUALIZAR: Actualizar estado del botón después de mostrar datos
      datosActuales = datos
      actualizarEstadoBotonExportar()
    } else {
      tablaContenedor.innerHTML = ""
      mostrarError("No se encontraron resultados para la búsqueda actual")
      // ACTUALIZAR: Limpiar datos y actualizar botón cuando no hay resultados
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
        // ACTUALIZAR: Actualizar botón cuando no hay datos
        actualizarEstadoBotonExportar()
      } else if (Array.isArray(data) && data.length === 0) {
        mostrarError("La búsqueda no produjo resultados. Intente con otros términos.")
        const tablaContenedor = document.getElementById("reportes-table")
        tablaContenedor.innerHTML = ""
        // ACTUALIZAR: Actualizar botón cuando no hay resultados de búsqueda
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
      // ACTUALIZAR: Actualizar botón cuando hay error
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

  async function eliminarReporte(id) {
    try {
      const response = await authenticatedFetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
      })

      if (!response) return // Ya manejado por authenticatedFetch

      alert("Reporte eliminado exitosamente")
      cargarTabla(searchInput.value.trim() ? parsearConsulta(searchInput.value.trim()) : "")
    } catch (error) {
      console.error("Error al eliminar:", error)
      mostrarError("No se pudo eliminar el reporte: " + error.message)
    }
  }

  // Funciones de exportar y refresh
  function exportData(datosActuales) {
    // ACTUALIZAR: Verificación mejorada con mensaje más claro
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

  // ACTUALIZAR: Event listener mejorado para el botón de exportar
  exportarButton.addEventListener("click", () => {
    if (exportarButton.disabled) {
      mostrarError("No hay datos disponibles para exportar.")
      return
    }
    exportData(datosActuales)
  })

  function refrescarTabla() {
    const valorBusqueda = searchInput.value.trim()
    if (valorBusqueda) {
      cargarTabla(parsearConsulta(valorBusqueda))
    } else {
      cargarTabla("")
    }
  }

  refreshButton.addEventListener("click", refrescarTabla)

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

  // Manejo móvil
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
})
