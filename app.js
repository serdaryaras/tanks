const rowsContainer = document.getElementById("rowsContainer");
const rowTemplate = document.getElementById("rowTemplate");
const addRowBtn = document.getElementById("addRowBtn");
const calculateBtn = document.getElementById("calculateBtn");
const errorsBox = document.getElementById("errors");
const totalResults = document.getElementById("totalResults");
const fuelResults = document.getElementById("fuelResults");
const tankResults = document.getElementById("tankResults");
const utilityTankResults = document.getElementById("utilityTankResults");
const sludgeResults = document.getElementById("sludgeResults");
const bilgeDrainResults = document.getElementById("bilgeDrainResults");
const exportXlsxBtn = document.getElementById("exportXlsxBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const importXlsxInput = document.getElementById("importXlsxInput");
const fileStatus = document.getElementById("fileStatus");
const sludgeConstructionBasisEl = document.getElementById(
  "sludgeConstructionBasis"
);
const sludgeMethodEl = document.getElementById("sludgeMethod");
const sludgeItem3BaseEl = document.getElementById("sludgeItem3Base");
const sludgeItem3BaseGroup = document.getElementById("sludgeItem3BaseGroup");
const sludgeFuelModeGroup = document.getElementById("sludgeFuelModeGroup");
const sludgeFuelModeLabel = document.getElementById("sludgeFuelModeLabel");
const sludgeFuelModeEl = document.getElementById("sludgeFuelMode");
const grtRangeGroup = document.getElementById("grtRangeGroup");
const sludgeBallastApplyGroup = document.getElementById("sludgeBallastApplyGroup");
const sludgeBallastCapacityGroup = document.getElementById(
  "sludgeBallastCapacityGroup"
);
const sludgeBallastFuelTypeGroup = document.getElementById(
  "sludgeBallastFuelTypeGroup"
);
const REPORT_LOGO_PATH = "assets/arti_engineering_logo.png";
const SLUDGE_METHOD_OPTIONS = [
  {
    value: "item1",
    label: "Reg.12.1 .1 - Ships not carrying ballast water in fuel oil tanks",
  },
  {
    value: "item2",
    label:
      "Reg.12.1 .2 - Ships with homogenizer/incinerator or other recognized sludge control means",
  },
  {
    value: "item3",
    label: "Reg.12.1 .3 - Ships carrying ballast water in fuel oil tanks",
  },
  {
    value: "item4",
    label:
      "Reg.12.1 .4 - Ships not carrying ballast water in fuel oil tanks (C in m³/day)",
  },
  {
    value: "item5",
    label:
      "Reg.12.1 .5 - Contract/keel before 1 July 2010 with recognized sludge control means",
  },
];
const BV_GREY_COMPONENTS_LPD = {
  cruise: { greyExcl: 160, laundry: 80, galley: 90 },
  ro_ro_night: { greyExcl: 150, laundry: 20, galley: 30 },
  ro_ro_day: { greyExcl: 50, laundry: 20, galley: 30 },
  cargo: { greyExcl: 100, laundry: 40, galley: 60 },
};
const BV_BLACK_LPD = {
  conventional: 100,
  vacuum: 12,
};

function addRow() {
  const clone = rowTemplate.content.cloneNode(true);
  rowsContainer.appendChild(clone);
}

function setFileStatus(message, isError = false) {
  fileStatus.textContent = message;
  fileStatus.style.color = isError ? "#fecaca" : "";
}

async function saveBlobWithPicker(blob, suggestedName, acceptType, fallbackName) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: acceptType.description,
          accept: acceptType.accept,
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName || suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return false;
}

function clearResults() {
  totalResults.innerHTML = "";
  fuelResults.innerHTML = "";
  tankResults.innerHTML = "";
  utilityTankResults.innerHTML = "";
  sludgeResults.innerHTML = "";
  bilgeDrainResults.innerHTML = "";
}

function toggleItem3BaseVisibility() {
  if (!sludgeItem3BaseGroup) {
    return;
  }
  sludgeItem3BaseGroup.style.display =
    sludgeMethodEl.value === "item3" ? "grid" : "none";
}

function toggleGRTVisibility() {
  if (!grtRangeGroup) {
    return;
  }
  const method = sludgeMethodEl.value;
  const needsGRT =
    method === "item2" ||
    method === "item5" ||
    (method === "item3" && sludgeItem3BaseEl.value === "item2");
  grtRangeGroup.style.display = needsGRT ? "grid" : "none";
}

function toggleBallastVisibility() {
  const isItem3 = sludgeMethodEl.value === "item3";
  const display = isItem3 ? "grid" : "none";
  sludgeBallastApplyGroup.style.display = display;
  sludgeBallastCapacityGroup.style.display = display;
  sludgeBallastFuelTypeGroup.style.display = display;
}

