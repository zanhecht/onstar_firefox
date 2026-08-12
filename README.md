# OnStar Auth Token Saver – Firefox Extension

Captures the OAuth `code` parameter from the `msauth.com.gm.mychevrolet://auth` redirect during a GM/OnStar login flow and prompts you to save it as a JSON file.

## How it works

1. A content script injects a JavaScript location interceptor into every page **before any page scripts run** (via a `<script>` tag, since content scripts live in an isolated world separate from the page's JS environment).
2. When any navigation to `msauth.com.gm.mychevrolet://` is attempted (via `href`, `assign`, or `replace`), the interceptor captures the full URL.
3. The URL is relayed to the background script via a `CustomEvent` bridge.
4. The background script extracts the `code=` query parameter and prompts the native OS **Save File** dialog to save a `.json` file.

The active listening only starts on pages whose hostname matches the configured **OAuth base URL** (default: `https://custlogin.gm.com`).

## Saved file format

```json
{
  "auth_url": "msauth.com.gm.mychevrolet://auth?code=XXXX&...",
  "code": "XXXX",
  "captured_at": "2024-01-01T00:00:00.000Z"
}
```

## Installation (temporary / development)

1. Open Firefox and navigate to `about:debugging`.
2. Click **This Firefox** → **Load Temporary Add-on**.
3. Select the `manifest.json` file from this folder.

To install permanently, the extension must be signed by Mozilla or loaded via Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false` in `about:config`.

## Configuration

Click the toolbar icon → **Open Options** to change the watched base URL.  
The extension matches on **protocol + hostname** only (port is matched if specified).

## Notes

- The Save dialog requires Firefox's built-in download prompt. If Firefox is configured to save all files silently to a default folder, the dialog will not appear. Check **Settings → General → Downloads → Always ask where to save files**.
- The location interceptor is injected on all pages but captures nothing unless the `msauth.com.gm.mychevrolet://` prefix appears in a navigation call.
