const LOGIN_API = "http://localhost:8080/users/login";
const REFRESH_API = "http://localhost:8080/refresh";
const WS_BASE = `ws://${location.hostname}:5001`;

let socket;
const statusEl = document.querySelector('#status');
const reconnectBtn = document.querySelector('#reconnect');
const outEl = document.querySelector('#out');
const errEl = document.querySelector('#err');
const inputEl = document.querySelector('#in');
const loginForm = document.querySelector('#loginForm');
const logoutBtn = document.querySelector('#logoutBtn');
const loginContainer = document.querySelector('#login-container');
const appContainer = document.querySelector('#app');

function setStatus(s) {
  statusEl.textContent = s;
  statusEl.className = s.toLowerCase();
}

function saveTokens(accessToken, refreshToken) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}
function loadAccessToken() { return localStorage.getItem('accessToken') || ''; }
function loadRefreshToken() { return localStorage.getItem('refreshToken') || ''; }
function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function login(email, password) {
  const res = await fetch(LOGIN_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

async function refreshAccessToken() {
  const refreshToken = loadRefreshToken();
  const res = await fetch(REFRESH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) throw new Error("Failed to refresh token");
  const data = await res.json();
  saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

function attachInputListener() {
  if (inputEl._wsAttached) return;
  
  inputEl.addEventListener('keydown', (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ msg: inputEl.value, from: "Browser" }));
        inputEl.value = "";
      }
    }
  });

  inputEl._wsAttached = true;
}

async function connect() {
  setStatus('Connecting');
  errEl.textContent = '';
  let token = loadAccessToken();
  if (!token) {
    setStatus('Disconnected');
    return;
  }

  socket = new WebSocket(`${WS_BASE}?token=${token}`);

  socket.onopen = () => setStatus('Connected');

  socket.onmessage = async (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.status === 0) {
        outEl.textContent = `${data.msg} (from ${data.from || "unknown"})`;
        errEl.textContent = '';
      } else {
        errEl.textContent = data.msg || 'Server error';
        if (String(data.msg).toLowerCase().includes('expired')) {
          try {
            token = await refreshAccessToken();
            socket.close();
            connect();
          } catch (e) {
            console.error("Re-login required", e);
            clearTokens();
            appContainer.classList.add("hidden");
            loginContainer.classList.remove("hidden");
          }
        }
      }
    } catch (e) {
      console.error('Invalid WS message', ev.data);
    }
  };

  socket.onclose = () => setStatus('Disconnected');
  socket.onerror = (e) => console.error('WebSocket error', e);

  attachInputListener();
}

// --- UI HANDLERS ---
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const { accessToken, refreshToken } = await login(email, password);
    saveTokens(accessToken, refreshToken);
    loginContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");
    connect();
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  const refreshToken = loadRefreshToken();
  try {
    await fetch(REFRESH_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
  } catch (e) {
    console.warn("Logout request failed", e);
  }
  clearTokens();
  location.reload();
});

reconnectBtn.addEventListener('click', async () => {
  try {
    await refreshAccessToken();
    if (socket) socket.close();
    connect();
  } catch (e) {
    errEl.textContent = 'Reconnect failed: ' + e.message;
  }
});

if (loadAccessToken()) {
  loginContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");
  connect();
}