function refreshK1InputState() {
  const method = sludgeMethodEl.value;
  const item3Base = sludgeItem3BaseEl.value;

  // Methods that use K1:
  // .1 => K1 0.01 / 0.005
  // .4/.5 => K1 0.015 / 0.005
  // .3 only when base is .1
  const usesK1 =
    method === "item1" ||
    method === "item4" ||
    method === "item5" ||
    (method === "item3" && item3Base === "item1");

  sludgeFuelModeGroup.style.display = usesK1 ? "grid" : "none";
  if (!usesK1) {
    return;
  }

  const isItem4Family = method === "item4" || method === "item5";
  sludgeFuelModeLabel.textContent = isItem4Family
    ? "Fuel Mode for K1 (0.015 / 0.005)"
    : "Fuel Mode for K1 (0.01 / 0.005)";

  // Rebuild options so the visible K1 values always match selected method.
  sludgeFuelModeEl.innerHTML = "";
  const optionA = document.createElement("option");
  optionA.value = "hfo_purified";
  optionA.textContent = isItem4Family
    ? "Heavy fuel oil purified for main engine use (K1 = 0.015)"
    : "Heavy fuel oil purified for main engine use (K1 = 0.01)";

  const optionB = document.createElement("option");
  optionB.value = "diesel_or_no_purification";
  optionB.textContent =
    "Diesel oil / heavy fuel oil without purification (K1 = 0.005)";

  sludgeFuelModeEl.appendChild(optionA);
  sludgeFuelModeEl.appendChild(optionB);
}

function refreshSludgeMethodOptions() {
  const basis = sludgeConstructionBasisEl.value;
  const allowedMethods =
    basis === "post_1990"
      ? ["item4", "item5"]
      : ["item1", "item2", "item3"];
  const currentValue = sludgeMethodEl.value;

  sludgeMethodEl.innerHTML = "";
  SLUDGE_METHOD_OPTIONS.filter((opt) => allowedMethods.includes(opt.value)).forEach(
    (opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      sludgeMethodEl.appendChild(optionEl);
    }
  );

  if (allowedMethods.includes(currentValue)) {
    sludgeMethodEl.value = currentValue;
  } else {
    sludgeMethodEl.value = allowedMethods[0];
  }

  toggleItem3BaseVisibility();
  toggleGRTVisibility();
  toggleBallastVisibility();
  refreshK1InputState();
}

function formatTons(kg) {
  return (kg / 1000).toFixed(3);
}

function formatMass(kg) {
  if (kg > 1500) {
    return `${(kg / 1000).toFixed(1)} t`;
  }

  return `${kg >= 500 ? kg.toFixed(1) : kg.toFixed(2)} kg`;
}

function formatM3(m3) {
  // 500 liters = 0.5 m3
  return `${m3 >= 0.5 ? m3.toFixed(1) : m3.toFixed(3)} m³`;
}

function getVoyageHours() {
  const duration = Number(document.getElementById("voyageDuration").value);
  const unit = document.getElementById("voyageUnit").value;

  if (Number.isNaN(duration) || duration <= 0) {
    return {
      error:
        "Voyage duration must be a positive number. Example: 240 hours or 10 days.",
    };
  }

  return { value: unit === "days" ? duration * 24 : duration };
}

function getTankSettings() {
  const storageReservePct = Number(
    document.getElementById("storageReservePct").value
  );
  const serviceHours = Number(document.getElementById("serviceHours").value);
  const settingErrors = [];

  if (!Number.isFinite(storageReservePct) || storageReservePct < 0) {
    settingErrors.push("Storage tank reserve (%) must be 0 or greater.");
  }

  if (!Number.isFinite(serviceHours) || serviceHours < 0) {
    settingErrors.push("Service tank autonomy (hours) must be 0 or greater.");
  }

  return {
    values: { storageReservePct, serviceHours },
    settingErrors,
  };
}

function getUtilityTankSettings(voyageHours) {
  const personsOnBoard = Number(document.getElementById("personsOnBoard").value);
  const shipCategory = document.getElementById("shipCategory").value;
  const blackWaterSystem = document.getElementById("blackWaterSystem").value;
  const nonDischargeDays = Number(document.getElementById("nonDischargeDays").value);
  const wasteTankTolerancePct = Number(
    document.getElementById("wasteTankTolerancePct").value
  );
  const fwTankTolerancePct = Number(
    document.getElementById("fwTankTolerancePct").value
  );
  const utilityErrors = [];

  if (!Number.isFinite(personsOnBoard) || personsOnBoard < 0) {
    utilityErrors.push("Persons on board (POB) must be 0 or greater.");
  }
  if (!BV_GREY_COMPONENTS_LPD[shipCategory]) {
    utilityErrors.push("Selected ship category is not valid.");
  }
  if (!BV_BLACK_LPD[blackWaterSystem]) {
    utilityErrors.push("Selected black water system is not valid.");
  }

  if (!Number.isFinite(nonDischargeDays) || nonDischargeDays < 7) {
    utilityErrors.push("No-discharge period (days) must be 7 or greater.");
  }

  if (!Number.isFinite(wasteTankTolerancePct) || wasteTankTolerancePct < 0) {
    utilityErrors.push("Grey/Black tank tolerance (%) must be 0 or greater.");
  }

  if (!Number.isFinite(fwTankTolerancePct) || fwTankTolerancePct < 0) {
    utilityErrors.push("FW tank tolerance (%) must be 0 or greater.");
  }

  const voyageDays = voyageHours / 24;
  const selectedGreyRates = BV_GREY_COMPONENTS_LPD[shipCategory] || {
    greyExcl: 0,
    laundry: 0,
    galley: 0,
  };
  const totalGreyRateLpd =
    selectedGreyRates.greyExcl +
    selectedGreyRates.laundry +
    selectedGreyRates.galley;
  const blackRateLpd = BV_BLACK_LPD[blackWaterSystem] || 0;
  const greyWaterDailyM3 = (personsOnBoard * totalGreyRateLpd) / 1000;
  const blackWaterDailyM3 = (personsOnBoard * blackRateLpd) / 1000;

  return {
    values: {
      personsOnBoard,
      shipCategory,
      blackWaterSystem,
      greyExclRateLpd: selectedGreyRates.greyExcl,
      laundryRateLpd: selectedGreyRates.laundry,
      galleyRateLpd: selectedGreyRates.galley,
      totalGreyRateLpd,
      blackRateLpd,
      greyWaterDailyM3,
      blackWaterDailyM3,
      nonDischargeDays,
      wasteTankTolerancePct,
      fwTankTolerancePct,
      voyageDays,
    },
    utilityErrors,
  };
}

