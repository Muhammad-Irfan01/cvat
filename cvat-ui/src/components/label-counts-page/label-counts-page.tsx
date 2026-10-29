// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Row, Col } from 'antd/lib/grid';
import Table from 'antd/lib/table';
import Title from 'antd/lib/typography/Title';

import { getCore } from 'cvat-core-wrapper';
import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';

const core = getCore();

interface LabelCount {
    id: number;
    name: string;
    color: string;
    count: number;
}

interface TaskLabelCounts {
    task_id: number;
    total: number;
    labels: LabelCount[];
}

// core.server.request goes through CVAT's shared Axios client,
// so the request carries the user's login like every other API call.
async function fetchLabelCounts(taskId: number): Promise<TaskLabelCounts> {
    const { backendAPI } = core.config;
    const response = await core.server.request(
        `${backendAPI}/test/tasks/${taskId}/label-counts`,
        { method: 'GET' },
    ) as { data: TaskLabelCounts };
    return response.data;
}

function LabelCountsPage(): JSX.Element {
    const taskId = +useParams<{ tid: string }>().tid;
    const [counts, setCounts] = useState<TaskLabelCounts | null>(null);

    useEffect(() => {
        fetchLabelCounts(taskId).then(setCounts);
    }, [taskId]);

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
                    {counts === null ? <CVATLoadingSpinner /> : (
                        <Table
                            rowKey='id'
                            size='small'
                            pagination={false}
                            dataSource={counts.labels}
                            columns={[
                                { title: 'Label', dataIndex: 'name' },
                                { title: 'Annotations', dataIndex: 'count', align: 'right' },
                            ]}
                            footer={() => `Total: ${counts.total}`}
                        />
                    )}
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(LabelCountsPage);
