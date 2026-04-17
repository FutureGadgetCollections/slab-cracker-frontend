// Tier resolution + body-class toggling.
// Reads the `tier` custom claim from the Firebase ID token and sets one of:
//   tier-free-anon  (not signed in)
//   tier-free       (signed in, no active sub)
//   tier-basic      (signed in, Basic sub)
//   tier-pro        (signed in, Pro sub)
// CSS in app.css uses these to show/hide tier-specific UI.
//
// REMINDER: this is UX only. All real tier enforcement lives on the backend.

(function() {
  const CLASSES = ['tier-unknown', 'tier-free-anon', 'tier-free', 'tier-basic', 'tier-pro'];
  let current = 'unknown';

  function apply(tier) {
    current = tier;
    document.body.classList.remove(...CLASSES);
    document.body.classList.add('tier-' + tier);
  }

  async function refresh() {
    const user = firebase.auth().currentUser;
    if (!user) { apply('free-anon'); return; }
    try {
      const res = await user.getIdTokenResult();
      const claim = (res.claims && res.claims.tier) || 'free';
      const valid = ['free', 'basic', 'pro'].includes(claim) ? claim : 'free';
      apply(valid);
    } catch (e) {
      console.warn('Failed to read tier claim, defaulting to free:', e);
      apply('free');
    }
  }

  window._tier = {
    refresh,
    setAnon: () => apply('free-anon'),
    current: () => current,
  };

  window.getCurrentTier = () => current;
})();
