(function () {
  const root = document.documentElement;
  const normalize = value => (value === "dark" ? "dark" : "light");
  function apply(theme) {
    const next = normalize(theme);
    root.dataset.dcTheme = next;
    root.setAttribute("theme-mode", next);
    root.style.colorScheme = next;
    try { localStorage.setItem("dc-tank-theme", next); } catch (error) {}
    window.dispatchEvent(new CustomEvent("drivecenter:theme", { detail: next }));
    return next;
  }
  const requested = new URLSearchParams(location.search).get("dcTheme");
  let saved = null;
  try { saved = localStorage.getItem("dc-tank-theme"); } catch (error) {}
  apply(requested || saved || "light");
  window.driveCenterTankTheme = apply;
  window.addEventListener("message", event => {
    if (!event.data || event.data.source !== "drivecenter" || event.data.type !== "theme") return;
    apply(event.data.theme);
  });
})();
