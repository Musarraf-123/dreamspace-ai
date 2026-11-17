import { Capacitor } from '@capacitor/core';

const apiBase = ((import.meta.env || {}).VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path) {
  if (Capacitor.isNativePlatform() && !apiBase) {
    throw new Error('The DreamSpace API address is missing from this app build. Set VITE_API_BASE_URL to your HTTPS API address and rebuild.');
  }
  return `${apiBase}/api${path}`;
}

function connectionError() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new Error('You are offline. Reconnect to the internet and try again.');
  }
  return new Error('DreamSpace could not reach the server. Check your connection and try again.');
}

export async function api(path, { method = 'GET', body } = {}) {
  const url = apiUrl(path);
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw connectionError();
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

export async function apiForm(path, formData) {
  const url = apiUrl(path);
  let response;
  try {
    response = await fetch(url, { method: 'POST', credentials: 'include', body: formData });
  } catch {
    throw connectionError();
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

export function assetUrl(path) { return `${apiBase}${path}`; }

export async function downloadAsset(path, filename) {
  let response;
  try { response = await fetch(assetUrl(path), { credentials: 'include' }); }
  catch { throw new Error('Unable to download this image. Check your connection and try again.'); }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Unable to download this image.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