function getSludgeSettings() {
  const sludgeConstructionBasis = document.getElementById(
    "sludgeConstructionBasis"
  ).value;
  const sludgeMethod = document.getElementById("sludgeMethod").value;
  const sludgeItem3Base = document.getElementById("sludgeItem3Base").value;
  const sludgeFuelMode = document.getElementById("sludgeFuelMode").value;
  const sludgeDays = Number(document.getElementById("sludgeDays").value);
  const grtRange = document.getElementById("grtRange").value;
  const sludgeUseBallastAddition =
    document.getElementById("sludgeUseBallastAddition").value === "yes";
  const ballastCapacityTonnes = Number(
    document.getElementById("ballastCapacityTonnes").value
  );
  const ballastFuelType = document.getElementById("ballastFuelType").value;
  const sludgeErrors = [];

  if (!["post_1990", "pre_1990"].includes(sludgeConstructionBasis)) {
    sludgeErrors.push("Invalid construction basis selection.");
  }
  if (!["item1", "item2", "item3", "item4", "item5"].includes(sludgeMethod)) {
    sludgeErrors.push("Invalid sludge regulation method.");
  }
  if (!["item1", "item2"].includes(sludgeItem3Base)) {
    sludgeErrors.push("Invalid base V1 method for item .3.");
  }
  if (!["lt400", "400to3999", "gte4000"].includes(grtRange)) {
    sludgeErrors.push("Invalid GRT range selection.");
  }
  if (!["hfo_purified", "diesel_or_no_purification"].includes(sludgeFuelMode)) {
    sludgeErrors.push("Invalid sludge fuel mode.");
  }
  if (!Number.isFinite(sludgeDays) || sludgeDays <= 0) {
    sludgeErrors.push("Sludge no-discharge period D (days) must be greater than 0.");
  }
  if (sludgeMethod === "item3" && sludgeUseBallastAddition &&
    (!Number.isFinite(ballastCapacityTonnes) || ballastCapacityTonnes < 0)) {
    sludgeErrors.push("Ballast capacity B (tonnes) must be 0 or greater.");
  }
  if (!["heavy", "diesel"].includes(ballastFuelType)) {
    sludgeErrors.push("Invalid ballast fuel type.");
  }

  return {
    values: {
      sludgeConstructionBasis,
      sludgeMethod,
      sludgeItem3Base,
      sludgeFuelMode,
      sludgeDays,
      grtRange,
      sludgeUseBallastAddition,
      ballastCapacityTonnes,
      ballastFuelType,
    },
    sludgeErrors,
  };
}

function getBilgeDrainSettings(parsedRows) {
  const mainEngineKw = parsedRows
    .filter((row) => row.equipType === "Main Engine")
    .reduce((sum, row) => sum + row.quantity * row.powerKw, 0);
  const holdDays = Number(document.getElementById("bilgeDrainDays").value);
  const bilgeDrainErrors = [];

  if (!Number.isFinite(mainEngineKw) || mainEngineKw <= 0) {
    bilgeDrainErrors.push(
      "At least one valid Main Engine row is required to derive rating P (kW)."
    );
  }
  if (!Number.isFinite(holdDays) || holdDays <= 0) {
    bilgeDrainErrors.push("Holding period D (days) must be greater than 0.");
  }

  return {
    values: {
      mainEngineKw,
      holdDays,
    },
    bilgeDrainErrors,
  };
}

