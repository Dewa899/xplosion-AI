// File: functions/explosion/tnt-equivalence.js
// Versi ini diadaptasi untuk Cloudflare Pages/Workers.

const processEquipmentDamage = [
  { po: 0, descriptionKey: "equip_no_damage", citation_ref: 3 },
  {
    po: 3.46,
    descriptionKey: "equip_control_house_steel_roof_windows_broken",
    citation_ref: 3,
  },
  {
    po: 6.89,
    descriptionKey: "equip_switchgear_damaged_tank_roof_collapses",
    citation_ref: 3,
  },
  {
    po: 10.34,
    descriptionKey: "equip_control_house_roof_collapses_instruments_damaged",
    citation_ref: 3,
  },
  {
    po: 13.79,
    descriptionKey: "equip_concrete_roof_collapses_fire_heater_cracks",
    citation_ref: 3,
  },
  { po: 17.24, descriptionKey: "equip_fire_heater_moves", citation_ref: 3 },
  {
    po: 20.68,
    descriptionKey: "equip_tank_uplifts_instruments_damaged",
    citation_ref: 3,
  },
  {
    po: 24.13,
    descriptionKey: "equip_cooling_tower_collapses",
    citation_ref: 3,
  },
  { po: 27.58, descriptionKey: "equip_reactor_moves", citation_ref: 3 },
  {
    po: 31.03,
    descriptionKey: "equip_filter_inner_parts_damaged",
    citation_ref: 3,
  },
  { po: 34.47, descriptionKey: "equip_fire_heater_overturns", citation_ref: 3 },
  {
    po: 37.92,
    descriptionKey: "equip_fractionation_column_cracks",
    citation_ref: 3,
  },
  {
    po: 41.37,
    descriptionKey: "equip_instrument_cubicle_overturns",
    citation_ref: 3,
  },
  {
    po: 44.82,
    descriptionKey: "equip_tank_uplifts_reactor_destroyed",
    citation_ref: 3,
  },
  {
    po: 48.26,
    descriptionKey: "equip_reactor_cracking_moves",
    citation_ref: 3,
  },
  { po: 51.71, descriptionKey: "equip_generator_overturns", citation_ref: 3 },
  { po: 55.16, descriptionKey: "equip_tank_sphere_moves", citation_ref: 3 },
  {
    po: 62.05,
    descriptionKey: "equip_reactor_chemical_overturns",
    citation_ref: 3,
  },
  { po: 65.5, descriptionKey: "equip_filter_uplifts", citation_ref: 3 },
  { po: 68.95, descriptionKey: "equip_utilities_overturns", citation_ref: 3 },
  { po: 82.74, descriptionKey: "equip_filter_overturns", citation_ref: 3 },
  {
    po: 96.53,
    descriptionKey: "equip_steam_turbine_piping_breaks",
    citation_ref: 3,
  },
  {
    po: 110.32,
    descriptionKey: "equip_tank_sphere_overturns",
    citation_ref: 3,
  },
  {
    po: 137.9,
    descriptionKey: "equip_floating_roof_collapses",
    citation_ref: 3,
  },
];

