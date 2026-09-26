// Boot splash controller. Loaded synchronously right after #acos-boot in
// index.html; external so the CSP can drop 'unsafe-inline' from script-src.
(function () {
  var root = document.documentElement;
  root.classList.add("acos-booting");
  var taglines = {
    ar: "من التكليف إلى الدليل",
    en: "From assignment to evidence",
    tr: "Ödevden kanıta",
    zh: "从作业到学习证据",
    hi: "असाइनमेंट से प्रमाण तक",
    es: "De la tarea a la evidencia",
    fr: "Du devoir à la preuve",
    ur: "اسائنمنٹ سے ثبوت تک",
  };
  var node = document.getElementById("acos-boot-tagline");
  var lang = (root.getAttribute("lang") || "ar").slice(0, 2);
  if (node && taglines[lang]) node.textContent = taglines[lang];

  var splash = document.getElementById("acos-boot");
  var removed = false;
  var pending = false;
  var startedAt = Date.now();
  // تسلسل الحركة ينتهي عند ~١٧٦٠ms. التطبيق غالبًا يجهز قبل ذلك بكثير،
  // فتُحجز مدة دنيا كي تكتمل الحركة ويستقرّ الشعار لحظةً قبل الانصراف.
  // الحركة كاملةً في أول زيارة للجلسة فقط؛ التنقّل وإعادة التحميل بعدها لا تُنتظر.
  var MIN_VISIBLE = 2300;
  try {
    if (window.sessionStorage.getItem("acos-boot-seen")) MIN_VISIBLE = 0;
    else window.sessionStorage.setItem("acos-boot-seen", "1");
  } catch (e) {}
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function removeNow() {
    if (removed || !splash) return;
    removed = true;
    splash.setAttribute("data-leaving", "1");
    root.classList.remove("acos-booting");
    window.setTimeout(function () {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 520);
  }

  function dismiss() {
    if (removed || pending) return;
    var remaining = reduceMotion ? 0 : MIN_VISIBLE - (Date.now() - startedAt);
    if (remaining > 0) {
      pending = true;
      window.setTimeout(removeNow, remaining);
      return;
    }
    removeNow();
  }

  window.__acosBootReady = dismiss;
  // شبكة أمان: لا تُحتجَز الواجهة خلف الشاشة إذا فشل تحميل الحزمة.
  window.setTimeout(removeNow, 9000);
})();
