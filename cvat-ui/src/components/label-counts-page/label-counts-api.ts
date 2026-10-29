// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { getCore } from 'cvat-core-wrapper';

const core = getCore();

export interface LabelCount {
    id: number;
    name: string;
    color: string;
    count: number;
    // Split of `count` by shape type ("rectangle", "polygon", "mask", ...), plus "track" and "tag".
    by_type: Record<string, number>;
}

export interface TaskLabelCounts {
    task_id: number;
    total: number;
    labels: LabelCount[];
}

// core.server.request goes through CVAT's shared Axios client,
// so the request carries the user's login like every other API call.
export async function fetchLabelCounts(taskId: number): Promise<TaskLabelCounts> {
    const { backendAPI } = core.config;
    const response = await core.server.request(
        `${backendAPI}/test/tasks/${taskId}/label-counts`,
        { method: 'GET' },
    ) as { data: TaskLabelCounts };
    return response.data;
}
