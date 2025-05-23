const API_URL = "http://localhost:8000";

document.getElementById("admin-login-form").addEventListener("submit", async function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("error-msg");
    errorMsg.textContent = ""; // limpiar error previo

    try {
    // Solicitar token
    const tokenRes = await fetch(`${API_URL}/token`, {
        method: "POST",
        headers: {
        "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });

    if (!tokenRes.ok) {
        throw new Error("Credenciales incorrectas");
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    localStorage.setItem("access_token", token);

    // Verificar si el usuario es admin
    const meRes = await fetch(`${API_URL}/me`, {
        headers: {
        "Authorization": `Bearer ${token}`
        }
    });

    if (!meRes.ok) {
        throw new Error("No se pudo verificar el rol del usuario");
    }

    const user = await meRes.json();
    if (user.rol === "admin") {
        window.location.href = "dashboard.html";
    } else {
        throw new Error("Acceso denegado: no eres administrador");
    }
    } catch (err) {
    errorMsg.textContent = err.message || "Error desconocido";
    localStorage.removeItem("access_token"); // limpiar token si falla
    }
});