const overpressureDamageLevels = [
  {
    minPo: 0.14,
    maxPo: 0.21,
    descriptionKey: "desc_annoying_noise",
    citation_ref: 2,
  },
  {
    minPo: 0.21,
    maxPo: 0.28,
    descriptionKey: "desc_breakage_large_windows",
    citation_ref: 2,
  },
  {
    minPo: 0.28,
    maxPo: 0.69,
    descriptionKey: "desc_loud_noise_glass_failure",
    citation_ref: 2,
  },
  {
    minPo: 0.69,
    maxPo: 1.03,
    descriptionKey: "desc_small_windows_break",
    citation_ref: 2,
  },
  {
    minPo: 1.03,
    maxPo: 2.07,
    descriptionKey: "desc_typical_pressure_break_glass",
    citation_ref: 2,
  },
  {
    minPo: 2.07,
    maxPo: 2.76,
    descriptionKey: "desc_safe_distance",
    citation_ref: 2,
  },
  {
    minPo: 2.76,
    maxPo: 4.8,
    descriptionKey: "desc_limited_minor_structural_damage",
    citation_ref: 2,
  },
  {
    minPo: 4.8,
    maxPo: 6.9,
    descriptionKey: "desc_minor_structural_damage_houses",
    citation_ref: 2,
  },
  {
    minPo: 6.9,
    maxPo: 9,
    descriptionKey: "desc_partial_house_collapse",
    citation_ref: 2,
  },
  {
    minPo: 9,
    maxPo: 13.8,
    descriptionKey: "desc_slight_distortion_steel_frames",
    citation_ref: 2,
  },
  {
    minPo: 13.8,
    maxPo: 15.8,
    descriptionKey: "desc_partial_collapse_roof_walls",
    citation_ref: 2,
  },
  {
    minPo: 15.8,
    maxPo: 17.2,
    descriptionKey: "desc_lower_limit_serious_damage",
    citation_ref: 2,
  },
  {
    minPo: 17.2,
    maxPo: 20.7,
    descriptionKey: "desc_50_percent_brick_walls_collapse",
    citation_ref: 2,
  },
  {
    minPo: 20.7,
    maxPo: 25,
    descriptionKey: "desc_heavy_machinery_damaged",
    citation_ref: 2,
  },
  {
    minPo: 25,
    maxPo: 34.5,
    descriptionKey: "desc_light_industrial_structures_collapse",
    citation_ref: 2,
  },
  {
    minPo: 34.5,
    maxPo: 48.2,
    descriptionKey: "desc_utility_poles_break",
    citation_ref: 2,
  },
  {
    minPo: 48.2,
    maxPo: 62,
    descriptionKey: "desc_freight_train_cars_destroyed",
    citation_ref: 2,
  },
  {
    minPo: 62,
    maxPo: 68.9,
    descriptionKey: "desc_fully_loaded_train_cars_destroyed",
    citation_ref: 2,
  },
  {
    minPo: 68.9,
    maxPo: Infinity,
    descriptionKey: "desc_likely_total_damage",
    citation_ref: 2,
  },
];

const citations = {
  1: "Wang et al., 2023",
  2: "Clancey, 1972; Crowl & Louvar, 2011",
  3: "Clancey, 1972; CCPS, 2000",
  4: "Jeremić & Bajić., 2006",
};

// --- Fungsi helper (tidak berubah) ---
const fPs = (ze) =>
  (1616 * (1 + (ze / 4.5) ** 2)) /
  (Math.sqrt(1 + (ze / 0.048) ** 2) *
    Math.sqrt(1 + (ze / 0.32) ** 2) *
    Math.sqrt(1 + (ze / 1.35) ** 2));

const fAlonso = (z) => {
  if (z < 10) return 1.13e6 * z ** -2.01;
  return 1.83e5 * z ** -1.16;
};

const fSadovski = (w, d) => {
  if (!(d > 0 && w > 0)) return NaN;
  const r = Math.cbrt(w) / d;
  return (0.085 * r + 0.3 * r ** 2 + 0.8 * r ** 3) * 1000;
};

function getImpactCategory(Po) {
  if (Po > 76)
    return {
      nameKey: "cat_catastrophic",
      color: "#991B1B",
      textColor: "#FFFFFF",
    };
  if (Po > 55)
    return { nameKey: "cat_major", color: "#F87171", textColor: "#FFFFFF" };
  if (Po > 40)
    return { nameKey: "cat_severe", color: "#FCA5A5", textColor: "var(--ink)" };
  if (Po > 25)
    return {
      nameKey: "cat_serious",
      color: "#FCD34D",
      textColor: "var(--ink)",
    };
  if (Po > 9)
    return {
      nameKey: "cat_moderate",
      color: "#FDE68A",
      textColor: "var(--ink)",
    };
  if (Po > 2)
    return { nameKey: "cat_minor", color: "#A7F3D0", textColor: "var(--ink)" };
  if (Po >= 0.14)
    return {
      nameKey: "cat_insignificant",
      color: "#D1FAE5",
      textColor: "var(--ink)",
    };
  if (Po >= 0)
    return {
      nameKey: "cat_no_effect",
      color: "#E5E7EB",
      textColor: "var(--ink)",
    };
  return { nameKey: "unknown", color: "var(--muted)", textColor: "#FFFFFF" };
}

