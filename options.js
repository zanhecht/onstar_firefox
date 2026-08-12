"use strict";

const DEFAULT_WATCH_URL = "https://custlogin.gm.com";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("watchUrl");
  const status = document.getElementById("status");

  browser.storage.local.get({ watchUrl: DEFAULT_WATCH_URL }).then((result) => {
    input.value = result.watchUrl;
  });

  document.getElementById("save").addEventListener("click", () => {
    const value = input.value.trim();
    status.className = "";

    if (!value) {
      status.className = "err";
      status.textContent = "URL cannot be empty.";
      return;
    }

    try {
      new URL(value);
    } catch {
      status.className = "err";
      status.textContent = "Please enter a valid URL (include https://).";
      return;
    }

    browser.storage.local.set({ watchUrl: value }).then(() => {
      status.className = "ok";
      status.textContent = "Saved.";
      setTimeout(() => {
        status.textContent = "";
        status.className = "";
      }, 2500);
    });
  });
});
