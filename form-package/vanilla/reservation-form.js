/**
 * Bodrum Rezervasyon Form — Vanilla JS implementation
 *
 * Usage (GitHub Pages / static HTML):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="/path/to/reservation-form.js"></script>
 *   <div id="reservation-form"></div>
 *   <script>
 *     BodrumReservationForm.mount({
 *       el: '#reservation-form',
 *       supabaseUrl: 'https://YOUR.supabase.co',
 *       supabaseAnonKey: 'YOUR_ANON_KEY',
 *       sourceSite: 'bodrumacilsu',
 *       propertySlug: null,          // veya 'gumbet-deniz-manzarali-1-1'
 *       whatsappNumber: '905385124088',
 *       theme: 'light',              // 'light' | 'dark'
 *       compact: false,              // modal versiyonu için true
 *       kvkkUrl: '/kvkk',
 *     });
 *   </script>
 *
 * Tüm UI bu dosya içinde inline CSS ile gelir; mevcut site stilini etkilemez.
 */
(function (global) {
  "use strict";

  // ----- Helpers -----------------------------------------------------------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style" && typeof attrs[k] === "object") {
          Object.assign(node.style, attrs[k]);
        } else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === "class") {
          node.className = attrs[k];
        } else if (k === "html") {
          node.innerHTML = attrs[k];
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function getUtm() {
    try {
      var qs = new URLSearchParams(global.location.search);
      return {
        utm_source: qs.get("utm_source"),
        utm_medium: qs.get("utm_medium"),
        utm_campaign: qs.get("utm_campaign"),
      };
    } catch (_e) {
      return { utm_source: null, utm_medium: null, utm_campaign: null };
    }
  }

  function isValidTrPhone(s) {
    if (!s) return false;
    var n = s.replace(/[\s().-]/g, "");
    // +90 5xx xxxx, 0 5xx xxxx, or international (+xx)
    if (/^\+?90?5\d{9}$/.test(n)) return true;     // TR
    if (/^05\d{9}$/.test(n)) return true;
    if (/^\+\d{8,15}$/.test(n)) return true;       // international
    return false;
  }

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // ----- Styles ------------------------------------------------------------

  var CSS = "\n" +
    ".brf{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F1F26}\n" +
    ".brf *{box-sizing:border-box}\n" +
    ".brf-card{background:#fff;border:1px solid #E3ECEF;border-radius:16px;padding:20px;box-shadow:0 6px 24px -16px rgba(5,60,74,.25)}\n" +
    ".brf-dark .brf-card{background:#0E5F70;color:#fff;border-color:rgba(255,255,255,.15)}\n" +
    ".brf-title{font-size:18px;font-weight:700;margin:0 0 4px;letter-spacing:-.01em}\n" +
    ".brf-sub{font-size:12px;color:#5C6B73;margin:0 0 16px}\n" +
    ".brf-dark .brf-sub{color:rgba(255,255,255,.7)}\n" +
    ".brf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n" +
    ".brf-row{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}\n" +
    ".brf-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#5C6B73}\n" +
    ".brf-dark .brf-label{color:rgba(255,255,255,.65)}\n" +
    ".brf-input,.brf-select,.brf-textarea{width:100%;padding:10px 12px;border:1px solid #C8D8DC;background:#fff;color:#0F1F26;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s}\n" +
    ".brf-input:focus,.brf-select:focus,.brf-textarea:focus{border-color:#1E8A9C;box-shadow:0 0 0 3px rgba(30,138,156,.15)}\n" +
    ".brf-textarea{resize:vertical;min-height:72px}\n" +
    ".brf-honeypot{position:absolute;left:-9999px;opacity:0;pointer-events:none}\n" +
    ".brf-kvkk{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#5C6B73}\n" +
    ".brf-kvkk input{margin-top:2px}\n" +
    ".brf-kvkk a{color:#1E8A9C;font-weight:600}\n" +
    ".brf-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px 16px;border:0;border-radius:999px;background:#F26A1E;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:background .15s}\n" +
    ".brf-btn:hover{background:#C24A0D}\n" +
    ".brf-btn:disabled{opacity:.6;cursor:wait}\n" +
    ".brf-btn-secondary{background:#1E8A9C;color:#fff}\n" +
    ".brf-btn-secondary:hover{background:#0E5F70}\n" +
    ".brf-error{color:#A32D2D;font-size:12px;margin-top:6px}\n" +
    ".brf-success{padding:24px;text-align:center}\n" +
    ".brf-success-icon{width:48px;height:48px;border-radius:50%;background:#0F6E56;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:12px}\n" +
    ".brf-success h3{margin:0 0 6px;font-size:18px}\n" +
    ".brf-success p{margin:0 0 16px;font-size:13px;color:#5C6B73}\n" +
    "@media(max-width:480px){.brf-grid{grid-template-columns:1fr}}\n";

  function ensureStyles() {
    if (document.getElementById("brf-style")) return;
    var s = document.createElement("style");
    s.id = "brf-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ----- Mount -------------------------------------------------------------

  var STRINGS = {
    title: "Rezervasyon Talebi",
    subtitle: "Formu doldurun, 1 saat içinde size dönüş yapalım.",
    name: "Ad Soyad",
    phone: "Telefon",
    email: "E-posta",
    checkin: "Giriş tarihi",
    checkout: "Çıkış tarihi",
    guests: "Kişi",
    region: "Bölge (opsiyonel)",
    message: "Mesaj (opsiyonel)",
    submit: "Talep Gönder",
    submitting: "Gönderiliyor...",
    kvkk: "Kişisel verilerimin",
    kvkkLink: "KVKK Aydınlatma Metni",
    kvkkSuffix: "'ne uygun şekilde işlenmesini onaylıyorum.",
    errPhone: "Lütfen geçerli bir telefon numarası girin",
    errRequired: "Lütfen zorunlu alanları doldurun",
    errKvkk: "Devam etmek için KVKK onayı vermelisiniz",
    errSubmit: "Bir sorun oluştu, lütfen tekrar deneyin",
    successTitle: "Talebiniz alındı",
    successBody: "1 saat içinde sizinle iletişime geçeceğiz. Aceleniz varsa WhatsApp'tan da yazabilirsiniz.",
    whatsapp: "WhatsApp'tan yaz",
  };

  function mount(opts) {
    if (!opts || !opts.el) throw new Error("BodrumReservationForm: 'el' is required");
    var target = typeof opts.el === "string" ? document.querySelector(opts.el) : opts.el;
    if (!target) throw new Error("BodrumReservationForm: target not found");
    if (!opts.supabaseUrl || !opts.supabaseAnonKey) {
      throw new Error("BodrumReservationForm: supabaseUrl and supabaseAnonKey are required");
    }
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error("BodrumReservationForm: supabase-js is not loaded. Include @supabase/supabase-js UMD before this script.");
    }
    ensureStyles();

    var theme = opts.theme === "dark" ? "brf-dark" : "";
    var sourceSite = opts.sourceSite;
    var propertySlug = opts.propertySlug || null;
    var whatsappNumber = (opts.whatsappNumber || "").replace(/\D/g, "");
    var kvkkUrl = opts.kvkkUrl || "/kvkk";
    var strings = Object.assign({}, STRINGS, opts.strings || {});

    var client = global.supabase.createClient(opts.supabaseUrl, opts.supabaseAnonKey, {
      auth: { persistSession: false },
    });

    var root = el("div", { class: "brf " + theme });
    target.innerHTML = "";
    target.appendChild(root);

    renderForm();

    function renderForm() {
      var utm = getUtm();
      var errBox = el("div", { class: "brf-error", style: { display: "none" } });
      var phoneInput = el("input", { class: "brf-input", type: "tel", required: "required", autocomplete: "tel", placeholder: "+90 5xx xxx xx xx" });
      var nameInput = el("input", { class: "brf-input", type: "text", required: "required", autocomplete: "name" });
      var emailInput = el("input", { class: "brf-input", type: "email", autocomplete: "email" });
      var checkinInput = el("input", { class: "brf-input", type: "date", required: "required", min: todayISO() });
      var checkoutInput = el("input", { class: "brf-input", type: "date", required: "required", min: todayISO() });
      var guestsInput = el("select", { class: "brf-select" }, [1,2,3,4,5,6,7,8].map(function (n) {
        return el("option", { value: String(n) }, [String(n)]);
      }));
      guestsInput.value = "2";
      var regionInput = el("input", { class: "brf-input", type: "text" });
      var messageInput = el("textarea", { class: "brf-textarea", rows: "3" });
      var kvkkCheck = el("input", { type: "checkbox", required: "required" });
      var honeypot = el("input", { class: "brf-honeypot", type: "text", name: "_company", tabindex: "-1", autocomplete: "off" });
      var submitBtn = el("button", { class: "brf-btn", type: "submit" }, [strings.submit]);

      checkinInput.addEventListener("change", function () {
        checkoutInput.min = checkinInput.value || todayISO();
      });

      var form = el("form", {
        class: "brf-card",
        novalidate: "novalidate",
        onSubmit: function (e) {
          e.preventDefault();
          submit();
        },
      }, [
        el("h3", { class: "brf-title" }, [strings.title]),
        el("p",  { class: "brf-sub" },  [strings.subtitle]),
        el("div", { class: "brf-row" }, [
          el("label", { class: "brf-label" }, [strings.name + " *"]),
          nameInput,
        ]),
        el("div", { class: "brf-grid" }, [
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.phone + " *"]),
            phoneInput,
          ]),
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.email]),
            emailInput,
          ]),
        ]),
        el("div", { class: "brf-grid" }, [
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.checkin + " *"]),
            checkinInput,
          ]),
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.checkout + " *"]),
            checkoutInput,
          ]),
        ]),
        el("div", { class: "brf-grid" }, [
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.guests]),
            guestsInput,
          ]),
          el("div", { class: "brf-row" }, [
            el("label", { class: "brf-label" }, [strings.region]),
            regionInput,
          ]),
        ]),
        el("div", { class: "brf-row" }, [
          el("label", { class: "brf-label" }, [strings.message]),
          messageInput,
        ]),
        el("label", { class: "brf-kvkk" }, [
          kvkkCheck,
          el("span", { html: strings.kvkk + " <a href=\"" + kvkkUrl + "\" target=\"_blank\" rel=\"noopener\">" + strings.kvkkLink + "</a>" + strings.kvkkSuffix }),
        ]),
        errBox,
        honeypot,
        submitBtn,
      ]);

      root.innerHTML = "";
      root.appendChild(form);

      function showError(msg) {
        errBox.textContent = msg;
        errBox.style.display = "block";
      }
      function hideError() {
        errBox.textContent = "";
        errBox.style.display = "none";
      }

      function submit() {
        hideError();
        if (!nameInput.value.trim() || !phoneInput.value.trim() || !checkinInput.value || !checkoutInput.value) {
          showError(strings.errRequired);
          return;
        }
        if (!isValidTrPhone(phoneInput.value)) {
          showError(strings.errPhone);
          return;
        }
        if (!kvkkCheck.checked) {
          showError(strings.errKvkk);
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = strings.submitting;

        var payload = {
          source_site: sourceSite,
          property_slug: propertySlug,
          guest_name: nameInput.value.trim(),
          guest_phone: phoneInput.value.trim(),
          guest_email: emailInput.value.trim() || null,
          check_in: checkinInput.value,
          check_out: checkoutInput.value,
          guests_count: parseInt(guestsInput.value, 10),
          region: regionInput.value.trim() || null,
          message: messageInput.value.trim() || null,
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          user_agent: navigator.userAgent.slice(0, 250),
        };

        // honeypot
        if (honeypot.value) {
          // Pretend success to avoid signaling to bots
          renderSuccess(payload);
          return;
        }

        client
          .from("reservation_requests")
          .insert(payload)
          .then(function (res) {
            if (res.error) {
              console.error("[brf]", res.error);
              showError(strings.errSubmit);
              submitBtn.disabled = false;
              submitBtn.textContent = strings.submit;
              return;
            }
            renderSuccess(payload);
            if (typeof opts.onSuccess === "function") opts.onSuccess(payload);
          })
          .catch(function (err) {
            console.error("[brf]", err);
            showError(strings.errSubmit);
            submitBtn.disabled = false;
            submitBtn.textContent = strings.submit;
          });
      }
    }

    function renderSuccess(payload) {
      var waText = encodeURIComponent(
        "Merhaba, " + payload.source_site + " sitesinden rezervasyon talebim var.\n" +
          "Ad: " + payload.guest_name + "\n" +
          "Tarih: " + payload.check_in + " → " + payload.check_out + "\n" +
          "Kişi: " + payload.guests_count
      );
      var waUrl = whatsappNumber ? "https://wa.me/" + whatsappNumber + "?text=" + waText : null;

      var success = el("div", { class: "brf-card brf-success" }, [
        el("div", { class: "brf-success-icon" }, ["✓"]),
        el("h3", null, [strings.successTitle]),
        el("p", null, [strings.successBody]),
        waUrl
          ? el("a", { class: "brf-btn brf-btn-secondary", href: waUrl, target: "_blank", rel: "noopener" }, [strings.whatsapp])
          : null,
      ]);
      root.innerHTML = "";
      root.appendChild(success);
    }
  }

  global.BodrumReservationForm = { mount: mount, version: "1.0.0" };
})(typeof window !== "undefined" ? window : globalThis);
