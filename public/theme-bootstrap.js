// Applies the saved theme before first paint (no white flash).
// Kept as an external file so the CSP can drop 'unsafe-inline' from script-src.
(function () {
  try {
    var theme = localStorage.getItem("academicos-theme") || "light";
    var dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
