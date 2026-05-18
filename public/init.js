// Brand-critical bootstrap. Loaded by <Script src="/init.js" strategy="beforeInteractive">
// in app/layout.tsx so it runs before paint without inline-script CSP complexity.
//
// 1) Disable browser scroll restoration so deep-links always start at the top.
// 2) Set body[data-motion] from stored preference / OS preference so CSS selectors
//    are correct from the first frame (no CRT-effect flash for users with stored prefs).
history.scrollRestoration = "manual";
window.scrollTo(0, 0);
(function () {
  try {
    var m = localStorage.getItem("erik.motion");
    var on =
      m === "on"
        ? true
        : m === "off"
          ? false
          : !window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    document.body.dataset.motion = on ? "full" : "reduce";
  } catch (e) {}
})();
