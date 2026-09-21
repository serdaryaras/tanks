const $ = (id) => document.getElementById(id);

const state = {
  shipType: 4,
  lastInput: null,
  lastResult: null,
  mainEngines: [
    { id: crypto.randomUUID(), label: "Main engine 1", powerKw: 6000, sfocGPerKwh: 185, fuel: "heavy_fuel_oil" },
  ],
  auxiliaryEngines: [
    { id: crypto.randomUUID(), label: "Auxiliary engine 1", powerKw: 800, sfocGPerKwh: 210, fuel: "diesel_gas_oil" },
    { id: crypto.randomUUID(), label: "Auxiliary engine 2", powerKw: 600, sfocGPerKwh: 210, fuel: "diesel_gas_oil" },
  ],
  boilers: [
    { id: crypto.randomUUID(), label: "Boiler 1", consumptionKgPerH: 350, fuel: "heavy_fuel_oil" },
  ],
};

function selectedShipType() {
  const active = document.querySelector(".type-card.is-active");
  return Number(active?.dataset.type || state.shipType || 4);
}

function collectInput() {
  state.shipType = selectedShipType();
  return {
    shipName: $("shipName").value,
    ship: {
      vsKn: $("vsKn").value,
      rangeNm: $("rangeNm").value,
      enduranceDays: $("enduranceDays").value,
      nonDischargePeriodDays: $("nonDischargeDays").value,
      personsOnBoard: $("personsOnBoard").value,
      shipType: state.shipType,
      vacuumToilet: $("vacuumToilet").checked,
      withCompactor: $("withCompactor").checked,
      solidWasteIncinerator: $("solidWasteIncinerator").checked,
      sludgeK1Mode: $("sludgeK1Mode").value,
    },
    mainEngines: state.mainEngines.map((row) => ({ ...row })),
    auxiliaryEngines: state.auxiliaryEngines.map((row) => ({ ...row })),
    boilers: state.boilers.map((row) => ({ ...row })),
  };
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtDays(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const digits = Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 1;
  return `${fmt(n, digits)} days`;
}

function periodSourceLabel(period) {
  if (!period?.source) return "";
  return TankCapacities.PERIOD_SOURCE_LABELS[period.source] || period.source;
}

function fmtPeriod(period) {
  if (!period || !(period.days > 0)) return "—";
  const src = periodSourceLabel(period);
  return src ? `${fmtDays(period.days)} · ${src}` : fmtDays(period.days);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function fact(label, value, cls = "") {
  return `<div><dt>${label}</dt><dd class="${cls}">${value}</dd></div>`;
}

function shipTypeLabel(type) {
  return TankCapacities.WASTEWATER_SHIP_TYPES.find((t) => t.value === Number(type))?.label || "—";
}

function fuelOptions(selected) {
  const short = {
    diesel_gas_oil: "MGO/MDO",
    light_fuel_oil: "LFO",
    heavy_fuel_oil: "HFO",
    lpg_propane: "LPG-P",
    lpg_butane: "LPG-B",
    lng: "LNG",
    methanol: "MeOH",
    ethanol: "EtOH",
  };
  return TankCapacities.FUEL_TYPES.map(
    (f) =>
      `<option value="${f}" ${f === selected ? "selected" : ""}>${escapeHtml(short[f] || TankCapacities.FUEL_LABELS[f])}</option>`,
  ).join("");
}

function drawEngineTable(bodyId, rows, kind) {
  const body = $(bodyId);
  body.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;
    if (kind === "boiler") {
      tr.innerHTML = `
        <td><input type="text" value="${escapeAttr(row.label)}" data-k="label" /></td>
        <td><input type="number" min="0" step="10" value="${escapeAttr(row.consumptionKgPerH)}" data-k="consumptionKgPerH" /></td>
        <td><select data-k="fuel">${fuelOptions(row.fuel)}</select></td>
        <td><button class="btn-ghost" type="button" data-del>Delete</button></td>
      `;
    } else {
      tr.innerHTML = `
        <td><input type="text" value="${escapeAttr(row.label)}" data-k="label" /></td>
        <td><input type="number" min="0" step="${kind === "ae" ? 10 : 100}" value="${escapeAttr(row.powerKw)}" data-k="powerKw" /></td>
        <td><input type="number" min="0" step="0.1" value="${escapeAttr(row.sfocGPerKwh)}" data-k="sfocGPerKwh" /></td>
        <td><select data-k="fuel">${fuelOptions(row.fuel)}</select></td>
        <td><button class="btn-ghost" type="button" data-del>Delete</button></td>
      `;
    }
    tr.querySelectorAll("input, select").forEach((el) => {
      const handler = () => {
        row[el.dataset.k] = el.value;
        updateResults();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
    tr.querySelector("[data-del]").addEventListener("click", () => {
      if (kind === "me") state.mainEngines = state.mainEngines.filter((b) => b.id !== row.id);
      if (kind === "ae") state.auxiliaryEngines = state.auxiliaryEngines.filter((b) => b.id !== row.id);
      if (kind === "boiler") state.boilers = state.boilers.filter((b) => b.id !== row.id);
      drawAllTables();
      updateResults();
    });
    body.appendChild(tr);
  });
}

function drawAllTables() {
  drawEngineTable("meBody", state.mainEngines, "me");
  drawEngineTable("aeBody", state.auxiliaryEngines, "ae");
  drawEngineTable("boilerBody", state.boilers, "boiler");
}

function fmtM3(n, digits = 2) {
  return n == null || Number.isNaN(n) ? "—" : `${fmt(n, digits)} m³`;
}

function tankFacts(tank, persons) {
  if (!tank) return fact("Daily generation", "—");
  const rows = [
    fact("Daily generation", `${fmt(tank.dailyM3, 2)} m³/day`),
    fact("Rate", escapeHtml(TankCapacities.wastewaterTankRateDescription(tank, persons))),
  ];
  if (tank.id === "gray") {
    for (const c of tank.components) {
      rows.push(fact(escapeHtml(c.label), `${fmt(c.rateLPerPersonDay, 0)} L/p/d`));
    }
  }
  return rows.join("");
}

function updateResults() {
  const input = collectInput();
  const result = TankCapacities.calculate(input);
  state.lastInput = input;
  state.lastResult = result;

  $("errorBox").classList.toggle("hidden", result.errors.length === 0);
  $("errorBox").textContent = result.errors.join(" ");
  $("warnBox").classList.toggle("hidden", result.warnings.length === 0);
  $("warnBox").textContent = result.warnings.join(" ");
  $("statusDot").className = `dot ${result.ok ? "ok" : "bad"}`;

  $("outFuelTank").textContent = result.totalFuelVolumeM3
    ? fmtM3(result.totalFuelVolumeM3, 1)
    : "—";

  const ww = result.wastewater;
  const hold = result.sewageHolding;
  $("blackDays").textContent = fmtPeriod(hold);
  $("grayDays").textContent = fmtPeriod(hold);
  $("outBlackHint").textContent = "Holding";
  $("outGrayHint").textContent = "Holding";
  $("outBlack").textContent = ww?.tanks[0] ? fmtM3(ww.tanks[0].holdingM3, 2) : "—";
  $("outGray").textContent = ww?.tanks[1] ? fmtM3(ww.tanks[1].holdingM3, 2) : "—";
  $("blackFacts").innerHTML = tankFacts(ww?.tanks[0], ww?.personsOnBoard);
  $("grayFacts").innerHTML = tankFacts(ww?.tanks[1], ww?.personsOnBoard);

  const sw = result.solidWaste;
  if (!sw) {
    $("solidNoteHead").textContent = "—";
    $("solidReadouts").innerHTML = "";
    $("solidFacts").innerHTML = fact("Solid waste", "—");
  } else {
    $("solidNoteHead").textContent = [
      fmtPeriod(sw.period),
      sw.withCompactor ? "compactor" : "",
      sw.incinerator ? "incinerator ×0.6" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    $("solidReadouts").innerHTML = sw.categories
      .map(
        (c) =>
          `<article class="is-total sw-${escapeAttr(c.category)}"><small>${escapeHtml(c.label)}</small><strong>${fmtM3(c.voyageVolumeM3, 2)}</strong></article>`,
      )
      .join("");
    $("solidFacts").innerHTML = sw.categories
      .map((c) => fact(escapeHtml(c.label), `${fmt(c.dailyMassKg, 1)} kg/d`))
      .join("");
  }

  const oily = result.oilyWaste || {};
  const sludge = oily.sludge;
  const bilge = oily.oilyBilge;
  $("oilyInputFacts").innerHTML = [
    fact("Daily fuel C", oily.dailyFuelM3 != null ? `${fmt(oily.dailyFuelM3, 2)} m³/day` : "—"),
    fact("Main-engine rating P", oily.mainEngineRatingKw != null ? `${fmt(oily.mainEngineRatingKw, 0)} kW` : "—"),
  ].join("");
  $("sludgeDot").className = `dot ${sludge ? "ok" : "bad"}`;
  $("sludgeDays").textContent = oily.sludgePeriod ? fmtPeriod(oily.sludgePeriod) : "—";
  $("outSludge").textContent = sludge ? fmtM3(sludge.volumeM3, 1) : "—";
  $("sludgeFacts").innerHTML = [
    fact("K₁", oily.k1 != null ? `${oily.k1.toFixed(3)} (${oily.k1Source}${oily.hfoPurified ? " · HFO purified" : " · no purification"})` : "—"),
    fact("Discharge interval D", oily.sludgePeriod ? fmtPeriod(oily.sludgePeriod) : "—"),
    ...(sludge
      ? [
          fact("K₁ × C × D", `${sludge.k1.toFixed(3)} × ${fmt(sludge.C, 2)} × ${fmt(sludge.D, Math.abs(sludge.D - Math.round(sludge.D)) < 1e-9 ? 0 : 1)}`),
          fact("Rule", escapeHtml(sludge.rule)),
          fact("Formula", escapeHtml(sludge.formula)),
        ]
      : [fact("Sludge tank", "—")]),
  ].join("");
  $("bilgeDot").className = `dot ${bilge ? "ok" : "bad"}`;
  $("outBilge").textContent = bilge ? fmtM3(bilge.volumeM3, 1) : "—";
  $("bilgeFacts").innerHTML = bilge
    ? [
        fact("Rule", escapeHtml(bilge.rule)),
        fact("Band", escapeHtml(bilge.band)),
        fact("Formula", escapeHtml(bilge.formula)),
        fact("P", `${fmt(bilge.P, 0)} kW`),
      ].join("")
    : fact("Oily bilge holding", "—");
  $("bilgeNote").textContent = oily.hfoRequiresHeatedBilge
    ? "HFO density > 0.94 at 15 °C: Circ.642 §7.5 — holding tank required, with heating."
    : "";

  const periods = result.periods || {};
  $("legFuel").textContent = periods.fuel ? fmtPeriod(periods.fuel) : "Range ÷ Vs";
  $("fuelDays").textContent = periods.fuel ? fmtPeriod(periods.fuel) : "—";
  $("legFw").textContent = periods.freshWater ? fmtPeriod(periods.freshWater) : "Autonomy / Range ÷ Vs";
  $("legBlack").textContent = periods.wastewater ? fmtPeriod(periods.wastewater) : "NDP ≥ 7 d";
  $("legGray").textContent = periods.wastewater ? fmtPeriod(periods.wastewater) : "NDP ≥ 7 d";
  $("legSolid").textContent = periods.solidWaste ? fmtPeriod(periods.solidWaste) : "Autonomy / Range ÷ Vs";
  $("legSludge").textContent = periods.sludge ? fmtPeriod(periods.sludge) : "Autonomy / Range ÷ Vs / 30 d";
}

function setType(type) {
  state.shipType = Number(type);
  document.querySelectorAll(".type-card").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.type) === state.shipType);
  });
  updateResults();
}

