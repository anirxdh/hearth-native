import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState, PillButton, StatCard, StatusDot } from '../components';
import { Seg } from '../Seg';
import { HearthChart } from '../HearthChart';
import type { BucketedPoint } from '@hearth/core';

describe('PillButton', () => {
  test('renders label, fires onPress, exposes button role', async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Request refill" onPress={onPress} />);
    const btn = screen.getByRole('button');
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Request refill')).toBeTruthy();
  });

  test('disabled state blocks presses and reports to accessibility', async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Save" onPress={onPress} disabled />);
    const btn = screen.getByRole('button');
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });

  test('loading replaces the label with a spinner and blocks presses', async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Print" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Print')).toBeNull();
  });
});

describe('Seg', () => {
  const options = [
    { key: 'a' as const, label: 'Overview' },
    { key: 'b' as const, label: 'Activity' },
  ];

  test('marks the active tab selected and switches on press', async () => {
    const onChange = jest.fn();
    await render(<Seg options={options} value="a" onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.props.accessibilityState.selected).toBe(true);
    expect(tabs[1]!.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(tabs[1]!);
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('StatCard', () => {
  test('reads as one sentence to VoiceOver', async () => {
    await render(<StatCard label="Blood pressure" value="140/84" unit="mmHg" meta="today" />);
    expect(screen.getByLabelText('Blood pressure: 140/84 mmHg, today')).toBeTruthy();
  });
});

describe('StatusDot', () => {
  test('renders for each semantic status without crashing', async () => {
    for (const status of ['red', 'amber', 'green'] as const) {
      await render(<StatusDot status={status} />);
    }
  });
});

describe('EmptyState', () => {
  test('shows title, detail, and an action slot', async () => {
    await render(
      <EmptyState
        title="No readings yet"
        detail="Record what you check at home."
        action={<Text>action here</Text>}
      />,
    );
    expect(screen.getByText('No readings yet')).toBeTruthy();
    expect(screen.getByText('Record what you check at home.')).toBeTruthy();
    expect(screen.getByText('action here')).toBeTruthy();
  });
});

describe('HearthChart', () => {
  const data: BucketedPoint[] = [
    { label: 'Jul 1', value: 182, start: '2026-07-01' },
    { label: 'Jul 13', value: 183, start: '2026-07-13' },
  ];

  test('empty data renders the quiet empty state, not a broken chart', async () => {
    await render(<HearthChart data={[]} />);
    expect(screen.getByText('No readings in this range yet.')).toBeTruthy();
  });

  test('with data, exposes an accessibility summary with the latest value', async () => {
    await render(<HearthChart data={data} unit="lb" />);
    expect(screen.getByLabelText('Chart, latest 183 lb, 2 readings')).toBeTruthy();
  });

  test('two series (BP) summarize both latest values and show the legend', async () => {
    const systolic: BucketedPoint[] = [
      { label: 'Jul 1', value: 138, start: '2026-07-01' },
      { label: 'Jul 13', value: 142, start: '2026-07-13' },
    ];
    const diastolic: BucketedPoint[] = [
      { label: 'Jul 1', value: 82, start: '2026-07-01' },
      { label: 'Jul 13', value: 88, start: '2026-07-13' },
    ];
    await render(
      <HearthChart
        data={systolic}
        data2={diastolic}
        unit="mmHg"
        seriesLabel="systolic"
        series2Label="diastolic"
      />,
    );
    expect(
      screen.getByLabelText('Chart, latest systolic 142 mmHg, diastolic 88 mmHg, 2 readings'),
    ).toBeTruthy();
    expect(screen.getByText('systolic (solid) / diastolic (dashed)')).toBeTruthy();
  });

  test('an empty second series keeps the single-series summary', async () => {
    await render(<HearthChart data={data} data2={[]} unit="lb" />);
    expect(screen.getByLabelText('Chart, latest 183 lb, 2 readings')).toBeTruthy();
  });
});
