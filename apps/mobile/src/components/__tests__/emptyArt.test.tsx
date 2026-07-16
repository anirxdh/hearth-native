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

describe('EmptyArt pictograms', () => {
  test.each(ARTS)('%s renders without crashing', async (_name, Art) => {
    await render(<Art />);
    expect(screen.toJSON()).toBeTruthy();
  });

  test.each(ARTS)('%s draws in the default 72 box, hidden from screen readers', async (_name, Art) => {
    await render(<Art />);
    const root = screen.toJSON() as { props: Record<string, unknown> };
    expect(root.props['accessibilityElementsHidden']).toBe(true);
    expect(root.props['width']).toBe(72);
    expect(root.props['height']).toBe(72);
  });

  test.each(ARTS)('%s honors a custom size', async (_name, Art) => {
    await render(<Art size={40} />);
    const root = screen.toJSON() as { props: Record<string, unknown> };
    expect(root.props['width']).toBe(40);
    expect(root.props['height']).toBe(40);
  });
});