function parseRows() {
  const rows = [...rowsContainer.querySelectorAll("tr")];
  const parsedRows = [];
  const rowErrors = [];

  rows.forEach((row, index) => {
    const equipType = row.querySelector(".equipType").value.trim();
    const fuelType = row.querySelector(".fuelType").value.trim().toUpperCase();
    const quantity = Number(row.querySelector(".quantity").value);
    const powerKw = Number(row.querySelector(".powerKw").value);
    const loadPct = Number(row.querySelector(".loadPct").value);
    const sfoc = Number(row.querySelector(".sfoc").value);
    const density = Number(row.querySelector(".density").value);

    if (!fuelType) {
      rowErrors.push(
        `Row ${index + 1}: Fuel type is required (e.g., HFO, MGO, LSMGO).`
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      rowErrors.push(`Row ${index + 1}: Quantity must be greater than 0.`);
    }

    if (!Number.isFinite(powerKw) || powerKw < 0) {
      rowErrors.push(
        `Row ${index + 1}: Power (kW) must be 0 or greater.`
      );
    }

    if (!Number.isFinite(loadPct) || loadPct < 0 || loadPct > 100) {
      rowErrors.push(
        `Row ${index + 1}: Load (%) must be between 0 and 100.`
      );
    }

    if (!Number.isFinite(sfoc) || sfoc < 0) {
      rowErrors.push(`Row ${index + 1}: SFOC (g/kWh) must be 0 or greater.`);
    }

    if (!Number.isFinite(density) || density <= 0) {
      rowErrors.push(
        `Row ${index + 1}: Density (kg/m³) must be greater than 0.`
      );
    }

    parsedRows.push({
      equipType,
      fuelType,
      quantity,
      powerKw,
      loadPct,
      sfoc,
      density,
    });
  });

  if (parsedRows.length === 0) {
    rowErrors.push("At least one equipment row is required.");
  }

  return { parsedRows, rowErrors };
}

function getSimpleValue(id) {
  return document.getElementById(id).value;
}

function setSimpleValue(id, value) {
  if (value === undefined || value === null) {
    return;
  }
  document.getElementById(id).value = String(value);
}

function collectInputState() {
  const { parsedRows } = parseRows();
  return {
    metadata: [{ key: "schemaVersion", value: "1" }],
    settings: [
      { key: "voyageDuration", value: getSimpleValue("voyageDuration") },
      { key: "voyageUnit", value: getSimpleValue("voyageUnit") },
      { key: "storageReservePct", value: getSimpleValue("storageReservePct") },
      { key: "serviceHours", value: getSimpleValue("serviceHours") },
      { key: "personsOnBoard", value: getSimpleValue("personsOnBoard") },
      { key: "shipCategory", value: getSimpleValue("shipCategory") },
      { key: "blackWaterSystem", value: getSimpleValue("blackWaterSystem") },
      { key: "nonDischargeDays", value: getSimpleValue("nonDischargeDays") },
      { key: "wasteTankTolerancePct", value: getSimpleValue("wasteTankTolerancePct") },
      { key: "fwTankTolerancePct", value: getSimpleValue("fwTankTolerancePct") },
      { key: "sludgeMethod", value: getSimpleValue("sludgeMethod") },
      {
        key: "sludgeConstructionBasis",
        value: getSimpleValue("sludgeConstructionBasis"),
      },
      { key: "sludgeItem3Base", value: getSimpleValue("sludgeItem3Base") },
      { key: "sludgeFuelMode", value: getSimpleValue("sludgeFuelMode") },
      { key: "sludgeDays", value: getSimpleValue("sludgeDays") },
      { key: "grtRange", value: getSimpleValue("grtRange") },
      { key: "sludgeUseBallastAddition", value: getSimpleValue("sludgeUseBallastAddition") },
      { key: "ballastCapacityTonnes", value: getSimpleValue("ballastCapacityTonnes") },
      { key: "ballastFuelType", value: getSimpleValue("ballastFuelType") },
      { key: "bilgeDrainDays", value: getSimpleValue("bilgeDrainDays") },
    ],
    machineryRows: parsedRows.map((row) => ({
      equipmentType: row.equipType,
      fuelType: row.fuelType,
      quantity: row.quantity,
      powerKw: row.powerKw,
      loadPct: row.loadPct,
      sfoc: row.sfoc,
      density: row.density,
    })),
  };
}

async function exportInputsToXlsx() {
  if (typeof XLSX === "undefined") {
    setFileStatus("XLSX library is not loaded.", true);
    return;
  }

  const state = collectInputState();
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(state.metadata),
    "Metadata"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(state.settings),
    "Settings"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(state.machineryRows),
    "MachineryRows"
  );

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const filename = `vessel_inputs_${stamp}.xlsx`;

  try {
    const xlsxArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([xlsxArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const savedWithPicker = await saveBlobWithPicker(
      blob,
      filename,
      {
        description: "Excel Workbook",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        },
      },
      filename
    );
    setFileStatus(
      savedWithPicker
        ? "Inputs saved as XLSX."
        : "Inputs downloaded as XLSX (save picker not supported in this browser)."
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setFileStatus("Save canceled.");
      return;
    }
    setFileStatus(`XLSX save failed: ${error.message}`, true);
  }
}

function readSheet(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function importInputsFromXlsx(file) {
  if (!file) {
    return;
  }
  if (typeof XLSX === "undefined") {
    setFileStatus("XLSX library is not loaded.", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const settingsRows = readSheet(workbook, "Settings");
      const machineryRows = readSheet(workbook, "MachineryRows");

      const settings = {};
      settingsRows.forEach((row) => {
        if (row.key) {
          settings[row.key] = row.value;
        }
      });

      setSimpleValue("voyageDuration", settings.voyageDuration);
      setSimpleValue("voyageUnit", settings.voyageUnit);
      setSimpleValue("storageReservePct", settings.storageReservePct);
      setSimpleValue("serviceHours", settings.serviceHours);
      setSimpleValue("personsOnBoard", settings.personsOnBoard);
      setSimpleValue("shipCategory", settings.shipCategory);
      setSimpleValue("blackWaterSystem", settings.blackWaterSystem);
      setSimpleValue("nonDischargeDays", settings.nonDischargeDays);
      setSimpleValue("wasteTankTolerancePct", settings.wasteTankTolerancePct);
      setSimpleValue("fwTankTolerancePct", settings.fwTankTolerancePct);
      setSimpleValue("sludgeMethod", settings.sludgeMethod);
      setSimpleValue("sludgeConstructionBasis", settings.sludgeConstructionBasis);
      refreshSludgeMethodOptions();
      setSimpleValue("sludgeItem3Base", settings.sludgeItem3Base);
      setSimpleValue("sludgeFuelMode", settings.sludgeFuelMode);
      setSimpleValue("sludgeDays", settings.sludgeDays);
      setSimpleValue("grtRange", settings.grtRange);
      setSimpleValue(
        "sludgeUseBallastAddition",
        settings.sludgeUseBallastAddition
      );
      setSimpleValue("ballastCapacityTonnes", settings.ballastCapacityTonnes);
      setSimpleValue("ballastFuelType", settings.ballastFuelType);
      setSimpleValue("bilgeDrainDays", settings.bilgeDrainDays);

      rowsContainer.innerHTML = "";
      if (!machineryRows.length) {
        addRow();
      } else {
        machineryRows.forEach((savedRow) => {
          addRow();
          const tr = rowsContainer.lastElementChild;
          tr.querySelector(".equipType").value = savedRow.equipmentType || "Main Engine";
          tr.querySelector(".fuelType").value = savedRow.fuelType || "";
          tr.querySelector(".quantity").value = savedRow.quantity ?? 1;
          tr.querySelector(".powerKw").value = savedRow.powerKw ?? "";
          tr.querySelector(".loadPct").value = savedRow.loadPct ?? "";
          tr.querySelector(".sfoc").value = savedRow.sfoc ?? "";
          tr.querySelector(".density").value = savedRow.density ?? "";
        });
      }

      setFileStatus("Inputs imported from XLSX successfully.");
    } catch (error) {
      setFileStatus(`Import failed: ${error.message}`, true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function createLi(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function collectResultLines() {
  const sections = [
    { key: "total", title: "Total Consumption", element: totalResults },
    { key: "fuel", title: "By Fuel Type", element: fuelResults },
    { key: "tank", title: "Tank Capacity Recommendation", element: tankResults },
    {
      key: "utility",
      title: "Waste Water and FW Tank Recommendation",
      element: utilityTankResults,
    },
    {
      key: "sludge",
      title: "Sludge Tank Recommendation (MARPOL Annex I Reg. 12.1)",
      element: sludgeResults,
    },
    {
      key: "bilgeDrain",
      title: "Bilge Water & Drain Oil Tank Recommendation (MEPC/Circular.235)",
      element: bilgeDrainResults,
    },
  ];

  return sections.map((section) => ({
    key: section.key,
    title: section.title,
    lines: [...section.element.querySelectorAll("li")].map((li) => li.textContent),
  }));
}

async function exportPdfReport() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    setFileStatus("PDF library is not loaded.", true);
    return;
  }

  const hasResults = calculate();
  if (!hasResults) {
    setFileStatus("Fix validation errors before creating PDF.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 46;

  const loadImageDataUrl = (path) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error(`Could not load logo: ${path}`));
      img.src = path;
    });

  const drawLine = (text, size = 10) => {
    const lines = pdf.splitTextToSize(text, contentWidth);
    if (y + lines.length * (size + 3) > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(size);
    pdf.text(lines, margin, y);
    y += lines.length * (size + 3) + 4;
  };

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, 95, "F");
  try {
    const logoDataUrl = await loadImageDataUrl(REPORT_LOGO_PATH);
    pdf.addImage(logoDataUrl, "PNG", margin, 14, 120, 48);
  } catch (error) {
    setFileStatus(`${error.message}. PDF will be created without logo.`, true);
  }

  pdf.setTextColor(11, 74, 140);
  pdf.setFontSize(17);
  pdf.text("Vessel Fuel Consumption Report", pageWidth - margin, 36, {
    align: "right",
  });
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 56, {
    align: "right",
  });
  pdf.text("Arti Engineering", pageWidth - margin, 71, { align: "right" });
  pdf.setDrawColor(59, 130, 197);
  pdf.setLineWidth(1);
  pdf.line(margin, 92, pageWidth - margin, 92);
  pdf.setTextColor(0, 0, 0);
  y = 118;

  const inputSummary = [
    `Voyage Duration: ${getSimpleValue("voyageDuration")} ${getSimpleValue("voyageUnit")}`,
    `Storage Reserve: ${getSimpleValue("storageReservePct")}%`,
    `Service Tank Autonomy: ${getSimpleValue("serviceHours")} h`,
    `POB: ${getSimpleValue("personsOnBoard")}`,
    `Ship Category: ${getSimpleValue("shipCategory")}`,
    `Black Water System: ${getSimpleValue("blackWaterSystem")}`,
    `No-Discharge Period: ${getSimpleValue("nonDischargeDays")} days`,
    `FW Tolerance: ${getSimpleValue("fwTankTolerancePct")}%`,
    `Grey/Black Tolerance: ${getSimpleValue("wasteTankTolerancePct")}%`,
  ];

  const sectionColorMap = {
    inputs: [230, 240, 255],
    total: [219, 234, 254],
    fuel: [224, 242, 254],
    tank: [224, 231, 255],
    utility: [243, 232, 255],
    sludge: [255, 237, 213],
    bilgeDrain: [204, 251, 241],
  };

  const estimateSectionHeight = (title, lines) => {
    const titleHeight = pdf.splitTextToSize(title, contentWidth).length * (12 + 3) + 4;
    const lineHeight = lines.reduce((acc, line) => {
      const wrapped = pdf.splitTextToSize(`- ${line}`, contentWidth - 18);
      return acc + wrapped.length * (10 + 3) + 2;
    }, 0);
    return 16 + titleHeight + lineHeight + 8;
  };

  const drawSectionBox = (title, lines, rgb) => {
    const neededHeight = estimateSectionHeight(title, lines);
    if (y + neededHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    pdf.setFillColor(...rgb);
    pdf.setDrawColor(185, 200, 220);
    pdf.roundedRect(margin, y - 8, contentWidth, neededHeight, 6, 6, "FD");

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.text(title, margin + 10, y + 10);
    y += 24;

    pdf.setFontSize(10);
    lines.forEach((line) => {
      const wrapped = pdf.splitTextToSize(`- ${line}`, contentWidth - 18);
      pdf.text(wrapped, margin + 10, y);
      y += wrapped.length * 13 + 2;
    });

    y += 8;
  };

  drawSectionBox("Inputs", inputSummary, sectionColorMap.inputs);

  const resultLines = collectResultLines();
  resultLines.forEach((section) => {
    drawSectionBox(
      section.title,
      section.lines,
      sectionColorMap[section.key] || sectionColorMap.inputs
    );
  });

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const filename = `vessel_report_${stamp}.pdf`;

  try {
    const blob = pdf.output("blob");
    const savedWithPicker = await saveBlobWithPicker(
      blob,
      filename,
      {
        description: "PDF Document",
        accept: {
          "application/pdf": [".pdf"],
        },
      },
      filename
    );
    setFileStatus(
      savedWithPicker
        ? "PDF report saved."
        : "PDF report downloaded (save picker not supported in this browser)."
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setFileStatus("Save canceled.");
      return;
    }
    setFileStatus(`PDF save failed: ${error.message}`, true);
  }
}

function calculate() {
  errorsBox.textContent = "";
  clearResults();

  const voyage = getVoyageHours();
  const tankSettings = getTankSettings();
  const utilityTankSettings = getUtilityTankSettings(voyage.value || 0);
  const sludgeSettings = getSludgeSettings();
  const { parsedRows, rowErrors } = parseRows();
  const bilgeDrainSettings = getBilgeDrainSettings(parsedRows);
  const allErrors = [
    ...rowErrors,
    ...tankSettings.settingErrors,
    ...utilityTankSettings.utilityErrors,
    ...sludgeSettings.sludgeErrors,
    ...bilgeDrainSettings.bilgeDrainErrors,
  ];

  if (voyage.error) {
    allErrors.push(voyage.error);
  }

  if (allErrors.length > 0) {
    errorsBox.textContent = allErrors.join("\n");
    return false;
  }

  let totalHourlyKg = 0;
  let totalDailyM3 = 0;
  const byFuel = {};

  parsedRows.forEach((row) => {
    const hourlyKg =
      row.quantity * row.powerKw * (row.loadPct / 100) * (row.sfoc / 1000);
    const hourlyM3 = hourlyKg / row.density;
    totalHourlyKg += hourlyKg;

    if (!byFuel[row.fuelType]) {
      byFuel[row.fuelType] = { hourlyKg: 0, hourlyM3: 0 };
    }

    byFuel[row.fuelType].hourlyKg += hourlyKg;
    byFuel[row.fuelType].hourlyM3 += hourlyM3;
  });

  const totalDailyKg = totalHourlyKg * 24;
  const totalVoyageKg = totalHourlyKg * voyage.value;

  totalResults.appendChild(
    createLi(`Hourly Total: ${formatMass(totalHourlyKg)}/h (${formatTons(totalHourlyKg)} t/h)`)
  );
  totalResults.appendChild(
    createLi(`Daily Total: ${formatMass(totalDailyKg)}/day (${formatTons(totalDailyKg)} t/day)`)
  );
  totalResults.appendChild(
    createLi(`Voyage Total: ${formatMass(totalVoyageKg)} (${formatTons(totalVoyageKg)} t)`)
  );

  const tankNeedByFuel = {};

  Object.entries(byFuel).forEach(([fuel, data]) => {
    const hourly = data.hourlyKg;
    const daily = hourly * 24;
    const voyageTotal = hourly * voyage.value;
    const hourlyM3 = data.hourlyM3;
    const dailyM3 = hourlyM3 * 24;
    totalDailyM3 += dailyM3;
    const voyageM3 = hourlyM3 * voyage.value;

    fuelResults.appendChild(
      createLi(
        `${fuel} -> ${formatMass(hourly)}/h (${formatM3(hourlyM3)}/h), ${formatMass(daily)}/day (${formatM3(dailyM3)}/day), ${formatMass(voyageTotal)}/voyage (${formatM3(voyageM3)}/voyage)`
      )
    );

    const storageTankM3 =
      voyageM3 * (1 + tankSettings.values.storageReservePct / 100);
    const serviceTankM3 = hourlyM3 * tankSettings.values.serviceHours;
    const totalTankNeedM3 = storageTankM3 + serviceTankM3;

    tankNeedByFuel[fuel] = totalTankNeedM3;

    tankResults.appendChild(
      createLi(
        `${fuel} -> Storage Tank: ${formatM3(storageTankM3)} (with ${tankSettings.values.storageReservePct.toFixed(1)}% reserve), Service Tank: ${formatM3(serviceTankM3)} (${tankSettings.values.serviceHours.toFixed(1)} h autonomy), Total Need: ${formatM3(totalTankNeedM3)}`
      )
    );
  });

  if (tankNeedByFuel.HFO) {
    totalResults.appendChild(
      createLi(`HFO Tank Need (Storage + Service): ${formatM3(tankNeedByFuel.HFO)}`)
    );
  }

  if (tankNeedByFuel.MGO) {
    totalResults.appendChild(
      createLi(`MGO Tank Need (Storage + Service): ${formatM3(tankNeedByFuel.MGO)}`)
    );
  }

  const {
    personsOnBoard,
    shipCategory,
    blackWaterSystem,
    greyExclRateLpd,
    laundryRateLpd,
    galleyRateLpd,
    totalGreyRateLpd,
    blackRateLpd,
    greyWaterDailyM3,
    blackWaterDailyM3,
    nonDischargeDays,
    wasteTankTolerancePct,
    fwTankTolerancePct,
    voyageDays,
  } = utilityTankSettings.values;

  const greyTankM3 =
    greyWaterDailyM3 * nonDischargeDays * (1 + wasteTankTolerancePct / 100);
  const blackTankM3 =
    blackWaterDailyM3 * nonDischargeDays * (1 + wasteTankTolerancePct / 100);
  const totalWasteDailyM3 = greyWaterDailyM3 + blackWaterDailyM3;
  const fwTankM3 =
    totalWasteDailyM3 * voyageDays * (1 + fwTankTolerancePct / 100);

  utilityTankResults.appendChild(
    createLi(
      `Grey Water Tank Need: ${formatM3(greyTankM3)} (No-discharge: ${nonDischargeDays.toFixed(1)} days, Tolerance: ${wasteTankTolerancePct.toFixed(1)}%)`
    )
  );
  utilityTankResults.appendChild(
    createLi(
      `Black Water Tank Need: ${formatM3(blackTankM3)} (No-discharge: ${nonDischargeDays.toFixed(1)} days, Tolerance: ${wasteTankTolerancePct.toFixed(1)}%)`
    )
  );
  utilityTankResults.appendChild(
    createLi(
      `FW Tank Need: ${formatM3(fwTankM3)} (Voyage autonomy/endurance: ${voyageDays.toFixed(1)} days, Tolerance: ${fwTankTolerancePct.toFixed(1)}%)`
    )
  );
  utilityTankResults.appendChild(
    createLi(
      `Total Grey + Black Generation: ${formatM3(totalWasteDailyM3)}/day`
    )
  );
  utilityTankResults.appendChild(
    createLi(
      `BV rule-based inputs used: Category=${shipCategory}, POB=${personsOnBoard.toFixed(0)}, Grey(excl/laundry/galley)=${greyExclRateLpd.toFixed(1)}/${laundryRateLpd.toFixed(1)}/${galleyRateLpd.toFixed(1)} L/person/day -> Total Grey=${totalGreyRateLpd.toFixed(1)} L/person/day, Black=${blackRateLpd.toFixed(1)} L/person/day (${blackWaterSystem})`
    )
  );

  const {
    sludgeConstructionBasis,
    sludgeMethod,
    sludgeItem3Base,
    sludgeFuelMode,
    sludgeDays,
    grtRange,
    sludgeUseBallastAddition,
    ballastCapacityTonnes,
    ballastFuelType,
  } = sludgeSettings.values;
  const totalDailyTon = totalDailyKg / 1000;
  let baseV1 = 0;
  let k1 = null;
  let methodDescription = "";

  const grtMinV = grtRange === "gte4000" ? 2 : grtRange === "400to3999" ? 1 : 0;

  if (sludgeMethod === "item1") {
    k1 = sludgeFuelMode === "hfo_purified" ? 0.01 : 0.005;
    baseV1 = k1 * totalDailyTon * sludgeDays;
    methodDescription = "Item .1";
  } else if (sludgeMethod === "item2") {
    baseV1 = grtMinV;
    methodDescription = "Item .2";
  } else if (sludgeMethod === "item3") {
    if (sludgeItem3Base === "item1") {
      k1 = sludgeFuelMode === "hfo_purified" ? 0.01 : 0.005;
      baseV1 = k1 * totalDailyTon * sludgeDays;
    } else {
      baseV1 = grtMinV;
    }
    methodDescription = "Item .3 (base V1 from " + sludgeItem3Base.replace("item", ".") + ")";
  } else if (sludgeMethod === "item4") {
    k1 = sludgeFuelMode === "hfo_purified" ? 0.015 : 0.005;
    baseV1 = k1 * totalDailyM3 * sludgeDays;
    methodDescription = "Item .4";
  } else if (sludgeMethod === "item5") {
    k1 = sludgeFuelMode === "hfo_purified" ? 0.015 : 0.005;
    const v4 = k1 * totalDailyM3 * sludgeDays;
    const v51 = 0.5 * v4;
    const v52 = grtMinV;
    baseV1 = Math.max(v51, v52);
    methodDescription = "Item .5";
    sludgeResults.appendChild(
      createLi(
        `Item .5 detail: .5.1=${formatM3(v51)}, .5.2=${formatM3(v52)} -> Selected V1=${formatM3(baseV1)}`
      )
    );
  }

  let finalV = baseV1;
  let ballastAddition = 0;
  if (sludgeMethod === "item3" && sludgeUseBallastAddition) {
    const k2 = ballastFuelType === "heavy" ? 0.01 : 0.005;
    ballastAddition = k2 * ballastCapacityTonnes;
    finalV += ballastAddition;
    sludgeResults.appendChild(
      createLi(
        `Item .3 addition: K2=${k2.toFixed(3)}, B=${ballastCapacityTonnes.toFixed(
          2
        )} t -> K2 x B = ${formatM3(ballastAddition)}`
      )
    );
  }

  sludgeResults.appendChild(
    createLi(
      `${methodDescription} base V1: ${formatM3(baseV1)}`
    )
  );
  const methodGroup = ["item4", "item5"].includes(sludgeMethod)
    ? "post_1990_set"
    : ["item1", "item2"].includes(sludgeMethod)
      ? "pre_1990_set"
      : "item3";
  if (
    (sludgeConstructionBasis === "post_1990" && methodGroup === "pre_1990_set") ||
    (sludgeConstructionBasis === "pre_1990" && methodGroup === "post_1990_set")
  ) {
    sludgeResults.appendChild(
      createLi(
        "Regulatory note: selected construction basis and method family are mixed. Review if this is intentional."
      )
    );
  } else {
    sludgeResults.appendChild(
      createLi("Regulatory note: selected construction basis and method family are aligned.")
    );
  }
  if (k1 !== null) {
    if (sludgeMethod === "item1") {
      sludgeResults.appendChild(
        createLi(
          `Inputs used (.1): K1=${k1.toFixed(3)}, C=${totalDailyTon.toFixed(
            3
          )} t/day, D=${sludgeDays.toFixed(1)} days`
        )
      );
    } else if (sludgeMethod === "item4" || sludgeMethod === "item5") {
      sludgeResults.appendChild(
        createLi(
          `Inputs used (.4/.5): K1=${k1.toFixed(3)}, C=${totalDailyM3.toFixed(
            3
          )} m³/day, D=${sludgeDays.toFixed(1)} days`
        )
      );
    } else if (sludgeMethod === "item3") {
      sludgeResults.appendChild(
        createLi(
          `Inputs used (.3 base .1): K1=${k1.toFixed(3)}, C=${totalDailyTon.toFixed(
            3
          )} t/day, D=${sludgeDays.toFixed(1)} days`
        )
      );
    }
  } else {
    if (sludgeMethod === "item2") {
      sludgeResults.appendChild(
        createLi(`Inputs used (.2): GRT range=${grtRange}`)
      );
    } else if (sludgeMethod === "item3" && sludgeItem3Base === "item2") {
      sludgeResults.appendChild(
        createLi(`Inputs used (.3 base .2): GRT range=${grtRange}`)
      );
    }
  }
  sludgeResults.appendChild(
    createLi(`Required Sludge Tank Capacity: ${formatM3(finalV)}`)
  );

  const {
    mainEngineKw,
    holdDays,
  } = bilgeDrainSettings.values;
  let bilgeCapacityM3 = 0;
  if (mainEngineKw <= 1000) {
    bilgeCapacityM3 = 1.5;
  } else if (mainEngineKw <= 20000) {
    bilgeCapacityM3 = 1.5 + (mainEngineKw - 1000) / 1500;
  } else {
    bilgeCapacityM3 = 14.2 + (0.2 * (mainEngineKw - 20000)) / 1500;
  }

  let drainOilCapacityM3 = 0;
  if (mainEngineKw <= 10000) {
    drainOilCapacityM3 = (20 * holdDays * mainEngineKw) / 1_000_000;
  } else {
    drainOilCapacityM3 =
      holdDays * (0.2 + (7 * (mainEngineKw - 10000)) / 1_000_000);
  }

  bilgeDrainResults.appendChild(
    createLi(
      `Bilge Water Holding Tank Capacity: ${formatM3(bilgeCapacityM3)} (P=${mainEngineKw.toFixed(
        0
      )} kW, MEPC/Circular.235 rating method)`
    )
  );
  bilgeDrainResults.appendChild(
    createLi(
      `Drain & Leakage Oil Tank Capacity: ${formatM3(
        drainOilCapacityM3
      )} (P=${mainEngineKw.toFixed(0)} kW, D=${holdDays.toFixed(
        1
      )} days, MEPC/Circular.235 method)`
    )
  );
  return true;
}

addRowBtn.addEventListener("click", addRow);
calculateBtn.addEventListener("click", calculate);
exportXlsxBtn.addEventListener("click", () => {
  exportInputsToXlsx();
});
exportPdfBtn.addEventListener("click", () => {
  exportPdfReport();
});
importXlsxInput.addEventListener("change", (event) => {
  importInputsFromXlsx(event.target.files[0]);
});
sludgeConstructionBasisEl.addEventListener("change", refreshSludgeMethodOptions);
sludgeMethodEl.addEventListener("change", toggleItem3BaseVisibility);
sludgeMethodEl.addEventListener("change", toggleGRTVisibility);
sludgeMethodEl.addEventListener("change", toggleBallastVisibility);
sludgeMethodEl.addEventListener("change", refreshK1InputState);
sludgeItem3BaseEl.addEventListener("change", toggleGRTVisibility);
sludgeItem3BaseEl.addEventListener("change", refreshK1InputState);

rowsContainer.addEventListener("click", (event) => {
  if (!event.target.classList.contains("removeRowBtn")) {
    return;
  }

  const row = event.target.closest("tr");
  if (row) {
    row.remove();
  }
});

addRow();
refreshSludgeMethodOptions();
toggleGRTVisibility();
toggleBallastVisibility();
refreshK1InputState();
