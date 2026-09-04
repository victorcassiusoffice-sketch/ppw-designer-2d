# Mauritius solar merchants — research record (2026-09-04)

Four shops Vic named, each fetched live on 2026-09-04 by a research agent and
then re-fetched by an independent verifier (every product URL, price, spec and
image re-checked the same day). Confidence per shop is the verifier's. Full
structured data: `research.json` (scratch) → the summary in this folder's
`00-FINDINGS.md`.

**The headline:** only **Emcar** publishes MUR prices. Suntricity, Solaire and
Solar Center are quote-only (no cart, no price list). So the Eco tab ships with
Emcar's priced products; the other three are onboarding targets whose catalogs
are documented below with datasheet-grade specs, ready to seed the moment a
price list or a "price on request" flow exists (see Open decisions in
`00-FINDINGS.md`).

## 1. Emcar Ltd — Victron Energy distributor (PRICED · verifier: HIGH)

| Field | Value |
|---|---|
| Company | EMCAR Ltd, family-owned, founded 1898; official distributor of Victron Energy + Himoinsa |
| Web | https://emcar.mu — WooCommerce e-shop (`/shop`, cart, checkout; Mastercard / Visa / bank transfer / **Juice (MCB)**) |
| Phone | HQ Bell Village (230) 405 1000 · Energy showroom Roche Bois (230) 405 1113 · Energy dept 405 1012 / 5250 9802 · WhatsApp +230 5254 6516 |
| Prices | Public, MUR, on every product (VAT inclusive/exclusive NOT stated anywhere on the site) |
| Stock | Public; many high-value Victron items were **out of stock** on 2026-09-04 (175 W panel, Jinko 475 W, MultiPlus 12/3000 + 12/2000, both Lithium SuperPacks, MPPT 150/35) |
| Store API | `https://emcar.mu/wp-json/wc/store/v1/products?category=solar-panels` (also `inverter-charger`, `battery`, `solar-charge-controller`); brand filter `pa_brand=victron-energy` → 38 products |
| Images | 2048 px PNG product shots; **403 to plain curl, 200 with a browser User-Agent** |
| Onboarding | Best fit of the four: an existing online shop with public MUR prices and Juice — a referral link works today. Their Energy department is the contact. |

Seeded into `src/data/products.json` (category `solar`, supplier "Emcar (Victron Energy distributor, Mauritius)"):

| id | Product | Rating | Dims mm (L×W×H) | kg | MUR | Stock 2026-09-04 | Source |
|---|---|---|---|---|---|---|---|
| `emcar-jinko-475` | Jinko Solar 475 W N-type panel | 475 Wp | 1903×1134×30 | 24.2 | 12,075 | out | https://emcar.mu/product/energy/solar-equipment/solar-panels/solar-panel-475w/ |
| `emcar-victron-175` | Victron BlueSolar 175 W-12 V mono (series 4a) | 175 Wp | 1485×668×30 | 11 | 9,085 | out | …/victron-energy-solar-panel-175w-12v/ + BlueSolar datasheet |
| `emcar-sunpower-flex-100` | SunPower SPR-E-Flex-100 flexible panel | 100 Wp | 1165×556×20 | 2 | 8,050 | in | …/flexible-solar-panel-100w/ + SPR-E-Flex specsheet |
| `emcar-victron-multiplus-12-3000` | Victron MultiPlus 12/3000/120-50 inverter/charger | 2.4 kW cont. (3000 VA) | 258×218×362 | 19 | 82,800 | out | …/inverter-charger/victron-energy-multiplus-12-3000-120-50-… + datasheet |
| `emcar-victron-phoenix-12-1200` | Victron Phoenix 12/1200 230 V VE.Direct | 1.0 kW cont. (1200 VA) | 232×362×117 | 7.4 | 17,250 | in (1) | …/victron-energy-phoenix-inverter-ve-direct-uk/ (12/1200 option) + datasheet |
| `emcar-victron-superpack-12-100` | Victron Lithium SuperPack 12.8 V/100 Ah | 1.28 kWh | 330×172×220 | 14 | 37,950 | out | …/battery/victron-energy-lithium-superpack-12-8v-100ah-m8-… + datasheet |
| `emcar-victron-agm-200` | Victron AGM Telecom 12 V/200 Ah | 2.4 kWh (12 V × 200 Ah, C20) | 546×125×323 | 60 | 25,300 | in | …/battery/victron-energy-agm-telecom-battery-12v-200ah/ + datasheet |
| `emcar-victron-mppt-100-30` | Victron SmartSolar MPPT 100/30 | 440 W PV @12 V | 186×70×130 | 1.3 | 6,900 | in | …/solar-charge-controller/victron-energy-smartsolar-mppt-100-30/ + datasheet |

