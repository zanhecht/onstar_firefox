# OnStar Auth Token Saver – Firefox Extension

Captures the OAuth `code` parameter from the `msauth.com.gm.mychevrolet://auth` redirect during a GM/OnStar login flow, exchanges it for a full Microsoft token set via PKCE, and prompts you to save the result as `microsoft_tokens.json`.

## Quick Start

1. On the [GitHub repository page](https://github.com/metheos/onstar_firefox), click the green **Code** button, then choose **Download ZIP**. Extract the ZIP to a folder on your computer.
2. Open [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox) in Firefox.
3. Click **Load Temporary Add-on…** and select `manifest.json` from the extracted folder.
4. Click the **Extensions** puzzle-piece button in the Firefox toolbar, then click **OnStar Auth Token Saver**.
5. Click **Launch Auth Flow** — a new tab opens and walks through GM login.
6. After login (or immediately if you're already signed in), the tab navigates to a completion page and a **Save File** dialog appears. Save as `microsoft_tokens.json` and place it in your OnStar JS token directory.
7. Use **View Capture Log** from the popup to inspect every captured redirect, including timestamp, code, state, and exchange status.

## How it works

1. The popup starts the GM auth flow by opening the OAuth authorization URL in a new tab.
2. The background script listens for HTTP response headers from `custlogin.gm.com` and captures redirects whose `Location` starts with `msauth.com.gm.mychevrolet://`.
3. The background script performs a PKCE token exchange: it POSTs the `code` and `code_verifier` to the token endpoint discovered from the OpenID configuration, receiving a full token set (`access_token`, `refresh_token`, `id_token`, etc.).
4. The auth tab is navigated to a completion page with next-step instructions, and a native **Save File** dialog prompts you to save `microsoft_tokens.json`.
5. Every captured redirect is logged in extension storage, even when there is no matching pending PKCE flow.

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

## Notes

- The extension does not inject scripts into web pages.
- Host access is limited to `custlogin.gm.com` for redirect observation.
