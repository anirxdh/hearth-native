import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { BucketedPoint } from '@hearth/core';
import { color, type } from './tokens';

/**
 * The one chart component every series in Hearth renders through: a hairline
 * editorial line chart. Ink line, quiet grid, first/last axis labels only,
 * an optional reference band (e.g. BP target). Pure presentation; all
 * bucketing happens in @hearth/core so what you see is what the data says.
 */
export function HearthChart({
  data,
  height = 160,
  width,
  unit,
  refLow,
  refHigh,
}: {
  data: BucketedPoint[];
  height?: number;
  /** Measured by parent; defaults to full-bleed 320. */
  width?: number;
  unit?: string;
  refLow?: number;
  refHigh?: number;
}) {
  const w = width ?? 320;
  const h = height;
  const padX = 8;
  const padTop = 18;
  const padBottom = 26;

  if (data.length === 0) {
    return (
      <View
        style={{
          height: h,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={type.mini}>No readings in this range yet.</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  let lo = Math.min(...values, refLow ?? Infinity);
  let hi = Math.max(...values, refHigh ?? -Infinity);
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  const span = hi - lo;
  lo -= span * 0.12;
  hi += span * 0.12;

  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const x = (i: number) => padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - ((v - lo) / (hi - lo)) * innerH;

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(' ');

  const gridYs = [padTop, padTop + innerH / 2, padTop + innerH];
  const first = data[0]!;
  const last = data[data.length - 1]!;

  return (
    <View accessible accessibilityLabel={`Chart, latest ${last.value}${unit ? ` ${unit}` : ''}, ${data.length} readings`}>
      <Svg width={w} height={h}>
        {refLow !== undefined && refHigh !== undefined ? (
          <Path
            d={`M ${padX} ${y(refHigh)} H ${w - padX} V ${y(refLow)} H ${padX} Z`}
            fill={color.hover}
          />
        ) : null}
        {gridYs.map((gy, i) => (
          <Line key={i} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke={color.line} strokeWidth={1} />
        ))}
        <Path d={path} stroke={color.ink} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 32
          ? data.map((d, i) => (
              <Circle key={d.start + String(i)} cx={x(i)} cy={y(d.value)} r={2.4} fill={color.paper} stroke={color.ink} strokeWidth={1.4} />
            ))
          : null}
        <Circle cx={x(data.length - 1)} cy={y(last.value)} r={3.4} fill={color.ink} />
        <SvgText x={padX} y={h - 8} fontSize={10.5} fill={color.ink3}>
          {first.label}
        </SvgText>
        <SvgText x={w - padX} y={h - 8} fontSize={10.5} fill={color.ink3} textAnchor="end">
          {last.label}
        </SvgText>
        <SvgText x={x(data.length - 1)} y={y(last.value) - 8} fontSize={11} fontWeight="600" fill={color.ink} textAnchor="end">
          {`${last.value}${unit ? ` ${unit}` : ''}`}
        </SvgText>
      </Svg>
    </View>
  );
}