Also on the site (verified prices, not seeded — accessories / small panels): Victron 40 W (Rs 2,300), 30 W (Rs 2,070), Phoenix 12/500 (Rs 9,085), Phoenix 24/1200 (Rs 21,850, model identity uncertain), MultiPlus 12/2000 (Rs 57,270, no datasheet), AGM 240 Ah (Rs 29,900, no dims), Lithium SuperPack 25.6 V/50 Ah (Rs 48,300), MPPT 75/15 (Rs 4,025), MPPT 150/35 (Rs 11,500), PWM-Light (Rs 2,875), EV Charging Station NS (Rs 31,050, out of stock), plus chargers, monitors, meters, cables.

## 2. Suntricity Ltd — Huawei FusionSolar + JA Solar + Jinko (QUOTE-ONLY · verifier: HIGH)

| Field | Value |
|---|---|
| Company | Suntricity Limited, Energy cluster of ER Group / ENL Commercial subsidiary (launched Aug 2021) |
| Web | https://suntricity.mu — WordPress/Avada; WooCommerce installed but EMPTY (`/shop` "No products were found"; Store API `[]`) |
| Sales | Arnaud Rousset +230 58 55 25 20 · arousset@suntricity.mu · contact form (reCAPTCHA v3) |
| Prices | None anywhere on the site. Every product page = "Download Datasheet" button only |
| Model | B2B distributor to installers across Mauritius + Indian Ocean islands |
| Onboarding | Needs a price list (or a "price on request" product flow) before anything can be sold through the Designer. Worth a call: they carry the modern residential kit (Huawei SUN2000 hybrid + LUNA2000 + JA/Jinko 470–555 W). |

Catalog (datasheet specs, all verified; no MUR prices):

| Product | Rating | Dims mm | kg | Datasheet |
|---|---|---|---|---|
| JA Solar DeepBlue 3.0 JAM72S30-555/MR | 555 Wp, 21.5 % | 2278×1134×35 | 28.1 | jasolar.com …/20220511060835815.pdf |
| JA Solar JAM72S20-470/MR | 470 Wp, 21.2 % | 2112×1052×35 | 24.5 | jasolar.com …/20220511055834606.pdf |
| JA Solar JAM72D20-465/MB bifacial | 465 Wp, 20.9 % | 2117×1052×35 | 27.3 | jasolar.com …/20220512051304453.pdf |
| Jinko Tiger Pro 72HC JKM530-550M | 550 Wp, 21.33 % | 2274×1134×35 | 28 | suntricity.mu …/JKM530-550M-72HL4-V-F2-EN.pdf |
| Jinko Tiger 78TR JKM460-480M | 480 Wp, 21.38 % | 2182×1029×35 | 25 | suntricity.mu …/JKM460-480M-7RL3-V-F1-EN.pdf |
| Huawei SUN2000-3K–6K-LB0 hybrid (single-phase) | 3–6 kW, 97.8 % | 425×150×376.5 | 15 | suntricity.mu …/SUN2000_3K-6K_LB0_EN.pdf |
| Huawei SUN2000-12/15/17/20KTL-M2 | 20 kW, 98.65 % | 525×262×470 | 25 | suntricity.mu …/SUN2000-12-20KTL-M2.pdf |
| Huawei SUN2000-30/36/40KTL-M3 | 40 kW, 98.7 % | 640×270×530 | 43 | suntricity.mu …/SUN2000-30-40KTL-M3.pdf |
| Huawei SUN2000-60KTL-M0 / 100KTL-M1 / 185KTL-H1 / 215KTL-H0 | 60 / 100 / 185 / 215 kW | up to 1035×365×700 | 74–90 | suntricity.mu datasheets |
| Huawei LUNA2000-5 / 10 / 15-S0 | 5 / 10 / 15 kWh usable, 5 kW out | 670×150×600 / 960 / 1320 | 63.8 / 113.8 / 163.8 | suntricity.mu …/LUNA2000-5-15-S0.pdf |
| Huawei SUN2000-450W-P optimizer · Backup Box-B0/B1 · Smart Dongle / SmartLogger / SmartACU | — | — | — | suntricity.mu datasheets |

## 3. Solaire Mauritius — buyAfraction Ltd / CARBONOZ (QUOTE-ONLY · verifier: HIGH)

