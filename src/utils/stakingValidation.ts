import {
  CalculateRewardsRequest,
  CompoundingFrequency,
  DurationUnit,
  RateType,
} from "../api/staking";

/** Raw, as-typed form values. */
export interface StakingFormValues {
  principal: string;
  apy: string;
  duration: string;
  durationUnit: DurationUnit;
  compoundingFrequency: CompoundingFrequency;
  rateType: RateType;
  tokenPrice: string;
}

export type StakingFormErrors = Partial<
  Record<"principal" | "apy" | "duration" | "tokenPrice", string>
>;

// Mirrors the server limits (server/validation/stakingInput.js). The server
// remains the source of truth; these only give instant feedback.
export const LIMITS = {
  MAX_PRINCIPAL: 1e12,
  MAX_APY_PERCENT: 1000,
  MAX_DURATION_YEARS: 100,
  MAX_TOKEN_PRICE: 1e9,
};

const parse = (raw: string): number =>
  raw.trim() === "" ? NaN : Number(raw.trim());

export const validateStakingForm = (
  values: StakingFormValues
): StakingFormErrors => {
  const errors: StakingFormErrors = {};

  const principal = parse(values.principal);
  if (values.principal.trim() === "") {
    errors.principal = "Enter the amount you want to stake.";
  } else if (!Number.isFinite(principal)) {
    errors.principal = "Principal must be a number.";
  } else if (principal <= 0) {
    errors.principal = "Principal must be greater than 0.";
  } else if (principal > LIMITS.MAX_PRINCIPAL) {
    errors.principal = `Principal must not exceed ${LIMITS.MAX_PRINCIPAL.toLocaleString("en-US")}.`;
  }

  const apy = parse(values.apy);
  if (values.apy.trim() === "") {
    errors.apy = "Enter the yield as a percentage, e.g. 5.";
  } else if (!Number.isFinite(apy)) {
    errors.apy = "APY must be a number.";
  } else if (apy < 0) {
    errors.apy = "APY cannot be negative.";
  } else if (apy > LIMITS.MAX_APY_PERCENT) {
    errors.apy = `APY must not exceed ${LIMITS.MAX_APY_PERCENT}%.`;
  }

  const duration = parse(values.duration);
  if (values.duration.trim() === "") {
    errors.duration = "Enter how long you plan to stake.";
  } else if (!Number.isFinite(duration)) {
    errors.duration = "Duration must be a number.";
  } else if (duration <= 0) {
    errors.duration = "Duration must be greater than 0.";
  } else {
    const years = values.durationUnit === "days" ? duration / 365 : duration;
    if (years > LIMITS.MAX_DURATION_YEARS) {
      errors.duration = `Duration must not exceed ${LIMITS.MAX_DURATION_YEARS} years.`;
    }
  }

  if (values.tokenPrice.trim() !== "") {
    const price = parse(values.tokenPrice);
    if (!Number.isFinite(price)) {
      errors.tokenPrice = "Token price must be a number.";
    } else if (price < 0) {
      errors.tokenPrice = "Token price cannot be negative.";
    } else if (price > LIMITS.MAX_TOKEN_PRICE) {
      errors.tokenPrice = "Token price is too large.";
    }
  }

  return errors;
};

/** Converts validated form values into the API payload. */
export const toRequest = (
  values: StakingFormValues
): CalculateRewardsRequest => {
  const request: CalculateRewardsRequest = {
    principal: parse(values.principal),
    apy: parse(values.apy),
    duration: parse(values.duration),
    durationUnit: values.durationUnit,
    compoundingFrequency: values.compoundingFrequency,
    rateType: values.rateType,
  };
  if (values.tokenPrice.trim() !== "") {
    request.tokenPrice = parse(values.tokenPrice);
  }
  return request;
};
