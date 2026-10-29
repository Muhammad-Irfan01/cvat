// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import {
    Chart, BarElement, CategoryScale, LinearScale, Legend, Tooltip, ChartDataset,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { LabelCount } from './label-counts-api';

// Chart.js only bundles the parts that are registered, so register what a bar chart needs.
Chart.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const BAR_HEIGHT_PX = 24;
const AXES_HEIGHT_PX = 60;

export type GroupBy = 'label' | 'type';

// One fixed color per annotation type, so a type looks the same on every task.
// The order here is also the order of the stacked segments.
const TYPE_COLORS: Record<string, string> = {
    rectangle: '#0072b2',
    polygon: '#e69f00',
    polyline: '#56b4e9',
    points: '#009e73',
    ellipse: '#f0e442',
    cuboid: '#d55e00',
    mask: '#cc79a7',
    skeleton: '#7f7f7f',
    track: '#332288',
    tag: '#88ccee',
};
const UNKNOWN_TYPE_COLOR = '#bfbfbf';

function makeDatasets(labels: LabelCount[], groupBy: GroupBy): ChartDataset<'bar'>[] {
    if (groupBy === 'label') {
        return [{
            label: 'Annotations',
            data: labels.map((label) => label.count),
            // Each bar uses the label's color from CVAT, the same as on the canvas.
            backgroundColor: labels.map((label) => label.color),
        }];
    }

    // One stacked segment per annotation type that occurs in this task.
    // Types missing from TYPE_COLORS go last.
    const knownTypes = Object.keys(TYPE_COLORS);
    const position = (type: string): number => {
        const index = knownTypes.indexOf(type);
        return index === -1 ? knownTypes.length : index;
    };
    const types = [...new Set(labels.flatMap((label) => Object.keys(label.by_type)))];
    types.sort((a, b) => position(a) - position(b));

    return types.map((type) => ({
        label: type,
        data: labels.map((label) => label.by_type[type] ?? 0),
        backgroundColor: TYPE_COLORS[type] ?? UNKNOWN_TYPE_COLOR,
    }));
}

interface Props {
    labels: LabelCount[];
    groupBy: GroupBy;
}

function LabelCountsChart({ labels, groupBy }: Props): JSX.Element {
    // Horizontal bars: label names stay readable on the side even for COCO's 80 classes.
    // The chart grows with the number of labels instead of squeezing the bars together.
    const height = labels.length * BAR_HEIGHT_PX + AXES_HEIGHT_PX;
    const stacked = groupBy === 'type';

    return (
        <div className='cvat-label-counts-chart' style={{ height }}>
            <Bar
                data={{
                    labels: labels.map((label) => label.name),
                    datasets: makeDatasets(labels, groupBy),
                }}
                options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: stacked, position: 'top' },
                    },
                    scales: {
                        x: { stacked, beginAtZero: true, ticks: { precision: 0 } },
                        y: { stacked, ticks: { autoSkip: false } },
                    },
                }}
            />
        </div>
    );
}

export default React.memo(LabelCountsChart);
