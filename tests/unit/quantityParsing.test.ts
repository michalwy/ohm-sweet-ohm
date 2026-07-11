import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuantityValue, parseNumberValue } from "../../src/lib/quantityParsing.js";

describe("parseQuantityValue", () => {
  describe("plain numbers (no prefix, no unit)", () => {
    it("parses integer with unit", () => {
      const result = parseQuantityValue({ rawValue: "100", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "100");
      assert.equal(result.displayValue, "100 Ω");
    });

    it("parses decimal with unit", () => {
      const result = parseQuantityValue({ rawValue: "1.5", baseUnitSymbol: "V" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "1.5");
      assert.equal(result.displayValue, "1.5 V");
    });

    it("parses zero", () => {
      const result = parseQuantityValue({ rawValue: "0", baseUnitSymbol: "V" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0");
      assert.equal(result.displayValue, "0 V");
    });
  });

  describe("SI prefixes", () => {
    it("parses milli prefix (m)", () => {
      const result = parseQuantityValue({ rawValue: "1mV", baseUnitSymbol: "V" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.001");
      assert.equal(result.displayValue, "1 mV");
    });

    it("parses kilo prefix (k)", () => {
      const result = parseQuantityValue({ rawValue: "10kΩ", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "10000");
      assert.equal(result.displayValue, "10 kΩ");
    });

    it("parses micro prefix (µ)", () => {
      const result = parseQuantityValue({ rawValue: "100µF", baseUnitSymbol: "F" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.0001");
      assert.equal(result.displayValue, "100 µF");
    });

    it("parses micro prefix (u, alias for µ)", () => {
      const result = parseQuantityValue({ rawValue: "100uF", baseUnitSymbol: "F" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.0001");
      assert.equal(result.displayValue, "100 µF");
    });

    it("parses nano prefix (n)", () => {
      const result = parseQuantityValue({ rawValue: "470nF", baseUnitSymbol: "F" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.00000047");
      assert.equal(result.displayValue, "470 nF");
    });

    it("parses pico prefix (p)", () => {
      const result = parseQuantityValue({ rawValue: "100pF", baseUnitSymbol: "F" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.0000000001");
      assert.equal(result.displayValue, "100 pF");
    });

    it("parses mega prefix (M)", () => {
      const result = parseQuantityValue({ rawValue: "1MΩ", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "1000000");
      assert.equal(result.displayValue, "1 MΩ");
    });

    it("normalises large value to best prefix", () => {
      const result = parseQuantityValue({ rawValue: "1000", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "1000");
      assert.equal(result.displayValue, "1 kΩ");
    });
  });

  describe("unit aliases", () => {
    it("accepts 'ohm' as alias for Ω", () => {
      const result = parseQuantityValue({ rawValue: "100 ohm", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "100");
    });

    it("accepts 'ohms' as alias for Ω", () => {
      const result = parseQuantityValue({ rawValue: "1kohms", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "1000");
    });
  });

  describe("whitespace handling", () => {
    it("accepts space between value and unit", () => {
      const result = parseQuantityValue({ rawValue: "1 mV", baseUnitSymbol: "V" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "0.001");
    });

    it("trims leading/trailing whitespace", () => {
      const result = parseQuantityValue({ rawValue: "  10 kΩ  ", baseUnitSymbol: "Ω" });
      assert.ok(result.ok);
      assert.equal(result.baseValue, "10000");
    });
  });

  describe("error cases", () => {
    it("returns error for empty string", () => {
      const result = parseQuantityValue({ rawValue: "", baseUnitSymbol: "V" });
      assert.ok(!result.ok);
    });

    it("returns error for non-numeric text", () => {
      const result = parseQuantityValue({ rawValue: "abc", baseUnitSymbol: "V" });
      assert.ok(!result.ok);
    });

    it("returns error for wrong unit", () => {
      const result = parseQuantityValue({ rawValue: "1A", baseUnitSymbol: "V" });
      assert.ok(!result.ok);
    });
  });
});

describe("parseNumberValue", () => {
  it("parses integer", () => {
    const result = parseNumberValue({ rawValue: "100" });
    assert.ok(result.ok);
    assert.equal(result.value, "100");
    assert.equal(result.displayValue, "100");
  });

  it("parses decimal", () => {
    const result = parseNumberValue({ rawValue: "1.5" });
    assert.ok(result.ok);
    assert.equal(result.value, "1.5");
  });

  it("parses negative number", () => {
    const result = parseNumberValue({ rawValue: "-10" });
    assert.ok(result.ok);
    assert.equal(result.value, "-10");
  });

  it("normalises comma decimal separator", () => {
    const result = parseNumberValue({ rawValue: "1,5" });
    assert.ok(result.ok);
    assert.equal(result.value, "1.5");
  });

  it("trims whitespace", () => {
    const result = parseNumberValue({ rawValue: "  42  " });
    assert.ok(result.ok);
    assert.equal(result.value, "42");
  });

  it("returns error for empty string", () => {
    const result = parseNumberValue({ rawValue: "" });
    assert.ok(!result.ok);
  });

  it("returns error for non-numeric text", () => {
    const result = parseNumberValue({ rawValue: "abc" });
    assert.ok(!result.ok);
  });

  it("returns error for number with unit", () => {
    const result = parseNumberValue({ rawValue: "1kΩ" });
    assert.ok(!result.ok);
  });
});