function fuelShortLabel(fuel) {
  const short = {
    diesel_gas_oil: "MGO/MDO",
    light_fuel_oil: "LFO",
    heavy_fuel_oil: "HFO",
    lpg_propane: "LPG-P",
    lpg_butane: "LPG-B",
    lng: "LNG",
    methanol: "MeOH",
    ethanol: "EtOH",
  };
  return short[fuel] || TankCapacities.FUEL_LABELS[fuel] || fuel || "—";
}

function sludgeK1ModeLabel(mode) {
  if (mode === "hfo_purified") return "HFO purified for ME (K₁ = 0.015)";
  if (mode === "diesel_or_no_purification") return "MDO / no purification (K₁ = 0.005)";
  return "Auto from main-engine fuel";
}

function reportFacts(rows) {
  if (!rows.length) return "";
  return `<dl class="facts">${rows
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("")}</dl>`;
}

function reportCheck(on, text) {
  return `<div class="check"><i class="${on ? "on" : ""}"></i>${escapeHtml(text)}</div>`;
}

function reportField(label, value, extra = "") {
  return `<label class="${extra}">${label}<span class="val">${value}</span></label>`;
}

function reportEngineRows(rows, kind) {
  if (!rows.length) return `<tr><td colspan="${kind === "boiler" ? 3 : 4}">—</td></tr>`;
  if (kind === "boiler") {
    return rows
      .map(
        (b) =>
          `<tr><td>${escapeHtml(b.label)}</td><td>${fmt(b.consumptionKgPerH, 0)}</td><td>${escapeHtml(fuelShortLabel(b.fuel))}</td></tr>`,
      )
      .join("");
  }
  return rows
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.label)}</td><td>${fmt(e.powerKw, 0)}</td><td>${fmt(e.sfocGPerKwh, 1)}</td><td>${escapeHtml(fuelShortLabel(e.fuel))}</td></tr>`,
    )
    .join("");
}

async function logoDataUrl() {
  const res = await fetch("assets/arti-logo.jpg");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildReportHtml(logo, input, result) {
  const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const ship = result.ship || input?.ship || {};
  const ww = result.wastewater || { tanks: [] };
  const sw = result.solidWaste;
  const periods = result.periods || {};
  const oily = result.oilyWaste || {};
  const sludge = oily.sludge;
  const bilge = oily.oilyBilge;
  const hold = result.sewageHolding;
  const black = ww.tanks?.[0];
  const gray = ww.tanks?.[1];
  const dDigits = sludge && Math.abs(sludge.D - Math.round(sludge.D)) < 1e-9 ? 0 : 1;

  const types = TankCapacities.WASTEWATER_SHIP_TYPES.map((t) => {
    const active = Number(ship.shipType) === t.value;
    return `<button class="type-card${active ? " is-active" : ""}" type="button">
      <span class="kicker">${escapeHtml(t.kicker)}</span>
      <strong>${escapeHtml(t.label)}</strong>
      <small>${escapeHtml(t.hint)}</small>
    </button>`;
  }).join("");

  const legend = [
    ["tank-fuel", "Fuel", periods.fuel ? fmtPeriod(periods.fuel) : "Range ÷ Vs"],
    ["tank-fw", "Fresh water", periods.freshWater ? fmtPeriod(periods.freshWater) : "Autonomy / Range ÷ Vs"],
    ["tank-black", "Black water", periods.wastewater ? fmtPeriod(periods.wastewater) : "NDP ≥ 7 d"],
    ["tank-gray", "Grey water", periods.wastewater ? fmtPeriod(periods.wastewater) : "NDP ≥ 7 d"],
    ["tank-sludge", "Sludge", periods.sludge ? fmtPeriod(periods.sludge) : "Autonomy / Range ÷ Vs / 30 d"],
    ["tank-bilge", "Oily bilge", "Circ.642 rule"],
    ["tank-solid", "Solid waste", periods.solidWaste ? fmtPeriod(periods.solidWaste) : "Autonomy / Range ÷ Vs"],
  ]
    .map(
      ([cls, name, days]) =>
        `<li class="${cls}"><span>${escapeHtml(name)}</span><em>${escapeHtml(days)}</em></li>`,
    )
    .join("");

  const banners = [
    result.errors?.length ? `<div class="banner err">${escapeHtml(result.errors.join(" "))}</div>` : "",
    result.warnings?.length ? `<div class="banner warn">${escapeHtml(result.warnings.join(" "))}</div>` : "",
  ].join("");

  const swHead = sw
    ? [fmtPeriod(sw.period), sw.withCompactor ? "compactor" : "", sw.incinerator ? "incinerator ×0.6" : ""]
        .filter(Boolean)
        .join(" · ")
    : "—";
  const swTiles = (sw?.categories || [])
    .map(
      (c) =>
        `<article class="vol sw-${escapeAttr(c.category)}"><small>${escapeHtml(c.label)}</small><strong>${fmtM3(c.voyageVolumeM3, 2)}</strong></article>`,
    )
    .join("");
  const swFacts = reportFacts((sw?.categories || []).map((c) => [escapeHtml(c.label), `${fmt(c.dailyMassKg, 1)} kg/d`]));

  const blackFacts = reportFacts(
    black
      ? [
          ["Daily generation", `${fmt(black.dailyM3, 2)} m³/day`],
          ["Rate", escapeHtml(TankCapacities.wastewaterTankRateDescription(black, ww.personsOnBoard))],
        ]
      : [["Daily generation", "—"]],
  );
  const grayFacts = reportFacts(
    gray
      ? [
          ["Daily generation", `${fmt(gray.dailyM3, 2)} m³/day`],
          ["Rate", escapeHtml(TankCapacities.wastewaterTankRateDescription(gray, ww.personsOnBoard))],
          ...gray.components.map((c) => [escapeHtml(c.label), `${fmt(c.rateLPerPersonDay, 0)} L/p/d`]),
        ]
      : [["Daily generation", "—"]],
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ARTI · Tank Capacities Report</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1c2b3a;
      background: #eef3f8;
      font-size: 10.5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .brand { display: flex; gap: 10px; align-items: center; }
    header img { height: 42px; width: auto; }
    .eyebrow { margin: 0; letter-spacing: .16em; text-transform: uppercase; font-size: 8px; color: #1e6bb8; }
    h1 { margin: 2px 0 0; font-size: 18px; font-weight: 650; letter-spacing: -.03em; color: #163a7a; }
    .meta { text-align: right; }
    .chips { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
    .chip { border: 1px solid #c5d4e4; background: #fff; color: #5b6e82; border-radius: 999px; padding: 3px 8px; font-size: 9px; }
    .when { margin-top: 4px; font-size: 9px; color: #5b6e82; }
    .banner { border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10px; }
    .banner.err { background: #fdecec; color: #c23b3b; border: 1px solid #f3c4c4; }
    .banner.warn { background: rgba(194,94,18,.08); color: #a84e0c; border: 1px solid rgba(194,94,18,.3); }
    .types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
    .type-card {
      text-align: left; border: 1px solid #c5d4e4; background: linear-gradient(180deg,#fff,#f4f8fc);
      border-radius: 12px; padding: 8px 10px; color: #1c2b3a;
    }
    .type-card .kicker { display: block; color: #1e6bb8; font-size: 8px; letter-spacing: .18em; margin-bottom: 3px; }
    .type-card strong { display: block; font-size: 12px; }
    .type-card small { display: block; color: #5b6e82; margin-top: 2px; font-size: 9px; }
    .type-card.is-active { border-color: #1e6bb8; background: linear-gradient(180deg,#eaf3fb,#fff); box-shadow: inset 0 0 0 1px rgba(30,107,184,.28); }
    .legend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; list-style: none; margin: 0 0 10px; padding: 0; }
    .legend li { background: #fff; border: 1px solid #c5d4e4; border-radius: 10px; padding: 6px 8px 6px 10px; }
    .legend span { display: flex; align-items: center; font-size: 10px; font-weight: 650; color: #163a7a; }
    .legend span::before { content: ""; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; flex: none; }
    .legend .tank-fuel span::before { background: #c8960c; }
    .legend .tank-fw span::before { background: #0f8a8a; }
    .legend .tank-black span::before { background: #4a3728; }
    .legend .tank-gray span::before { background: #6d7f91; }
    .legend .tank-solid span::before { background: #2f7d4a; }
    .legend .tank-sludge span::before { background: #c25e12; }
    .legend .tank-bilge span::before { background: #6b4c9a; }
    .legend em { display: block; font-style: normal; font-size: 9px; color: #5b6e82; margin-top: 1px; }
    .legend .tank-fuel { color: #c8960c; box-shadow: inset 4px 0 0 #c8960c; }
    .legend .tank-fw { color: #0f8a8a; box-shadow: inset 4px 0 0 #0f8a8a; }
    .legend .tank-black { color: #4a3728; box-shadow: inset 4px 0 0 #4a3728; }
    .legend .tank-gray { color: #6d7f91; box-shadow: inset 4px 0 0 #6d7f91; }
    .legend .tank-solid { color: #2f7d4a; box-shadow: inset 4px 0 0 #2f7d4a; }
    .legend .tank-sludge { color: #c25e12; box-shadow: inset 4px 0 0 #c25e12; }
    .legend .tank-bilge { color: #6b4c9a; box-shadow: inset 4px 0 0 #6b4c9a; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; align-items: stretch; }
    .row-top { grid-template-columns: .92fr 1.08fr; }
    .span-2 { grid-column: 1 / -1; }
    .card {
      background: #fff; border: 1px solid #c5d4e4; border-radius: 14px; padding: 9px 10px;
      break-inside: avoid; page-break-inside: avoid;
    }
    .card.tank-fuel { border-color: #c8960c; box-shadow: inset 5px 0 0 #c8960c; }
    .card.tank-sludge { border-color: #c25e12; box-shadow: inset 5px 0 0 #c25e12; }
    .card.tank-bilge { border-color: #6b4c9a; box-shadow: inset 5px 0 0 #6b4c9a; }
    .card.tank-black { border-color: #4a3728; box-shadow: inset 5px 0 0 #4a3728; }
    .card.tank-gray { border-color: #6d7f91; box-shadow: inset 5px 0 0 #6d7f91; }
    .card.tank-solid { border-color: #2f7d4a; box-shadow: inset 5px 0 0 #2f7d4a; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
    .head h2 { margin: 0; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #163a7a; }
    .head p { margin: 0; color: #5b6e82; font-size: 9px; text-align: right; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
    label { display: flex; flex-direction: column; gap: 3px; font-size: 9px; color: #5b6e82; position: relative; }
    .val {
      display: block; background: #fff; border: 1px solid #b7c9db; border-radius: 8px;
      padding: 5px 7px; font-size: 12px; color: #1c2b3a; font-variant-numeric: tabular-nums;
    }
    .ink-fuel .val { box-shadow: inset 3px 0 0 #c8960c; }
    .ink-fw .val { box-shadow: inset 3px 0 0 #0f8a8a; }
    .ink-ww .val { box-shadow: inset 3px 0 0 #4a3728; }
    .ink-sludge .val { box-shadow: inset 3px 0 0 #c25e12; }
    .keys { position: absolute; right: 0; top: 0; display: flex; gap: 3px; }
    .keys i { width: 7px; height: 7px; border-radius: 50%; display: block; }
    .keys i.fw { background: #0f8a8a; }
    .keys i.sludge { background: #c25e12; }
    .keys i.solid { background: #2f7d4a; }
    .keys i.black { background: #4a3728; }
    .keys i.gray { background: #6d7f91; }
    .extras { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #c5d4e4; display: grid; gap: 5px; }
    .check { display: flex; align-items: center; gap: 6px; color: #1c2b3a; font-size: 10px; }
    .check i { width: 10px; height: 10px; border: 1px solid #b7c9db; border-radius: 2px; flex: none; background: #fff; }
    .check i.on { background: #163a7a; border-color: #163a7a; box-shadow: inset 0 0 0 2px #fff; }
    .mach { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .mach-boilers { grid-column: 1 / -1; }
    .mini { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #1e6bb8; font-weight: 650; margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; color: #5b6e82; padding: 3px 4px; border-bottom: 1px solid #c5d4e4; }
    td { padding: 4px; border-bottom: 1px solid #d7e2ee; font-size: 10px; }
    .vol { background: #f7fafc; border: 1px solid #d3e0ec; border-radius: 10px; padding: 8px; }
    .vol small { color: #5b6e82; letter-spacing: .08em; text-transform: uppercase; font-size: 8px; }
    .vol strong { display: block; margin-top: 2px; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.04em; }
    .vol em { color: #5b6e82; font-style: normal; font-size: 9px; }
    .tank-fuel .vol { border-color: #c8960c; }
    .tank-fuel .vol strong { color: #c8960c; }
    .tank-sludge .vol { border-color: #c25e12; }
    .tank-sludge .vol strong { color: #c25e12; }
    .tank-bilge .vol { border-color: #6b4c9a; }
    .tank-bilge .vol strong { color: #6b4c9a; }
    .tank-black .vol { border-color: #4a3728; }
    .tank-black .vol strong { color: #4a3728; }
    .tank-gray .vol { border-color: #6d7f91; }
    .tank-gray .vol strong { color: #6d7f91; }
    .sw-plastics { border-color: #2a6f97; }
    .sw-plastics strong { color: #2a6f97; }
    .sw-paper { border-color: #b8860b; }
    .sw-paper strong { color: #b8860b; }
    .sw-glass_tins { border-color: #5a7d5a; }
    .sw-glass_tins strong { color: #5a7d5a; }
    .sw-food { border-color: #c45c26; }
    .sw-food strong { color: #c45c26; }
    .facts { margin: 8px 0 0; display: grid; gap: 4px; }
    .facts div { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; border-bottom: 1px dotted rgba(91,110,130,.35); padding-bottom: 3px; }
    .facts dt { color: #5b6e82; }
    .facts dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .note { margin: 8px 0 0; font-size: 9px; color: #c25e12; }
    .row-label { margin: 10px 0 6px; letter-spacing: .14em; text-transform: uppercase; font-size: 9px; color: #1e6bb8; }
    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    footer { margin-top: 8px; border-top: 1px solid #c5d4e4; padding-top: 6px; font-size: 8px; color: #5b6e82; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <img src="${logo}" alt="ARTI Engineering" />
      <div>
        <p class="eyebrow">ARTI Engineering · Tank capacities</p>
        <h1>Dirty Oil, Wastewater &amp; Garbage</h1>
      </div>
    </div>
    <div class="meta">
      <div class="chips">
        <span class="chip">MARPOL I/12 sludge</span>
        <span class="chip">Circ.642 oily bilge</span>
        <span class="chip">BV Pt F Ch 9 Tab 1</span>
      </div>
      <div class="when">${escapeHtml(when)} · ${escapeHtml(result.shipName)} · ${escapeHtml(shipTypeLabel(ship.shipType))}</div>
    </div>
  </header>
  ${banners}
  <section class="types">${types}</section>
  <ul class="legend">${legend}</ul>

  <section class="row row-top">
    <article class="card">
      <div class="head"><h2>Ship particulars</h2><p>Duration inputs</p></div>
      ${reportField("Ship / project name", escapeHtml(result.shipName || "—"))}
      <div class="grid-2">
        ${reportField("<span>Vs (kn)</span>", fmt(ship.vsKn), "ink-fuel")}
        ${reportField("<span>Range (nm)</span>", fmt(ship.rangeNm, 0), "ink-fuel")}
        ${reportField('<span>Autonomy (days)</span><span class="keys"><i class="fw"></i><i class="sludge"></i><i class="solid"></i></span>', fmt(ship.enduranceDays), "ink-fw")}
        ${reportField('<span>No-discharge period (days)</span><span class="keys"><i class="black"></i><i class="gray"></i></span>', fmt(ship.nonDischargePeriodDays), "ink-ww")}
        ${reportField("<span>Persons on board</span>", fmt(ship.personsOnBoard, 0))}
        ${reportField('<span>K₁ — HFO purification</span><span class="keys"><i class="sludge"></i></span>', escapeHtml(sludgeK1ModeLabel(ship.sludgeK1Mode)), "ink-sludge")}
      </div>
      <div class="extras">
        ${reportCheck(ship.vacuumToilet, "Vacuum toilet (12 L/person/day · BV Tab 1)")}
        ${reportCheck(ship.withCompactor, "Waste compactor")}
        ${reportCheck(ship.solidWasteIncinerator, "Solid-waste incinerator (volume ×0.6, not glass/tins)")}
      </div>
    </article>
    <article class="card">
      <div class="head"><h2>Machinery</h2><p>kg/h = P × SFOC / 1000</p></div>
      <div class="mach">
        <div>
          <p class="mini">Main engines</p>
          <table>
            <thead><tr><th>Label</th><th>kW</th><th>SFOC</th><th>Fuel</th></tr></thead>
            <tbody>${reportEngineRows(result.mainEngines || [], "me")}</tbody>
          </table>
        </div>
        <div>
          <p class="mini">Auxiliary engines</p>
          <table>
            <thead><tr><th>Label</th><th>kW</th><th>SFOC</th><th>Fuel</th></tr></thead>
            <tbody>${reportEngineRows(result.auxiliaryEngines || [], "ae")}</tbody>
          </table>
        </div>
        <div class="mach-boilers">
          <p class="mini">Boilers</p>
          <table>
            <thead><tr><th>Label</th><th>kg/h</th><th>Fuel</th></tr></thead>
            <tbody>${reportEngineRows(result.boilers || [], "boiler")}</tbody>
          </table>
        </div>
      </div>
    </article>
  </section>

  <p class="row-label">Fuel tank · sludge · oily bilge</p>
  <section class="row">
    <article class="card tank-fuel">
      <div class="head"><h2>Fuel tank</h2><p>${escapeHtml(periods.fuel ? fmtPeriod(periods.fuel) : "—")}</p></div>
      <div class="vol"><small>Capacity</small><strong>${result.totalFuelVolumeM3 ? fmtM3(result.totalFuelVolumeM3, 1) : "—"}</strong></div>
      ${reportFacts([
        ["Daily fuel C", oily.dailyFuelM3 != null ? `${fmt(oily.dailyFuelM3, 2)} m³/day` : "—"],
        ["Main-engine rating P", oily.mainEngineRatingKw != null ? `${fmt(oily.mainEngineRatingKw, 0)} kW` : "—"],
      ])}
      <p class="note">C is daily fuel volume from all consumers at service load. P is the sum of main-engine ratings.</p>
    </article>
    <article class="card tank-sludge">
      <div class="head"><h2>Sludge tank</h2><p>${escapeHtml(oily.sludgePeriod ? fmtPeriod(oily.sludgePeriod) : "—")}</p></div>
      <div class="vol"><small>V₁ sludge</small><strong>${sludge ? fmtM3(sludge.volumeM3, 1) : "—"}</strong><em>K₁ · C · D</em></div>
      ${reportFacts([
        ["K₁", oily.k1 != null ? `${oily.k1.toFixed(3)} (${oily.k1Source}${oily.hfoPurified ? " · HFO purified" : " · no purification"})` : "—"],
        ["Discharge interval D", oily.sludgePeriod ? fmtPeriod(oily.sludgePeriod) : "—"],
        ...(sludge
          ? [
              ["K₁ × C × D", `${sludge.k1.toFixed(3)} × ${fmt(sludge.C, 2)} × ${fmt(sludge.D, dDigits)}`],
              ["Rule", escapeHtml(sludge.rule)],
              ["Formula", escapeHtml(sludge.formula)],
            ]
          : [["Sludge tank", "—"]]),
      ])}
    </article>
    <article class="card tank-bilge">
      <div class="head"><h2>Oily bilge holding</h2><p>Circ.642 §8.3</p></div>
      <div class="vol"><small>V bilge</small><strong>${bilge ? fmtM3(bilge.volumeM3, 1) : "—"}</strong><em>from P</em></div>
      ${
        bilge
          ? reportFacts([
              ["Rule", escapeHtml(bilge.rule)],
              ["Band", escapeHtml(bilge.band)],
              ["Formula", escapeHtml(bilge.formula)],
              ["P", `${fmt(bilge.P, 0)} kW`],
            ])
          : reportFacts([["Oily bilge holding", "—"]])
      }
      ${oily.hfoRequiresHeatedBilge ? `<p class="note">HFO density &gt; 0.94 at 15 °C: Circ.642 §7.5 — holding tank required, with heating.</p>` : ""}
    </article>
    <article class="card tank-solid">
      <div class="head"><h2>Solid waste</h2><p>${escapeHtml(swHead)}</p></div>
      <div class="tiles">${swTiles || `<article class="vol"><small>Solid waste</small><strong>—</strong></article>`}</div>
      ${swFacts}
    </article>
  </section>

  <p class="row-label">Wastewater · BV Pt F Ch 9 Sec 2</p>
  <section class="row">
    <article class="card tank-black">
      <div class="head"><h2>Black-water tank</h2><p>${escapeHtml(fmtPeriod(hold))}</p></div>
      <div class="vol"><small>Holding</small><strong>${black ? fmtM3(black.holdingM3, 2) : "—"}</strong></div>
      ${blackFacts}
    </article>
    <article class="card tank-gray">
      <div class="head"><h2>Gray-water tank</h2><p>${escapeHtml(fmtPeriod(hold))}</p></div>
      <div class="vol"><small>Holding</small><strong>${gray ? fmtM3(gray.holdingM3, 2) : "—"}</strong></div>
      ${grayFacts}
    </article>
  </section>

  <footer>
    <span>ARTI Engineering · confidential calculation sheet</span>
    <span>${escapeHtml(result.shipName)} · ${escapeHtml(when)}</span>
  </footer>
</body>
</html>`;
}

