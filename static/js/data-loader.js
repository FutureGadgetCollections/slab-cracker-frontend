// Fetches a JSON file: tries GitHub raw first, falls back to GCS.
// Requires window.DATA_CONFIG = { gcsBucket, githubDataRepo }
async function loadJsonData(filename) {
  const { gcsBucket, githubDataRepo } = window.DATA_CONFIG || {};

  if (githubDataRepo) {
    const url = `https://raw.githubusercontent.com/${githubDataRepo}/main/${filename}?t=${Date.now()}`;
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_) {}
  }

  if (!gcsBucket) throw new Error('DATA_CONFIG.gcsBucket is not set');
  const gcsUrl = `https://storage.googleapis.com/${gcsBucket}/${filename}?t=${Date.now()}`;
  const gcsRes = await fetch(gcsUrl);
  if (!gcsRes.ok) throw new Error(`GCS fetch failed for ${filename}: ${gcsRes.status}`);
  return await gcsRes.json();
}
