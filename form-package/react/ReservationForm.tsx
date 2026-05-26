"use client";

import { useState, useEffect, useTransition, FormEvent } from "react";
import { getReservationClient } from "./supabaseClient";
import { isValidTrPhone, todayISO, getUtmFromUrl } from "./utils";
import type { SiteName, ReservationRequestPayload } from "./types";

export interface ReservationFormProps {
  /** Required: hangi siteden gönderildiği */
  siteName: SiteName;
  /** Apart/villa detay sayfasındaysak slug; ana sayfa formunda null */
  propertySlug?: string | null;
  /** WhatsApp deep-link için (+ ve boşluk olmadan) */
  whatsappNumber?: string;
  /** "/kvkk" gibi local link */
  kvkkUrl?: string;
  /** Form modal içinde mi açılıyor? Compact varyantı küçültür */
  compact?: boolean;
  /** Manuel override (env yoksa) */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Submit başarılı olunca tetiklenir (lead tracking için) */
  onSuccess?: (payload: ReservationRequestPayload) => void;
  /** Submit başarısız olursa */
  onError?: (err: unknown) => void;
  className?: string;
}

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; payload: ReservationRequestPayload }
  | { status: "error"; message: string };

export function ReservationForm({
  siteName,
  propertySlug = null,
  whatsappNumber = "",
  kvkkUrl = "/kvkk",
  compact = false,
  supabaseUrl,
  supabaseAnonKey,
  onSuccess,
  onError,
  className = "",
}: ReservationFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState(2);
  const [region, setRegion] = useState("");
  const [message, setMessage] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const [utm, setUtm] = useState({
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
  });

  useEffect(() => {
    setUtm(getUtmFromUrl());
  }, []);

  const minCheckin = todayISO();
  const minCheckout = checkin || minCheckin;

  function showError(msg: string) {
    setState({ status: "error", message: msg });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !checkin || !checkout) {
      return showError("Lütfen zorunlu alanları doldurun.");
    }
    if (!isValidTrPhone(phone)) {
      return showError("Lütfen geçerli bir telefon numarası girin.");
    }
    if (new Date(checkout) <= new Date(checkin)) {
      return showError("Çıkış tarihi, giriş tarihinden sonra olmalı.");
    }
    if (!kvkk) {
      return showError("Devam etmek için KVKK onayı vermelisiniz.");
    }

    const payload: ReservationRequestPayload = {
      source_site: siteName,
      property_slug: propertySlug,
      guest_name: name.trim(),
      guest_phone: phone.trim(),
      guest_email: email.trim() || null,
      check_in: checkin,
      check_out: checkout,
      guests_count: guests,
      region: region.trim() || null,
      message: message.trim() || null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : undefined,
    };

    // Honeypot — pretend success but never call API
    if (honeypot) {
      setState({ status: "success", payload });
      return;
    }

    setState({ status: "submitting" });
    startTransition(async () => {
      try {
        const client = getReservationClient(supabaseUrl, supabaseAnonKey);
        const { error } = await client.from("reservation_requests").insert(payload);
        if (error) throw error;
        setState({ status: "success", payload });
        onSuccess?.(payload);
      } catch (err) {
        console.error("[ReservationForm]", err);
        onError?.(err);
        showError("Bir sorun oluştu, lütfen tekrar deneyin.");
      }
    });
  }

  if (state.status === "success") {
    const waText = encodeURIComponent(
      `Merhaba, ${siteName} sitesinden rezervasyon talebim var.\n` +
        `Ad: ${state.payload.guest_name}\n` +
        `Tarih: ${state.payload.check_in} → ${state.payload.check_out}\n` +
        `Kişi: ${state.payload.guests_count}`
    );
    return (
      <div className={`rf-card rf-success ${className}`}>
        <div className="rf-success-icon" aria-hidden>✓</div>
        <h3>Talebiniz alındı</h3>
        <p>1 saat içinde sizinle iletişime geçeceğiz. Aceleniz varsa WhatsApp'tan da yazabilirsiniz.</p>
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rf-btn rf-btn-secondary"
          >
            WhatsApp'tan yaz
          </a>
        )}
        <Styles />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={`rf-card ${className}`}>
      <h3 className="rf-title">Rezervasyon Talebi</h3>
      <p className="rf-sub">
        Formu doldurun, 1 saat içinde dönüş yapalım.
      </p>

      <div className="rf-row">
        <label className="rf-label">Ad Soyad *</label>
        <input
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rf-input"
        />
      </div>

      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label">Telefon *</label>
          <input
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+90 5xx xxx xx xx"
            className="rf-input"
          />
        </div>
        <div className="rf-row">
          <label className="rf-label">E-posta</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rf-input"
          />
        </div>
      </div>

      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label">Giriş tarihi *</label>
          <input
            type="date"
            required
            min={minCheckin}
            value={checkin}
            onChange={(e) => setCheckin(e.target.value)}
            className="rf-input"
          />
        </div>
        <div className="rf-row">
          <label className="rf-label">Çıkış tarihi *</label>
          <input
            type="date"
            required
            min={minCheckout}
            value={checkout}
            onChange={(e) => setCheckout(e.target.value)}
            className="rf-input"
          />
        </div>
      </div>

      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label">Kişi</label>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="rf-input"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="rf-row">
          <label className="rf-label">Bölge (opsiyonel)</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rf-input"
            placeholder="Gümbet, Yalıkavak…"
          />
        </div>
      </div>

      {!compact && (
        <div className="rf-row">
          <label className="rf-label">Mesaj (opsiyonel)</label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rf-input"
            placeholder="Özel istekleriniz…"
          />
        </div>
      )}

      <label className="rf-kvkk">
        <input
          type="checkbox"
          required
          checked={kvkk}
          onChange={(e) => setKvkk(e.target.checked)}
        />
        <span>
          Kişisel verilerimin{" "}
          <a href={kvkkUrl} target="_blank" rel="noopener noreferrer">
            KVKK Aydınlatma Metni
          </a>
          'ne uygun şekilde işlenmesini onaylıyorum.
        </span>
      </label>

      <input
        type="text"
        name="_company"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="rf-honeypot"
        aria-hidden
      />

      {state.status === "error" && (
        <div className="rf-error" role="alert">
          {state.message}
        </div>
      )}

      <button type="submit" disabled={pending || state.status === "submitting"} className="rf-btn">
        {pending || state.status === "submitting" ? "Gönderiliyor…" : "Talep Gönder"}
      </button>

      <Styles />
    </form>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .rf-card {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #fff;
        color: #0f1f26;
        border: 1px solid #e3ecef;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 6px 24px -16px rgba(5, 60, 74, 0.25);
      }
      .rf-card * { box-sizing: border-box; }
      .rf-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .rf-sub { font-size: 12px; color: #5c6b73; margin: 0 0 16px; }
      .rf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .rf-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
      .rf-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #5c6b73; }
      .rf-input { width: 100%; padding: 10px 12px; border: 1px solid #c8d8dc; background: #fff; color: #0f1f26; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s; }
      .rf-input:focus { border-color: #1e8a9c; box-shadow: 0 0 0 3px rgba(30, 138, 156, 0.15); }
      textarea.rf-input { resize: vertical; min-height: 72px; }
      .rf-honeypot { position: absolute; left: -9999px; opacity: 0; pointer-events: none; }
      .rf-kvkk { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: #5c6b73; margin-bottom: 10px; }
      .rf-kvkk input { margin-top: 2px; }
      .rf-kvkk a { color: #1e8a9c; font-weight: 600; }
      .rf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 12px 16px; border: 0; border-radius: 999px; background: #f26a1e; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.15s; margin-top: 4px; }
      .rf-btn:hover { background: #c24a0d; }
      .rf-btn:disabled { opacity: 0.6; cursor: wait; }
      .rf-btn-secondary { background: #1e8a9c; }
      .rf-btn-secondary:hover { background: #0e5f70; }
      .rf-error { color: #a32d2d; font-size: 12px; margin: 8px 0 4px; }
      .rf-success { padding: 28px; text-align: center; }
      .rf-success-icon { width: 48px; height: 48px; border-radius: 50%; background: #0f6e56; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 12px; }
      .rf-success h3 { margin: 0 0 6px; font-size: 18px; }
      .rf-success p { margin: 0 0 16px; font-size: 13px; color: #5c6b73; }
      @media (max-width: 480px) { .rf-grid { grid-template-columns: 1fr; } }
    `}</style>
  );
}
