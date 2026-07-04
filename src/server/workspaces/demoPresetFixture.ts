export type AttributeFixture = {
  key: string;
  name: string;
  type: "TEXT" | "NUMBER" | "QUANTITY" | "BOOLEAN" | "CHOICE";
  baseUnitSymbol?: string;
  choices?: Array<{ key: string; label: string; sortOrder: number }>;
};

export type CategoryFixture = {
  key: string;
  name: string;
  isAssignable: boolean;
  parentKey?: string;
  valueAttributeKey?: string;
  attributes?: Array<{
    attributeKey: string;
    sortOrder: number;
    isPrimary?: boolean;
    defaultQuantityBaseValue?: number;
    defaultChoiceOptionKey?: string;
  }>;
};

export type ManufacturerFixture = { key: string; name: string };

export type LocationFixture = {
  key: string;
  name: string;
  parentKey?: string;
  isAssignable: boolean;
};

export type PartFixture = {
  catalogNumber: string;
  manufacturerKey: string;
  primaryCategoryKey?: string;
  attributes?: Array<{
    attributeKey: string;
    quantityBaseValue?: number;
    textValue?: string;
    numberValue?: number;
    booleanValue?: boolean;
    choiceOptionKey?: string;
    displayValue?: string;
  }>;
  stockEntries?: Array<{ locationKey: string; quantity: number }>;
};

export type ShoppingListFixture = {
  key: string;
  name: string;
  description?: string;
  items: Array<{ catalogNumber: string; manufacturerKey: string; quantity: number }>;
};

export type PurchaseOrderFixture = {
  supplierKey: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  orderNumber?: string;
  currency?: string;
  notes?: string;
  items: Array<{
    catalogNumber: string;
    manufacturerKey: string;
    quantity: number;
    unitPrice?: number;
    locationKey?: string;
  }>;
};

export type BomMatcherFixtureOperator = "EQ" | "NEQ" | "LT" | "LTE" | "GT" | "GTE";

export type BomLineItemFixture = {
  /** Designator range string, e.g. "C1-C4". */
  designators: string;
  /** Optional category scope. */
  categoryKey?: string;
  /** Optional exact-part pin (resolved by manufacturer + catalog number). */
  pinnedPart?: { manufacturerKey: string; catalogNumber: string };
  notes?: string;
  /** Attribute matchers; `value` is the raw input parsed like a part attribute value. */
  matchers?: Array<{
    attributeKey: string;
    operator: BomMatcherFixtureOperator;
    value: string;
  }>;
};

export type DesignFixture = {
  key: string;
  name: string;
  description?: string;
  /** Catalog number for the auto-created output part (under the internal manufacturer). */
  outputCatalogNumber: string;
  /** Extra revisions beyond the implicit v1. Each entry adds the next revision number. */
  extraRevisions?: Array<{ notes?: string }>;
  /** BOM line items attached to the latest revision. */
  bomLineItems?: BomLineItemFixture[];
};

export type DemoPresetFixture = {
  attributes: AttributeFixture[];
  categories: CategoryFixture[];
  manufacturers: ManufacturerFixture[];
  suppliers: ManufacturerFixture[];
  locations: LocationFixture[];
  parts: PartFixture[];
  shoppingLists: ShoppingListFixture[];
  purchaseOrders: PurchaseOrderFixture[];
  designs: DesignFixture[];
};

