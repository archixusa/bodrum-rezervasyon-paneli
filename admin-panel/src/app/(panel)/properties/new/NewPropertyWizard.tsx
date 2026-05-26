"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToaster } from "@/components/Toaster";
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Upload,
  X,
  Star,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

type Step = 1 | 2 | 3;

const REGIONS = [
  "Gümbet", "Turgutreis", "Yalıkavak", "Bitez", "Ortakent",
  "Gündoğan", "Torba", "Türkbükü", "Akyarlar", "Gümüşlük",
];

const AMENITY_OPTIONS = [
  "Özel havuz", "Ortak havuz", "Deniz manzarası", "Bahçe", "Klima",
  "Wi-Fi", "Çamaşır makinesi", "Bulaşık makinesi", "Mangal/BBQ",
  "Şömine", "Asansör", "Otopark", "Güvenlik", "Smart TV", "Net flix",
  "Çocuk dostu", "Evcil hayvan kabul", "Tekerlekli sandalye erişimi",
];

interface UploadedImage {
  id: string;
  publicUrl: string;
  storagePath: string;
  isHero: boolean;
  order: number;
}

export function NewPropertyWizard({ owners }: { owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const toaster = useToaster();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [internalName, setInternalName] = useState("");
  const [type, setType] = useState<"villa" | "apart" | "daire" | "apart_otel">("villa");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [bathrooms, setBathrooms] = useState<number | "">("");
  const [maxGuests, setMaxGuests] = useState<number | "">("");
  const [sizeM2, setSizeM2] = useState<number | "">("");
  const [hasPool, setHasPool] = useState(false);
  const [poolType, setPoolType] = useState("");
  const [hasGarden, setHasGarden] = useState(false);
  const [distanceBeach, setDistanceBeach] = useState<number | "">("");
  const [distanceCenter, setDistanceCenter] = useState<number | "">("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [priceTry, setPriceTry] = useState<number | "">("");
  const [priceEur, setPriceEur] = useState<number | "">("");
  const [ownerId, setOwnerId] = useState("");

  // Step 2
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // Step 3
  const [rawDescription, setRawDescription] = useState("");
  const [highlightsText, setHighlightsText] = useState("");

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function saveStep1(): Promise<string | null> {
    if (!internalName.trim() || !region) {
      toaster.push({ title: "Eksik alan", body: "İç ad ve bölge zorunlu", variant: "warning" });
      return null;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("property_templates")
      .insert({
        internal_name: internalName.trim(),
        type,
        region,
        district: district || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        max_guests: maxGuests || null,
        size_m2: sizeM2 || null,
        has_pool: hasPool,
        pool_type: poolType || null,
        has_garden: hasGarden,
        distance_to_beach_m: distanceBeach || null,
        distance_to_center_m: distanceCenter || null,
        amenities: amenities.length ? amenities : null,
        base_price_try: priceTry || null,
        base_price_eur: priceEur || null,
        owner_id: ownerId || null,
        status: "draft",
      })
      .select()
      .single();
    setSubmitting(false);
    if (error || !data) {
      toaster.push({ title: "Kaydedilemedi", body: error?.message, variant: "error" });
      return null;
    }
    setTemplateId(data.id);
    return data.id;
  }

  async function uploadImage(file: File) {
    if (!templateId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${templateId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("property-images")
      .upload(path, file, { upsert: false });
    if (upErr) {
      toaster.push({ title: "Yükleme hatası", body: upErr.message, variant: "error" });
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
    const { data: row, error: rowErr } = await supabase
      .from("property_images")
      .insert({
        template_id: templateId,
        storage_path: path,
        public_url: pub.publicUrl,
        display_order: images.length,
        is_hero: images.length === 0,
        size_bytes: file.size,
      })
      .select()
      .single();
    if (rowErr || !row) {
      toaster.push({ title: "Kayıt hatası", body: rowErr?.message, variant: "error" });
    } else {
      setImages((prev) => [
        ...prev,
        {
          id: row.id,
          publicUrl: row.public_url,
          storagePath: row.storage_path,
          isHero: row.is_hero,
          order: row.display_order,
        },
      ]);
    }
    setUploading(false);
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      await uploadImage(f);
    }
    e.target.value = "";
  }

  async function setHero(id: string) {
    if (!templateId) return;
    await supabase
      .from("property_images")
      .update({ is_hero: false })
      .eq("template_id", templateId);
    await supabase.from("property_images").update({ is_hero: true }).eq("id", id);
    setImages((prev) => prev.map((i) => ({ ...i, isHero: i.id === id })));
  }

  async function removeImage(id: string) {
    const img = images.find((x) => x.id === id);
    if (!img) return;
    await supabase.storage.from("property-images").remove([img.storagePath]);
    await supabase.from("property_images").delete().eq("id", id);
    setImages((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveStep3AndGenerate(e: FormEvent) {
    e.preventDefault();
    if (!templateId) return;
    if (!rawDescription.trim()) {
      toaster.push({ title: "Ham açıklama gerekli", variant: "warning" });
      return;
    }
    setSubmitting(true);
    const highlights = highlightsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await supabase
      .from("property_templates")
      .update({
        raw_description: rawDescription.trim(),
        highlights: highlights.length ? highlights : null,
        status: "generating",
      })
      .eq("id", templateId);
    // Kick off Claude for both sites in parallel
    try {
      const [r1, r2] = await Promise.all([
        supabase.functions.invoke("generate-property-content", {
          body: { template_id: templateId, site: "bodrumapartkiralama" },
        }),
        supabase.functions.invoke("generate-property-content", {
          body: { template_id: templateId, site: "bodrumapartvilla" },
        }),
      ]);
      const errors = [r1.error, r2.error].filter(Boolean);
      if (errors.length) {
        toaster.push({
          title: "Bazı üretimler başarısız",
          body: errors.map((e) => e!.message).join("; "),
          variant: "warning",
        });
      }
      await supabase.from("property_templates").update({ status: "review" }).eq("id", templateId);
      toaster.push({
        title: "İçerik üretildi",
        body: "İnceleme sayfasına yönlendiriliyorsunuz",
        variant: "success",
      });
      router.push(`/properties/${templateId}/review`);
    } catch (err) {
      toaster.push({
        title: "Üretim hatası",
        body: (err as Error).message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <StepIndicator step={step} />

      {step === 1 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const id = await saveStep1();
            if (id) setStep(2);
          }}
          className="panel-card space-y-4 p-6"
        >
          <h2 className="text-lg font-bold">1. Temel Bilgiler</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label>
              <span className="label">İç ad (panel için) *</span>
              <input
                type="text"
                required
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                placeholder="Yalıkavak deniz manzaralı 3+1 villa"
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Mülk tipi *</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="panel-input"
              >
                <option value="villa">Villa</option>
                <option value="apart">Apart</option>
                <option value="daire">Daire</option>
                <option value="apart_otel">Apart otel</option>
              </select>
            </label>
            <label>
              <span className="label">Bölge *</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="panel-input"
              >
                <option value="">Seçin</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Alt bölge / mahalle</span>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Yatak odası</span>
              <input
                type="number"
                min={0}
                value={bedrooms}
                onChange={(e) =>
                  setBedrooms(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Banyo</span>
              <input
                type="number"
                min={0}
                value={bathrooms}
                onChange={(e) =>
                  setBathrooms(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Maks misafir</span>
              <input
                type="number"
                min={1}
                value={maxGuests}
                onChange={(e) =>
                  setMaxGuests(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Brüt m²</span>
              <input
                type="number"
                min={0}
                value={sizeM2}
                onChange={(e) =>
                  setSizeM2(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Sahile mesafe (m)</span>
              <input
                type="number"
                min={0}
                value={distanceBeach}
                onChange={(e) =>
                  setDistanceBeach(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Merkeze mesafe (m)</span>
              <input
                type="number"
                min={0}
                value={distanceCenter}
                onChange={(e) =>
                  setDistanceCenter(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Gece fiyatı (TRY)</span>
              <input
                type="number"
                min={0}
                value={priceTry}
                onChange={(e) =>
                  setPriceTry(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Gece fiyatı (EUR)</span>
              <input
                type="number"
                min={0}
                value={priceEur}
                onChange={(e) =>
                  setPriceEur(e.target.value ? Number(e.target.value) : "")
                }
                className="panel-input"
              />
            </label>
            <label>
              <span className="label">Sahip</span>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="panel-input"
              >
                <option value="">Seçin (opsiyonel)</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="space-y-2 pt-2">
            <legend className="label">Özellikler</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasPool}
                  onChange={(e) => setHasPool(e.target.checked)}
                />
                Havuz var
              </label>
              {hasPool && (
                <input
                  type="text"
                  value={poolType}
                  onChange={(e) => setPoolType(e.target.value)}
                  placeholder="özel / ortak / ısıtmalı..."
                  className="panel-input !w-48"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasGarden}
                  onChange={(e) => setHasGarden(e.target.checked)}
                />
                Bahçe var
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
              {AMENITY_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={amenities.includes(a)}
                    onChange={() => toggleAmenity(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-4">
            <button type="submit" disabled={submitting} className="panel-btn-accent">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Devam → Fotoğraflar
            </button>
          </div>
        </form>
      )}

      {step === 2 && templateId && (
        <div className="panel-card space-y-4 p-6">
          <h2 className="text-lg font-bold">2. Fotoğraflar</h2>
          <p className="text-sm text-muted">
            En az 3, ideali 8-12 fotoğraf yükleyin. İlk yüklenen otomatik hero olur;
            yıldız ile değiştirebilirsiniz.
          </p>

          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-border-strong)] bg-white p-8 text-center transition hover:border-accent-500">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onFiles}
              disabled={uploading}
              className="hidden"
            />
            <Upload className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-semibold">
              {uploading ? "Yükleniyor..." : "Tıklayın veya sürükleyin"}
            </p>
            <p className="text-xs text-muted">JPG/PNG/WebP, max 8 MB</p>
          </label>

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={clsx(
                    "group relative aspect-[4/3] overflow-hidden rounded-lg border-2",
                    img.isHero ? "border-accent-500" : "border-transparent"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.publicUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => setHero(img.id)}
                      className="rounded bg-white/90 px-2 py-1 text-xs font-semibold text-navy-900"
                      title="Hero yap"
                    >
                      <Star
                        className={clsx(
                          "h-3 w-3",
                          img.isHero && "fill-accent-500 text-accent-500"
                        )}
                      />
                    </button>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="rounded bg-danger/90 px-2 py-1 text-xs font-semibold text-white"
                      title="Sil"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {img.isHero && (
                    <span className="absolute left-2 top-2 rounded bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Hero
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <button onClick={() => setStep(1)} className="panel-btn-ghost">
              <ChevronLeft className="h-4 w-4" /> Geri
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={images.length < 1}
              className="panel-btn-accent"
            >
              Devam → AI İçerik <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && templateId && (
        <form
          onSubmit={saveStep3AndGenerate}
          className="panel-card space-y-4 p-6"
        >
          <h2 className="text-lg font-bold">3. Ham Açıklama + AI Üretimi</h2>
          <p className="text-sm text-muted">
            Mülkü 2-3 paragrafta kendi sözlerinizle anlatın. AI bunu iki sitenin
            kişiliğine göre yeniden yazacak — birinde aile/pratik, diğerinde
            lüks/şiirsel.
          </p>

          <label className="block">
            <span className="label">Ham açıklama *</span>
            <textarea
              required
              rows={8}
              value={rawDescription}
              onChange={(e) => setRawDescription(e.target.value)}
              placeholder="Yalıkavak sırtlarında, marinaya 10 dakika yürüme mesafesinde özel havuzlu villa. Üç yatak odası, hepsi ensuite. Geniş yaşam alanı doğrudan terasa açılıyor, terastan körfez manzarası var. Mutfak ada tipinde, taş tezgah. Komşusu yok, çok sessiz. Üç çift için ideal, küçük çocuklu aileler de gelebilir..."
              className="panel-input"
            />
          </label>

          <label className="block">
            <span className="label">Vurgular (satır başına bir madde)</span>
            <textarea
              rows={4}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              placeholder="Özel havuz&#10;Marinaya 10 dk yürüme&#10;Körfez manzarası&#10;3 ensuite yatak odası"
              className="panel-input"
            />
          </label>

          <div className="flex justify-between gap-2 pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="panel-btn-ghost"
            >
              <ChevronLeft className="h-4 w-4" /> Geri
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="panel-btn-accent"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Üretiliyor (15-30 sn)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> İçerik Üret
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const labels = ["Temel", "Fotoğraflar", "AI İçerik"];
  return (
    <ol className="panel-card flex items-center gap-2 p-3 text-sm">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <li key={l} className="flex flex-1 items-center gap-2">
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                done
                  ? "bg-success text-white"
                  : active
                  ? "bg-accent-500 text-white"
                  : "bg-navy-100 text-muted"
              )}
            >
              {done ? "✓" : n}
            </span>
            <span className={clsx("font-semibold", !active && "text-muted")}>
              {l}
            </span>
            {i < labels.length - 1 && (
              <span className="mx-2 flex-1 border-t border-dashed border-[var(--color-border-strong)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