| Field | Value |
|---|---|
| Company | buyAfraction Ltd t/a Solaire Mauritius / Solaire Maurice — CARBONOZ Renewable Energy Group; BRN C20173696 |
| Web | https://en.solaire.mu (single-page static site; fr.solaire.mu mirror) |
| Contact | +230 7018 1147 (tel + WhatsApp) · mu-office@carbonoz.com · Calendly with Felix Zuckschwerdt · expat.com lists Deenen Ramachundren +230 5909 6006 |
| Prices | None. "Request Quote" only; quotations non-binding without a site visit |
| Model | Installer / integrator selling turn-key kits: **Solaire 1** (5 kWp, LONGi 450 W panels, MPP Solar or Growatt inverter, no battery) and **Solaire 2** (5–50 kWp hybrid, Deye inverter, 14 kWh LIXI/CATL battery), solar carports, EV charging |
| Brands | LONGi, Deye, Growatt, MPP Solar/Voltronic, LIXI (own battery brand), CATL cells, Solar Assistant |
| Onboarding | Kit seller — the Designer would need a "kit" product (panels + inverter + battery as one line) and a quote flow. The LIXI 14 kWh battery has a USD 1,800 EU price on lixibattery.com (not MU). |

Specs verified: LIXI 48 V stackable 14 kWh (415×700×263 mm, 125 kg); LIXI 192 V rack 20.48 kWh (460×550×1018, 236.5 kg); LIXI PRO RACK 112.5 kWh cabinet. The "LONGi 450 W" panel is a kit line only — no model, no dims on the site (LONGi Hi-MO 6 Scientist LR5-54HTH-450M is 1722×1134×30 mm, 20.8 kg per LONGi's datasheet, but Solaire does not say which).

## 4. Solar Center Mauritius — Sigenergy (QUOTE-ONLY · verifier: HIGH)

| Field | Value |
|---|---|
| Company | Solar Center Mauritius; sub-brands Solar Rent (20-year lease SPV), Solar Invest, Agrivoltaique.mu |
| Web | https://solarcenter.mu (Next.js brochure site, EN/FR/MFE; no shop) · https://solar-rent.mu |
| Contact | +230 260 2020 · contact@solarcenter.mu · Solar Rent WhatsApp +230 5250 1791 · contact@solar-rent.mu |
| Prices | Only the Solar Rent lease tiers: SRH 8 / 16 / 24 kWh = Rs 390k / 490k / 590k first enhanced rent + Rs 2,000 / 3,000 / 4,000 per month for 20 years (10 kWp = 20 × 500 W panels, Sigenergy 5 kW hybrid, 1–3 × 8 kWh LFP); SRH 32 / 40 / 48 kWh = Rs 790k / 890k / 990k + Rs 5–7k/month. Indicative cash price "3 kWp installation Rs 150,000–250,000". VAT not stated. |
| Brands | Sigenergy / SigenStor 5-in-1 (official distributor for Mauritius + Indian Ocean); SMA and Solax named |
| Onboarding | Lease model does not fit a one-off cart line. Worth listing as a service partner ("solar as a lease") rather than a product merchant. |

Specs verified from Sigenergy datasheets: SigenStor BAT 8.0 (8.06 kWh, 767×260×270 mm, 70 kg); Sigen Energy Controller 5.0 SP (5 kW hybrid, 700×245×300 mm, 18 kg).

## 5. Brand image + datasheet sources (for to-scale art)

Verified 2026-09-04 (official product renders, transparent PNG where noted):

- **LONGi** — static.longi.com: Hi-MO X6 Explorer LR5-54HTH-440M (1722×1134×30, 20.8 kg) `Explorer_04_8b2c959558.png` (824×1224 RGBA); Hi-MO 6 Scientist LR5-54HTH-450M same dims `Scientist_new2_7168a03441.png`; Hi-MO X6 Scientist 72-cell 600 W (2278×1134×30); Hi-MO 7 LR7-72HGD-620M (2382×1134×30).
- **JA Solar** — jasolar.eu (jasolar.com blocks non-browser clients): JAM54D40 LB 460 W (1762×1134×30, 22 kg) `JAM_54_D40_LB_BF_frontal_vorne_1.png`; JAM54D40 GB 445 W (1722×1134×30); JAM72D40 MB 605 W (2278×1134×30); JAM54S30 LR 440 W.
- **Huawei** — solar.huawei.com asset CDN: SUN2000-5KTL-L1 (365×156×375 mm, 12 kg, 840×840 RGBA render); SUN2000-10KTL-M1 (525×146.5×470); LUNA2000-5-S0 (670×150×600, 63.8 kg, 840×840 RGBA); LUNA2000-7-S1 (590×255×510, 80 kg, 1500×1500 RGBA).
- **Victron** — victronenergy.com/upload/products: MultiPlus-II 48/3000 (268×141×499, 19 kg) `MultiPlus-II_nw.png` (720×794 RGBA); 48/5000 (320×149×565, 30 kg); SmartSolar MPPT 150/35 `SmartSolar MPPT 150-35 (top).png` (a true top view); Cerbo GX; Lithium Smart 25.6 V/200 Ah (650×163×237, 39 kg).

Licence note from the brand agents: these are manufacturer product-page renders, not press-kit assets; the Emcar shots are the merchant's own listing images. Fine for the Designer's catalog use the same way K1's product photos are used; a merchant agreement should cover imagery when they sign.
