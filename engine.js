(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TankCapacities = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const FUEL_TYPES = [
    "diesel_gas_oil",
    "light_fuel_oil",
    "heavy_fuel_oil",
    "lpg_propane",
    "lpg_butane",
    "lng",
    "methanol",
    "ethanol",
  ];

  const FUEL_LABELS = {
    diesel_gas_oil: "Diesel / gas oil (ISO DMX–DMB)",
    light_fuel_oil: "Light fuel oil (ISO RMA–RMD)",
    heavy_fuel_oil: "Heavy fuel oil (ISO RME–RMK)",
    lpg_propane: "LPG (propane)",
    lpg_butane: "LPG (butane)",
    lng: "LNG",
    methanol: "Methanol",
    ethanol: "Ethanol",
  };

  const DEFAULT_FUEL_DENSITY_KG_M3 = {
    diesel_gas_oil: 850,
    light_fuel_oil: 900,
    heavy_fuel_oil: 991,
    lpg_propane: 500,
    lpg_butane: 540,
    lng: 450,
    methanol: 792,
    ethanol: 789,
  };

  const DEFAULT_SLUDGE_DAYS = 30;
  const MIN_WASTEWATER_HOLDING_DAYS = 7;
  const PERIOD_SOURCE_LABELS = {
    autonomy: "Autonomy",
    range_voyage: "Range ÷ Vs",
    non_discharge: "No-discharge",
    non_discharge_min_7: "No-discharge, min. 7 d",
    minimum_7: "Minimum 7 d",
    default_30: "Default 30 d",
    rule: "Circ.642 rule",
  };
  const SLUDGE_K1_HFO_PURIFIED = 0.015;
  const SLUDGE_K1_NO_PURIFICATION = 0.005;
  const HFO_DENSITY_REQUIRES_BILGE_HOLDING_KG_M3 = 940;

  const WASTEWATER_SHIP_TYPES = [
    { value: 1, label: "Cruise ship", kicker: "01", hint: "High hotel load" },
    { value: 2, label: "Night Ro-Pax", kicker: "02", hint: "Overnight passengers" },
    { value: 3, label: "Day Ro-Pax", kicker: "03", hint: "Day voyages" },
    { value: 4, label: "Cargo ship", kicker: "04", hint: "Crew only" },
  ];

  const NO_VACUUM = {
    1: [100, 160, 80, 90],
    2: [100, 150, 20, 30],
    3: [100, 50, 20, 30],
    4: [100, 100, 40, 60],
  };

  const VACUUM = {
    1: [12, 160, 80, 90],
    2: [12, 150, 20, 30],
    3: [12, 50, 20, 30],
    4: [12, 100, 40, 60],
  };

  const WASTEWATER_STREAM_ORDER = ["black", "gray", "laundry", "galley"];
  const WASTEWATER_STREAM_LABELS = {
    black: "Black water",
    gray: "Gray water",
    laundry: "Laundry",
    galley: "Galley",
  };
  const GRAY_TANK_STREAMS = ["gray", "laundry", "galley"];
  const LITERS_PER_M3 = 1000;

  const SOLID_WASTE_CATEGORY_ORDER = ["plastics", "paper", "glass_tins", "food"];
  const SOLID_WASTE_LABELS = {
    plastics: "Plastic",
    paper: "Paper / cardboard",
    glass_tins: "Glass / tins",
    food: "Food",
  };
  const DEFAULT_RATES_KG_PER_PD = { plastics: 0.1, paper: 1.0, glass_tins: 1.0, food: 0.7 };
  const BULK_DENSITY_NO_COMPACTOR_KG_M3 = { plastics: 40, paper: 40, glass_tins: 160, food: 300 };
  const BULK_DENSITY_WITH_COMPACTOR_KG_M3 = { plastics: 410, paper: 410, glass_tins: 1600, food: 300 };
  const INCINERATOR_VOLUME_REMAINING_FRACTION = 0.6;
  const INCINERATOR_CATEGORIES = ["plastics", "paper", "food"];
  const INCINERATOR_CATEGORY_LABELS = "Plastic, Paper, Food";

  function toNum(v) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function engineFuelKg(powerKw, sfocGPerKwh, hours) {
    return (powerKw * sfocGPerKwh * hours) / 1000;
  }

  function boilerFuelKg(kgPerH, hours) {
    return kgPerH * hours;
  }

  function density(fuel, densities, fallback) {
    const d = densities[fuel];
    return d != null && d > 0 ? d : fallback;
  }

  function addMass(map, fuel, label, massKg) {
    if (massKg <= 0) return;
    const entry = map.get(fuel) || { massKg: 0, consumers: [] };
    entry.massKg += massKg;
    entry.consumers.push({ label, massKg });
    map.set(fuel, entry);
  }

  function voyageHours(rangeNm, vsKn) {
    if (!(rangeNm > 0) || !(vsKn > 0)) return null;
    return rangeNm / vsKn;
  }

  function makePeriod(days, source) {
    if (!(days > 0) || !Number.isFinite(days)) return null;
    return { days, hours: days * 24, source };
  }

  function resolveVoyagePeriod(rangeNm, vsKn) {
    const hours = voyageHours(rangeNm, vsKn);
    if (hours == null) return null;
    return { days: hours / 24, hours, source: "range_voyage" };
  }

  function resolveAutonomyPeriod(autonomyDays, voyage) {
    if (autonomyDays > 0) return makePeriod(autonomyDays, "autonomy");
    if (voyage && voyage.days > 0) {
      return { days: voyage.days, hours: voyage.hours, source: "range_voyage" };
    }
    return null;
  }

  function resolveFwAutonomy(enduranceDays, voyageDays) {
    const voyage = voyageDays > 0 ? makePeriod(voyageDays, "range_voyage") : null;
    return resolveAutonomyPeriod(enduranceDays, voyage);
  }

  function resolveWastewaterPeriod(nonDischargeDays) {
    const ndp = nonDischargeDays > 0 ? nonDischargeDays : 0;
    if (ndp >= MIN_WASTEWATER_HOLDING_DAYS) return makePeriod(ndp, "non_discharge");
    if (ndp > 0) return makePeriod(MIN_WASTEWATER_HOLDING_DAYS, "non_discharge_min_7");
    return makePeriod(MIN_WASTEWATER_HOLDING_DAYS, "minimum_7");
  }

  function resolveSewageHolding(nonDischargePeriodDays) {
    return resolveWastewaterPeriod(nonDischargePeriodDays);
  }

  function resolveSolidWastePeriod(autonomyDays, voyage) {
    return resolveAutonomyPeriod(autonomyDays, voyage);
  }

  function resolveSludgePeriod(autonomyDays, voyage) {
    if (autonomyDays > 0) return makePeriod(autonomyDays, "autonomy");
    if (voyage && voyage.days > 0) {
      return { days: voyage.days, hours: voyage.hours, source: "range_voyage" };
    }
    return makePeriod(DEFAULT_SLUDGE_DAYS, "default_30");
  }

  function wastewaterRatesLPerPersonDay(shipType, vacuumToilet) {
    const table = vacuumToilet ? VACUUM : NO_VACUUM;
    const row = table[shipType];
    if (!row) return null;
    const [b, g, l, ga] = row;
    return { black: b, gray: g, laundry: l, galley: ga };
  }

  function sumStreams(streams, pick) {
    return streams.reduce((total, stream) => total + pick(stream), 0);
  }

  function wastewaterTankRateDescription(tank, personsOnBoard) {
    if (tank.id === "black") {
      return `${tank.rateLPerPersonDay} L/person/day × ${personsOnBoard} persons`;
    }
    const parts = tank.components
      .map((c) => `${c.label} ${c.rateLPerPersonDay}`)
      .join(" + ");
    return `${parts} L/person/day × ${personsOnBoard} persons`;
  }

  function computeWastewater(shipType, vacuumToilet, personsOnBoard, nonDischargeDays) {
    const rates = wastewaterRatesLPerPersonDay(shipType, vacuumToilet);
    if (!rates || !(personsOnBoard > 0) || !(nonDischargeDays > 0)) return null;

    const streams = WASTEWATER_STREAM_ORDER.map((stream) => {
      const rateLPerPersonDay = rates[stream];
      const dailyLiters = rateLPerPersonDay * personsOnBoard;
      const holdingLiters = dailyLiters * nonDischargeDays;
      return {
        stream,
        label: WASTEWATER_STREAM_LABELS[stream],
        rateLPerPersonDay,
        dailyLiters,
        dailyM3: dailyLiters / LITERS_PER_M3,
        holdingLiters,
        holdingM3: holdingLiters / LITERS_PER_M3,
      };
    });

    const black = streams.find((s) => s.stream === "black");
    const grayComponents = streams.filter((s) => GRAY_TANK_STREAMS.includes(s.stream));
    const tanks = [
      {
        id: "black",
        label: "Black water",
        rateLPerPersonDay: black.rateLPerPersonDay,
        dailyLiters: black.dailyLiters,
        dailyM3: black.dailyM3,
        holdingLiters: black.holdingLiters,
        holdingM3: black.holdingM3,
        components: [black],
      },
      {
        id: "gray",
        label: "Gray water",
        rateLPerPersonDay: sumStreams(grayComponents, (s) => s.rateLPerPersonDay),
        dailyLiters: sumStreams(grayComponents, (s) => s.dailyLiters),
        dailyM3: sumStreams(grayComponents, (s) => s.dailyM3),
        holdingLiters: sumStreams(grayComponents, (s) => s.holdingLiters),
        holdingM3: sumStreams(grayComponents, (s) => s.holdingM3),
        components: grayComponents,
      },
    ];

    const blackTank = tanks[0];
    const grayTank = tanks[1];
    const totalDailyLiters = streams.reduce((s, x) => s + x.dailyLiters, 0);
    const totalHoldingLiters = tanks.reduce((s, t) => s + t.holdingLiters, 0);

    return {
      shipType,
      vacuumToilet,
      personsOnBoard,
      streams,
      tanks,
      totalDailyLiters,
      totalDailyM3: totalDailyLiters / LITERS_PER_M3,
      totalHoldingLiters,
      totalHoldingM3: totalHoldingLiters / LITERS_PER_M3,
      blackWaterDailyM3: blackTank.dailyM3,
      grayWaterTotalDailyM3: grayTank.dailyM3,
      grayWaterTotalHoldingM3: grayTank.holdingM3,
      blackWaterHoldingM3: blackTank.holdingM3,
    };
  }

  function computeFreshWater(wastewater, fwAutonomy) {
    if (!wastewater || !fwAutonomy || !(fwAutonomy.days > 0)) return null;
    return {
      dailyLiters: wastewater.totalDailyLiters,
      dailyM3: wastewater.totalDailyM3,
      tankLiters: wastewater.totalDailyLiters * fwAutonomy.days,
      tankM3: wastewater.totalDailyM3 * fwAutonomy.days,
    };
  }

  function computeSolidWaste(personsOnBoard, period, withCompactor, incinerator) {
    if (!(personsOnBoard > 0) || !period || !(period.days > 0)) return null;
    const bulkDensity = withCompactor
      ? BULK_DENSITY_WITH_COMPACTOR_KG_M3
      : BULK_DENSITY_NO_COMPACTOR_KG_M3;

    const categories = SOLID_WASTE_CATEGORY_ORDER.map((category) => {
      const dailyMassKg = DEFAULT_RATES_KG_PER_PD[category] * personsOnBoard;
      const voyageMassKg = dailyMassKg * period.days;
      const rho = bulkDensity[category];
      let dailyVolumeM3 = rho > 0 ? dailyMassKg / rho : 0;
      let voyageVolumeM3 = rho > 0 ? voyageMassKg / rho : 0;
      if (incinerator && INCINERATOR_CATEGORIES.includes(category)) {
        dailyVolumeM3 *= INCINERATOR_VOLUME_REMAINING_FRACTION;
        voyageVolumeM3 *= INCINERATOR_VOLUME_REMAINING_FRACTION;
      }
      return {
        category,
        label: SOLID_WASTE_LABELS[category],
        rateKgPerPersonDay: DEFAULT_RATES_KG_PER_PD[category],
        dailyMassKg,
        dailyVolumeM3,
        voyageMassKg,
        voyageVolumeM3,
      };
    });

    return {
      personsOnBoard,
      period,
      withCompactor,
      incinerator,
      categories,
    };
  }

  function accumulateRangeFuel(hours, mainEngines, auxiliaryEngines, boilers, fuelDensityKgM3, defaultDensity) {
    const byFuel = new Map();
    for (const e of mainEngines) {
      addMass(byFuel, e.fuel, e.label, engineFuelKg(e.powerKw, e.sfocGPerKwh, hours));
    }
    for (const e of auxiliaryEngines) {
      addMass(byFuel, e.fuel, e.label, engineFuelKg(e.powerKw, e.sfocGPerKwh, hours));
    }
    for (const b of boilers) {
      addMass(byFuel, b.fuel, b.label, boilerFuelKg(b.consumptionKgPerH, hours));
    }

    const breakdown = [];
    for (const [fuel, data] of byFuel) {
      const rho = density(fuel, fuelDensityKgM3, defaultDensity[fuel]);
      breakdown.push({
        fuel,
        massKg: data.massKg,
        volumeM3: data.massKg / rho,
        consumers: data.consumers,
      });
    }
    breakdown.sort((a, b) => b.massKg - a.massKg);
    return breakdown;
  }

  function dailyFuelConsumptionM3(
    mainEngines,
    auxiliaryEngines,
    boilers,
    fuelDensityKgM3,
    defaultDensity,
  ) {
    return accumulateRangeFuel(
      24,
      mainEngines,
      auxiliaryEngines,
      boilers,
      fuelDensityKgM3,
      defaultDensity,
    ).reduce((sum, row) => sum + row.volumeM3, 0);
  }

  function mainEngineRatingKw(mainEngines) {
    return (mainEngines || []).reduce((sum, e) => sum + (e.powerKw > 0 ? e.powerKw : 0), 0);
  }

  function resolveSludgeK1(mode, mainEngines) {
    if (mode === "hfo_purified") {
      return { k1: SLUDGE_K1_HFO_PURIFIED, hfoPurified: true, source: "manual" };
    }
    if (mode === "diesel_or_no_purification") {
      return { k1: SLUDGE_K1_NO_PURIFICATION, hfoPurified: false, source: "manual" };
    }
    const hfoPurified = (mainEngines || []).some((e) => e.fuel === "heavy_fuel_oil" && e.powerKw > 0);
    return {
      k1: hfoPurified ? SLUDGE_K1_HFO_PURIFIED : SLUDGE_K1_NO_PURIFICATION,
      hfoPurified,
      source: "auto",
    };
  }

  function computeSludgeTank(C, D, k1) {
    if (!(C > 0) || !(D > 0) || !(k1 > 0)) return null;
    return {
      k1,
      C,
      D,
      volumeM3: k1 * C * D,
      rule: "MARPOL Annex I Reg. 12 · MEPC.1/Circ.867 item .4",
      formula: "V₁ = K₁ · C · D",
    };
  }

  function computeOilyBilgeHolding(P) {
    if (!(P > 0)) return null;
    let volumeM3;
    let band;
    let formula;
    if (P <= 1000) {
      volumeM3 = 4;
      band = "P ≤ 1 000 kW";
      formula = "4 m³";
    } else if (P <= 20000) {
      volumeM3 = P / 250;
      band = "1 000 < P ≤ 20 000 kW";
      formula = "P / 250";
    } else {
      volumeM3 = 40 + P / 500;
      band = "P > 20 000 kW";
      formula = "40 + P / 500";
    }
    return {
      P,
      volumeM3,
      band,
      formula,
      rule: "MEPC.1/Circ.642 §8.3",
    };
  }

  function fuelsInUse(form) {
    const set = new Set();
    for (const e of form.mainEngines || []) set.add(e.fuel);
    for (const e of form.auxiliaryEngines || []) set.add(e.fuel);
    for (const b of form.boilers || []) {
      if (Number(b.consumptionKgPerH) > 0) set.add(b.fuel);
    }
    return FUEL_TYPES.filter((f) => set.has(f));
  }

  function normalizeConsumers(list, kind) {
    return (Array.isArray(list) ? list : []).map((row, i) => {
      if (kind === "boiler") {
        return {
          id: row.id,
          label: String(row.label || "").trim() || `Boiler ${i + 1}`,
          consumptionKgPerH: toNum(row.consumptionKgPerH) || 0,
          fuel: row.fuel || "heavy_fuel_oil",
        };
      }
      const prefix = kind === "ae" ? "Auxiliary engine" : "Main engine";
      return {
        id: row.id,
        label: String(row.label || "").trim() || `${prefix} ${i + 1}`,
        powerKw: toNum(row.powerKw) || 0,
        sfocGPerKwh: toNum(row.sfocGPerKwh) || 0,
        fuel: row.fuel || (kind === "ae" ? "diesel_gas_oil" : "heavy_fuel_oil"),
      };
    });
  }

  function validate(form) {
    const errors = [];
    const ship = form.ship || {};
    const vsKn = toNum(ship.vsKn);
    const rangeNm = toNum(ship.rangeNm);
    const enduranceDays = toNum(ship.enduranceDays);
    const nonDischarge = toNum(ship.nonDischargePeriodDays);
    const pob = toNum(ship.personsOnBoard);

    if (vsKn != null && vsKn <= 0) errors.push("Service speed V_s must be positive.");
    if (rangeNm != null && rangeNm <= 0) errors.push("Design range must be positive.");
    if (enduranceDays != null && enduranceDays < 0) errors.push("Autonomy must be zero or greater.");
    if (nonDischarge != null && nonDischarge <= 0) errors.push("No-discharge period must be positive.");
    if (!(pob > 0)) errors.push("Enter persons on board.");
    if (![1, 2, 3, 4].includes(Number(ship.shipType))) errors.push("Select ship type.");

    (form.mainEngines || []).forEach((e, i) => {
      if (!(toNum(e.powerKw) > 0)) errors.push(`Main engine ${i + 1}: enter service power.`);
      if (!(toNum(e.sfocGPerKwh) > 0)) errors.push(`Main engine ${i + 1}: enter SFOC.`);
    });
    (form.auxiliaryEngines || []).forEach((e, i) => {
      if (!(toNum(e.powerKw) > 0)) errors.push(`Auxiliary engine ${i + 1}: enter service power.`);
      if (!(toNum(e.sfocGPerKwh) > 0)) errors.push(`Auxiliary engine ${i + 1}: enter SFOC.`);
    });
    (form.boilers || []).forEach((b, i) => {
      const c = toNum(b.consumptionKgPerH);
      if (c == null || c < 0) errors.push(`Boiler ${i + 1}: consumption cannot be negative.`);
    });

    const densities = form.fuelDensityKgM3 || {};
    for (const fuel of FUEL_TYPES) {
      const d = densities[fuel];
      if (d != null && d !== "" && !(toNum(d) > 0)) {
        errors.push(`Fuel density for ${FUEL_LABELS[fuel]} must be positive.`);
      }
    }

    const mainEngines = normalizeConsumers(form.mainEngines, "me");
    const auxiliaryEngines = normalizeConsumers(form.auxiliaryEngines, "ae");
    const boilers = normalizeConsumers(form.boilers, "boiler");
    if (
      mainEngines.length === 0 &&
      auxiliaryEngines.length === 0 &&
      boilers.every((b) => b.consumptionKgPerH === 0)
    ) {
      errors.push("Add at least one fuel consumer with non-zero consumption.");
    }

    return errors;
  }

  function parseDensities(raw) {
    const out = {};
    for (const fuel of FUEL_TYPES) {
      const n = toNum(raw && raw[fuel]);
      if (n > 0) out[fuel] = n;
    }
    return out;
  }

  function calculate(input) {
    const form = input || {};
    const shipIn = form.ship || {};
    const shipType = Number(shipIn.shipType) || null;
    const vsKn = toNum(shipIn.vsKn);
    const rangeNm = toNum(shipIn.rangeNm);
    const enduranceDays = toNum(shipIn.enduranceDays) || 0;
    const nonDischargePeriodDays = toNum(shipIn.nonDischargePeriodDays);
    const personsOnBoard = toNum(shipIn.personsOnBoard);
    const vacuumToilet = Boolean(shipIn.vacuumToilet);
    const withCompactor = Boolean(shipIn.withCompactor);
    const solidWasteIncinerator = Boolean(shipIn.solidWasteIncinerator);
    const sludgeK1Mode = String(shipIn.sludgeK1Mode || "auto");

    const mainEngines = normalizeConsumers(form.mainEngines, "me");
    const auxiliaryEngines = normalizeConsumers(form.auxiliaryEngines, "ae");
    const boilers = normalizeConsumers(form.boilers, "boiler");
    const fuelDensityKgM3 = parseDensities(form.fuelDensityKgM3);
    const densities = { ...DEFAULT_FUEL_DENSITY_KG_M3, ...fuelDensityKgM3 };

    const errors = validate({
      ship: {
        vsKn,
        rangeNm,
        enduranceDays,
        nonDischargePeriodDays,
        personsOnBoard,
        shipType,
      },
      mainEngines,
      auxiliaryEngines,
      boilers,
      fuelDensityKgM3,
    });

    const voyage = resolveVoyagePeriod(rangeNm, vsKn);
    const hours = voyage ? voyage.hours : null;
    const voyageDays = voyage ? voyage.days : null;
    const fwAutonomy = resolveAutonomyPeriod(enduranceDays, voyage);
    const sewageHolding = resolveWastewaterPeriod(nonDischargePeriodDays);
    const solidPeriod = resolveSolidWastePeriod(enduranceDays, voyage);
    const sludgePeriod = resolveSludgePeriod(enduranceDays, voyage);
    const sludgeDischargeDays = sludgePeriod ? sludgePeriod.days : DEFAULT_SLUDGE_DAYS;
    const wastewater = computeWastewater(
      shipType,
      vacuumToilet,
      personsOnBoard,
      sewageHolding ? sewageHolding.days : null,
    );
    const freshWater = computeFreshWater(wastewater, fwAutonomy);
    const solidWaste = computeSolidWaste(
      personsOnBoard,
      solidPeriod,
      withCompactor,
      solidWasteIncinerator,
    );

    let rangeFuelByType = [];
    if (hours != null) {
      rangeFuelByType = accumulateRangeFuel(
        hours,
        mainEngines,
        auxiliaryEngines,
        boilers,
        fuelDensityKgM3,
        densities,
      );
    }

    const totalFuelMassKg = rangeFuelByType.reduce((s, r) => s + r.massKg, 0);
    const totalFuelVolumeM3 = rangeFuelByType.reduce((s, r) => s + r.volumeM3, 0);

    const warnings = [];

    const k1Info = resolveSludgeK1(sludgeK1Mode, mainEngines);
    const dailyFuelM3 = dailyFuelConsumptionM3(
      mainEngines,
      auxiliaryEngines,
      boilers,
      fuelDensityKgM3,
      densities,
    );
    const meRatingKw = mainEngineRatingKw(mainEngines);
    const sludgeTank = computeSludgeTank(dailyFuelM3, sludgeDischargeDays, k1Info.k1);
    const oilyBilge = computeOilyBilgeHolding(meRatingKw);
    const usesHfo = (mainEngines.concat(auxiliaryEngines, boilers) || []).some(
      (c) => c.fuel === "heavy_fuel_oil" && (c.powerKw > 0 || c.consumptionKgPerH > 0),
    );
    const hfoRequiresHeatedBilge =
      usesHfo && densities.heavy_fuel_oil > HFO_DENSITY_REQUIRES_BILGE_HOLDING_KG_M3;
    if (meRatingKw <= 0) {
      warnings.push("Oily bilge holding needs a main-engine rating P (kW).");
    }

    const fuelOk = hours != null && rangeFuelByType.length > 0;
    if (errors.length === 0 && hours != null && !fuelOk) {
      errors.push("No fuel consumption calculated — check equipment inputs.");
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      shipName: String(form.shipName || "").trim() || "Project",
      ship: {
        vsKn,
        rangeNm,
        enduranceDays,
        nonDischargePeriodDays,
        personsOnBoard,
        shipType,
        vacuumToilet,
        withCompactor,
        solidWasteIncinerator,
        sludgeDischargeDays,
        sludgeK1Mode,
      },
      mainEngines,
      auxiliaryEngines,
      boilers,
      fuelDensityKgM3: densities,
      voyageHours: hours,
      voyageDays,
      fwAutonomy,
      sewageHolding,
      periods: {
        fuel: voyage,
        freshWater: fwAutonomy,
        wastewater: sewageHolding,
        solidWaste: solidPeriod,
        sludge: sludgePeriod,
        oilyBilge: { days: null, hours: null, source: "rule" },
      },
      wastewater,
      freshWater,
      solidWaste,
      rangeFuelByType,
      totalFuelMassKg,
      totalFuelVolumeM3,
      fuelsInUse: fuelsInUse({ mainEngines, auxiliaryEngines, boilers }),
      oilyWaste: {
        sludge: sludgeTank,
        oilyBilge,
        k1: k1Info.k1,
        k1Source: k1Info.source,
        hfoPurified: k1Info.hfoPurified,
        dailyFuelM3: dailyFuelM3 > 0 ? dailyFuelM3 : null,
        sludgeDischargeDays,
        sludgePeriod,
        mainEngineRatingKw: meRatingKw > 0 ? meRatingKw : null,
        hfoRequiresHeatedBilge,
      },
    };
  }

  return {
    FUEL_TYPES,
    FUEL_LABELS,
    DEFAULT_FUEL_DENSITY_KG_M3,
    MIN_WASTEWATER_HOLDING_DAYS,
    PERIOD_SOURCE_LABELS,
    WASTEWATER_SHIP_TYPES,
    WASTEWATER_STREAM_LABELS,
    SOLID_WASTE_LABELS,
    INCINERATOR_CATEGORIES,
    INCINERATOR_CATEGORY_LABELS,
    voyageHours,
    resolveVoyagePeriod,
    resolveAutonomyPeriod,
    resolveFwAutonomy,
    resolveWastewaterPeriod,
    resolveSewageHolding,
    resolveSolidWastePeriod,
    resolveSludgePeriod,
    computeWastewater,
    computeFreshWater,
    computeSolidWaste,
    wastewaterTankRateDescription,
    wastewaterRatesLPerPersonDay,
    fuelsInUse,
    DEFAULT_SLUDGE_DAYS,
    SLUDGE_K1_HFO_PURIFIED,
    SLUDGE_K1_NO_PURIFICATION,
    dailyFuelConsumptionM3,
    mainEngineRatingKw,
    resolveSludgeK1,
    computeSludgeTank,
    computeOilyBilgeHolding,
    calculate,
  };
});
