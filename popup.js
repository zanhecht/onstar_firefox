"use strict";

const DEFAULT_WATCH_URL = "https://custlogin.gm.com";

document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get({ watchUrl: DEFAULT_WATCH_URL }).then((result) => {
    document.getElementById("watchUrl").textContent = result.watchUrl;
  });

  document.getElementById("optionsLink").addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  const launchBtn = document.getElementById("launchBtn");
  const flowStatus = document.getElementById("flowStatus");

  launchBtn.addEventListener("click", () => {
    launchBtn.disabled = true;
    flowStatus.className = "";
    flowStatus.textContent = "Fetching discovery document…";

    browser.runtime
      .sendMessage({ type: "START_AUTH_FLOW" })
      .then(() => {
        flowStatus.className = "ok";
        flowStatus.textContent = "Auth tab opened.";
      })
      .catch((err) => {
        flowStatus.className = "err";
        flowStatus.textContent = `Error: ${err}`;
      })
      .finally(() => {
        launchBtn.disabled = false;
      });
  });
});
