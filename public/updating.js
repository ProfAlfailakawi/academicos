// صفحة «النظام قيد التحديث» (public/updating.html): سكربتها في ملفٍّ خارجي لأن سياسة
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
  var title, lead, note, step, stepEn;

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

  /* السطرُ الرئيس عربي وتحته سطرٌ إنجليزي صغير؛ وخطوةُ السجلّ الجارية تتبع الحالة. */
  function show(state) {
    title.textContent = state[0];
    lead.textContent = state[1];
    if (step) step.textContent = state[2];
    if (stepEn) stepEn.textContent = state[3];
    note.textContent = state[4];
  }

  function describe() {
    if (navigator.onLine === false) {
      show(["الجهاز غير متصل بالشبكة", "Device offline · resumes on reconnect",
        "انتظار عودة الشبكة", "waiting for network",
        "يُستأنف الفحص تلقائياً عند عودة الاتصال."]);
    } else if (stuck()) {
      show(["التحديث يستغرق وقتاً أطول من المعتاد", "Update taking longer than usual",
        "فحص جاهزية الخادم كل نصف دقيقة", "health check · every 30 s",
        "نواصل الفحص دون تدخّل منك، ولك أن تعيد الاتصال الآن."]);
    } else {
      show(["النظام قيد التحديث", "AcademicOS is restarting on a new version",
        "تشغيل الخادم وفحص جاهزيته", "starting server · health check",
        "تعود إلى صفحتك نفسها حين يكتمل التشغيل، دون أيّ إجراءٍ منك."]);
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
    step = document.getElementById("step");
    stepEn = document.getElementById("stepEn");
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
