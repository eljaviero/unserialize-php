window.APP_CONSTANTS = Object.freeze({
  footerByName: "Javiero",
  footerLinkText: "eljaviero.com",
  footerLinkUrl: "https://eljaviero.com"
});

(function applyFooterConstantsOnLoad() {
  function apply() {
    const config = window.APP_CONSTANTS || {};
    const byName = config.footerByName || "Javiero";
    const linkText = config.footerLinkText || "eljaviero.com";
    const linkUrl = config.footerLinkUrl || "https://eljaviero.com";

    const byNode = document.getElementById("footer-by-name");
    const linkNode = document.getElementById("footer-link");

    if (byNode) byNode.textContent = byName;
    if (linkNode) {
      linkNode.textContent = linkText;
      linkNode.setAttribute("href", linkUrl);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();