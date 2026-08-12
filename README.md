# OnStar Auth Token Saver – Firefox Extension

Captures the OAuth `code` parameter from the `msauth.com.gm.mychevrolet://auth` redirect during a GM/OnStar login flow, exchanges it for a full Microsoft token set via PKCE, and prompts you to save the result as `microsoft_tokens.json`.

## Quick Start

1. On the [GitHub repository page](https://github.com/metheos/onstar_firefox), click the green **Code** button, then choose **Download ZIP**. Extract the ZIP to a folder on your computer.
2. Open [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox) in Firefox.
3. Click **Load Temporary Add-on…** and select `manifest.json` from the extracted folder.
4. Click the **Extensions** puzzle-piece button in the Firefox toolbar, then click **OnStar Auth Token Saver**.
5. Click **Launch Auth Flow** — a new tab opens and walks through GM login.
6. After login (or immediately if you're already signed in), the tab navigates to a completion page and a **Save File** dialog appears. Save as `microsoft_tokens.json` and place it in your OnStar JS token directory.

## How it works

1. A content script injects a JavaScript location interceptor into every page **before any page scripts run** (via a `<script>` tag, since content scripts live in an isolated world separate from the page's JS environment).
2. When any navigation to `msauth.com.gm.mychevrolet://` is attempted (via `href`, `assign`, or `replace`), the interceptor captures the full URL. If the browser already has a valid session, the OAuth server returns an immediate HTTP 302 to the custom scheme — this is caught at the network layer via `webRequest.onHeadersReceived` before any page loads.
3. The captured redirect URL is relayed to the background script.
4. The background script performs a PKCE token exchange: it POSTs the `code` and `code_verifier` to the token endpoint discovered from the OpenID configuration, receiving a full token set (`access_token`, `refresh_token`, `id_token`, etc.).
5. The auth tab is navigated to a completion page with next-step instructions, and a native **Save File** dialog prompts you to save `microsoft_tokens.json`.

The active listening only starts on pages whose hostname matches the configured **OAuth base URL** (default: `https://custlogin.gm.com`).

## Saved file format

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "...",
  "captured_at": "2026-08-12T00:00:00.000Z"
}
```

## Installation (temporary / development)

1. Open [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox) in Firefox.
2. Click **Load Temporary Add-on…** and select `manifest.json` from this folder.

To install permanently, the extension must be signed by Mozilla or loaded via Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false` in `about:config`.

## Configuration

Click the toolbar icon → **Open Options** to change the watched base URL.  
The extension matches on **protocol + hostname** only (port is matched if specified).

## Notes

- The location interceptor is injected on all pages but captures nothing unless the `msauth.com.gm.mychevrolet://` prefix appears in a navigation call.
