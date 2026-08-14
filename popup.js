"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const launchBtn = document.getElementById("launchBtn");
  const openLogBtn = document.getElementById("openLogBtn");
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

  openLogBtn.addEventListener("click", () => {
    browser.tabs.create({ url: browser.runtime.getURL("redirect-log.html") });
  });
});