function getInjuryRiskCategory(Po) {
  const poValue = parseFloat(Po);
  if (isNaN(poValue)) {
    return {
      nameKey: "injury_cat_invalid",
      color: "var(--muted)",
      textColor: "#FFFFFF",
    };
  }
  if (poValue < 0.14) {
    return {
      nameKey: "injury_cat_no_effect",
      color: "#D1FAE5",
      textColor: "var(--ink)",
    };
  } else if (poValue <= 20) {
    return {
      nameKey: "injury_cat_minor",
      color: "#FACC15",
      textColor: "var(--ink)",
    };
  } else if (poValue <= 30) {
    return {
      nameKey: "injury_cat_moderate",
      color: "#FDBA74",
      textColor: "var(--ink)",
    };
  } else if (poValue <= 50) {
    return {
      nameKey: "injury_cat_serious",
      color: "#FB7185",
      textColor: "#FFFFFF",
    };
  } else if (poValue <= 100) {
    return {
      nameKey: "injury_cat_severe",
      color: "#EF4444",
      textColor: "#FFFFFF",
    };
  } else {
    // > 100
    return {
      nameKey: "injury_cat_fatality",
      color: "#7F1D1D",
      textColor: "#FFFFFF",
    };
  }
}

function getDamageDescriptionKeys(kPa) {
  const keys = [];
  if (kPa >= 0.14 && kPa <= 2) keys.push("damage_accidental_glass");
  if (kPa > 2 && kPa <= 9) keys.push("damage_minor_glass_architectural");
  if (kPa > 9 && kPa <= 25) keys.push("damage_widespread_glass_nonstructural");
  if (kPa >= 13.8 && kPa <= 20.7)
    keys.push("damage_collapse_unreinforced_walls");
  if (kPa > 20.7 && kPa <= 25)
    keys.push("damage_steel_panels_destroyed_tanks_ruptured_1");
  if (kPa > 25 && kPa <= 27.6)
    keys.push("damage_steel_panels_destroyed_tanks_ruptured_2");
  if (kPa > 25 && kPa <= 40) keys.push("damage_extensive_nonstructural");
  if (kPa >= 34.5 && kPa <= 40) keys.push("damage_total_destruction_houses_1");
  if (kPa > 40 && kPa <= 48.2) keys.push("damage_total_destruction_houses_2");
  if (kPa > 40 && kPa <= 55)
    keys.push("damage_heavy_nonstructural_ceiling_collapse");
  if (kPa > 48.2 && kPa <= 55) keys.push("damage_brick_panels_fail_1");
  if (kPa > 55 && kPa <= 55.1) keys.push("damage_brick_panels_fail_2");
  if (kPa > 55 && kPa <= 76)
    keys.push("damage_partial_collapse_concrete_columns");
  if (kPa > 76) keys.push("damage_total_collapse_all_elements");
  return keys;
}

function getInjuryEffects(Po) {
  const poValue = parseFloat(Po);
  if (isNaN(poValue) || poValue < 0) {
    return {
      primaryKey: "injury_awaiting_input",
      secondaryKey: null,
      conclusionKey: null,
    };
  }

  if (poValue < 20) {
    return {
      primaryKey: "injury_table_p1",
      secondaryKey: "injury_table_s1",
      conclusionKey: "injury_table_c1",
    };
  } else if (poValue <= 30) {
    return {
      primaryKey: "injury_table_p2",
      secondaryKey: "injury_table_s2",
      conclusionKey: "injury_table_c2",
    };
  } else if (poValue <= 50) {
    return {
      primaryKey: "injury_table_p3",
      secondaryKey: "injury_table_s3",
      conclusionKey: "injury_table_c3",
    };
  } else if (poValue <= 100) {
    return {
      primaryKey: "injury_table_p4",
      secondaryKey: "injury_table_s4",
      conclusionKey: "injury_table_c4",
    };
  } else {
    return {
      primaryKey: "injury_table_p5",
      secondaryKey: "injury_table_s5",
      conclusionKey: "injury_table_c5",
    };
  }
}

