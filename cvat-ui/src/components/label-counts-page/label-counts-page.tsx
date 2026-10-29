// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Row, Col } from 'antd/lib/grid';
import Button from 'antd/lib/button';
import Empty from 'antd/lib/empty';
import Radio from 'antd/lib/radio';
import Result from 'antd/lib/result';
import Tag from 'antd/lib/tag';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';

import { ServerError } from 'cvat-core-wrapper';
import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import { TaskLabelCounts, fetchLabelCounts } from './label-counts-api';
import LabelCountsChart, { GroupBy } from './label-counts-chart';
import { ConnectionStatus, useLabelCountsUpdates } from './use-label-counts-updates';

const CONNECTION_TAGS: Record<ConnectionStatus, { color: string, text: string }> = {
    connecting: { color: 'default', text: 'Connecting…' },
    live: { color: 'green', text: 'Live' },
    reconnecting: { color: 'orange', text: 'Connection lost, reconnecting…' },
    refused: { color: 'red', text: 'Live updates are not available for this task' },
};

// Turns a failed request into a message the user can act on.
function describeError(error: unknown, taskId: number): string {
    if (error instanceof ServerError) {
        switch (error.code) {
            case 0:
                return 'The CVAT server could not be reached. Check your connection.';
            case 401:
                return 'Your session has ended. Log in again to see this page.';
            case 403:
                return `You do not have access to the annotations of task #${taskId}.`;
            case 404:
                return `Task #${taskId} does not exist.`;
            default:
                return `The server returned an error (${error.code}): ${error.message}`;
        }
    }

    return error instanceof Error ? error.message : 'Unknown error';
}

function LabelCountsPage(): JSX.Element {
    const taskId = +useParams<{ tid: string }>().tid;
    const [counts, setCounts] = useState<TaskLabelCounts | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<GroupBy>('label');

    // Re-reads the counts and swaps them in, without showing the spinner.
    // Used for live updates, so the chart changes in place.
    const refreshCounts = useCallback(async (): Promise<void> => {
        try {
            setCounts(await fetchLabelCounts(taskId));
            setError(null);
        } catch (requestError: unknown) {
            setError(describeError(requestError, taskId));
        }
    }, [taskId]);

    // First load and "Try again": clear the page and show the spinner.
    const loadCounts = useCallback(async (): Promise<void> => {
        setCounts(null);
        setError(null);
        await refreshCounts();
    }, [refreshCounts]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    const connectionStatus = useLabelCountsUpdates(taskId, refreshCounts);

    let content: JSX.Element;
    if (error !== null) {
        content = (
            <Result
                status='error'
                title='Could not load label counts'
                subTitle={error}
                extra={<Button onClick={loadCounts}>Try again</Button>}
            />
        );
    } else if (counts === null) {
        content = <CVATLoadingSpinner />;
    } else if (counts.total === 0) {
        content = (
            <Empty
                description={counts.labels.length === 0 ?
                    'This task has no labels yet.' :
                    'This task has no annotations yet. Counts appear here once objects are annotated.'}
            />
        );
    } else {
        content = (
            <>
                <div className='cvat-label-counts-toolbar'>
                    <Text type='secondary'>{`Total: ${counts.total}`}</Text>
                    <Radio.Group
                        size='small'
                        buttonStyle='solid'
                        value={groupBy}
                        onChange={(event) => setGroupBy(event.target.value)}
                    >
                        <Radio.Button value='label'>Label</Radio.Button>
                        <Radio.Button value='type'>Shape type</Radio.Button>
                    </Radio.Group>
                </div>
                <LabelCountsChart labels={counts.labels} groupBy={groupBy} />
            </>
        );
    }

    return (
        <div className='cvat-label-counts-page'>
            <Row justify='center'>
                <Col span={22} xl={18} xxl={14} className='cvat-task-top-bar'>
                    <GoBackButton />
                </Col>
            </Row>
            <Row justify='center' className='cvat-label-counts-inner-wrapper'>
                <Col span={22} xl={18} xxl={14} className='cvat-label-counts-inner'>
                    <div className='cvat-label-counts-header'>
                        <Title level={4}>{`Annotations per label, task #${taskId}`}</Title>
                        <Tag color={CONNECTION_TAGS[connectionStatus].color}>
                            {CONNECTION_TAGS[connectionStatus].text}
                        </Tag>
                    </div>
                    {content}
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(LabelCountsPage);