function printReportHtml(html) {
  const printWin = window.open("", "_blank", "noopener,noreferrer");
  if (!printWin) {
    throw new Error("Pop-up blocked. Allow pop-ups to save the PDF report.");
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  const triggerPrint = () => {
    printWin.focus();
    printWin.print();
  };
  if (printWin.document.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    printWin.onload = () => setTimeout(triggerPrint, 250);
  }
}

async function exportPdf() {
  const input = collectInput();
  const result = TankCapacities.calculate(input);
  state.lastInput = input;
  state.lastResult = result;
  const btn = $("btnPdf");
  btn.disabled = true;
  try {
    const logo = await logoDataUrl();
    const html = buildReportHtml(logo, input, result);
    if (window.artiApp?.savePdf) {
      await window.artiApp.savePdf(html);
    } else {
      printReportHtml(html);
    }
  } catch (err) {
    $("errorBox").classList.remove("hidden");
    $("errorBox").textContent = `PDF export failed: ${err.message || err}`;
  } finally {
    btn.disabled = false;
  }
}

document.querySelectorAll(".type-card").forEach((btn) => {
  btn.addEventListener("click", () => setType(btn.dataset.type));
});

$("addMe").addEventListener("click", () => {
  const n = state.mainEngines.length + 1;
  state.mainEngines.push({
    id: crypto.randomUUID(),
    label: `Main engine ${n}`,
    powerKw: 6000,
    sfocGPerKwh: 185,
    fuel: "heavy_fuel_oil",
  });
  drawAllTables();
  updateResults();
});
$("addAe").addEventListener("click", () => {
  const n = state.auxiliaryEngines.length + 1;
  state.auxiliaryEngines.push({
    id: crypto.randomUUID(),
    label: `Auxiliary engine ${n}`,
    powerKw: 800,
    sfocGPerKwh: 210,
    fuel: "diesel_gas_oil",
  });
  drawAllTables();
  updateResults();
});
$("addBoiler").addEventListener("click", () => {
  const n = state.boilers.length + 1;
  state.boilers.push({
    id: crypto.randomUUID(),
    label: `Boiler ${n}`,
    consumptionKgPerH: 350,
    fuel: "heavy_fuel_oil",
  });
  drawAllTables();
  updateResults();
});

[
  "shipName",
  "vsKn",
  "rangeNm",
  "enduranceDays",
  "nonDischargeDays",
  "personsOnBoard",
  "vacuumToilet",
  "withCompactor",
  "solidWasteIncinerator",
  "sludgeK1Mode",
].forEach((id) => {
  $(id).addEventListener("input", updateResults);
  $(id).addEventListener("change", updateResults);
});

$("btnPdf").addEventListener("click", exportPdf);

drawAllTables();
updateResults();
