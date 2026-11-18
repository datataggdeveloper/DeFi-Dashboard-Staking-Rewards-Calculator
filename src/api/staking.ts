import axios from "axios";

export type DurationUnit = "days" | "years";
export type CompoundingFrequency = "daily" | "weekly" | "monthly" | "annually";
export type RateType = "nominal" | "effective";

export interface CalculateRewardsRequest {
  principal: number;
  apy: number;
  duration: number;
  durationUnit: DurationUnit;
  compoundingFrequency: CompoundingFrequency;
  rateType: RateType;
  tokenPrice?: number;
}

export interface ChartPoint {
  years: number;
  day: number;
  balance: number;
  rewards: number;
  balanceUsd?: number;
}

export interface CalculateRewardsResponse {
  principal: number;
  apy: number;
  rateType: RateType;
  compoundingFrequency: CompoundingFrequency;
  periodsPerYear: number;
  duration: { value: number; unit: DurationUnit };
  normalizedDuration: { years: number; days: number; periods: number };
  nominalRate: number;
  effectiveApy: number;
  finalBalance: number;
  totalRewards: number;
  tokenPrice?: number;
  usd?: { principal: number; finalBalance: number; totalRewards: number };
  chartData: ChartPoint[];
}

export interface ApiFieldError {
  field: string;
  message: string;
}

/** Error with a message that is safe to show to the user. */
export class StakingApiError extends Error {
  details: ApiFieldError[];

  constructor(message: string, details: ApiFieldError[] = []) {
    super(message);
    this.name = "StakingApiError";
    this.details = details;
  }
}

/**
 * Calls POST /api/calculate-rewards. The URL is relative: in development the
 * CRA dev server proxies /api to the Express server (see "proxy" in
 * package.json); in production both are served from the same origin.
 */
export const calculateRewards = async (
  payload: CalculateRewardsRequest,
  signal?: AbortSignal
): Promise<CalculateRewardsResponse> => {
  try {
    const { data } = await axios.post<CalculateRewardsResponse>(
      "/api/calculate-rewards",
      payload,
      { signal, timeout: 10000 }
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;

    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data?.error;
      if (apiError?.message) {
        throw new StakingApiError(apiError.message, apiError.details ?? []);
      }
      if (error.response) {
        throw new StakingApiError(
          `The calculation service returned an error (${error.response.status}). Please try again.`
        );
      }
      if (error.code === "ECONNABORTED") {
        throw new StakingApiError(
          "The calculation service took too long to respond. Please try again."
        );
      }
    }
    throw new StakingApiError(
      "Could not reach the calculation service. Check that the server is running and try again."
    );
  }
};
