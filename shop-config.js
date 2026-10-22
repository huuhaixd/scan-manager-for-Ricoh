// CẤU HÌNH BÁN HÀNG CỦA TRANG WEB - chỉ cần sửa file này.
// - lemon.month / lemon.lifetime: link thanh toán Lemon Squeezy (thẻ quốc tế). Để trống = dùng PayPal + VietQR.
// - storeUrl: link Chrome Web Store sau khi được duyệt. Để trống = nút "Thêm vào Chrome" dẫn tới mục Liên hệ.
window.SHOP = {
  storeUrl: "",
  lemon: { month: "", lifetime: "" },
  paypalEmail: "huuhaixd@gmail.com",
  bank: { code: "BIDV", account: "2224319413", name: "PHAM HUU HAI", branch: "BIDV - PGD Nhân Chính" },
  plans: {
    month: { usd: 3, vnd: 79000, en: "Pro – 1 month", vi: "Pro – 1 tháng", tag: "M" },
    lifetime: { usd: 50, vnd: 1299000, en: "Lifetime – 1 computer", vi: "Trọn đời – 1 máy tính", tag: "L" }
  },
  contact: { telegram: "HUUHAIXD", email: "huuhaixd@gmail.com", zalo: "84971100958" }
};
