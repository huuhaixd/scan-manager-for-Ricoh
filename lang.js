// Chuyển ngôn ngữ trang (en/vi) - nhớ lựa chọn, mặc định theo trình duyệt
(function () {
  const saved = (function () { try { return localStorage.getItem("sm-lang"); } catch (e) { return null; } })();
  const fromUrl = new URLSearchParams(location.search).get("lang");
  const lang = fromUrl || saved || ((navigator.language || "en").toLowerCase().startsWith("vi") ? "vi" : "en");
  function set(l) {
    document.documentElement.lang = l;
    document.querySelectorAll(".lang-switch button").forEach(b => b.classList.toggle("on", b.dataset.l === l));
    try { localStorage.setItem("sm-lang", l); } catch (e) { /* bỏ qua */ }
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lang-switch button").forEach(b => b.addEventListener("click", () => set(b.dataset.l)));
    set(lang === "vi" ? "vi" : "en");
  });
})();
