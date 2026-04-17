// Firebase config is set as window.FIREBASE_CONFIG by Hugo at build time (see head.html partial).
// Unlike the admin frontend, there's no email allowlist — anyone can sign up.
window._firebaseReady = false;
(function() {
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg.apiKey || !cfg.projectId) {
    console.warn('Firebase config is empty. Sign-in will be disabled until .env is sourced.');
    return;
  }
  try {
    firebase.initializeApp(cfg);
    window._firebaseReady = true;
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
})();

async function authSignOut() {
  await firebase.auth().signOut();
  window.location.reload();
}

async function signInWithGoogle() {
  if (!window._firebaseReady) {
    showToast('Sign-in is not configured yet. Check back soon.', 'warning');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showToast('Sign-in failed: ' + e.message, 'danger');
    }
  }
}

// Navbar auth state
if (window._firebaseReady) firebase.auth().onAuthStateChanged(async user => {
  const emailEl    = document.getElementById('nav-user-email');
  const loginBtn   = document.getElementById('btn-login');
  const logoutBtn  = document.getElementById('btn-logout');
  const accountBtn = document.getElementById('btn-account');

  if (user) {
    if (emailEl)    emailEl.textContent = user.email;
    if (loginBtn)   loginBtn.classList.add('d-none');
    if (logoutBtn)  logoutBtn.classList.remove('d-none');
    if (accountBtn) accountBtn.classList.remove('d-none');
    await window._tier.refresh();
  } else {
    if (emailEl)    emailEl.textContent = '';
    if (loginBtn)   loginBtn.classList.remove('d-none');
    if (logoutBtn)  logoutBtn.classList.add('d-none');
    if (accountBtn) accountBtn.classList.add('d-none');
    window._tier.setAnon();
  }
});

// No-Firebase fallback — still show login button so a click can explain why
if (!window._firebaseReady) {
  document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.classList.remove('d-none');
    window._tier.setAnon();
  });
}
