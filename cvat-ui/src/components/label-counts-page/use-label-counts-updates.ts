// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';

import { getCore } from 'cvat-core-wrapper';

const core = getCore();

// One import changes several jobs and sends one event per job; wait for the burst
// to end so the page re-reads the counts once instead of once per job.
const REFRESH_DELAY_MS = 300;

// After a dropped connection, retry after 1 s, 2 s, 4 s, ... but never wait longer
// than 30 s, so a long outage does not leave the page waiting for minutes.
const FIRST_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// Close codes the server sends when it refuses the socket on purpose
// (cvat/apps/test/websocket.py): not logged in, no access, no such task.
// Retrying would get the same answer, so the page stops trying.
const REFUSAL_CLOSE_CODES = [4401, 4403, 4404];

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'refused';

function labelCountsSocketUrl(taskId: number): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const { backendAPI } = core.config;
    return `${protocol}//${window.location.host}${backendAPI}/test/ws/tasks/${taskId}/label-counts`;
}

// Opens the label counts WebSocket of a task and calls onChange whenever the
// server reports that the task's annotations changed. The browser sends the
// session cookie with the connection, so the server checks the same login and
// task access as for the HTTP endpoint.
//
// If the connection drops, it reconnects with a growing delay, and calls
// onChange once it is back, because changes made while it was down were missed.
export function useLabelCountsUpdates(taskId: number, onChange: () => void): ConnectionStatus {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');

    // Keep the latest callback without reopening the socket when it changes.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        let socket: WebSocket;
        let failedAttempts = 0;
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const scheduleRefresh = (): void => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => onChangeRef.current(), REFRESH_DELAY_MS);
        };

        const connect = (): void => {
            reconnectTimer = undefined;
            socket = new WebSocket(labelCountsSocketUrl(taskId));

            socket.onopen = () => {
                if (failedAttempts > 0) {
                    scheduleRefresh();
                }
                failedAttempts = 0;
                setStatus('live');
            };

            socket.onmessage = scheduleRefresh;

            socket.onclose = (event) => {
                if (REFUSAL_CLOSE_CODES.includes(event.code)) {
                    setStatus('refused');
                    return;
                }

                const delay = Math.min(FIRST_RETRY_DELAY_MS * 2 ** failedAttempts, MAX_RETRY_DELAY_MS);
                failedAttempts += 1;
                setStatus('reconnecting');
                reconnectTimer = setTimeout(connect, delay);
            };
        };

        // When the browser reports the network is back, retry at once
        // instead of waiting for the rest of the current delay.
        const reconnectNow = (): void => {
            if (reconnectTimer !== undefined) {
                clearTimeout(reconnectTimer);
                connect();
            }
        };

        setStatus('connecting');
        connect();
        window.addEventListener('online', reconnectNow);

        return () => {
            window.removeEventListener('online', reconnectNow);
            clearTimeout(refreshTimer);
            clearTimeout(reconnectTimer);
            socket.onclose = null;
            socket.close();
        };
    }, [taskId]);

    return status;
}
