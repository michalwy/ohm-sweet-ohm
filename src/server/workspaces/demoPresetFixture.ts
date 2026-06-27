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

export type DesignFixture = {
  key: string;
  name: string;
  description?: string;
  /** Catalog number for the auto-created output part (under the internal manufacturer). */
  outputCatalogNumber: string;
  /** Extra revisions beyond the implicit v1. Each entry adds the next revision number. */
  extraRevisions?: Array<{ notes?: string }>;
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
        { key: "pkg_qfn56", label: "QFN-56", sortOrder: 25 }
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
        { attributeKey: "package", sortOrder: 2 },
        { attributeKey: "powerRating", sortOrder: 3 }
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
        { attributeKey: "package", sortOrder: 3 }
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
        { attributeKey: "package", sortOrder: 2 }
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
        { attributeKey: "voltageRating", sortOrder: 1 },
        { attributeKey: "currentRating", sortOrder: 2 }
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
        { attributeKey: "vdsMax", sortOrder: 2 }
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
        { attributeKey: "vceMax", sortOrder: 2 }
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
        { attributeKey: "flashSize", sortOrder: 1 },
        { attributeKey: "ramSize", sortOrder: 2 },
        { attributeKey: "pinCount", sortOrder: 3 }
      ]
    },
    {
      key: "opamps",
      name: "Op-Amps",
      isAssignable: true,
      parentKey: "ics",
      attributes: [
        { attributeKey: "package", sortOrder: 0, isPrimary: true },
        { attributeKey: "gainBandwidthProduct", sortOrder: 1 }
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
        { attributeKey: "package", sortOrder: 2 }
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
        { attributeKey: "pitch", sortOrder: 1 }
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
    { catalogNumber: "RC0402FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 500 }] },
    { catalogNumber: "RC0402FR-0722RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22, displayValue: "22 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0402FR-0747RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47, displayValue: "47 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }, { attributeKey: "powerRating", quantityBaseValue: 0.0625, displayValue: "62.5 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 400 }] },
    { catalogNumber: "RC0402FR-07180RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 180, displayValue: "180 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-07220RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 220, displayValue: "220 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07330RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 330, displayValue: "330 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 150 }] },
    { catalogNumber: "RC0402FR-07560RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 560, displayValue: "560 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 500 }] },
    { catalogNumber: "RC0402FR-071K5L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1500, displayValue: "1.5 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-072K2L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 2200, displayValue: "2.2 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-073K3L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 3300, displayValue: "3.3 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-074K7L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 4700, displayValue: "4.7 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0402FR-076K8L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 6800, displayValue: "6.8 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 600 }] },
    { catalogNumber: "RC0402FR-0722KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22000, displayValue: "22 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-0733KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 33000, displayValue: "33 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 150 }] },
    { catalogNumber: "RC0402FR-0768KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 68000, displayValue: "68 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0402FR-07220KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 220000, displayValue: "220 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-07470KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470000, displayValue: "470 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402FR-071ML", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    // Yageo 0402 ±5%
    { catalogNumber: "RC0402JR-0715RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 15, displayValue: "15 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-0733RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 33, displayValue: "33 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-0768RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 68, displayValue: "68 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-07150RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 150, displayValue: "150 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-07390RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 390, displayValue: "390 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-07680RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 680, displayValue: "680 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-071K5L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1500, displayValue: "1.5 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-073K3L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 3300, displayValue: "3.3 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-076K8L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 6800, displayValue: "6.8 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "RC0402JR-0715KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 15000, displayValue: "15 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    // Yageo 0603
    { catalogNumber: "RC0603FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }, { attributeKey: "powerRating", quantityBaseValue: 0.1, displayValue: "100 mW" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0603FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0603FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "RC0603FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 300 }] },
    { catalogNumber: "RC0603FR-072K2L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 2200, displayValue: "2.2 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "RC0603FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 400 }] },
    { catalogNumber: "RC0603FR-0722KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 22000, displayValue: "22 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "RC0603FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "RC0603FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "RC0603FR-071ML", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    // Yageo 0805
    { catalogNumber: "RC0805FR-0710RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }, { attributeKey: "powerRating", quantityBaseValue: 0.125, displayValue: "125 mW" }] },
    { catalogNumber: "RC0805FR-07100RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "RC0805FR-07470RL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 470, displayValue: "470 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "RC0805FR-071KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "RC0805FR-074K7L", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 4700, displayValue: "4.7 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "RC0805FR-0710KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 200 }] },
    { catalogNumber: "RC0805FR-0747KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 47000, displayValue: "47 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "RC0805FR-07100KL", manufacturerKey: "yageo", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    // Vishay CRCW 0402
    { catalogNumber: "CRCW04020000Z0ED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 0, displayValue: "0 Ω" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a1", quantity: 100 }] },
    { catalogNumber: "CRCW040210R0FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CRCW0402100RFKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CRCW04021K00FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CRCW040210K0FKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CRCW0402100KFKED", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    // Vishay CRCW 0603
    { catalogNumber: "CRCW060310R0FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "CRCW06031K00FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "CRCW060310K0FKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "CRCW0603100KFKEA", manufacturerKey: "vishay", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_1p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    // Bourns CFR-25 THT
    { catalogNumber: "CFR-25JB-52-10R", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10, displayValue: "10 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-100R", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100, displayValue: "100 Ω" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-1K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000, displayValue: "1 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 80 }] },
    { catalogNumber: "CFR-25JB-52-10K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 10000, displayValue: "10 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "CFR-25JB-52-100K", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 100000, displayValue: "100 kΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }] },
    { catalogNumber: "CFR-25JB-52-1M", manufacturerKey: "bourns", primaryCategoryKey: "resistors", attributes: [{ attributeKey: "resistance", quantityBaseValue: 1000000, displayValue: "1 MΩ" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "powerRating", quantityBaseValue: 0.25, displayValue: "250 mW" }] },

    // ── Capacitors ────────────────────────────────────────────────────────────
    // Murata GRM 0402 X7R
    { catalogNumber: "GRM155R71C104KA88D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 500 }] },
    { catalogNumber: "GRM155R60J105KA12D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-6, displayValue: "1 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "GRM1555C1H100JA01D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-11, displayValue: "10 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "GRM1555C1H220JA01D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-11, displayValue: "22 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "GRM155R71H103KA88D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 400 }] },
    // Murata GRM 0603
    { catalogNumber: "GRM188R71C104KA93D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "GRM188R61A106KE69D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    { catalogNumber: "GRM188C81E225KE15D", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    // Murata GRM 0805
    { catalogNumber: "GRM21BR71H104KA01L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "GRM21BR60J106KE19L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 100 }] },
    // Murata GRM 1206
    { catalogNumber: "GRM31CR60J107ME39L", manufacturerKey: "murata", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-4, displayValue: "100 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 6.3, displayValue: "6.3 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_20p" }, { attributeKey: "package", choiceOptionKey: "pkg_1206" }] },
    // Yageo CC 0402
    { catalogNumber: "CC0402KRX7R9BB101", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-10, displayValue: "100 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CC0402KRX7R9BB102", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-9, displayValue: "1 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "CC0402KRX7R9BB103", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 300 }] },
    { catalogNumber: "CC0402KRX7R9BB104", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 500 }] },
    { catalogNumber: "CC0402JPRNPO9BB101", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-10, displayValue: "100 pF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_5p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    // Yageo CC 0603
    { catalogNumber: "CC0603KRX7R9BB103", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-8, displayValue: "10 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "CC0603KRX7R9BB104", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 200 }] },
    { catalogNumber: "CC0603KRX5R9BB105", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-6, displayValue: "1 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "CC0603KRX5R9BB106", manufacturerKey: "yageo", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-5, displayValue: "10 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 10, displayValue: "10 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_20p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    // Panasonic electrolytic
    { catalogNumber: "EEU-FR1E101", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-4, displayValue: "100 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 50 }] },
    { catalogNumber: "EEU-FR1E470", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-5, displayValue: "47 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }], stockEntries: [{ locationKey: "drawer_a2", quantity: 50 }] },
    { catalogNumber: "EEU-FR1E471", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-4, displayValue: "470 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }] },
    { catalogNumber: "EEA-GA1E102", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-3, displayValue: "1000 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "package", choiceOptionKey: "pkg_tht" }] },
    { catalogNumber: "EEEFK1E471P", manufacturerKey: "panasonic", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 4.7e-4, displayValue: "470 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }] },
    // KEMET
    { catalogNumber: "C0402C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "C0603C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "C0805C104K5RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0805" }] },
    { catalogNumber: "C1210C226K3RACTU", manufacturerKey: "kemet", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-5, displayValue: "22 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_1210" }] },
    // AVX
    { catalogNumber: "04025C104KAT2A", manufacturerKey: "avx", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 1e-7, displayValue: "100 nF" }, { attributeKey: "voltageRating", quantityBaseValue: 25, displayValue: "25 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "06031C225KAT2A", manufacturerKey: "avx", primaryCategoryKey: "capacitors", attributes: [{ attributeKey: "capacitance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µF" }, { attributeKey: "voltageRating", quantityBaseValue: 16, displayValue: "16 V" }, { attributeKey: "tolerance", choiceOptionKey: "tol_10p" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },

    // ── Inductors ─────────────────────────────────────────────────────────────
    // Bourns SRR series
    { catalogNumber: "SRR0402-1R0Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-6, displayValue: "1 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.9, displayValue: "900 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "SRR0402-2R2Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-6, displayValue: "2.2 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.7, displayValue: "700 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "SRR0402-4R7Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 4.7e-6, displayValue: "4.7 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.52, displayValue: "520 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0402" }] },
    { catalogNumber: "SRR0603-100Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-5, displayValue: "10 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 50 }] },
    { catalogNumber: "SRR0603-220Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-5, displayValue: "22 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.55, displayValue: "550 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "SRR0603-470Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 4.7e-5, displayValue: "47 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.38, displayValue: "380 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_0603" }] },
    { catalogNumber: "SRR1005-101Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 1e-4, displayValue: "100 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.8, displayValue: "800 mA" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 30 }] },
    { catalogNumber: "SRR1005-221Y", manufacturerKey: "bourns", primaryCategoryKey: "inductors", attributes: [{ attributeKey: "inductance", quantityBaseValue: 2.2e-4, displayValue: "220 µH" }, { attributeKey: "currentRating", quantityBaseValue: 0.55, displayValue: "550 mA" }] },

    // ── Diodes ────────────────────────────────────────────────────────────────
    { catalogNumber: "1N4148W", manufacturerKey: "diodesinc", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.15, displayValue: "150 mA" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 200 }] },
    { catalogNumber: "1N4148WT", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 100, displayValue: "100 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.15, displayValue: "150 mA" }] },
    { catalogNumber: "1N5819-T", manufacturerKey: "diodesinc", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sma" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "1N4001RLG", manufacturerKey: "onsemi", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "voltageRating", quantityBaseValue: 50, displayValue: "50 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "1N4007RLG", manufacturerKey: "onsemi", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tht" }, { attributeKey: "voltageRating", quantityBaseValue: 1000, displayValue: "1000 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "BAT54S", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 30, displayValue: "30 V" }, { attributeKey: "currentRating", quantityBaseValue: 0.2, displayValue: "200 mA" }] },
    { catalogNumber: "SS14", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sma" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 1, displayValue: "1 A" }] },
    { catalogNumber: "SS34", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_smb" }, { attributeKey: "voltageRating", quantityBaseValue: 40, displayValue: "40 V" }, { attributeKey: "currentRating", quantityBaseValue: 3, displayValue: "3 A" }] },
    // Zener diodes (Vishay BZX84C SOT-23)
    { catalogNumber: "BZX84C3V3", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 3.3, displayValue: "3.3 V" }] },
    { catalogNumber: "BZX84C4V7", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 4.7, displayValue: "4.7 V" }] },
    { catalogNumber: "BZX84C5V1", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 5.1, displayValue: "5.1 V" }] },
    { catalogNumber: "BZX84C6V2", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 6.2, displayValue: "6.2 V" }] },
    { catalogNumber: "BZX84C9V1", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 9.1, displayValue: "9.1 V" }] },
    { catalogNumber: "BZX84C12", manufacturerKey: "vishay", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "voltageRating", quantityBaseValue: 12, displayValue: "12 V" }] },
    // Nexperia BZX384 SOT-323
    { catalogNumber: "BZX384-B3V3", manufacturerKey: "nexperia", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 3.3, displayValue: "3.3 V" }] },
    { catalogNumber: "BZX384-B5V1", manufacturerKey: "nexperia", primaryCategoryKey: "diodes", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot323" }, { attributeKey: "voltageRating", quantityBaseValue: 5.1, displayValue: "5.1 V" }] },

    // ── MOSFETs ───────────────────────────────────────────────────────────────
    { catalogNumber: "2N7002", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 60, displayValue: "60 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 100 }] },
    { catalogNumber: "2N7002E-7-F", manufacturerKey: "diodesinc", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 60, displayValue: "60 V" }] },
    { catalogNumber: "BSS138", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 50, displayValue: "50 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "BSS84", manufacturerKey: "onsemi", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: -50, displayValue: "-50 V" }] },
    { catalogNumber: "IRF540NPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "vdsMax", quantityBaseValue: 100, displayValue: "100 V" }], stockEntries: [{ locationKey: "drawer_a4", quantity: 20 }] },
    { catalogNumber: "IRL540NPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }, { attributeKey: "vdsMax", quantityBaseValue: 100, displayValue: "100 V" }] },
    { catalogNumber: "IRLML2502TRPBF", manufacturerKey: "infineon", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 20, displayValue: "20 V" }] },
    { catalogNumber: "DMN2004VK-7", manufacturerKey: "diodesinc", primaryCategoryKey: "mosfets", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_nchannel" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vdsMax", quantityBaseValue: 20, displayValue: "20 V" }] },

    // ── BJTs ──────────────────────────────────────────────────────────────────
    { catalogNumber: "2N2222AG", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "2N2907AG", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -60, displayValue: "-60 V" }] },
    { catalogNumber: "BC547CBU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 45, displayValue: "45 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 80 }] },
    { catalogNumber: "BC557CBU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -45, displayValue: "-45 V" }] },
    { catalogNumber: "BC817-40LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: 45, displayValue: "45 V" }] },
    { catalogNumber: "BC807-40LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: -45, displayValue: "-45 V" }] },
    { catalogNumber: "MMBT3904LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }], stockEntries: [{ locationKey: "drawer_a3", quantity: 50 }] },
    { catalogNumber: "MMBT3906LT1G", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_sot23" }, { attributeKey: "vceMax", quantityBaseValue: -40, displayValue: "-40 V" }] },
    { catalogNumber: "2N3904BU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_npn" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: 40, displayValue: "40 V" }] },
    { catalogNumber: "2N3906BU", manufacturerKey: "onsemi", primaryCategoryKey: "bjts", attributes: [{ attributeKey: "channelType", choiceOptionKey: "ch_pnp" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }, { attributeKey: "vceMax", quantityBaseValue: -40, displayValue: "-40 V" }] },

    // ── Microcontrollers ──────────────────────────────────────────────────────
    { catalogNumber: "ATMEGA328P-PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip28" }, { attributeKey: "flashSize", textValue: "32 KB" }, { attributeKey: "ramSize", textValue: "2 KB" }, { attributeKey: "pinCount", numberValue: 28 }] },
    { catalogNumber: "ATMEGA328P-AU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp32" }, { attributeKey: "flashSize", textValue: "32 KB" }, { attributeKey: "ramSize", textValue: "2 KB" }, { attributeKey: "pinCount", numberValue: 32 }] },
    { catalogNumber: "ATTINY85-20PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "flashSize", textValue: "8 KB" }, { attributeKey: "ramSize", textValue: "512 B" }, { attributeKey: "pinCount", numberValue: 8 }] },
    { catalogNumber: "ATTINY85-20SU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "flashSize", textValue: "8 KB" }, { attributeKey: "ramSize", textValue: "512 B" }, { attributeKey: "pinCount", numberValue: 8 }] },
    { catalogNumber: "ATMEGA2560-16AU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp100" }, { attributeKey: "flashSize", textValue: "256 KB" }, { attributeKey: "ramSize", textValue: "8 KB" }, { attributeKey: "pinCount", numberValue: 100 }] },
    { catalogNumber: "PIC16F877A-I/P", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip40" }, { attributeKey: "flashSize", textValue: "14 KB" }, { attributeKey: "ramSize", textValue: "368 B" }, { attributeKey: "pinCount", numberValue: 40 }] },
    { catalogNumber: "STM32F103C8T6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp48" }, { attributeKey: "flashSize", textValue: "64 KB" }, { attributeKey: "ramSize", textValue: "20 KB" }, { attributeKey: "pinCount", numberValue: 48 }] },
    { catalogNumber: "STM32F103CBT6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp48" }, { attributeKey: "flashSize", textValue: "128 KB" }, { attributeKey: "ramSize", textValue: "20 KB" }, { attributeKey: "pinCount", numberValue: 48 }] },
    { catalogNumber: "STM32G071RBT6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "flashSize", textValue: "128 KB" }, { attributeKey: "ramSize", textValue: "36 KB" }, { attributeKey: "pinCount", numberValue: 64 }] },
    { catalogNumber: "STM32G031K8T6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_tqfp32" }, { attributeKey: "flashSize", textValue: "64 KB" }, { attributeKey: "ramSize", textValue: "8 KB" }, { attributeKey: "pinCount", numberValue: 32 }] },
    { catalogNumber: "STM32F401CCU6", manufacturerKey: "stmicro", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_qfn32" }, { attributeKey: "flashSize", textValue: "256 KB" }, { attributeKey: "ramSize", textValue: "64 KB" }, { attributeKey: "pinCount", numberValue: 48 }] },
    { catalogNumber: "ATMEGA16A-PU", manufacturerKey: "microchip", primaryCategoryKey: "microcontrollers", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip40" }, { attributeKey: "flashSize", textValue: "16 KB" }, { attributeKey: "ramSize", textValue: "1 KB" }, { attributeKey: "pinCount", numberValue: 40 }] },

    // ── Op-Amps ───────────────────────────────────────────────────────────────
    { catalogNumber: "LM358P", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }], stockEntries: [{ locationKey: "drawer_b2", quantity: 30 }] },
    { catalogNumber: "LM358DR", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }] },
    { catalogNumber: "LM741CN", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1.5e6, displayValue: "1.5 MHz" }] },
    { catalogNumber: "TL071CP", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }] },
    { catalogNumber: "TL071CD", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_soic8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }] },
    { catalogNumber: "TL072CP", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }] },
    { catalogNumber: "LM324N", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 1e6, displayValue: "1 MHz" }] },
    { catalogNumber: "TL074CN", manufacturerKey: "ti", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 3e6, displayValue: "3 MHz" }] },
    { catalogNumber: "MCP602-I/P", manufacturerKey: "microchip", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip8" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 2.8e6, displayValue: "2.8 MHz" }] },
    { catalogNumber: "MCP604-I/P", manufacturerKey: "microchip", primaryCategoryKey: "opamps", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_dip14" }, { attributeKey: "gainBandwidthProduct", quantityBaseValue: 2.8e6, displayValue: "2.8 MHz" }] },

    // ── Voltage Regulators ────────────────────────────────────────────────────
    { catalogNumber: "LM7805CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }] },
    { catalogNumber: "LM7812CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 12, displayValue: "12 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }] },
    { catalogNumber: "LM7905CT", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: -5, displayValue: "-5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1.5, displayValue: "1.5 A" }, { attributeKey: "package", choiceOptionKey: "pkg_to220" }] },
    { catalogNumber: "L78M05CDT-TR", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.5, displayValue: "500 mA" }] },
    { catalogNumber: "L78M12CDT-TR", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 12, displayValue: "12 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.5, displayValue: "500 mA" }] },
    { catalogNumber: "LM317T", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_to220" }] },
    { catalogNumber: "LM317DCYR", manufacturerKey: "ti", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "AMS1117-3.3", manufacturerKey: "diodesinc", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "AMS1117-5.0", manufacturerKey: "diodesinc", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 1, displayValue: "1 A" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "LD1117V33", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "LD1117V50", manufacturerKey: "stmicro", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 5, displayValue: "5 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.8, displayValue: "800 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_sot223" }] },
    { catalogNumber: "MCP1700-3302E/TO", manufacturerKey: "microchip", primaryCategoryKey: "regulators", attributes: [{ attributeKey: "outputVoltage", quantityBaseValue: 3.3, displayValue: "3.3 V" }, { attributeKey: "outputCurrentMax", quantityBaseValue: 0.25, displayValue: "250 mA" }, { attributeKey: "package", choiceOptionKey: "pkg_to92" }] },

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
    { catalogNumber: "B2B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 2 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 50 }] },
    { catalogNumber: "B3B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 3 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 40 }] },
    { catalogNumber: "B4B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 30 }] },
    { catalogNumber: "B6B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }] },
    { catalogNumber: "B8B-PH-K-S(LF)(SN)", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 8 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }] },
    { catalogNumber: "PHR-2", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 2 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 50 }] },
    { catalogNumber: "PHR-3", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 3 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }] },
    { catalogNumber: "PHR-4", manufacturerKey: "jst", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.002, displayValue: "2 mm" }] },
    { catalogNumber: "68602-140HLF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 20 }] },
    { catalogNumber: "67996-240HLF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 40 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }] },
    { catalogNumber: "MHRD1260T1", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }] },
    { catalogNumber: "10118194-0001LF", manufacturerKey: "amphenol", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }] },
    { catalogNumber: "0022232041", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 4 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }], stockEntries: [{ locationKey: "drawer_b3", quantity: 25 }] },
    { catalogNumber: "0022232051", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }] },
    { catalogNumber: "0022232061", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 6 }, { attributeKey: "pitch", quantityBaseValue: 0.00254, displayValue: "2.54 mm" }] },
    { catalogNumber: "47589-0001", manufacturerKey: "molex", primaryCategoryKey: "connectors", attributes: [{ attributeKey: "pinCount", numberValue: 5 }] }
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
      ]
    },
    {
      key: "stm32_breakout",
      name: "STM32G0 Breakout",
      description: "Minimal STM32G071 breakout board with SWD header and 3.3 V regulator.",
      outputCatalogNumber: "DESIGN-0002",
      extraRevisions: [{ notes: "Routed UART to pin header for debugging." }]
    },
    {
      key: "shift_register_driver",
      name: "8-Channel Shift Register Driver",
      description: "74HC595-based output expander with transistor-buffered channels.",
      outputCatalogNumber: "DESIGN-0003"
    }
  ]
};
