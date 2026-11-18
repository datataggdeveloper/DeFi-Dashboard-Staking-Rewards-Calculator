import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPoint } from "../../api/staking";
import {
  formatDuration,
  formatTokens,
  formatUsd,
} from "./stakingFormat";

const ACCENT = "#00dbe3";

interface Props {
  data: ChartPoint[];
  totalYears: number;
  showUsd: boolean;
}

const ChartTooltip = ({
  active,
  payload,
  showUsd,
}: TooltipProps<number, string> & { showUsd: boolean }) => {
  const theme = useTheme();
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as ChartPoint;

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        border: `2px solid ${ACCENT}`,
        borderRadius: "8px",
        padding: "8px 12px",
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
        {formatDuration(point.years)}
      </Typography>
      <Typography sx={{ fontSize: 14 }}>
        Balance: {formatTokens(point.balance)}
      </Typography>
      <Typography sx={{ fontSize: 14 }}>
        Rewards: {formatTokens(point.rewards)}
      </Typography>
      {showUsd && point.balanceUsd !== undefined && (
        <Typography sx={{ fontSize: 14 }}>
          Value: {formatUsd(point.balanceUsd)}
        </Typography>
      )}
    </Box>
  );
};

const StakingGrowthChart = ({ data, totalYears, showUsd }: Props) => {
  const theme = useTheme();
  const useDays = totalYears < 1;
  const xKey = useDays ? "day" : "years";
  const axisColor = theme.palette.text.secondary;

  return (
    <Box
      role="img"
      aria-label={`Projected balance growth chart from ${formatTokens(
        data[0].balance
      )} to ${formatTokens(data[data.length - 1].balance)}`}
      sx={{ width: "100%", height: { xs: 260, sm: 320 } }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 24, left: 0, bottom: 24 }}
        >
          <defs>
            <linearGradient id="stakingGrowthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ACCENT} stopOpacity={0.45} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(v: number) => `${Number(v.toFixed(2))}`}
            tick={{ fill: axisColor, fontSize: 12 }}
            stroke={axisColor}
            label={{
              value: useDays ? "Days" : "Years",
              position: "insideBottomRight",
              offset: -8,
              fill: axisColor,
              fontSize: 12,
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={72}
            tickFormatter={(v: number) => formatTokens(v, 2)}
            tick={{ fill: axisColor, fontSize: 12 }}
            stroke={axisColor}
          />
          <Tooltip
            content={<ChartTooltip showUsd={showUsd} />}
            cursor={{ stroke: ACCENT, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={ACCENT}
            strokeWidth={3}
            fill="url(#stakingGrowthFill)"
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default StakingGrowthChart;
