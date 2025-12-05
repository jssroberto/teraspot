import React from "react";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";

interface LineChartProps {
  data: { occupancy_rate: number }[];
  prediction?: { predicted_occupancy: number }[];
  width: number;
  height: number;
  color: string;
}

export const LineChart = ({
  data,
  prediction,
  width,
  height,
  color,
}: LineChartProps) => {
  if (!data || data.length === 0) return null;

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxVal = 100;
  const minVal = 0;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y =
      height -
      padding -
      ((d.occupancy_rate - minVal) / (maxVal - minVal)) * chartHeight;
    return `${x},${y}`;
  });

  const predictionPoints = prediction
    ? prediction.map((d, i) => {
        const totalLen = data.length + prediction.length - 1;
        const index = data.length + i;
        const x = padding + (index / totalLen) * chartWidth;
        const y =
          height -
          padding -
          ((d.predicted_occupancy - minVal) / (maxVal - minVal)) * chartHeight;
        return `${x},${y}`;
      })
    : [];

  return (
    <Svg width={width} height={height}>
      {/* Background */}
      <Rect x={0} y={0} width={width} height={height} fill="#1A1A1A" />

      {/* Grid Lines */}
      {[0, 25, 50, 75, 100].map((val) => {
        const y = height - padding - (val / 100) * chartHeight;
        return (
          <React.Fragment key={val}>
            <Line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#333"
              strokeWidth="1"
              strokeDasharray={val === 50 ? "5, 5" : "2, 4"}
            />
            <SvgText
              x={padding - 8}
              y={y + 4}
              fill="#888"
              fontSize="10"
              textAnchor="end"
            >
              {val}%
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Axes */}
      <Line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#555"
        strokeWidth="2"
      />
      <Line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#555"
        strokeWidth="2"
      />

      {/* Historical Data Line */}
      <Polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="3"
      />

      {/* Historical Data Points */}
      {points.slice(0, Math.min(points.length, 24)).map((p, i) => {
        const [cx, cy] = p.split(",");
        return (
          <React.Fragment key={i}>
            <Circle
              cx={parseFloat(cx)}
              cy={parseFloat(cy)}
              r="4"
              fill={color}
            />
          </React.Fragment>
        );
      })}

      {/* Prediction Line */}
      {predictionPoints.length > 0 && (
        <>
          <Polyline
            points={predictionPoints.map((p) => p).join(" ")}
            fill="none"
            stroke="#FFD700"
            strokeWidth="2"
            strokeDasharray="5, 5"
          />
          {predictionPoints.map((p, i) => {
            const [cx, cy] = p.split(",");
            return (
              <Circle
                key={i}
                cx={parseFloat(cx)}
                cy={parseFloat(cy)}
                r="3"
                fill="#FFD700"
              />
            );
          })}
        </>
      )}

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
        Time
      </SvgText>
    </Svg>
  );
};
