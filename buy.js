// Trang thanh toán: chọn gói -> nhập email (+ Mã máy) -> VietQR / PayPal / thẻ (Lemon Squeezy) -> báo đã thanh toán
(function () {
  const S = window.SHOP;
  const $ = (id) => document.getElementById(id);
  const lang = () => document.documentElement.lang === "vi" ? "vi" : "en";
  const fmtVnd = (n) => n.toLocaleString("vi-VN") + "đ";

  // Mã đơn hàng ngắn, giữ nguyên trong phiên để khớp nội dung chuyển khoản
  let order = "";
  try { order = sessionStorage.getItem("sm-order") || ""; } catch (e) { /* bỏ qua */ }
  if (!/^[A-Z0-9]{6}$/.test(order)) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    order = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % chars.length]).join("");
    try { sessionStorage.setItem("sm-order", order); } catch (e) { /* bỏ qua */ }
  }

  const params = new URLSearchParams(location.search);
  let plan = params.get("plan") === "lifetime" ? "lifetime" : "month";
  const iidParam = (params.get("iid") || "").toUpperCase();

  const email = () => $("f-email").value.trim();
  const validEmail = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email());
  const iid = () => $("f-iid").value.trim().toUpperCase();
  const transferMsg = () => `SCANMGR ${S.plans[plan].tag} ${order}`;

  function render() {
    const p = S.plans[plan];
    if (validEmail()) $("need-email").hidden = true;
    document.querySelectorAll("[data-plan-name]").forEach((el) => { el.textContent = S.plans[el.dataset.planName][lang()]; });
    document.querySelectorAll("[data-plan-price]").forEach((el) => {
      const q = S.plans[el.dataset.planPrice];
      el.textContent = `$${q.usd} · ${fmtVnd(q.vnd)}`;
    });
    $("plan-" + plan).checked = true;
    $("order-code").textContent = order;

    // VietQR: ảnh QR có sẵn số tiền + nội dung (dịch vụ img.vietqr.io)
    const qs = new URLSearchParams({ amount: p.vnd, addInfo: transferMsg(), accountName: S.bank.name });
    $("qr").src = `https://img.vietqr.io/image/${S.bank.code}-${S.bank.account}-compact2.png?${qs}`;
    $("b-branch").textContent = S.bank.branch;
    $("b-acc").textContent = S.bank.account;
    $("b-name").textContent = S.bank.name;
    $("b-amount").textContent = fmtVnd(p.vnd);
    $("b-msg").textContent = transferMsg();

    // PayPal: trang thanh toán chuẩn của PayPal (Buy Now)
    const pp = new URLSearchParams({
      cmd: "_xclick", business: S.paypalEmail, item_name: `Scan Manager ${p.en} #${order}`,
      item_number: order, amount: p.usd.toFixed(2), currency_code: "USD", no_shipping: "1",
      custom: email(), return: new URL("thanks.html", location.href).href
    });
    $("btn-paypal").href = "https://www.paypal.com/cgi-bin/webscr?" + pp;

    // Lemon Squeezy (nếu đã cấu hình)
    const lemon = S.lemon && S.lemon[plan];
    $("m-lemon").hidden = !lemon;
    if (lemon) {
      const u = new URL(lemon);
      if (validEmail()) u.searchParams.set("checkout[email]", email());
      u.searchParams.set("checkout[custom][lang]", lang());
      u.searchParams.set("checkout[custom][order]", order);
      $("btn-lemon").href = u.href;
    }

    // Thông tin đơn để gửi tác giả
    const lines = lang() === "vi"
      ? [`Mã đơn: ${order}`, `Gói: ${p.vi} (${fmtVnd(p.vnd)} / $${p.usd})`, `Email: ${email() || "(chưa nhập)"}`, `Mã máy: ${iid() || "(chưa có)"}`, `Nội dung CK: ${transferMsg()}`]
      : [`Order: ${order}`, `Plan: ${p.en} ($${p.usd} / ${fmtVnd(p.vnd)})`, `E-mail: ${email() || "(not entered)"}`, `Device ID: ${iid() || "(none)"}`, `Transfer message: ${transferMsg()}`];
    const sum = lines.join("\n");
    $("summary").textContent = sum;
    $("c-zalo").href = `https://zalo.me/${S.contact.zalo}`;
    $("c-tg").href = `https://t.me/${S.contact.telegram}`;
    $("c-mail").href = `mailto:${S.contact.email}?subject=${encodeURIComponent("Scan Manager Pro - " + order)}&body=${encodeURIComponent(sum)}`;
  }

  function copy(text, btn) {
    const done = () => { const old = btn.innerHTML; btn.textContent = "✓"; setTimeout(() => { btn.innerHTML = old; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }

  // Bắt buộc có email trước khi sang trang thanh toán (để gửi mã)
  function guard(e) {
    if (validEmail()) { $("need-email").hidden = true; return; }
    e.preventDefault();
    $("need-email").hidden = false;
    $("f-email").focus();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("input[name=plan]").forEach((r) => r.addEventListener("change", () => { plan = r.value; render(); }));
    if (/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(iidParam)) $("f-iid").value = iidParam; // mở từ extension
    ["f-email", "f-iid"].forEach((id) => $(id).addEventListener("input", render));
    ["btn-paypal", "btn-lemon"].forEach((id) => $(id).addEventListener("click", guard));
    document.querySelectorAll("[data-copy-id]").forEach((b) => b.addEventListener("click", () => copy($(b.dataset.copyId).textContent, b)));
    $("btn-copy-sum").addEventListener("click", (e) => copy($("summary").textContent, e.currentTarget));
    // Zalo/Telegram không điền sẵn được nội dung -> tự sao chép thông tin đơn để dán vào tin nhắn
    ["c-zalo", "c-tg"].forEach((id) => $(id).addEventListener("click", () => { if (navigator.clipboard) navigator.clipboard.writeText($("summary").textContent).catch(() => {}); }));
    document.querySelectorAll(".lang-switch button").forEach((b) => b.addEventListener("click", () => setTimeout(render, 0)));
    render();
  });
})();
