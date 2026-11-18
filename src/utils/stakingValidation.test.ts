import {
  StakingFormValues,
  toRequest,
  validateStakingForm,
} from "./stakingValidation";

const valid: StakingFormValues = {
  principal: "1000",
  apy: "5",
  duration: "1.5",
  durationUnit: "years",
  compoundingFrequency: "monthly",
  rateType: "nominal",
  tokenPrice: "",
};

describe("validateStakingForm", () => {
  it("accepts valid values, including fractional duration and zero APY", () => {
    expect(validateStakingForm(valid)).toEqual({});
    expect(validateStakingForm({ ...valid, apy: "0" })).toEqual({});
  });

  it("flags empty required fields", () => {
    const errors = validateStakingForm({
      ...valid,
      principal: "",
      apy: " ",
      duration: "",
    });
    expect(Object.keys(errors).sort()).toEqual(["apy", "duration", "principal"]);
  });

  it("rejects non-numeric, negative and out-of-range values", () => {
    expect(validateStakingForm({ ...valid, principal: "abc" }).principal).toMatch(/number/);
    expect(validateStakingForm({ ...valid, principal: "0" }).principal).toMatch(/greater than 0/);
    expect(validateStakingForm({ ...valid, apy: "-1" }).apy).toMatch(/negative/);
    expect(validateStakingForm({ ...valid, apy: "1001" }).apy).toMatch(/exceed/);
    expect(validateStakingForm({ ...valid, duration: "101" }).duration).toMatch(/100 years/);
  });

  it("applies the duration cap in the selected unit", () => {
    const days = { ...valid, durationUnit: "days" as const };
    expect(validateStakingForm({ ...days, duration: "36500" })).toEqual({});
    expect(validateStakingForm({ ...days, duration: "36501" }).duration).toBeDefined();
  });

  it("treats token price as optional but validates it when present", () => {
    expect(validateStakingForm({ ...valid, tokenPrice: "" })).toEqual({});
    expect(validateStakingForm({ ...valid, tokenPrice: "2.5" })).toEqual({});
    expect(validateStakingForm({ ...valid, tokenPrice: "-3" }).tokenPrice).toBeDefined();
  });
});

describe("toRequest", () => {
  it("converts strings to numbers and omits an empty token price", () => {
    expect(toRequest(valid)).toEqual({
      principal: 1000,
      apy: 5,
      duration: 1.5,
      durationUnit: "years",
      compoundingFrequency: "monthly",
      rateType: "nominal",
    });
  });

  it("includes the token price when provided", () => {
    expect(toRequest({ ...valid, tokenPrice: "2.5" }).tokenPrice).toBe(2.5);
  });
});