// --- API Handler Cloudflare ---
export async function onRequestPost(context) {
  try {
    const { request } = context;
    if (request.headers.get("Content-Type") !== "application/json") {
      return new Response(JSON.stringify({ message: "Request must be JSON" }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { rho, vol, dh, eta, e_tnt, dist, pa } = body;

    if (!rho || !vol || !dh || !eta || !e_tnt || !dist || !pa) {
      return new Response(JSON.stringify({ message: "Input tidak lengkap" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- Kalkulasi (tidak berubah) ---
    const W_mass = rho * vol;
    const E_total = W_mass * dh * eta;
    const W_tnt = E_total / e_tnt;
    const Ze = dist > 0 && W_tnt > 0 ? dist / Math.cbrt(W_tnt) : NaN;
    if (!Number.isFinite(Ze) || Ze <= 0) {
      return new Response(
        JSON.stringify({
          message: "Hasil kalkulasi tidak valid (Ze tidak positif)",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const PoPa_crowl = fPs(Ze);
    const Po_crowl = PoPa_crowl * pa;
    const isAlonsoExtrapolated = Ze < 1 || Ze > 200;
    const Po_alonso = fAlonso(Ze) / 1000;
    const Po_sadovski = fSadovski(W_tnt, dist);

    // --- Fungsi Asesmen (tidak berubah) ---
    const calculateAssessments = (Po) => {
      if (!Number.isFinite(Po)) {
        return {
          impactCategory: getImpactCategory(NaN),
          injuryCategory: getInjuryRiskCategory(NaN),
          structuralKeys: [],
          structuralRangeDescKey: null,
          equipmentKey: null,
          injuryEffects: getInjuryEffects(NaN),
        };
      }

      const impactCategory = getImpactCategory(Po);
      const injuryCategory = getInjuryRiskCategory(Po);
      const structuralKeys = getDamageDescriptionKeys(Po);
      const structuralRangeDesc = overpressureDamageLevels.find(
        (range) => Po >= range.minPo && Po < range.maxPo
      );
      const equipmentDamage = processEquipmentDamage
        .slice()
        .reverse()
        .find((item) => Po >= item.po);
      const injuryEffects = getInjuryEffects(Po);

      return {
        impactCategoryNameKey: impactCategory.nameKey,
        impactColor: impactCategory.color,
        impactTextColor: impactCategory.textColor,
        injuryCategoryNameKey: injuryCategory.nameKey,
        injuryColor: injuryCategory.color,
        injuryTextColor: injuryCategory.textColor,
        structuralKeys: structuralKeys,
        structuralRangeDescKey: structuralRangeDesc
          ? structuralRangeDesc.descriptionKey
          : null,
        structuralRangeCitationRef: structuralRangeDesc
          ? structuralRangeDesc.citation_ref
          : null,
        equipmentKey: equipmentDamage ? equipmentDamage.descriptionKey : null,
        equipmentCitationRef: equipmentDamage
          ? equipmentDamage.citation_ref
          : null,
        injuryEffects: injuryEffects,
      };
    };

    const assessmentsCrowl = calculateAssessments(Po_crowl);
    const assessmentsAlonso = calculateAssessments(Po_alonso);
    const assessmentsSadovski = calculateAssessments(Po_sadovski);

    const responsePayload = {
      W_mass,
      E_total,
      W_tnt,
      Ze,
      Ps: PoPa_crowl,
      Po_crowl,
      Po_alonso,
      Po_sadovski,
      isAlonsoExtrapolated,
      assessments: {
        crowl: assessmentsCrowl,
        alonso: assessmentsAlonso,
        sadovski: assessmentsSadovski,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Server Calculation Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi error di server saat menghitung" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