export const DEMO_PRESET_FIXTURE: DemoPresetFixture = {
  attributes: [
    { key: "resistance", name: "Resistance", type: "QUANTITY", baseUnitSymbol: "Ω" },
    { key: "capacitance", name: "Capacitance", type: "QUANTITY", baseUnitSymbol: "F" },
    { key: "inductance", name: "Inductance", type: "QUANTITY", baseUnitSymbol: "H" },
    { key: "voltageRating", name: "Voltage Rating", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "currentRating", name: "Current Rating", type: "QUANTITY", baseUnitSymbol: "A" },
    { key: "powerRating", name: "Power Rating", type: "QUANTITY", baseUnitSymbol: "W" },
    { key: "outputVoltage", name: "Output Voltage", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "outputCurrentMax", name: "Output Current Max", type: "QUANTITY", baseUnitSymbol: "A" },
    { key: "vdsMax", name: "Vds Max", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "vceMax", name: "Vce Max", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "gainBandwidthProduct", name: "Gain-Bandwidth Product", type: "QUANTITY", baseUnitSymbol: "Hz" },
    { key: "flashSize", name: "Flash Size", type: "TEXT" },
    { key: "ramSize", name: "RAM Size", type: "TEXT" },
    { key: "pinCount", name: "Pin Count", type: "NUMBER" },
    { key: "pitch", name: "Pitch", type: "QUANTITY", baseUnitSymbol: "m" },
    { key: "temperatureCoefficient", name: "Temperature Coefficient", type: "QUANTITY", baseUnitSymbol: "ppm/°C" },
    { key: "dcr", name: "DCR", type: "QUANTITY", baseUnitSymbol: "Ω" },
    { key: "selfResonantFrequency", name: "Self-Resonant Frequency", type: "QUANTITY", baseUnitSymbol: "Hz" },
    { key: "forwardVoltage", name: "Forward Voltage", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "zenerVoltage", name: "Zener Voltage", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "rdsOn", name: "Rds(on)", type: "QUANTITY", baseUnitSymbol: "Ω" },
    { key: "vgsThreshold", name: "Vgs Threshold", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "hfe", name: "hFE", type: "NUMBER" },
    { key: "core", name: "Core", type: "TEXT" },
    { key: "clockMax", name: "Clock Max", type: "QUANTITY", baseUnitSymbol: "Hz" },
    { key: "supplyVoltageMin", name: "Supply Voltage Min", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "supplyVoltageMax", name: "Supply Voltage Max", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "slewRate", name: "Slew Rate", type: "QUANTITY", baseUnitSymbol: "V/s" },
    { key: "inputOffsetVoltage", name: "Input Offset Voltage", type: "QUANTITY", baseUnitSymbol: "V" },
    { key: "dropoutVoltage", name: "Dropout Voltage", type: "QUANTITY", baseUnitSymbol: "V" },
    {
      key: "tolerance",
      name: "Tolerance",
      type: "CHOICE",
      choices: [
        { key: "tol_01p", label: "±0.1%", sortOrder: 0 },
        { key: "tol_1p", label: "±1%", sortOrder: 1 },
        { key: "tol_2p", label: "±2%", sortOrder: 2 },
        { key: "tol_5p", label: "±5%", sortOrder: 3 },
        { key: "tol_10p", label: "±10%", sortOrder: 4 },
        { key: "tol_20p", label: "±20%", sortOrder: 5 }
      ]
    },
    {
      key: "package",
      name: "Package",
      type: "CHOICE",
      choices: [
        { key: "pkg_0402", label: "0402", sortOrder: 0 },
        { key: "pkg_0603", label: "0603", sortOrder: 1 },
        { key: "pkg_0805", label: "0805", sortOrder: 2 },
        { key: "pkg_1206", label: "1206", sortOrder: 3 },
        { key: "pkg_1210", label: "1210", sortOrder: 4 },
        { key: "pkg_sot23", label: "SOT-23", sortOrder: 5 },
        { key: "pkg_sot235", label: "SOT-23-5", sortOrder: 6 },
        { key: "pkg_sot223", label: "SOT-223", sortOrder: 7 },
        { key: "pkg_sot323", label: "SOT-323", sortOrder: 8 },
        { key: "pkg_sma", label: "SMA", sortOrder: 9 },
        { key: "pkg_smb", label: "SMB", sortOrder: 10 },
        { key: "pkg_soic8", label: "SOIC-8", sortOrder: 11 },
        { key: "pkg_dip8", label: "DIP-8", sortOrder: 12 },
        { key: "pkg_dip14", label: "DIP-14", sortOrder: 13 },
        { key: "pkg_dip16", label: "DIP-16", sortOrder: 14 },
        { key: "pkg_dip20", label: "DIP-20", sortOrder: 15 },
        { key: "pkg_dip28", label: "DIP-28", sortOrder: 16 },
        { key: "pkg_dip40", label: "DIP-40", sortOrder: 17 },
        { key: "pkg_tht", label: "THT", sortOrder: 18 },
        { key: "pkg_to92", label: "TO-92", sortOrder: 19 },
        { key: "pkg_to220", label: "TO-220", sortOrder: 20 },
        { key: "pkg_tqfp32", label: "TQFP-32", sortOrder: 21 },
        { key: "pkg_tqfp48", label: "TQFP-48", sortOrder: 22 },
        { key: "pkg_tqfp100", label: "TQFP-100", sortOrder: 23 },
        { key: "pkg_qfn32", label: "QFN-32", sortOrder: 24 },
        { key: "pkg_qfn56", label: "QFN-56", sortOrder: 25 },
        { key: "pkg_lqfp64", label: "LQFP-64", sortOrder: 26 },
        { key: "pkg_dpak", label: "DPAK", sortOrder: 27 }
      ]
    },
    {
      key: "channelType",
      name: "Channel Type",
      type: "CHOICE",
      choices: [
        { key: "ch_nchannel", label: "N-channel", sortOrder: 0 },
        { key: "ch_pchannel", label: "P-channel", sortOrder: 1 },
        { key: "ch_npn", label: "NPN", sortOrder: 2 },
        { key: "ch_pnp", label: "PNP", sortOrder: 3 }
      ]
    },
    {
      key: "dielectricType",
      name: "Dielectric Type",
      type: "CHOICE",
      choices: [
        { key: "dielectric_c0g", label: "C0G", sortOrder: 0 },
        { key: "dielectric_x5r", label: "X5R", sortOrder: 1 },
        { key: "dielectric_x7r", label: "X7R", sortOrder: 2 },
        { key: "dielectric_y5v", label: "Y5V", sortOrder: 3 },
        { key: "dielectric_tantalum", label: "Tantalum", sortOrder: 4 },
        { key: "dielectric_aluminum_electrolytic", label: "Aluminum Electrolytic", sortOrder: 5 }
      ]
    },
    {
      key: "mountingType",
      name: "Mounting Type",
      type: "CHOICE",
      choices: [
        { key: "mount_tht", label: "THT", sortOrder: 0 },
        { key: "mount_smd", label: "SMD", sortOrder: 1 }
      ]
    },
    {
      key: "gender",
      name: "Gender",
      type: "CHOICE",
      choices: [
        { key: "gender_male", label: "Male", sortOrder: 0 },
        { key: "gender_female", label: "Female", sortOrder: 1 }
      ]
    }
  ],

  categories: [
    // Root categories
    { key: "passives", name: "Passives", isAssignable: false },
    { key: "semiconductors", name: "Semiconductors", isAssignable: false },
    { key: "ics", name: "Integrated Circuits", isAssignable: false, parentKey: "semiconductors" },
    // Passives leaf categories
    {
      key: "resistors",
      name: "Resistors",
      isAssignable: true,
      parentKey: "passives",
      valueAttributeKey: "resistance",
      attributes: [
        { attributeKey: "resistance", sortOrder: 0, isPrimary: true },
        { attributeKey: "tolerance", sortOrder: 1 },
        { attributeKey: "powerRating", sortOrder: 2 },
        { attributeKey: "temperatureCoefficient", sortOrder: 3 },
        { attributeKey: "package", sortOrder: 4 }
      ]
    },
    {
      key: "capacitors",
      name: "Capacitors",
      isAssignable: true,
      parentKey: "passives",
      valueAttributeKey: "capacitance",
      attributes: [
        { attributeKey: "capacitance", sortOrder: 0, isPrimary: true },
        { attributeKey: "voltageRating", sortOrder: 1 },
        { attributeKey: "tolerance", sortOrder: 2 },
        { attributeKey: "dielectricType", sortOrder: 3 },
        { attributeKey: "package", sortOrder: 4 }
      ]
    },
    {
      key: "inductors",
      name: "Inductors",
      isAssignable: true,
      parentKey: "passives",
      valueAttributeKey: "inductance",
      attributes: [
        { attributeKey: "inductance", sortOrder: 0, isPrimary: true },
        { attributeKey: "currentRating", sortOrder: 1 },
        { attributeKey: "dcr", sortOrder: 2 },
        { attributeKey: "selfResonantFrequency", sortOrder: 3 },
        { attributeKey: "package", sortOrder: 4 }
      ]
    },
    // Semiconductors leaf categories
    {
      key: "diodes",
      name: "Diodes",
      isAssignable: true,
      parentKey: "semiconductors",
      attributes: [
        { attributeKey: "package", sortOrder: 0, isPrimary: true },
        { attributeKey: "forwardVoltage", sortOrder: 1 },
        { attributeKey: "currentRating", sortOrder: 2 },
        { attributeKey: "voltageRating", sortOrder: 3 }
      ]
    },
    {
      key: "zeners",
      name: "Zener Diodes",
      isAssignable: true,
      parentKey: "semiconductors",
      valueAttributeKey: "zenerVoltage",
      attributes: [
        { attributeKey: "zenerVoltage", sortOrder: 0, isPrimary: true },
        { attributeKey: "powerRating", sortOrder: 1 },
        { attributeKey: "package", sortOrder: 2 }
      ]
    },
    {
      key: "mosfets",
      name: "MOSFETs",
      isAssignable: true,
      parentKey: "semiconductors",
      attributes: [
        { attributeKey: "channelType", sortOrder: 0, isPrimary: true },
        { attributeKey: "package", sortOrder: 1 },
        { attributeKey: "vdsMax", sortOrder: 2 },
        { attributeKey: "currentRating", sortOrder: 3 },
        { attributeKey: "rdsOn", sortOrder: 4 },
        { attributeKey: "vgsThreshold", sortOrder: 5 }
      ]
    },
    {
      key: "bjts",
      name: "BJTs",
      isAssignable: true,
      parentKey: "semiconductors",
      attributes: [
        { attributeKey: "channelType", sortOrder: 0, isPrimary: true },
        { attributeKey: "package", sortOrder: 1 },
        { attributeKey: "vceMax", sortOrder: 2 },
        { attributeKey: "currentRating", sortOrder: 3 },
        { attributeKey: "hfe", sortOrder: 4 }
      ]
    },
    // IC sub-categories
    {
      key: "microcontrollers",
      name: "Microcontrollers",
      isAssignable: true,
      parentKey: "ics",
      attributes: [
        { attributeKey: "package", sortOrder: 0, isPrimary: true },
        { attributeKey: "core", sortOrder: 1 },
        { attributeKey: "flashSize", sortOrder: 2 },
        { attributeKey: "ramSize", sortOrder: 3 },
        { attributeKey: "clockMax", sortOrder: 4 },
        { attributeKey: "supplyVoltageMin", sortOrder: 5 },
        { attributeKey: "supplyVoltageMax", sortOrder: 6 },
        { attributeKey: "pinCount", sortOrder: 7 }
      ]
    },
    {
      key: "opamps",
      name: "Op-Amps",
      isAssignable: true,
      parentKey: "ics",
      attributes: [
        { attributeKey: "package", sortOrder: 0, isPrimary: true },
        { attributeKey: "gainBandwidthProduct", sortOrder: 1 },
        { attributeKey: "slewRate", sortOrder: 2 },
        { attributeKey: "inputOffsetVoltage", sortOrder: 3 },
        { attributeKey: "supplyVoltageMin", sortOrder: 4 },
        { attributeKey: "supplyVoltageMax", sortOrder: 5 }
      ]
    },
    {
      key: "regulators",
      name: "Voltage Regulators",
      isAssignable: true,
      parentKey: "ics",
      attributes: [
        { attributeKey: "outputVoltage", sortOrder: 0, isPrimary: true },
        { attributeKey: "outputCurrentMax", sortOrder: 1 },
        { attributeKey: "dropoutVoltage", sortOrder: 2 },
        { attributeKey: "package", sortOrder: 3 }
      ]
    },
    {
      key: "timers",
      name: "Timer ICs",
      isAssignable: true,
      parentKey: "ics",
      attributes: [{ attributeKey: "package", sortOrder: 0, isPrimary: true }]
    },
    {
      key: "logic",
      name: "Logic ICs",
      isAssignable: true,
      parentKey: "ics",
      attributes: [{ attributeKey: "package", sortOrder: 0, isPrimary: true }]
    },
    {
      key: "connectors",
      name: "Connectors",
      isAssignable: true,
      attributes: [
        { attributeKey: "pinCount", sortOrder: 0, isPrimary: true },
        { attributeKey: "pitch", sortOrder: 1 },
        { attributeKey: "mountingType", sortOrder: 2 },
        { attributeKey: "gender", sortOrder: 3 }
      ]
    }
  ],

  manufacturers: [
    { key: "yageo", name: "Yageo" },
    { key: "vishay", name: "Vishay" },
    { key: "bourns", name: "Bourns" },
    { key: "murata", name: "Murata" },
    { key: "panasonic", name: "Panasonic" },
    { key: "kemet", name: "KEMET" },
    { key: "avx", name: "AVX" },
    { key: "diodesinc", name: "Diodes Incorporated" },
    { key: "onsemi", name: "ON Semiconductor" },
    { key: "infineon", name: "Infineon Technologies" },
    { key: "ti", name: "Texas Instruments" },
    { key: "stmicro", name: "STMicroelectronics" },
    { key: "microchip", name: "Microchip Technology" },
    { key: "amphenol", name: "Amphenol" },
    { key: "molex", name: "Molex" },
    { key: "jst", name: "JST" },
    { key: "nexperia", name: "Nexperia" }
  ],

  suppliers: [
    { key: "mouser", name: "Mouser Electronics" },
    { key: "digikey", name: "DigiKey" },
    { key: "tme", name: "TME" }
  ],

  locations: [
    { key: "workshop", name: "Workshop", isAssignable: false },
    { key: "cabinet_a", name: "Cabinet A", parentKey: "workshop", isAssignable: false },
    { key: "drawer_a1", name: "Drawer 1", parentKey: "cabinet_a", isAssignable: true },
    { key: "drawer_a2", name: "Drawer 2", parentKey: "cabinet_a", isAssignable: true },
    { key: "drawer_a3", name: "Drawer 3", parentKey: "cabinet_a", isAssignable: true },
    { key: "drawer_a4", name: "Drawer 4", parentKey: "cabinet_a", isAssignable: true },
    { key: "drawer_a5", name: "Drawer 5", parentKey: "cabinet_a", isAssignable: true },
    { key: "cabinet_b", name: "Cabinet B", parentKey: "workshop", isAssignable: false },
    { key: "drawer_b1", name: "Drawer 1", parentKey: "cabinet_b", isAssignable: true },
    { key: "drawer_b2", name: "Drawer 2", parentKey: "cabinet_b", isAssignable: true },
    { key: "drawer_b3", name: "Drawer 3", parentKey: "cabinet_b", isAssignable: true },
    { key: "shelf", name: "Shelf", parentKey: "workshop", isAssignable: true }
  ],

  parts: [
    // ── Resistors (Yageo 0402 ±1%) ───────────────────────────────────────────
    { catalogNumber: "RC0402FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 500 }] },
    { catalogNumber: "RC0402FR-0722RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22, displayValue: "22 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0402FR-0747RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47, displayValue: "47 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 400 }] },
    { catalogNumber: "RC0402FR-07180RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 180, displayValue: "180 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-07220RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 220, displayValue: "220 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07330RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 330, displayValue: "330 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 150 }] },
    { catalogNumber: "RC0402FR-07560RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 560, displayValue: "560 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 500 }] },
    { catalogNumber: "RC0402FR-071K5L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1500, displayValue: "1.5 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-072K2L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 2200, displayValue: "2.2 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-073K3L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 3300, displayValue: "3.3 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-074K7L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 4700, displayValue: "4.7 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0402FR-076K8L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 6800, displayValue: "6.8 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 600 }] },
    { catalogNumber: "RC0402FR-0722KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22000, displayValue: "22 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-0733KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 33000, displayValue: "33 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 150 }] },
    { catalogNumber: "RC0402FR-0768KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 68000, displayValue: "68 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07220KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 220000, displayValue: "220 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-07470KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470000, displayValue: "470 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402FR-071ML", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Yageo 0402 ±5%
    { catalogNumber: "RC0402JR-0715RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 15, displayValue: "15 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-0733RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 33, displayValue: "33 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-0768RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 68, displayValue: "68 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-07150RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 150, displayValue: "150 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-07390RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 390, displayValue: "390 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-07680RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 680, displayValue: "680 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-071K5L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1500, displayValue: "1.5 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-073K3L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 3300, displayValue: "3.3 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-076K8L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 6800, displayValue: "6.8 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0402JR-0715KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 15000, displayValue: "15 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Yageo 0603
    { catalogNumber: "RC0603FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0603FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0603FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0603FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0603FR-072K2L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 2200, displayValue: "2.2 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0603FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 400 }] },
    { catalogNumber: "RC0603FR-0722KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22000, displayValue: "22 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0603FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0603FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0603FR-071ML", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Yageo 0805
    { catalogNumber: "RC0805FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-074K7L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 4700, displayValue: "4.7 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0805FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "RC0805FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Vishay CRCW 0402
    { catalogNumber: "CRCW04020000Z0ED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 0, displayValue: "0 Ω" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 100 }] },
    { catalogNumber: "CRCW040210R0FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW0402100RFKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW04021K00FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW040210K0FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW0402100KFKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Vishay CRCW 0603
    { catalogNumber: "CRCW060310R0FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW06031K00FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW060310K0FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    { catalogNumber: "CRCW0603100KFKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 100, displayValue: "±100 ppm/°C" }] },
    // Bourns CFR-25 THT
    { catalogNumber: "CFR-25JB-52-10R", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-100R", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-1K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 80 }] },
    { catalogNumber: "CFR-25JB-52-10K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-100K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }] },
    { catalogNumber: "CFR-25JB-52-1M", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }, { attributeKey: "temperatureCoefficient", quantityBaseValue: 350, displayValue: "±350 ppm/°C" }] },

    // ── Capacitors ────────────────────────────────────────────────────────────
    // Murata GRM 0402 X7R
    { catalogNumber: "GRM155R71C104KA88D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 500 }] },
    { catalogNumber: "GRM155R60J105KA12D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-6, displayValue: "1 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "GRM1555C1H100JA01D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-11, displayValue: "10 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_c0g" }] },
    { catalogNumber: "GRM1555C1H220JA01D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-11, displayValue: "22 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_c0g" }] },
    { catalogNumber: "GRM155R71H103KA88D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 400 }] },
    // Murata GRM 0603
    { catalogNumber: "GRM188R71C104KA93D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "GRM188R61A106KE69D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "GRM188C81E225KE15D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }] },
    // Murata GRM 0805
    { catalogNumber: "GRM21BR71H104KA01L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "GRM21BR60J106KE19L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    // Murata GRM 1206
    { catalogNumber: "GRM31CR60J107ME39L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-4, displayValue: "100 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_20p" }, { attributeKey: "package", choiceOptionKey: "pkg_1206" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }] },
    // Yageo CC 0402
    { catalogNumber: "CC0402KRX7R9BB101", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-10, displayValue: "100 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "CC0402KRX7R9BB102", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-9, displayValue: "1 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "CC0402KRX7R9BB103", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "CC0402KRX7R9BB104", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 500 }] },
    { catalogNumber: "CC0402JPRNPO9BB101", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-10, displayValue: "100 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_c0g" }] },
    // Yageo CC 0603
    { catalogNumber: "CC0603KRX7R9BB103", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "CC0603KRX7R9BB104", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 200 }] },
    { catalogNumber: "CC0603KRX5R9BB105", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-6, displayValue: "1 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }] },
    { catalogNumber: "CC0603KRX5R9BB106", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_20p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }] },
    // Panasonic electrolytic
    { catalogNumber: "EEU-FR1E101", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-4, displayValue: "100 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_aluminum_electrolytic" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 50 }] },
    { catalogNumber: "EEU-FR1E470", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-5, displayValue: "47 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_aluminum_electrolytic" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 50 }] },
    { catalogNumber: "EEU-FR1E471", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-4, displayValue: "470 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_aluminum_electrolytic" }] },
    { catalogNumber: "EEA-GA1E102", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-3, displayValue: "1000 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_aluminum_electrolytic" }] },
    { catalogNumber: "EEEFK1E471P", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-4, displayValue: "470 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_aluminum_electrolytic" }] },
    // KEMET
    { catalogNumber: "C0402C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "C0603C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "C0805C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "C1210C226K3RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-5, displayValue: "22 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_1210" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    // AVX
    { catalogNumber: "04025C104KAT2A", manufacturerKey: "avx", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x7r" }] },
    { catalogNumber: "06031C225KAT2A", manufacturerKey: "avx", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dielectricType", choiceOptionKey: "dielectric_x5r" }] },

    // ── Inductors ─────────────────────────────────────────────────────────────
    // Bourns SRR series
    { catalogNumber: "SRR0402-1R0Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-6, displayValue: "1 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.9, displayValue: "900 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dcr", quantityBaseValue: 0.065, displayValue: "65 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 150000000.0, displayValue: "150 MHz" }] },
    { catalogNumber: "SRR0402-2R2Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.7, displayValue: "700 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dcr", quantityBaseValue: 0.13, displayValue: "130 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 100000000.0, displayValue: "100 MHz" }] },
    { catalogNumber: "SRR0402-4R7Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 4.7e-6, displayValue: "4.7 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.52, displayValue: "520 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "dcr", quantityBaseValue: 0.22, displayValue: "220 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 70000000.0, displayValue: "70 MHz" }] },
    { catalogNumber: "SRR0603-100Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-5, displayValue: "10 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dcr", quantityBaseValue: 0.13, displayValue: "130 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 30000000.0, displayValue: "30 MHz" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 50 }] },
    { catalogNumber: "SRR0603-220Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-5, displayValue: "22 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.55, displayValue: "550 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dcr", quantityBaseValue: 0.27, displayValue: "270 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }] },
    { catalogNumber: "SRR0603-470Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 4.7e-5, displayValue: "47 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.38, displayValue: "380 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "dcr", quantityBaseValue: 0.5, displayValue: "500 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 14000000.0, displayValue: "14 MHz" }] },
    { catalogNumber: "SRR1005-101Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-4, displayValue: "100 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "dcr", quantityBaseValue: 0.45, displayValue: "450 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 9000000.0, displayValue: "9 MHz" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 30 }] },
    { catalogNumber: "SRR1005-221Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-4, displayValue: "220 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.55, displayValue: "550 mA" }, { attributeKey: "dcr", quantityBaseValue: 0.85, displayValue: "850 mΩ" }, { attributeKey: "selfResonantFrequency", quantityBaseValue: 6000000.0, displayValue: "6 MHz" }] },

    // ── Diodes ────────────────────────────────────────────────────────────────
    { catalogNumber: "1N4148W", manufacturerKey: "diodesinc", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.15, displayValue: "150 mA" }, { attributeKey: "forwardVoltage", quantityBaseValue: 1.0, displayValue: "1 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 200 }] },
    { catalogNumber: "1N4148WT", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.15, displayValue: "150 mA" }, { attributeKey: "forwardVoltage", quantityBaseValue: 1.0, displayValue: "1 V" }] },
    { catalogNumber: "1N5819-T", manufacturerKey: "diodesinc", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sma" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "forwardVoltage", quantityBaseValue: 0.55, displayValue: "550 mV" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "1N4001RLG", manufacturerKey: "onsemi", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "forwardVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "1N4007RLG", manufacturerKey: "onsemi", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "voltageRating", quantityBaseValue: 1000, displayValue: "1000 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "forwardVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "BAT54S", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 30, displayValue: "30 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.2, displayValue: "200 mA" }, { attributeKey: "forwardVoltage", quantityBaseValue: 0.4, displayValue: "400 mV" }] },
    { catalogNumber: "SS14", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sma" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "forwardVoltage", quantityBaseValue: 0.55, displayValue: "550 mV" }] },
    { catalogNumber: "SS34", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_smb" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 3, displayValue: "3 A" }, { attributeKey: "forwardVoltage", quantityBaseValue: 0.5, displayValue: "500 mV" }] },
    // ── Zener Diodes ─────────────────────────────────────────────────────────
    // Vishay BZX84C SOT-23
    { catalogNumber: "BZX84C3V3", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    { catalogNumber: "BZX84C4V7", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 4.7, displayValue: "4.7 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    { catalogNumber: "BZX84C5V1", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 5.1, displayValue: "5.1 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    { catalogNumber: "BZX84C6V2", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 6.2, displayValue: "6.2 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    { catalogNumber: "BZX84C9V1", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 9.1, displayValue: "9.1 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    { catalogNumber: "BZX84C12", manufacturerKey: "vishay", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "zenerVoltage", quantityBaseValue: 12, displayValue: "12 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.35, displayValue: "350 mW" }] },
    // Nexperia BZX384 SOT-323
    { catalogNumber: "BZX384-B3V3", manufacturerKey: "nexperia", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "zenerVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }] },
    { catalogNumber: "BZX384-B5V1", manufacturerKey: "nexperia", primaryCategoryKey: "zeners", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "zenerVoltage", quantityBaseValue: 5.1, displayValue: "5.1 V" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }] },

    // ── MOSFETs ───────────────────────────────────────────────────────────────
    { catalogNumber: "2N7002", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 60, displayValue: "60 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.115, displayValue: "115 mA" }, { attributeKey: "rdsOn", quantityBaseValue: 5.0, displayValue: "5 Ω" }, { attributeKey: "vgsThreshold", quantityBaseValue: 2.1, displayValue: "2.1 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "2N7002E-7-F", manufacturerKey: "diodesinc", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 60, displayValue: "60 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.115, displayValue: "115 mA" }, { attributeKey: "rdsOn", quantityBaseValue: 5.0, displayValue: "5 Ω" }, { attributeKey: "vgsThreshold", quantityBaseValue: 2.1, displayValue: "2.1 V" }] },
    { catalogNumber: "BSS138", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.22, displayValue: "220 mA" }, { attributeKey: "rdsOn", quantityBaseValue: 3.5, displayValue: "3.5 Ω" }, { attributeKey: "vgsThreshold", quantityBaseValue: 1.5, displayValue: "1.5 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "BSS84", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: -50, displayValue: "-50 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.13, displayValue: "-130 mA" }, { attributeKey: "rdsOn", quantityBaseValue: 6.0, displayValue: "6 Ω" }, { attributeKey: "vgsThreshold", quantityBaseValue: -2.1, displayValue: "-2.1 V" }] },
    { catalogNumber: "IRF540NPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "vdsMax", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 33, displayValue: "33 A" }, { attributeKey: "rdsOn", quantityBaseValue: 0.044, displayValue: "44 mΩ" }, { attributeKey: "vgsThreshold", quantityBaseValue: 3.0, displayValue: "3 V" }], stockEntries: [{ locationKey: "drawer_a4", quantity: 20 }] },
    { catalogNumber: "IRL540NPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "vdsMax", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 28, displayValue: "28 A" }, { attributeKey: "rdsOn", quantityBaseValue: 0.044, displayValue: "44 mΩ" }, { attributeKey: "vgsThreshold", quantityBaseValue: 1.5, displayValue: "1.5 V" }] },
    { catalogNumber: "IRLML2502TRPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 20, displayValue: "20 V" }, { attributeKey: "currentRating", quantityBaseValue: 4.2, displayValue: "4.2 A" }, { attributeKey: "rdsOn", quantityBaseValue: 0.045, displayValue: "45 mΩ" }, { attributeKey: "vgsThreshold", quantityBaseValue: 0.9, displayValue: "0.9 V" }] },
    { catalogNumber: "DMN2004VK-7", manufacturerKey: "diodesinc", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 20, displayValue: "20 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.54, displayValue: "540 mA" }, { attributeKey: "rdsOn", quantityBaseValue: 0.55, displayValue: "550 mΩ" }, { attributeKey: "vgsThreshold", quantityBaseValue: 0.6, displayValue: "600 mV" }] },

    // ── BJTs ──────────────────────────────────────────────────────────────────
    { catalogNumber: "2N2222AG", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "hfe", numberValue: 150 }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "2N2907AG", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -60, displayValue: "-60 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.6, displayValue: "-600 mA" }, { attributeKey: "hfe", numberValue: 150 }] },
    { catalogNumber: "BC547CBU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 45, displayValue: "45 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.1, displayValue: "100 mA" }, { attributeKey: "hfe", numberValue: 450 }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "BC557CBU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -45, displayValue: "-45 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.1, displayValue: "-100 mA" }, { attributeKey: "hfe", numberValue: 450 }] },
    { catalogNumber: "BC817-40LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: 45, displayValue: "45 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.5, displayValue: "500 mA" }, { attributeKey: "hfe", numberValue: 400 }] },
    { catalogNumber: "BC807-40LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: -45, displayValue: "-45 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.5, displayValue: "-500 mA" }, { attributeKey: "hfe", numberValue: 400 }] },
    { catalogNumber: "MMBT3904LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.2, displayValue: "200 mA" }, { attributeKey: "hfe", numberValue: 150 }], stockEntries: [{ locationKey: "drawer_a3", quantity: 50 }] },
    { catalogNumber: "MMBT3906LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: -40, displayValue: "-40 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.2, displayValue: "-200 mA" }, { attributeKey: "hfe", numberValue: 150 }] },
    { catalogNumber: "2N3904BU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.2, displayValue: "200 mA" }, { attributeKey: "hfe", numberValue: 150 }] },
    { catalogNumber: "2N3906BU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -40, displayValue: "-40 V" }, { attributeKey: "currentRating", quantityBaseValue: -0.2, displayValue: "-200 mA" }, { attributeKey: "hfe", numberValue: 150 }] },

    // ── Microcontrollers ──────────────────────────────────────────────────────
    { catalogNumber: "ATMEGA328P-PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip28" }, { attributeKey: "flashSize", textValue: "32 KB" }, { attributeKey: "ramSize", textValue: "2 KB" }, { attributeKey: "pinCount", numberValue: 28 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.8, displayValue: "1.8 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "ATMEGA328P-AU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp32" }, { attributeKey: "flashSize", textValue: "32 KB" }, { attributeKey: "ramSize", textValue: "2 KB" }, { attributeKey: "pinCount", numberValue: 32 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.8, displayValue: "1.8 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "ATTINY85-20PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "flashSize", textValue: "8 KB" }, { attributeKey: "ramSize", textValue: "512 B" }, { attributeKey: "pinCount", numberValue: 8 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.8, displayValue: "1.8 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "ATTINY85-20SU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "flashSize", textValue: "8 KB" }, { attributeKey: "ramSize", textValue: "512 B" }, { attributeKey: "pinCount", numberValue: 8 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.8, displayValue: "1.8 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "ATMEGA2560-16AU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp100" }, { attributeKey: "flashSize", textValue: "256 KB" }, { attributeKey: "ramSize", textValue: "8 KB" }, { attributeKey: "pinCount", numberValue: 100 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 16000000.0, displayValue: "16 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.8, displayValue: "1.8 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "PIC16F877A-I/P", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip40" }, { attributeKey: "flashSize", textValue: "14 KB" }, { attributeKey: "ramSize", textValue: "368 B" }, { attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "core", textValue: "PIC 8-bit (mid-range)" }, { attributeKey: "clockMax", quantityBaseValue: 20000000.0, displayValue: "20 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.0, displayValue: "2 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "STM32F103C8T6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp48" }, { attributeKey: "flashSize", textValue: "64 KB" }, { attributeKey: "ramSize", textValue: "20 KB" }, { attributeKey: "pinCount", numberValue: 48 }, { attributeKey: "core", textValue: "ARM Cortex-M3" }, { attributeKey: "clockMax", quantityBaseValue: 72000000.0, displayValue: "72 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.0, displayValue: "2 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 3.6, displayValue: "3.6 V" }] },
    { catalogNumber: "STM32F103CBT6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp48" }, { attributeKey: "flashSize", textValue: "128 KB" }, { attributeKey: "ramSize", textValue: "20 KB" }, { attributeKey: "pinCount", numberValue: 48 }, { attributeKey: "core", textValue: "ARM Cortex-M3" }, { attributeKey: "clockMax", quantityBaseValue: 72000000.0, displayValue: "72 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.0, displayValue: "2 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 3.6, displayValue: "3.6 V" }] },
    { catalogNumber: "STM32G071RBT6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_lqfp64" }, { attributeKey: "flashSize", textValue: "128 KB" }, { attributeKey: "ramSize", textValue: "36 KB" }, { attributeKey: "pinCount", numberValue: 64 }, { attributeKey: "core", textValue: "ARM Cortex-M0+" }, { attributeKey: "clockMax", quantityBaseValue: 64000000.0, displayValue: "64 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.65, displayValue: "1.65 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 3.6, displayValue: "3.6 V" }] },
    { catalogNumber: "STM32G031K8T6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp32" }, { attributeKey: "flashSize", textValue: "64 KB" }, { attributeKey: "ramSize", textValue: "8 KB" }, { attributeKey: "pinCount", numberValue: 32 }, { attributeKey: "core", textValue: "ARM Cortex-M0+" }, { attributeKey: "clockMax", quantityBaseValue: 64000000.0, displayValue: "64 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.65, displayValue: "1.65 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 3.6, displayValue: "3.6 V" }] },
    { catalogNumber: "STM32F401CCU6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_qfn32" }, { attributeKey: "flashSize", textValue: "256 KB" }, { attributeKey: "ramSize", textValue: "64 KB" }, { attributeKey: "pinCount", numberValue: 48 }, { attributeKey: "core", textValue: "ARM Cortex-M4" }, { attributeKey: "clockMax", quantityBaseValue: 84000000.0, displayValue: "84 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 1.7, displayValue: "1.7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 3.6, displayValue: "3.6 V" }] },
    { catalogNumber: "ATMEGA16A-PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip40" }, { attributeKey: "flashSize", textValue: "16 KB" }, { attributeKey: "ramSize", textValue: "1 KB" }, { attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "core", textValue: "AVR 8-bit" }, { attributeKey: "clockMax", quantityBaseValue: 16000000.0, displayValue: "16 MHz" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.7, displayValue: "2.7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },

    // ── Op-Amps ───────────────────────────────────────────────────────────────
    { catalogNumber: "LM358P", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 300000.0, displayValue: "0.3 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.002, displayValue: "2 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 3, displayValue: "3 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 32, displayValue: "32 V" }], stockEntries: [{ locationKey: "drawer_b2", quantity: 30 }] },
    { catalogNumber: "LM358DR", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 300000.0, displayValue: "0.3 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.002, displayValue: "2 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 3, displayValue: "3 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 32, displayValue: "32 V" }] },
    { catalogNumber: "LM741CN", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1.5e6, displayValue: "1.5 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 500000.0, displayValue: "0.5 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.001, displayValue: "1 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 44, displayValue: "44 V" }] },
    { catalogNumber: "TL071CP", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 13000000.0, displayValue: "13 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.003, displayValue: "3 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 7, displayValue: "7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 36, displayValue: "36 V" }] },
    { catalogNumber: "TL071CD", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 13000000.0, displayValue: "13 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.003, displayValue: "3 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 7, displayValue: "7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 36, displayValue: "36 V" }] },
    { catalogNumber: "TL072CP", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 13000000.0, displayValue: "13 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.003, displayValue: "3 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 7, displayValue: "7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 36, displayValue: "36 V" }] },
    { catalogNumber: "LM324N", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 300000.0, displayValue: "0.3 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.002, displayValue: "2 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 3, displayValue: "3 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 32, displayValue: "32 V" }] },
    { catalogNumber: "TL074CN", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 13000000.0, displayValue: "13 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.003, displayValue: "3 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 7, displayValue: "7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 36, displayValue: "36 V" }] },
    { catalogNumber: "MCP602-I/P", manufacturerKey: "microchip", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 2.8e6, displayValue: "2.8 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 2300000.0, displayValue: "2.3 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.001, displayValue: "1 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.7, displayValue: "2.7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },
    { catalogNumber: "MCP604-I/P", manufacturerKey: "microchip", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 2.8e6, displayValue: "2.8 MHz" }, { attributeKey: "slewRate", quantityBaseValue: 2300000.0, displayValue: "2.3 V/µs" }, { attributeKey: "inputOffsetVoltage", quantityBaseValue: 0.001, displayValue: "1 mV" }, { attributeKey: "supplyVoltageMin", quantityBaseValue: 2.7, displayValue: "2.7 V" }, { attributeKey: "supplyVoltageMax", quantityBaseValue: 5.5, displayValue: "5.5 V" }] },

    // ── Voltage Regulators ────────────────────────────────────────────────────
    { catalogNumber: "LM7805CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.0, displayValue: "2 V" }] },
    { catalogNumber: "LM7812CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 12, displayValue: "12 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.0, displayValue: "2 V" }] },
    { catalogNumber: "LM7905CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: -5, displayValue: "-5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.0, displayValue: "2 V" }] },
    { catalogNumber: "L78M05CDT-TR", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.5, displayValue: "500 mA" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.0, displayValue: "2 V" }, { attributeKey: "package", choiceOptionKey: "pkg_dpak" }] },
    { catalogNumber: "L78M12CDT-TR", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 12, displayValue: "12 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.5, displayValue: "500 mA" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.0, displayValue: "2 V" }, { attributeKey: "package", choiceOptionKey: "pkg_dpak" }] },
    { catalogNumber: "LM317T", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 1.25, displayValue: "1.25 V (adj.)" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.2, displayValue: "2.2 V" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }] },
    { catalogNumber: "LM317DCYR", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 1.25, displayValue: "1.25 V (adj.)" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.5, displayValue: "500 mA" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 2.2, displayValue: "2.2 V" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "AMS1117-3.3", manufacturerKey: "diodesinc", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }] },
    { catalogNumber: "AMS1117-5.0", manufacturerKey: "diodesinc", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }] },
    { catalogNumber: "LD1117V33", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }] },
    { catalogNumber: "LD1117V50", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 1.1, displayValue: "1.1 V" }] },
    { catalogNumber: "MCP1700-3302E/TO", manufacturerKey: "microchip", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.25, displayValue: "250 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "dropoutVoltage", quantityBaseValue: 0.178, displayValue: "178 mV" }] },

    // ── Timer ICs ─────────────────────────────────────────────────────────────
    { catalogNumber: "NE555P", manufacturerKey: "ti", primaryCategoryKey: "timers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }], stockEntries: [{ locationKey: "drawer_a5", quantity: 30 }] },
    { catalogNumber: "NE555DR", manufacturerKey: "ti", primaryCategoryKey: "timers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }] },
    { catalogNumber: "NE556N", manufacturerKey: "ti", primaryCategoryKey: "timers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "LMC555CN/NOPB", manufacturerKey: "ti", primaryCategoryKey: "timers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }] },
    { catalogNumber: "LM556CN", manufacturerKey: "ti", primaryCategoryKey: "timers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },

    // ── Logic ICs ─────────────────────────────────────────────────────────────
    { catalogNumber: "SN74HC00N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }], stockEntries: [{ locationKey: "drawer_a5", quantity: 20 }] },
    { catalogNumber: "SN74HC04N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }], stockEntries: [{ locationKey: "drawer_a5", quantity: 20 }] },
    { catalogNumber: "SN74HC08N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "SN74HC32N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "SN74HC86N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "SN74HC595N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip16" }], stockEntries: [{ locationKey: "drawer_a5", quantity: 15 }] },
    { catalogNumber: "SN74HC245N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip20" }] },
    { catalogNumber: "SN74HC74N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "SN74HC164N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }] },
    { catalogNumber: "SN74HC138N", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip16" }] },
    { catalogNumber: "CD4017BE", manufacturerKey: "ti", primaryCategoryKey: "logic", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip16" }] },

    // ── Connectors ────────────────────────────────────────────────────────────
    { catalogNumber: "B2B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 2 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 50 }] },
    { catalogNumber: "B3B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 3 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 40 }] },
    { catalogNumber: "B4B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 30 }] },
    { catalogNumber: "B6B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }] },
    { catalogNumber: "B8B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 8 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }] },
    { catalogNumber: "PHR-2", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 2 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 50 }] },
    { catalogNumber: "PHR-3", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 3 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }] },
    { catalogNumber: "PHR-4", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }] },
    { catalogNumber: "68602-140HLF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 20 }] },
    { catalogNumber: "67996-240HLF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }] },
    { catalogNumber: "MHRD1260T1", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }] },
    { catalogNumber: "10118194-0001LF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }] },
    { catalogNumber: "0022232041", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 25 }] },
    { catalogNumber: "0022232051", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }] },
    { catalogNumber: "0022232061", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "gender", choiceOptionKey: "gender_female" }] },
    { catalogNumber: "47589-0001", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }, { attributeKey: "mountingType", choiceOptionKey: "mount_tht" }, { attributeKey: "gender", choiceOptionKey: "gender_male" }] }
  ],

  shoppingLists: [
    {
      key: "bench_restocking",
      name: "Bench restocking",
      description: "Common passives and semiconductors to keep on hand",
      items: [
        { catalogNumber: "RC0402FR-0710KL", manufacturerKey: "yageo", quantity: 200 },
        { catalogNumber: "RC0402FR-07100RL", manufacturerKey: "yageo", quantity: 200 },
        { catalogNumber: "GRM155R71C104KA88D", manufacturerKey: "murata", quantity: 200 },
        { catalogNumber: "CC0402KRX7R9BB104", manufacturerKey: "yageo", quantity: 200 },
        { catalogNumber: "1N4148W", manufacturerKey: "diodesinc", quantity: 100 },
        { catalogNumber: "2N2222AG", manufacturerKey: "onsemi", quantity: 50 },
        { catalogNumber: "2N7002", manufacturerKey: "onsemi", quantity: 50 },
        { catalogNumber: "NE555P", manufacturerKey: "ti", quantity: 10 },
        { catalogNumber: "LM358P", manufacturerKey: "ti", quantity: 10 },
        { catalogNumber: "LM7805CT", manufacturerKey: "ti", quantity: 5 }
      ]
    },
    {
      key: "stm32_dev_kit",
      name: "STM32 dev kit BOM",
      description: "Parts for a minimal STM32F103 development board",
      items: [
        { catalogNumber: "STM32F103C8T6", manufacturerKey: "stmicro", quantity: 3 },
        { catalogNumber: "GRM155R71C104KA88D", manufacturerKey: "murata", quantity: 20 },
        { catalogNumber: "GRM1555C1H100JA01D", manufacturerKey: "murata", quantity: 4 },
        { catalogNumber: "GRM1555C1H220JA01D", manufacturerKey: "murata", quantity: 4 },
        { catalogNumber: "RC0402FR-0710KL", manufacturerKey: "yageo", quantity: 10 },
        { catalogNumber: "RC0402FR-07100RL", manufacturerKey: "yageo", quantity: 5 },
        { catalogNumber: "AMS1117-3.3", manufacturerKey: "diodesinc", quantity: 3 },
        { catalogNumber: "1N5819-T", manufacturerKey: "diodesinc", quantity: 3 },
        { catalogNumber: "68602-140HLF", manufacturerKey: "amphenol", quantity: 3 },
        { catalogNumber: "B4B-PH-K-S(LF)(SN)", manufacturerKey: "jst", quantity: 6 }
      ]
    }
  ],

  purchaseOrders: [
    {
      supplierKey: "mouser",
      status: "RECEIVED",
      orderNumber: "MOUSER-2024-0142",
      currency: "EUR",
      notes: "Quarterly passive restock",
      items: [
        { catalogNumber: "ATMEGA328P-PU", manufacturerKey: "microchip", quantity: 5, unitPrice: 3.20, locationKey: "drawer_b1" },
        { catalogNumber: "STM32F103C8T6", manufacturerKey: "stmicro", quantity: 3, unitPrice: 4.80, locationKey: "drawer_b1" },
        { catalogNumber: "LM7805CT", manufacturerKey: "ti", quantity: 10, unitPrice: 0.75, locationKey: "drawer_b2" },
        { catalogNumber: "LM317T", manufacturerKey: "ti", quantity: 10, unitPrice: 0.65, locationKey: "drawer_b2" },
        { catalogNumber: "LD1117V33", manufacturerKey: "stmicro", quantity: 10, unitPrice: 0.45, locationKey: "drawer_b2" }
      ]
    },
    {
      supplierKey: "digikey",
      status: "ORDERED",
      orderNumber: "DK-7892341",
      currency: "EUR",
      notes: "Microcontroller and logic ICs order",
      items: [
        { catalogNumber: "ATMEGA328P-AU", manufacturerKey: "microchip", quantity: 10, unitPrice: 3.10 },
        { catalogNumber: "STM32G071RBT6", manufacturerKey: "stmicro", quantity: 5, unitPrice: 5.20 },
        { catalogNumber: "SN74HC595N", manufacturerKey: "ti", quantity: 20, unitPrice: 0.45 },
        { catalogNumber: "SN74HC00N", manufacturerKey: "ti", quantity: 20, unitPrice: 0.35 },
        { catalogNumber: "SN74HC04N", manufacturerKey: "ti", quantity: 20, unitPrice: 0.35 },
        { catalogNumber: "BC547CBU", manufacturerKey: "onsemi", quantity: 100, unitPrice: 0.08 },
        { catalogNumber: "BSS138", manufacturerKey: "onsemi", quantity: 50, unitPrice: 0.15 },
        { catalogNumber: "B4B-PH-K-S(LF)(SN)", manufacturerKey: "jst", quantity: 50, unitPrice: 0.12 }
      ]
    },
    {
      supplierKey: "tme",
      status: "DRAFT",
      currency: "EUR",
      notes: "Planned inductor and connector restock",
      items: [
        { catalogNumber: "SRR1005-101Y", manufacturerKey: "bourns", quantity: 20, unitPrice: 0.55 },
        { catalogNumber: "SRR0603-100Y", manufacturerKey: "bourns", quantity: 30, unitPrice: 0.38 },
        { catalogNumber: "AMS1117-5.0", manufacturerKey: "diodesinc", quantity: 20, unitPrice: 0.40 },
        { catalogNumber: "MCP602-I/P", manufacturerKey: "microchip", quantity: 10, unitPrice: 1.10 },
        { catalogNumber: "0022232041", manufacturerKey: "molex", quantity: 30, unitPrice: 0.28 },
        { catalogNumber: "CC0402KRX7R9BB103", manufacturerKey: "yageo", quantity: 500, unitPrice: 0.01 }
      ]
    }
  ],
  designs: [
    {
      key: "usb_power_module",
      name: "USB-C Power Module",
      description: "5 V / 3 A regulated power module built around the AMS1117 LDO.",
      outputCatalogNumber: "DESIGN-0001",
      extraRevisions: [
        { notes: "Added bulk input capacitor and reverse-polarity protection." },
        { notes: "Switched output connector to JST-PH." }
      ],
      bomLineItems: [
        {
          designators: "U1",
          notes: "5 V LDO regulator",
          pinnedPart: { manufacturerKey: "diodesinc", catalogNumber: "AMS1117-5.0" }
        },
        {
          designators: "C1, C2",
          categoryKey: "capacitors",
          notes: "Input/output decoupling",
          matchers: [{ attributeKey: "capacitance", operator: "EQ", value: "100nF" }]
        },
        {
          designators: "C3",
          categoryKey: "capacitors",
          notes: "Bulk input capacitor",
          matchers: [{ attributeKey: "capacitance", operator: "GTE", value: "1uF" }]
        },
        {
          designators: "R1",
          categoryKey: "resistors",
          notes: "Power LED series resistor",
          matchers: [{ attributeKey: "resistance", operator: "EQ", value: "1k" }]
        }
      ]
    },
    {
      key: "stm32_breakout",
      name: "STM32G0 Breakout",
      description: "Minimal STM32G071 breakout board with SWD header and 3.3 V regulator.",
      outputCatalogNumber: "DESIGN-0002",
      extraRevisions: [{ notes: "Routed UART to pin header for debugging." }],
      bomLineItems: [
        {
          designators: "U1",
          notes: "Main microcontroller",
          pinnedPart: { manufacturerKey: "stmicro", catalogNumber: "STM32G071RBT6" }
        },
        {
          designators: "U2",
          notes: "3.3 V LDO regulator",
          pinnedPart: { manufacturerKey: "diodesinc", catalogNumber: "AMS1117-3.3" }
        },
        {
          designators: "C1-C4",
          categoryKey: "capacitors",
          notes: "VDD decoupling",
          matchers: [{ attributeKey: "capacitance", operator: "EQ", value: "100nF" }]
        },
        {
          designators: "R1, R2",
          categoryKey: "resistors",
          notes: "BOOT0 / reset pull resistors",
          matchers: [{ attributeKey: "resistance", operator: "EQ", value: "10k" }]
        }
      ]
    },
    {
      key: "shift_register_driver",
      name: "8-Channel Shift Register Driver",
      description: "74HC595-based output expander with transistor-buffered channels.",
      outputCatalogNumber: "DESIGN-0003",
      bomLineItems: [
        {
          designators: "U1",
          notes: "Shift register",
          pinnedPart: { manufacturerKey: "ti", catalogNumber: "SN74HC595N" }
        },
        {
          designators: "R1-R8",
          categoryKey: "resistors",
          notes: "Transistor base resistors",
          matchers: [{ attributeKey: "resistance", operator: "EQ", value: "1k" }]
        },
        {
          designators: "C1",
          categoryKey: "capacitors",
          notes: "Decoupling capacitor",
          matchers: [{ attributeKey: "capacitance", operator: "EQ", value: "100nF" }]
        }
      ]
    }
  ]
};
