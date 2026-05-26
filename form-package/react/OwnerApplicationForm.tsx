"use client";

import { useState, useEffect, useTransition, FormEvent } from "react";
import { getReservationClient } from "./supabaseClient";
import { isValidTrPhone, getUtmFromUrl } from "./utils";
import type { SiteName } from "./types";

export interface OwnerApplicationFormProps {
  /** "bodrumapartkiralama" or "bodrumapartvilla" */
  siteName: Extract<SiteName, "bodrumapartkiralama" | "bodrumapartvilla">;
  whatsappNumber?: string;
  kvkkUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  onSuccess?: () => void;
  className?: string;
  /** if true, tone of strings shifts toward "luxury" — used by bodrumapartvilla */
  tone?: "family" | "luxury";
}

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

interface Payload {
  source_site: string;
  name: string;
  phone: string;
  email: string | null;
  region: string | null;
  property_type: string | null;
  property_count: number;
  currently_renting: "yes" | "no" | "planning" | null;
  current_channels: string[];
  ownership_duration: string | null;
  message: string | null;
  referral_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  user_agent?: string;
}

const REGIONS = [
  "Gümbet",
  "Turgutreis",
  "Yalıkavak",
  "Bitez",
  "Ortakent",
  "Gündoğan",
  "Torba",
  "Türkbükü",
  "Yalı",
  "Akyarlar",
  "Gümüşlük",
  "Diğer",
];

const CHANNELS = ["Airbnb", "Booking", "Direkt", "Diğer komisyoncu", "Hiçbiri"];

