import React from "react";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

interface BarChartProps {
  data: { occupancy_percentage: number; hour: number }[];
  width: number;
  height: number;
  color: string;
}

export const BarChart = ({ data, width, height, color }: BarChartProps) => {
  if (!data || data.length === 0) return null;

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxVal = Math.max(...data.map((d) => d.occupancy_percentage), 100);
  const barWidth = (chartWidth / data.length) * 0.7;
  const barGap = (chartWidth / data.length) * 0.3;

  return (
    <Svg width={width} height={height}>
      {/* Background */}
      <Rect x={0} y={0} width={width} height={height} fill="#1A1A1A" />

      {/* Grid Lines */}
      {[0, 25, 50, 75, 100].map((val) => {
        const y = height - padding - (val / maxVal) * chartHeight;
        return (
          <Line
            key={val}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#333"
            strokeWidth="1"
            strokeDasharray="2, 4"
          />
        );
      })}

      {/* Axes */}
      <Line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#555"
        strokeWidth="2"
      />

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.occupancy_percentage / maxVal) * chartHeight;
        const x = padding + i * (chartWidth / data.length) + barGap / 2;
        const y = height - padding - barHeight;

        // Color intensity based on value
        const intensity = d.occupancy_percentage / 100;
        const barColor = `rgba(255, ${100 - intensity * 100}, ${100 - intensity * 100}, ${0.7 + intensity * 0.3})`;

        return (
          <React.Fragment key={i}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={barColor}
              rx="4"
            />
            <SvgText
              x={x + barWidth / 2}
              y={height - padding + 15}
              fill="#AAA"
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
            >
              {d.hour}:00
            </SvgText>
            {barHeight > 20 && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fill="#FFF"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {Math.round(d.occupancy_percentage)}%
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {/* Axis Labels */}
      <SvgText
        x={padding / 2}
        y={height / 2}
        fill="#AAA"
        fontSize="12"
        textAnchor="middle"
        transform={`rotate(-90, ${padding / 2}, ${height / 2})`}
      >
        Occupancy %
      </SvgText>
      <SvgText
        x={width / 2}
        y={height - 5}
        fill="#AAA"
        fontSize="12"
        textAnchor="middle"
      >
        Hour of Day
      </SvgText>
    </Svg>
  );
};
