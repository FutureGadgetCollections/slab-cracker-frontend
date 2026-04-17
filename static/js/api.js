const BACKEND_URL = (document.body.dataset.backendUrl || '').replace(/\/$/, '');

// Fetch wrapper. Attaches Firebase ID token if the user is signed in; otherwise
// sends anonymously (backend applies IP-based quota for anon callers).
async function api(method, path, body, _retry = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (window._firebaseReady) {
    const user = firebase.auth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = 'Bearer ' + token;
    }
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BACKEND_URL + path, opts);

  if (res.status === 401 && _retry && window._firebaseReady && firebase.auth().currentUser) {
    await firebase.auth().currentUser.getIdToken(true);
    return api(method, path, body, false);
  }

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch (_) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}