export function OwnerApplicationForm({
  siteName,
  whatsappNumber = "905385124088",
  kvkkUrl = "/kvkk",
  supabaseUrl,
  supabaseAnonKey,
  onSuccess,
  className = "",
  tone = "family",
}: OwnerApplicationFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [propertyCount, setPropertyCount] = useState(1);
  const [currentlyRenting, setCurrentlyRenting] = useState<"yes" | "no" | "planning" | "">("");
  const [channels, setChannels] = useState<string[]>([]);
  const [ownershipDuration, setOwnershipDuration] = useState("");
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
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    setUtm(getUtmFromUrl());
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const ref = qs.get("ref");
      if (ref) {
        setReferralCode(ref);
        try {
          localStorage.setItem("owner_referral_code", ref);
        } catch {}
      } else {
        try {
          const stored = localStorage.getItem("owner_referral_code");
          if (stored) setReferralCode(stored);
        } catch {}
      }
    }
  }, []);

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function showError(message: string) {
    setState({ status: "error", message });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return showError("Lütfen ad ve telefonu doldurun.");
    if (!isValidTrPhone(phone)) return showError("Lütfen geçerli bir telefon numarası girin.");
    if (!kvkk) return showError("Devam etmek için KVKK onayı vermelisiniz.");

    const payload: Payload = {
      source_site: siteName,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      region: region || null,
      property_type: propertyType || null,
      property_count: propertyCount,
      currently_renting: currentlyRenting || null,
      current_channels: channels,
      ownership_duration: ownershipDuration || null,
      message: message.trim() || null,
      referral_code: referralCode,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : undefined,
    };

    if (honeypot) {
      setState({ status: "success" });
      return;
    }

    setState({ status: "submitting" });
    startTransition(async () => {
      try {
        const client = getReservationClient(supabaseUrl, supabaseAnonKey);
        const { error } = await client.from("owner_applications").insert(payload);
        if (error) throw error;
        setState({ status: "success" });
        onSuccess?.();
      } catch (err) {
        console.error("[OwnerApplicationForm]", err);
        showError("Bir sorun oluştu, lütfen tekrar deneyin.");
      }
    });
  }

  if (state.status === "success") {
    const waText = encodeURIComponent(
      `Merhaba, ${siteName} sitesinden mülk sahibi başvurusu yaptım. Adım ${name || "—"}.`
    );
    return (
      <div className={`oaf-card oaf-success ${className}`}>
        <div className="oaf-success-icon" aria-hidden>
          ✓
        </div>
        <h3>Teşekkürler!</h3>
        <p>
          Başvurunuz alındı. Ekibimiz 1-2 saat içinde size dönüş yapacak; mülkünüzü
          değerlendirmek için randevu ayarlayacağız.
        </p>
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="oaf-btn oaf-btn-secondary"
          >
            WhatsApp'tan da yazın
          </a>
        )}
        <OwnerFormStyles />
      </div>
    );
  }

  const submitLabel =
    tone === "luxury" ? "Mülkümü değerlendirin" : "Başvurumu gönder";

  return (
    <form onSubmit={onSubmit} noValidate className={`oaf-card ${className}`}>
      <h3 className="oaf-title">
        {tone === "luxury" ? "Mülkünüzü Değerlendirelim" : "Başvuru Formu"}
      </h3>
      <p className="oaf-sub">
        Bilgileriniz size özel. 1-2 saat içinde sizi arayacağız.
      </p>

      <div className="oaf-row">
        <label className="oaf-label">Ad Soyad *</label>
        <input
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="oaf-input"
        />
      </div>

      <div className="oaf-grid-2">
        <div className="oaf-row">
          <label className="oaf-label">Telefon *</label>
          <input
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+90 5xx xxx xx xx"
            className="oaf-input"
          />
        </div>
        <div className="oaf-row">
          <label className="oaf-label">E-posta</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="oaf-input"
          />
        </div>
      </div>

      <div className="oaf-grid-2">
        <div className="oaf-row">
          <label className="oaf-label">Bölge</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="oaf-input"
          >
            <option value="">Seçin</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="oaf-row">
          <label className="oaf-label">Mülk tipi</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="oaf-input"
          >
            <option value="">Seçin</option>
            <option value="villa">Villa</option>
            <option value="apart">Apart</option>
            <option value="daire">Daire</option>
            <option value="apart_otel">Apart otel</option>
            <option value="karma">Birden fazla farklı</option>
          </select>
        </div>
      </div>

      <div className="oaf-grid-2">
        <div className="oaf-row">
          <label className="oaf-label">Mülk sayısı</label>
          <input
            type="number"
            min={1}
            max={50}
            value={propertyCount}
            onChange={(e) => setPropertyCount(Number(e.target.value))}
            className="oaf-input"
          />
        </div>
        <div className="oaf-row">
          <label className="oaf-label">Ne kadar süredir size ait?</label>
          <select
            value={ownershipDuration}
            onChange={(e) => setOwnershipDuration(e.target.value)}
            className="oaf-input"
          >
            <option value="">Seçin</option>
            <option value="yeni">Yeni aldım</option>
            <option value="0-1">1 yıldan az</option>
            <option value="1-3">1-3 yıl</option>
            <option value="3+">3 yıldan fazla</option>
          </select>
        </div>
      </div>

      <fieldset className="oaf-row">
        <legend className="oaf-label">Şu an kiralıyor musunuz?</legend>
        <div className="oaf-radio-group">
          {[
            { v: "yes" as const, l: "Evet" },
            { v: "no" as const, l: "Hayır" },
            { v: "planning" as const, l: "Planlıyorum" },
          ].map((o) => (
            <label key={o.v} className="oaf-radio">
              <input
                type="radio"
                name="currently_renting"
                value={o.v}
                checked={currentlyRenting === o.v}
                onChange={() => setCurrentlyRenting(o.v)}
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {currentlyRenting === "yes" && (
        <fieldset className="oaf-row">
          <legend className="oaf-label">Hangi kanallarda?</legend>
          <div className="oaf-checks">
            {CHANNELS.map((c) => (
              <label key={c} className="oaf-check">
                <input
                  type="checkbox"
                  checked={channels.includes(c)}
                  onChange={() => toggleChannel(c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="oaf-row">
        <label className="oaf-label">Mesaj / Sorularınız</label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="oaf-input"
          placeholder="Mülkünüz hakkında bilmemizi istediğiniz detaylar…"
        />
      </div>

      {referralCode && (
        <p className="oaf-ref">
          🎉 Referans kodunuz var: <strong>{referralCode}</strong>
        </p>
      )}

      <label className="oaf-kvkk">
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
        className="oaf-honeypot"
        aria-hidden
      />

      {state.status === "error" && (
        <div className="oaf-error" role="alert">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || state.status === "submitting"}
        className="oaf-btn"
      >
        {pending || state.status === "submitting" ? "Gönderiliyor…" : submitLabel}
      </button>

      <OwnerFormStyles />
    </form>
  );
}

function OwnerFormStyles() {
  return (
    <style jsx global>{`
      .oaf-card {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #fff;
        color: #0f1f26;
        border: 1px solid #e3ecef;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 8px 28px -18px rgba(5, 60, 74, 0.25);
      }
      .oaf-card * { box-sizing: border-box; }
      .oaf-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
      .oaf-sub { font-size: 13px; color: #5c6b73; margin: 0 0 20px; }
      .oaf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .oaf-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .oaf-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #5c6b73; }
      .oaf-input { width: 100%; padding: 11px 13px; border: 1px solid #c8d8dc; background: #fff; color: #0f1f26; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s; }
      .oaf-input:focus { border-color: #1e8a9c; box-shadow: 0 0 0 3px rgba(30, 138, 156, 0.15); }
      textarea.oaf-input { resize: vertical; min-height: 80px; }
      .oaf-radio-group { display: flex; gap: 16px; flex-wrap: wrap; }
      .oaf-radio, .oaf-check { display: flex; gap: 6px; font-size: 14px; cursor: pointer; align-items: center; }
      .oaf-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; }
      .oaf-honeypot { position: absolute; left: -9999px; opacity: 0; pointer-events: none; }
      .oaf-kvkk { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: #5c6b73; margin: 12px 0; }
      .oaf-kvkk input { margin-top: 2px; }
      .oaf-kvkk a { color: #1e8a9c; font-weight: 600; }
      .oaf-ref { font-size: 12px; color: #0f6e56; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 12px; margin: 12px 0; }
      .oaf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 14px 16px; border: 0; border-radius: 999px; background: #f26a1e; color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: background 0.15s; margin-top: 4px; }
      .oaf-btn:hover { background: #c24a0d; }
      .oaf-btn:disabled { opacity: 0.6; cursor: wait; }
      .oaf-btn-secondary { background: #1e8a9c; color: #fff; }
      .oaf-btn-secondary:hover { background: #0e5f70; }
      .oaf-error { color: #a32d2d; font-size: 13px; margin: 8px 0; padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
      .oaf-success { padding: 32px; text-align: center; }
      .oaf-success-icon { width: 56px; height: 56px; border-radius: 50%; background: #0f6e56; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 14px; }
      .oaf-success h3 { margin: 0 0 8px; font-size: 22px; }
      .oaf-success p { margin: 0 0 18px; font-size: 14px; color: #5c6b73; }
      @media (max-width: 480px) { .oaf-grid-2 { grid-template-columns: 1fr; } }
    `}</style>
  );
}
