// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';

import { getCore } from 'cvat-core-wrapper';

const core = getCore();

// One import changes several jobs and sends one event per job; wait for the burst
// to end so the page re-reads the counts once instead of once per job.
const REFRESH_DELAY_MS = 300;

export type ConnectionStatus = 'connecting' | 'live' | 'closed';

function labelCountsSocketUrl(taskId: number): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const { backendAPI } = core.config;
    return `${protocol}//${window.location.host}${backendAPI}/test/ws/tasks/${taskId}/label-counts`;
}

// Opens the label counts WebSocket of a task and calls onChange whenever the
// server reports that the task's annotations changed. The browser sends the
// session cookie with the connection, so the server checks the same login and
// task access as for the HTTP endpoint.
export function useLabelCountsUpdates(taskId: number, onChange: () => void): ConnectionStatus {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');

    // Keep the latest callback without reopening the socket when it changes.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        const socket = new WebSocket(labelCountsSocketUrl(taskId));

        setStatus('connecting');
        socket.onopen = () => setStatus('live');
        socket.onclose = () => setStatus('closed');
        socket.onmessage = () => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => onChangeRef.current(), REFRESH_DELAY_MS);
        };

        return () => {
            clearTimeout(refreshTimer);
            socket.onclose = null;
            socket.close();
        };
    }, [taskId]);

    return status;
}
