"use strict";

(async () => {
  const showError = (message) => {
    document.getElementById("header1").textContent = message;
    document.getElementById("subtitle").textContent = "Unable to get Microsoft authentication tokens.";
    document.getElementById("header2").innerHTML = "";
    document.getElementById("orderedList").innerHTML = "";
  };

  const params = new URLSearchParams(location.search);
  const key = params.get("key");

  if (!key) {
    showError("Missing token data.");
    return;
  }

  const { [key]: tokenSet } = await browser.storage.local.get(key);

  if (!tokenSet) {
    showError("Token data not found.");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(tokenSet, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  console.log(url);
  const link = document.createElement("a");

  link.href = url;
  link.download = "microsoft_tokens.json";
  link.textContent = "here";

  document.getElementById("downloadLink").replaceWith(link);

  // Keep the Blob URL alive while the browser processes the download.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
})();