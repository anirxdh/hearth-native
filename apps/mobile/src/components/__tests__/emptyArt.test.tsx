import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  BottleArt,
  CalendarArt,
  ChartArt,
  FlowArt,
  FolderArt,
  NotebookArt,
} from '../EmptyArt';

const ARTS = [
  ['FolderArt', FolderArt],
  ['CalendarArt', CalendarArt],
  ['NotebookArt', NotebookArt],
  ['ChartArt', ChartArt],
  ['FlowArt', FlowArt],
  ['BottleArt', BottleArt],
] as const;

type Rendered = { props: Record<string, unknown>; children: Rendered[] };

/** The Frame is a float wrapper (Animated.View) around the Svg itself. */
function svgOf(root: Rendered): Rendered {
  return root.children[0]!;
}

describe('EmptyArt pictograms', () => {
  test.each(ARTS)('%s renders without crashing', async (_name, Art) => {
    await render(<Art />);
    expect(screen.toJSON()).toBeTruthy();
  });

  test.each(ARTS)('%s draws in the default 72 box, hidden from screen readers', async (_name, Art) => {
    await render(<Art />);
    const svg = svgOf(screen.toJSON() as unknown as Rendered);
    expect(svg.props['accessibilityElementsHidden']).toBe(true);
    expect(svg.props['width']).toBe(72);
    expect(svg.props['height']).toBe(72);
  });

  test.each(ARTS)('%s honors a custom size', async (_name, Art) => {
    await render(<Art size={40} />);
    const svg = svgOf(screen.toJSON() as unknown as Rendered);
    expect(svg.props['width']).toBe(40);
    expect(svg.props['height']).toBe(40);
  });
});
