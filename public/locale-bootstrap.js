(function () {
  try {
    var supported = ["ar", "en", "tr", "zh", "hi", "es", "fr", "ur"];
    var rtl = { ar: true, ur: true };
    var saved = localStorage.getItem("academicos.locale.v1");
    var code = supported.indexOf(saved) >= 0 ? saved : "";
    if (!code) {
      var candidates = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
      for (var i = 0; i < candidates.length; i += 1) {
        var normalized = String(candidates[i] || "").toLowerCase();
        for (var j = 0; j < supported.length; j += 1) {
          if (normalized === supported[j] || normalized.indexOf(supported[j] + "-") === 0) {
            code = supported[j];
            break;
          }
        }
        if (code) break;
      }
    }
    code = code || "en";
    document.documentElement.lang = code;
    document.documentElement.dir = rtl[code] ? "rtl" : "ltr";
    document.documentElement.dataset.locale = code;
  } catch (_) {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
})();
