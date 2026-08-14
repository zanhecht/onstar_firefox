"use strict";

const AUTH_PREFIX = "msauth.com.gm.mychevrolet://";
const DISCOVERY_URL =
  "https://custlogin.gm.com/gmb2cprod.onmicrosoft.com" + "/b2c_1a_seamless_mobile_signuporsignin/v2.0/.well-known/openid-configuration";
const CLIENT_ID = "3ff30506-d242-4bed-835b-422bf992622e";
const REDIRECT_URI = "msauth.com.gm.mychevrolet://auth";
const SCOPE = `https://gmb2cprod.onmicrosoft.com/${CLIENT_ID}/Test.Read openid profile offline_access`;
const REDIRECT_LOG_KEY = "redirectCaptureLog";
const REDIRECT_LOG_MAX_ITEMS = 250;

// ── PKCE helpers (Web Crypto) ────────────────────────────────────────────────

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

async function generateCodeChallenge(verifier) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64urlEncode(hash);
}

function generateNonce() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

// ── Auth flow launcher ───────────────────────────────────────────────────────

async function startAuthFlow() {
  const resp = await fetch(DISCOVERY_URL);
  if (!resp.ok) throw new Error(`Discovery request failed: ${resp.status}`);
  const config = await resp.json();

  const authorizationEndpoint = config.authorization_endpoint;
  const token_endpoint = config.token_endpoint;
  if (!authorizationEndpoint) throw new Error("No authorization_endpoint in discovery document");
  if (!token_endpoint) throw new Error("No token_endpoint in discovery document");

  const code_verifier = generateCodeVerifier();
  const code_challenge = await generateCodeChallenge(code_verifier);
  const state = generateNonce();

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge,
    code_challenge_method: "S256",
    state,
    bundleID: "com.gm.myChevrolet",
    mode: "dark",
    evar25: "mobile_mychevrolet_chevrolet_us_app_launcher_sign_in_or_create_account",
    channel: "lightreg",
    ui_locales: "en-US",
    brand: "chevrolet",
  });

  const authorizationUrl = `${authorizationEndpoint}?${params.toString()}`;

  await browser.storage.local.set({ pendingPkce: { code_verifier, state, token_endpoint } });

  await browser.tabs.create({ url: authorizationUrl });
}

// ── Token save and redirect processing ──────────────────────────────────────

// Dedup by state param: prevents double-save when multiple redirect responses
// for the same auth attempt are observed.
const _recentStates = new Map(); // state -> timestamp

function extractParam(url, name) {
  const match = new RegExp(`[?&]${name}=([^&]*)`).exec(url || "");
  return match ? decodeURIComponent(match[1]) : null;
}

function isDuplicate(authUrl) {
  const state = extractParam(authUrl, "state");
  if (!state) return false;
  const now = Date.now();
  for (const [k, t] of _recentStates) {
    if (now - t > 60_000) _recentStates.delete(k);
  }
  if (_recentStates.has(state)) return true;
  _recentStates.set(state, now);
  return false;
}

function generateLogId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function appendRedirectLog(entry) {
  const { [REDIRECT_LOG_KEY]: existing } = await browser.storage.local.get(REDIRECT_LOG_KEY);
  const list = Array.isArray(existing) ? existing : [];
  list.push(entry);
  if (list.length > REDIRECT_LOG_MAX_ITEMS) {
    list.splice(0, list.length - REDIRECT_LOG_MAX_ITEMS);
  }
  await browser.storage.local.set({ [REDIRECT_LOG_KEY]: list });
}

