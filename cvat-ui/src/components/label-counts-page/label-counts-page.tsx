// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Row, Col } from 'antd/lib/grid';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';

import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import { TaskLabelCounts, fetchLabelCounts } from './label-counts-api';
import LabelCountsChart from './label-counts-chart';

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
                        <>
                            <Text type='secondary'>{`Total: ${counts.total}`}</Text>
                            <LabelCountsChart labels={counts.labels} />
                        </>
                    )}
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(LabelCountsPage);
