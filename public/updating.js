// صفحة «نُحدّث البرنامج» (public/updating.html): سكربتها في ملفٍّ خارجي لأن سياسة
// CSP في الخادم لا تسمح بسكربتٍ مضمّن. يحفظه عاملُ الخدمة مع الصفحة نفسها.
(function () {
  /* المظهر المحفوظ في البرنامج (theme-bootstrap.js) قبل أول رسم؛ وإلا فمظهرُ النظام. */
  try {
    var theme = localStorage.getItem("academicos-theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
    else if (theme === "light") document.documentElement.classList.add("light");
  } catch (e) {}

  var HEALTH = "/api/health/live";
  var FIRST = 3000, CEILING = 15000, PATIENT = 30000;
  var KEY = "academicos-updating-reloads";
  var tries = 0, timer = 0, asking = false;
  var title, lead, note;

  /* إعاداتُ التحميل في الدقيقتين الأخيرتين: ثلاثٌ والخادمُ سليم تعني أن الصفحة
     نفسها تتعثّر، فلا ندور في حلقة. */
  function recent() {
    try {
      var now = Date.now();
      return JSON.parse(sessionStorage.getItem(KEY) || "[]").filter(function (t) { return now - t < 120000; });
    } catch (e) { return []; }
  }
  function remember() {
    try { var list = recent(); list.push(Date.now()); sessionStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function stuck() { return recent().length >= 3; }

  /* فُتحت هذه الصفحة باسمها مباشرة: العودة إلى البداية، لا إليها. */
  function reopen() {
    remember();
    if (location.pathname === "/updating.html") location.replace("/");
    else location.reload();
  }

  function describe() {
    if (navigator.onLine === false) {
      title.textContent = "لا اتصال بالإنترنت الآن";
      lead.textContent = "سنعود تلقائياً حين يعود الاتصال";
      note.textContent = "";
    } else if (stuck()) {
      title.textContent = "نُحدّث البرنامج الآن ✨";
      lead.textContent = "يستغرق ذلك وقتاً أطول من المعتاد";
      note.textContent = "سنحاول مرّةً كل نصف دقيقة، ويمكنك المحاولة الآن.";
    } else {
      title.textContent = "نُحدّث البرنامج الآن ✨";
      lead.textContent = "لحظاتٍ ونعود";
      note.textContent = "ستُفتح الصفحة التي طلبتها تلقائياً حين نعود.";
    }
  }

  function wait() {
    if (stuck()) return PATIENT;
    return Math.min(CEILING, Math.round(FIRST * Math.pow(1.3, Math.max(0, tries - 5))));
  }
  function later() { clearTimeout(timer); timer = setTimeout(ask, wait()); }

  function ask() {
    clearTimeout(timer);
    if (asking) return;
    if (navigator.onLine === false) { describe(); later(); return; }
    asking = true;
    tries++;
    var control = typeof AbortController === "function" ? new AbortController() : null;
    var guard = setTimeout(function () { if (control) control.abort(); }, 8000);
    fetch(HEALTH, { cache: "no-store", credentials: "same-origin", signal: control ? control.signal : undefined })
      .then(function (response) { return response.ok; }, function () { return false; })
      .then(function (ok) {
        clearTimeout(guard);
        asking = false;
        if (ok) { reopen(); return; }
        describe();
        later();
      });
  }

  function start() {
    title = document.getElementById("title");
    lead = document.getElementById("lead");
    note = document.getElementById("note");
    document.getElementById("retry").addEventListener("click", function () {
      if (location.pathname === "/updating.html") location.replace("/");
      else location.reload();
    });
    window.addEventListener("online", function () { describe(); ask(); });
    window.addEventListener("offline", describe);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) ask(); });
    describe();
    later();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