async function updateRedirectLog(logId, patch) {
  if (!logId) return;
  const { [REDIRECT_LOG_KEY]: existing } = await browser.storage.local.get(REDIRECT_LOG_KEY);
  const list = Array.isArray(existing) ? existing : [];
  const idx = list.findIndex((item) => item && item.id === logId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  await browser.storage.local.set({ [REDIRECT_LOG_KEY]: list });
}

async function logCapturedRedirect(authUrl, details) {
  const code = extractParam(authUrl, "code");
  const state = extractParam(authUrl, "state");
  const error = extractParam(authUrl, "error");
  const errorDescription = extractParam(authUrl, "error_description");
  const { pendingPkce } = await browser.storage.local.get("pendingPkce");

  const logEntry = {
    id: generateLogId(),
    captured_at: new Date().toISOString(),
    redirect_url: authUrl,
    code: code || null,
    state: state || null,
    error: error || null,
    error_description: errorDescription || null,
    tab_id: details?.tabId ?? null,
    request_url: details?.url ?? null,
    status_code: details?.statusCode ?? null,
    request_type: details?.type ?? null,
    pending_pkce_present: Boolean(pendingPkce),
    pending_pkce_state: pendingPkce?.state || null,
    exchange_status: "captured",
    exchange_detail: null,
  };

  await appendRedirectLog(logEntry);
  return logEntry.id;
}

function saveTokenFile(tokenSet) {
  const content = JSON.stringify(tokenSet, null, 2);
  // Firefox rejects data: URLs in downloads.download(); blob: URLs are required.
  const blobUrl = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  browser.downloads
    .download({ url: blobUrl, filename: "microsoft_tokens.json", saveAs: true })
    .then((downloadId) => {
      // Revoke only after the download finishes; .then() fires on queue, not completion.
      const listener = (delta) => {
        if (delta.id !== downloadId || !delta.state) return;
        if (delta.state.current === "complete" || delta.state.current === "interrupted") {
          URL.revokeObjectURL(blobUrl);
          browser.downloads.onChanged.removeListener(listener);
        }
      };
      browser.downloads.onChanged.addListener(listener);
    })
    .catch((err) => {
      URL.revokeObjectURL(blobUrl);
      console.error("[OnStar Auth] Download failed:", err);
    });
}

async function exchangeAndSave(authUrl, tabId = null, logId = null) {
  if (!authUrl || !authUrl.toLowerCase().startsWith(AUTH_PREFIX.toLowerCase())) return;
  if (isDuplicate(authUrl)) {
    await updateRedirectLog(logId, {
      exchange_status: "duplicate",
      exchange_detail: "A redirect with the same state was already processed recently.",
    });
    return;
  }

  const code = extractParam(authUrl, "code");
  const state = extractParam(authUrl, "state");
  if (!code) {
    await updateRedirectLog(logId, {
      exchange_status: "skipped_no_code",
      exchange_detail: "Redirect did not contain an OAuth code parameter.",
    });
    console.error("[OnStar Auth] No code in redirect URL");
    return;
  }

  const { pendingPkce } = await browser.storage.local.get("pendingPkce");
  if (!pendingPkce) {
    await updateRedirectLog(logId, {
      exchange_status: "skipped_no_pending_pkce",
      exchange_detail: "Captured redirect was not associated with an active PKCE flow.",
    });
    console.error("[OnStar Auth] No pending PKCE session found");
    return;
  }

  const { code_verifier, state: expectedState, token_endpoint } = pendingPkce;
  if (state && expectedState && state !== expectedState) {
    await updateRedirectLog(logId, {
      exchange_status: "state_mismatch",
      exchange_detail: "Captured redirect state does not match pending PKCE state.",
    });
    console.error("[OnStar Auth] State mismatch — possible CSRF");
    return;
  }

  await browser.storage.local.remove("pendingPkce");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier,
  });

  const resp = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenSet = await resp.json();
  if (!resp.ok) {
    await updateRedirectLog(logId, {
      exchange_status: "token_exchange_failed",
      exchange_detail: tokenSet?.error_description || tokenSet?.error || `Token endpoint returned ${resp.status}.`,
    });
    console.error("[OnStar Auth] Token exchange failed:", tokenSet);
    return;
  }

  if (tabId != null) {
    browser.tabs.update(tabId, { url: browser.runtime.getURL("complete.html") }).catch(() => {});
  }
  saveTokenFile({ ...tokenSet, captured_at: new Date().toISOString() });
  await updateRedirectLog(logId, {
    exchange_status: "token_saved",
    exchange_detail: "Token exchange succeeded and save-file prompt was shown.",
  });
}

// ── webRequest: catch immediate HTTP-302 redirects (pre-page-load) ───────────
//
// When the browser already has a valid session the auth server returns a 302
// directly to the custom scheme before any page renders, bypassing the content
// script entirely.  Intercepting response headers lets us catch that URL.

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const location = (details.responseHeaders || []).find((h) => h.name.toLowerCase() === "location");
    if (!location) return;
    const redirectUrl = location.value;
    if (redirectUrl.toLowerCase().startsWith(AUTH_PREFIX.toLowerCase())) {
      logCapturedRedirect(redirectUrl, details)
        .then((logId) => exchangeAndSave(redirectUrl, details.tabId, logId))
        .catch((err) => console.error("[OnStar Auth] Exchange failed:", err));
    }
  },
  { urls: ["*://custlogin.gm.com/*"] },
  ["responseHeaders"],
);

// ── Message dispatcher ───────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "START_AUTH_FLOW") {
    // Return the promise so the popup can await the result.
    return startAuthFlow().catch((err) => {
      console.error("[OnStar Auth] Flow start failed:", err);
      return Promise.reject(err.message || String(err));
    });
  }
});
