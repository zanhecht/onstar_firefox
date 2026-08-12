"use strict";

// These constants are inlined into the injected page script as string literals.
const AUTH_PREFIX = "msauth.com.gm.mychevrolet://";
const DOM_ATTR = "data-onstar-auth-url";
const EVENT_NAME = "__onstar_auth_captured__";

const DEFAULT_WATCH_URL = "https://custlogin.gm.com";

/**
 * Injects the location interceptor into the PAGE's JavaScript context via a
 * <script> tag. Content scripts run in an isolated world, so we must do this
 * to patch Location.prototype before any page scripts execute.
 *
 * The injected script captures any navigation to the msauth:// scheme, writes
 * the URL to a DOM attribute (so a late-starting listener won't miss it), and
 * also dispatches a CustomEvent that the content script can listen to.
 */
function injectInterceptor() {
  const script = document.createElement("script");
  script.textContent = `
(function () {
  'use strict';
  var PREFIX = '${AUTH_PREFIX.toLowerCase()}';
  var ATTR   = '${DOM_ATTR}';
  var EVENT  = '${EVENT_NAME}';

  function capture(url) {
    try {
      var s = String(url || '');
      if (s.toLowerCase().startsWith(PREFIX)) {
        document.documentElement.setAttribute(ATTR, s);
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { url: s } }));
      }
    } catch (_) {}
  }

  try {
    var desc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (desc && desc.set) {
      Object.defineProperty(Location.prototype, 'href', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) { capture(v); desc.set.call(this, v); },
      });
    }
  } catch (_) {}

  try {
    var origAssign = window.location.assign.bind(window.location);
    window.location.assign = function (url) { capture(url); return origAssign(url); };
  } catch (_) {}

  try {
    var origReplace = window.location.replace.bind(window.location);
    window.location.replace = function (url) { capture(url); return origReplace(url); };
  } catch (_) {}
})();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function urlMatchesBase(currentUrl, watchUrl) {
  try {
    const base = new URL(watchUrl);
    const current = new URL(currentUrl);
    return current.protocol === base.protocol && current.hostname === base.hostname && (base.port === "" || current.port === base.port);
  } catch (_) {
    return false;
  }
}

function sendAuthUrl(authUrl) {
  browser.runtime.sendMessage({ type: "AUTH_URL_CAPTURED", authUrl }).catch(() => {});
}

// Inject unconditionally at document_start so the interceptor is in place
// before any page JS runs. The capture logic is harmless on non-target pages.
injectInterceptor();

// Async config check — activate the listener only on the configured domain.
browser.storage.local.get({ watchUrl: DEFAULT_WATCH_URL }).then((result) => {
  const watchUrl = result.watchUrl || DEFAULT_WATCH_URL;

  if (!urlMatchesBase(window.location.href, watchUrl)) return;

  // Handle the case where the redirect already happened before we got here.
  const existing = document.documentElement.getAttribute(DOM_ATTR);
  if (existing) {
    sendAuthUrl(existing);
    return;
  }

  window.addEventListener(EVENT_NAME, (e) => {
    if (e.detail && e.detail.url) {
      sendAuthUrl(e.detail.url);
    }
  });
});
