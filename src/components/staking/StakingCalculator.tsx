import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import axios from "axios";
import CustomTextField from "../text/TextField";
import {
  CalculateRewardsResponse,
  calculateRewards,
  CompoundingFrequency,
  DurationUnit,
  RateType,
  StakingApiError,
} from "../../api/staking";
import {
  StakingFormErrors,
  StakingFormValues,
  toRequest,
  validateStakingForm,
} from "../../utils/stakingValidation";
import StakingGrowthChart from "./StakingGrowthChart";
import { formatTokens, formatUsd } from "./stakingFormat";

const ACCENT = "#00dbe3";

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: CalculateRewardsResponse }
  | { status: "error"; message: string; details: string[] };

const INITIAL_VALUES: StakingFormValues = {
  principal: "1000",
  apy: "5",
  duration: "1",
  durationUnit: "years",
  compoundingFrequency: "daily",
  rateType: "nominal",
  tokenPrice: "",
};

const FREQUENCIES: { value: CompoundingFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" },
];

const RATE_TYPES: { value: RateType; label: string }[] = [
  { value: "nominal", label: "Nominal annual rate (APR)" },
  { value: "effective", label: "Effective APY" },
];

const StatCard = ({
  label,
  value,
  secondary,
  highlight,
}: {
  label: string;
  value: string;
  secondary?: string;
  highlight?: boolean;
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        padding: "16px 20px",
        borderRadius: "8px",
        border: `2px solid ${ACCENT}`,
        backgroundColor: highlight ? "#173039" : theme.palette.background.paper,
        color: highlight ? "#fff" : theme.palette.text.primary,
      }}
    >
      <Typography sx={{ fontSize: 14, opacity: 0.8 }}>{label}</Typography>
      <Typography
        sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 700, wordBreak: "break-word" }}
      >
        {value}
      </Typography>
      {secondary && (
        <Typography sx={{ fontSize: 14, opacity: 0.8 }}>{secondary}</Typography>
      )}
    </Box>
  );
};

