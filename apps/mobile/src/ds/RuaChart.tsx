import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { BucketedPoint } from '@rua/core';
import { color, type } from './tokens';

/**
 * The one chart component every series in RUA renders through: a hairline
 * editorial line chart. Ink line, quiet grid, first/last axis labels only,
 * an optional reference band (e.g. BP target). Pure presentation; all
 * bucketing happens in @rua/core so what you see is what the data says.
 *
 * An optional second series (BP diastolic) draws as a dashed ink3 line on
 * the same scale, with a one-line legend when both series are named. The
 * single-series API is unchanged for every other kind.
 *
 * Width: by default the chart measures its container with onLayout and fills
 * it, so it works at phone, iPad, and the 720 readable column on web alike.
 * Passing `width` still pins it for callers that manage their own layout.
 */
export function RuaChart({
  data,
  data2,
  height = 160,
  width,
  unit,
  refLow,
  refHigh,
  seriesLabel,
  series2Label,
}: {
  data: BucketedPoint[];
  /** Optional second series, rendered dashed in ink3 on the same scale. */
  data2?: BucketedPoint[];
  height?: number;
  /** Optional fixed width; omit to fill the container (measured via onLayout). */
  width?: number;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  /** Names for the legend and accessibility summary when data2 is present. */
  seriesLabel?: string;
  series2Label?: string;
}) {
  const [measured, setMeasured] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const lw = Math.round(e.nativeEvent.layout.width);
    if (lw > 0 && lw !== measured) setMeasured(lw);
  };
  const w = width ?? measured ?? 320;
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

  const second = data2 && data2.length > 0 ? data2 : null;
  const values = [...data.map((d) => d.value), ...(second ? second.map((d) => d.value) : [])];
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

  // The second series positions along its own index range so a stray point
  // without a pair (e.g. a BP reading missing the diastolic) cannot skew it.
  // Null-safe positioning for the optional second series: takes the array
  // explicitly so no closure ever dereferences a null series.
  const xIn = (arr: { length: number }, i: number) =>
    padX + (arr.length === 1 ? innerW / 2 : (i / (arr.length - 1)) * innerW);
  const path2 = second
    ? second
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xIn(second, i).toFixed(1)} ${y(d.value).toFixed(1)}`)
        .join(' ')
    : null;

  const gridYs = [padTop, padTop + innerH / 2, padTop + innerH];
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const last2 = second ? second[second.length - 1]! : null;
  const u = unit ? ` ${unit}` : '';
  const summary = last2
    ? `Chart, latest ${seriesLabel ?? 'first series'} ${last.value}${u}, ${series2Label ?? 'second series'} ${last2.value}${u}, ${data.length} readings`
    : `Chart, latest ${last.value}${u}, ${data.length} readings`;

  // Until the container reports a width, hold the vertical space quietly
  // instead of drawing at a guessed width and reflowing a frame later.
  const ready = width != null || measured != null;

  return (
    <View accessible accessibilityLabel={summary} style={{ width: '100%' }} onLayout={onLayout}>
      {!ready ? (
        <View style={{ height: h }} />
      ) : (
      <Svg width={w} height={h} testID="rua-chart-svg">
        {refLow !== undefined && refHigh !== undefined ? (
          <Path
            d={`M ${padX} ${y(refHigh)} H ${w - padX} V ${y(refLow)} H ${padX} Z`}
            fill={color.hover}
          />
        ) : null}
        {gridYs.map((gy, i) => (
          <Line key={i} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke={color.line} strokeWidth={1} />
        ))}
        {path2 ? (
          <Path
            d={path2}
            stroke={color.ink3}
            strokeWidth={1.6}
            strokeDasharray="5 4"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        <Path d={path} stroke={color.ink} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 32
          ? data.map((d, i) => (
              <Circle key={d.start + String(i)} cx={x(i)} cy={y(d.value)} r={2.4} fill={color.paper} stroke={color.ink} strokeWidth={1.4} />
            ))
          : null}
        {second && last2 ? (
          <Circle cx={xIn(second, second.length - 1)} cy={y(last2.value)} r={2.6} fill={color.ink3} />
        ) : null}
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
      )}
      {second && seriesLabel && series2Label ? (
        <Text style={[type.mini, { marginTop: 4 }]}>
          {seriesLabel} (solid) / {series2Label} (dashed)
        </Text>
      ) : null}
    </View>
  );
}
