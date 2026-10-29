// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import {
    Chart, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { LabelCount } from './label-counts-api';

// Chart.js only bundles the parts that are registered, so register what a bar chart needs.
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

const BAR_HEIGHT_PX = 24;
const AXES_HEIGHT_PX = 60;

interface Props {
    labels: LabelCount[];
}

function LabelCountsChart({ labels }: Props): JSX.Element {
    // Horizontal bars: label names stay readable on the side even for COCO's 80 classes.
    // The chart grows with the number of labels instead of squeezing the bars together.
    const height = labels.length * BAR_HEIGHT_PX + AXES_HEIGHT_PX;

    return (
        <div className='cvat-label-counts-chart' style={{ height }}>
            <Bar
                data={{
                    labels: labels.map((label) => label.name),
                    datasets: [{
                        label: 'Annotations',
                        data: labels.map((label) => label.count),
                        // Each bar uses the label's color from CVAT, the same as on the canvas.
                        backgroundColor: labels.map((label) => label.color),
                    }],
                }}
                options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: { beginAtZero: true, ticks: { precision: 0 } },
                        y: { ticks: { autoSkip: false } },
                    },
                }}
            />
        </div>
    );
}

export default React.memo(LabelCountsChart);
