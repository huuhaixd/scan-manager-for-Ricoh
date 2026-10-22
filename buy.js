// Trang thanh toán: chọn gói → email (+ Mã máy) → máy chủ tạo đơn chờ → VietQR / PayPal / thẻ
// → trang tự hỏi máy chủ, khi tiền về (PayPal IPN / webhook ngân hàng / chủ shop xác nhận) thì hiện mã.
(function () {
  const S = window.SHOP;
  const $ = (id) => document.getElementById(id);
  const lang = () => document.documentElement.lang === "vi" ? "vi" : "en";
  const fmtVnd = (n) => Number(n).toLocaleString("vi-VN") + "đ";
  const params = new URLSearchParams(location.search);
  let plan = params.get("plan") === "lifetime" ? "lifetime" : "month";
  const iidParam = (params.get("iid") || "").toUpperCase();
  let order = null; // phản hồi create_order của máy chủ
  let pollTimer = null;

  const email = () => $("f-email").value.trim();
  const validEmail = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email());
  const iid = () => $("f-iid").value.trim().toUpperCase();
  const validIid = () => /^[0-9A-F]{4}(-?[0-9A-F]{4}){3}$/.test(iid());
  const serverPlan = () => (plan === "lifetime" ? "lifetime" : "pro");

  async function api(body) {
    const resp = await fetch(S.server, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return resp.json();
  }

  function renderPlans() {
    document.querySelectorAll("[data-plan-name]").forEach((el) => { el.textContent = S.plans[el.dataset.planName][lang()]; });
    document.querySelectorAll("[data-plan-price]").forEach((el) => {
      const q = S.plans[el.dataset.planPrice];
      el.textContent = `$${q.usd} · ${fmtVnd(q.vnd)}`;
    });
    $("plan-" + plan).checked = true;
  }

  function renderPay() {
    if (!order) return;
    const p = S.plans[plan];
    $("order-code").textContent = order.order;
    const vnd = order.amountVnd || p.vnd, usd = order.amountUsd || p.usd;
    // VietQR có sẵn số tiền + nội dung "SCANMGR M|L <mã đơn>" (máy chủ nhận diện khi tiền về)
    const qs = new URLSearchParams({ amount: vnd, addInfo: order.transfer, accountName: S.bank.name });
    $("qr").src = `https://img.vietqr.io/image/${S.bank.code}-${S.bank.account}-compact2.png?${qs}`;
    $("b-branch").textContent = S.bank.branch;
    $("b-acc").textContent = S.bank.account;
    $("b-name").textContent = S.bank.name;
    $("b-amount").textContent = fmtVnd(vnd);
    $("b-msg").textContent = order.transfer;
    // PayPal Buy Now + IPN báo về máy chủ (notify_url) → xác nhận tự động
    const pp = new URLSearchParams({
      cmd: "_xclick", business: order.paypalEmail || S.paypalEmail, item_name: `Scan Manager ${p.en} #${order.order}`,
      item_number: order.order, custom: order.order, amount: Number(usd).toFixed(2), currency_code: "USD", no_shipping: "1",
      return: new URL("buy.html?order=" + order.order + "&lang=" + lang(), location.href).href,
      cancel_return: location.href
    });
    if (order.notifyUrl) pp.set("notify_url", order.notifyUrl);
    $("btn-paypal").href = "https://www.paypal.com/cgi-bin/webscr?" + pp;
    // Thẻ (Lemon Squeezy) nếu đã cấu hình
    const lemon = S.lemon && S.lemon[plan];
    $("m-lemon").hidden = !lemon;
    if (lemon) {
      const u = new URL(lemon);
      u.searchParams.set("checkout[email]", email());
      u.searchParams.set("checkout[custom][lang]", lang());
      u.searchParams.set("checkout[custom][order]", order.order);
      if (validIid()) u.searchParams.set("checkout[custom][iid]", iid());
      $("btn-lemon").href = u.href;
    }
    renderSummary();
  }

  function renderSummary() {
    if (!order) return;
    const p = S.plans[plan];
    const sum = (lang() === "vi"
      ? [`Mã đơn: ${order.order}`, `Gói: ${p.vi}`, `Email: ${email()}`, `Mã máy: ${iid() || "(không có)"}`, `Nội dung CK: ${order.transfer}`]
      : [`Order: ${order.order}`, `Plan: ${p.en}`, `E-mail: ${email()}`, `Device ID: ${iid() || "(none)"}`, `Transfer message: ${order.transfer}`]).join("\n");
    $("summary").textContent = sum;
    $("c-zalo").href = `https://zalo.me/${S.contact.zalo}`;
    $("c-tg").href = `https://t.me/${S.contact.telegram}`;
    $("c-mail").href = `mailto:${S.contact.email}?subject=${encodeURIComponent("Scan Manager Pro - " + order.order)}&body=${encodeURIComponent(sum)}`;
  }

  function showError(msgVi, msgEn) {
    const el = $("order-error");
    el.textContent = lang() === "vi" ? msgVi : msgEn;
    el.hidden = false;
  }

  async function createOrder() {
    $("order-error").hidden = true;
    if (!validEmail()) { $("need-email").hidden = false; $("f-email").focus(); return; }
    $("need-email").hidden = true;
    const btn = $("btn-create");
    btn.disabled = true;
    try {
      const r = await api({ action: "create_order", plan: serverPlan(), email: email(), iid: validIid() ? iid() : "", method: "vietqr", lang: lang() });
      if (!r.ok) {
        if (r.error === "too_many_orders") showError("Email này đang có quá nhiều đơn chờ. Vui lòng liên hệ tác giả.", "Too many pending orders for this e-mail. Please contact us.");
        else showError("Không tạo được đơn. Vui lòng thử lại.", "Could not create the order. Please try again.");
        return;
      }
      order = r;
      try { sessionStorage.setItem("sm-order", JSON.stringify({ order: r, plan, email: email(), iid: iid() })); } catch (e) { /* bỏ qua */ }
      startPayment();
    } catch (e) {
      showError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", "Cannot reach the server. Check your connection and try again.");
    } finally {
      btn.disabled = false;
    }
  }

  function startPayment() {
    $("step-pay").hidden = false;
    $("step-help").hidden = false;
    $("btn-create").hidden = true;
    ["f-email", "f-iid"].forEach((id) => { $(id).readOnly = true; });
    document.querySelectorAll("input[name=plan]").forEach((r) => { r.disabled = true; });
    renderPay();
    let rep = "";
    try { rep = sessionStorage.getItem("sm-reported") || ""; } catch (e) { /* bỏ qua */ }
    if (rep === order.order) { $("btn-reported").hidden = true; $("reported-note").hidden = false; }
    $("step-pay").scrollIntoView({ behavior: "smooth", block: "start" });
    poll();
  }

  // Hỏi máy chủ mỗi 8 giây xem đơn đã được xác nhận chưa (dừng sau 2 giờ)
  async function poll() {
    clearTimeout(pollTimer);
    if (!order) return;
    try {
      const r = await api({ action: "order_status", order: order.order });
      if (r.ok && r.status === "paid") return showPaid(r);
      if (r.ok && r.status === "expired") return;
    } catch (e) { /* mạng chập chờn - thử lại */ }
    if (Date.now() - (order.startedAt || (order.startedAt = Date.now())) < 2 * 3600000) pollTimer = setTimeout(poll, 8000);
  }

  // Khách bấm "Tôi đã chuyển khoản" → máy chủ gửi email ưu tiên cho tác giả kiểm tra BIDV
  async function reportPaid() {
    if (!order) return;
    const btn = $("btn-reported");
    btn.disabled = true;
    try {
      const r = await api({ action: "report_paid", order: order.order });
      if (r.ok && r.status === "paid") return poll();
      $("reported-note").hidden = false;
      btn.hidden = true;
      try { sessionStorage.setItem("sm-reported", order.order); } catch (e) { /* bỏ qua */ }
    } catch (e) {
      btn.disabled = false;
    }
  }

  function showPaid(r) {
    $("step-pay").hidden = true;
    $("step-help").hidden = true;
    $("step-done").hidden = false;
    $("done-key").textContent = r.key || "";
    document.querySelectorAll(".auto-on").forEach((el) => { el.hidden = !r.autoActivate; });
    try { sessionStorage.removeItem("sm-order"); } catch (e) { /* bỏ qua */ }
    $("step-done").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copy(text, btn) {
    const done = () => { const old = btn.innerHTML; btn.textContent = "✓"; setTimeout(() => { btn.innerHTML = old; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(iidParam)) $("f-iid").value = iidParam; // mở từ extension
    renderPlans();
    document.querySelectorAll("input[name=plan]").forEach((r) => r.addEventListener("change", () => { plan = r.value; renderPlans(); }));
    $("btn-create").addEventListener("click", createOrder);
    $("btn-reported").addEventListener("click", reportPaid);
    $("f-email").addEventListener("keydown", (e) => { if (e.key === "Enter") createOrder(); });
    document.querySelectorAll("[data-copy-id]").forEach((b) => b.addEventListener("click", () => copy($(b.dataset.copyId).textContent, b)));
    $("btn-copy-sum").addEventListener("click", (e) => copy($("summary").textContent, e.currentTarget));
    ["c-zalo", "c-tg"].forEach((id) => $(id).addEventListener("click", () => { if (navigator.clipboard) navigator.clipboard.writeText($("summary").textContent).catch(() => {}); }));
    document.querySelectorAll(".lang-switch button").forEach((b) => b.addEventListener("click", () => setTimeout(() => { renderPlans(); renderPay(); }, 0)));

    // Quay lại trang (VD từ PayPal) → khôi phục đơn đang chờ
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem("sm-order") || "null"); } catch (e) { /* bỏ qua */ }
    const back = params.get("order");
    if (saved && saved.order && (!back || back === saved.order.order)) {
      order = saved.order; plan = saved.plan; $("f-email").value = saved.email; $("f-iid").value = saved.iid || "";
      renderPlans(); startPayment();
    } else if (back) {
      try { const r = await api({ action: "order_status", order: back }); if (r.ok && r.status === "paid") showPaid(r); } catch (e) { /* bỏ qua */ }
    }
  });
})();
