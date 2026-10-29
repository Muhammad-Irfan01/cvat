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
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';

import { ServerError } from 'cvat-core-wrapper';
import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import { TaskLabelCounts, fetchLabelCounts } from './label-counts-api';
import LabelCountsChart, { GroupBy } from './label-counts-chart';

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

    const loadCounts = useCallback(async (): Promise<void> => {
        setCounts(null);
        setError(null);
        try {
            setCounts(await fetchLabelCounts(taskId));
        } catch (requestError: unknown) {
            setError(describeError(requestError, taskId));
        }
    }, [taskId]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

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
                    <Title level={4}>{`Annotations per label, task #${taskId}`}</Title>
                    {content}
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(LabelCountsPage);