const StakingCalculator = () => {
  const theme = useTheme();
  const [values, setValues] = useState<StakingFormValues>(INITIAL_VALUES);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<CalcState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the widget unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const errors: StakingFormErrors = validateStakingForm(values);
  const showError = (field: keyof StakingFormErrors) =>
    touched[field] ? errors[field] : undefined;

  const setField =
    <K extends keyof StakingFormValues>(field: K) =>
    (value: StakingFormValues[K]) =>
      setValues((prev) => ({ ...prev, [field]: value }));

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setTouched({ principal: true, apy: true, duration: true, tokenPrice: true });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading" });

    try {
      const data = await calculateRewards(toRequest(values), controller.signal);
      setState({ status: "success", data });
    } catch (error) {
      if (axios.isCancel(error)) return;
      const apiError =
        error instanceof StakingApiError
          ? error
          : new StakingApiError("Something went wrong. Please try again.");
      setState({
        status: "error",
        message: apiError.message,
        details: apiError.details.map((d) => d.message),
      });
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setValues(INITIAL_VALUES);
    setTouched({});
    setState({ status: "idle" });
  };

  const isLoading = state.status === "loading";

  return (
    <Box
      component="section"
      aria-labelledby="staking-calculator-title"
      sx={{
        backgroundColor: "#fff",
        padding: { xs: "0 16px 48px", md: "0 24px 80px" },
        textAlign: "left",
      }}
    >
      <Typography
        id="staking-calculator-title"
        component="h2"
        sx={{
          fontSize: { xs: 30, md: 45 },
          lineHeight: { xs: "40px", md: "60px" },
          color: "#173039",
          fontWeight: 700,
          marginBottom: "20px",
        }}
      >
        Staking Rewards Calculator
      </Typography>

      <Grid container spacing={3}>
        {/* ---------- Form ---------- */}
        <Grid item xs={12} md={5}>
          <Box
            component="form"
            noValidate
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: { xs: "20px 16px", sm: "24px" },
              borderRadius: "8px",
              border: `2px solid ${ACCENT}`,
              backgroundColor: theme.palette.background.paper,
              "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                { borderColor: ACCENT },
              "& .MuiInputLabel-root.Mui-focused": { color: "#23a2bb" },
            }}
          >
            <CustomTextField
              label="Principal (tokens)"
              value={values.principal}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("principal")(e.target.value)
              }
              onBlur={() => markTouched("principal")}
              error={!!showError("principal")}
              helperText={showError("principal") ?? "Amount you plan to stake"}
              inputProps={{ inputMode: "decimal" }}
              fullWidth
            />
            <CustomTextField
              label="APY (%)"
              value={values.apy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("apy")(e.target.value)
              }
              onBlur={() => markTouched("apy")}
              error={!!showError("apy")}
              helperText={showError("apy") ?? "Yearly yield, e.g. 5 for 5%"}
              inputProps={{ inputMode: "decimal" }}
              fullWidth
            />
            <CustomTextField
              select
              label="Rate type"
              value={values.rateType}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("rateType")(e.target.value as RateType)
              }
              helperText={
                values.rateType === "nominal"
                  ? "Rate is split across the compounding periods: A = P(1 + r/n)^(nt)"
                  : "Rate already includes compounding; frequency only shapes the curve"
              }
              fullWidth
            >
              {RATE_TYPES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CustomTextField>

            <Box sx={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <CustomTextField
                label="Duration"
                value={values.duration}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setField("duration")(e.target.value)
                }
                onBlur={() => markTouched("duration")}
                error={!!showError("duration")}
                helperText={showError("duration") ?? "Fractions allowed, e.g. 1.5"}
                inputProps={{ inputMode: "decimal" }}
                sx={{ flex: 1 }}
              />
              <ToggleButtonGroup
                exclusive
                size="large"
                value={values.durationUnit}
                aria-label="Duration unit"
                onChange={(_, unit: DurationUnit | null) =>
                  unit && setField("durationUnit")(unit)
                }
                sx={{
                  height: 56,
                  "& .MuiToggleButton-root": {
                    textTransform: "none",
                    fontWeight: 700,
                    borderWidth: 2,
                    borderColor: ACCENT,
                  },
                  "& .Mui-selected, & .Mui-selected:hover": {
                    backgroundColor: ACCENT,
                    color: "#173039",
                  },
                }}
              >
                <ToggleButton value="days">Days</ToggleButton>
                <ToggleButton value="years">Years</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <CustomTextField
              select
              label="Compounding frequency"
              value={values.compoundingFrequency}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("compoundingFrequency")(
                  e.target.value as CompoundingFrequency
                )
              }
              fullWidth
            >
              {FREQUENCIES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CustomTextField>

            <CustomTextField
              label="Token price in USD (optional)"
              value={values.tokenPrice}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setField("tokenPrice")(e.target.value)
              }
              onBlur={() => markTouched("tokenPrice")}
              error={!!showError("tokenPrice")}
              helperText={showError("tokenPrice") ?? "Adds USD projections"}
              inputProps={{ inputMode: "decimal" }}
              fullWidth
            />

            <Box sx={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Button
                type="submit"
                variant="contained"
                disabled={isLoading}
                startIcon={
                  isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <CalculateOutlinedIcon />
                  )
                }
                sx={{
                  flex: 1,
                  minWidth: 160,
                  backgroundColor: ACCENT,
                  borderRadius: "6px",
                  height: "56px",
                  fontSize: "18px",
                  textTransform: "uppercase",
                  color: "#173039",
                  fontWeight: 700,
                  "&:hover": { backgroundColor: "#23a2bb" },
                }}
              >
                {isLoading ? "Calculating" : "Calculate"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleReset}
                sx={{
                  height: "56px",
                  borderRadius: "6px",
                  borderWidth: 2,
                  borderColor: "#173039",
                  color: theme.palette.text.primary,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  "&:hover": { borderWidth: 2, borderColor: "#173039" },
                }}
              >
                Reset
              </Button>
            </Box>
          </Box>
        </Grid>

        {/* ---------- Results ---------- */}
        <Grid item xs={12} md={7}>
          <Box
            aria-live="polite"
            sx={{
              minHeight: 320,
              height: "100%",
              padding: { xs: "20px 16px", sm: "24px" },
              borderRadius: "8px",
              border: `2px solid ${ACCENT}`,
              backgroundColor: theme.palette.background.paper,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              justifyContent: state.status === "success" ? "flex-start" : "center",
            }}
          >
            {state.status === "idle" && (
              <Box sx={{ textAlign: "center", color: theme.palette.text.secondary }}>
                <CalculateOutlinedIcon sx={{ fontSize: 48, color: ACCENT }} />
                <Typography sx={{ fontSize: 18 }}>
                  Enter your staking details and press Calculate to see your
                  projected balance and growth.
                </Typography>
              </Box>
            )}

            {state.status === "loading" && (
              <Box sx={{ textAlign: "center" }}>
                <CircularProgress sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: 18, marginTop: "12px" }}>
                  Calculating your rewards…
                </Typography>
              </Box>
            )}

            {state.status === "error" && (
              <Alert severity="error" sx={{ alignItems: "center" }}>
                <Typography sx={{ fontWeight: 700 }}>{state.message}</Typography>
                {state.details.slice(1).map((d) => (
                  <Typography key={d} sx={{ fontSize: 14 }}>
                    {d}
                  </Typography>
                ))}
              </Alert>
            )}

            {state.status === "success" && (
              <SuccessView data={state.data} />
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

const SuccessView = ({ data }: { data: CalculateRewardsResponse }) => {
  const hasUsd = data.usd !== undefined;
  const rateNote =
    data.rateType === "nominal"
      ? `Nominal ${data.apy}% compounded ${data.compoundingFrequency} = ${formatTokens(
          data.effectiveApy,
          4
        )}% effective APY`
      : `Effective APY ${data.apy}%`;

  return (
    <>
      <Box sx={{ display: "flex", gap: "16px", flexDirection: { xs: "column", sm: "row" } }}>
        <StatCard
          highlight
          label="Projected final balance"
          value={formatTokens(data.finalBalance)}
          secondary={hasUsd ? formatUsd(data.usd!.finalBalance) : undefined}
        />
        <StatCard
          label="Total rewards earned"
          value={formatTokens(data.totalRewards)}
          secondary={hasUsd ? formatUsd(data.usd!.totalRewards) : undefined}
        />
      </Box>

      <Typography sx={{ fontSize: 14, opacity: 0.85 }}>
        {rateNote} · {formatTokens(data.normalizedDuration.days, 2)} days (
        {formatTokens(data.normalizedDuration.years, 3)}{" "}
        {data.normalizedDuration.years === 1 ? "year" : "years"}) ·{" "}
        {formatTokens(data.normalizedDuration.periods, 2)} compounding periods
      </Typography>

      <StakingGrowthChart
        data={data.chartData}
        totalYears={data.normalizedDuration.years}
        showUsd={hasUsd}
      />
    </>
  );
};

export default StakingCalculator;
