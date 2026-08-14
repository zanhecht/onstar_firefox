"use strict";

const REDIRECT_LOG_KEY = "redirectCaptureLog";

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatTimestamp(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function render(logItems) {
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("empty");
  const summaryEl = document.getElementById("summary");

  const items = Array.isArray(logItems) ? [...logItems].reverse() : [];
  summaryEl.textContent = `${items.length} captured redirect${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    rowsEl.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  rowsEl.innerHTML = items
    .map((item) => {
      const exchangeStatus = item.exchange_status || "captured";
      const exchangeDetail = item.exchange_detail ? `<div>${escapeHtml(item.exchange_detail)}</div>` : "";
      const statusMeta = [item.status_code, item.request_type].filter(Boolean).join(" / ") || "-";
      return `<tr>
        <td>${escapeHtml(formatTimestamp(item.captured_at))}</td>
        <td>${item.code ? `<code>${escapeHtml(item.code)}</code>` : "-"}</td>
        <td>${item.state ? `<code>${escapeHtml(item.state)}</code>` : "-"}</td>
        <td><span class="status">${escapeHtml(exchangeStatus)}</span>${exchangeDetail}</td>
        <td>${escapeHtml(statusMeta)}</td>
        <td>${item.tab_id == null ? "-" : escapeHtml(String(item.tab_id))}</td>
        <td class="url"><code>${escapeHtml(item.redirect_url || "-")}</code></td>
      </tr>`;
    })
    .join("");
}

async function loadLog() {
  const result = await browser.storage.local.get(REDIRECT_LOG_KEY);
  render(result[REDIRECT_LOG_KEY]);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    loadLog().catch((err) => {
      console.error("Failed to refresh redirect log", err);
    });
  });

  document.getElementById("clearBtn").addEventListener("click", async () => {
    const confirmed = window.confirm("Clear all captured redirect log entries?");
    if (!confirmed) return;
    await browser.storage.local.set({ [REDIRECT_LOG_KEY]: [] });
    await loadLog();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[REDIRECT_LOG_KEY]) return;
    render(changes[REDIRECT_LOG_KEY].newValue);
  });

  loadLog().catch((err) => {
    console.error("Failed to load redirect log", err);
    render([]);
  });
});
