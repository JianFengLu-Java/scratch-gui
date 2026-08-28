import PropTypes from 'prop-types';
import React from 'react';
import {
    ChevronDownIcon,
    CircleAlertIcon,
    HouseIcon,
    LoaderCircleIcon,
    RefreshCwIcon
} from 'lucide-react';
import Box from '../box/box.jsx';

import styles from './crash-message.css';
import planetBrandLockup from '../../../../../../logo/Frame 4.svg';

const CrashMessage = props => (
    <div
        aria-labelledby="editor-status-title"
        aria-live={props.loading ? 'polite' : 'assertive'}
        className={styles.crashWrapper}
        role={props.loading ? 'status' : 'alert'}
    >
        <Box
            className={styles.card}
            data-slot="card"
        >
            <div
                className={styles.cardHeader}
                data-slot="card-header"
            >
                <img
                    alt="编程宇宙"
                    className={styles.brandLogo}
                    src={planetBrandLockup}
                    draggable={false}
                />
            </div>
            <div
                aria-hidden="true"
                className={styles.separator}
                data-slot="separator"
            />
            <div
                className={styles.cardContent}
                data-slot="card-content"
            >
                <div
                    aria-hidden="true"
                    className={styles.emptyMedia}
                    data-state={props.loading ? 'loading' : 'error'}
                    data-slot="empty-icon"
                >
                    {props.loading ? <LoaderCircleIcon /> : <CircleAlertIcon />}
                </div>
                <div className={styles.emptyHeader}>
                    <h1
                        className={styles.title}
                        data-slot="empty-title"
                        id="editor-status-title"
                    >
                        {props.loading ? '正在载入作品' : '作品加载失败'}
                    </h1>
                    <p
                        className={styles.description}
                        data-slot="empty-description"
                    >
                        {props.loading ? '正在准备编辑器，请稍候。' : '暂时无法读取作品，请重新载入或返回创作中心。'}
                    </p>
                </div>
                {!props.loading && (
                    <div
                        className={styles.actions}
                        data-slot="empty-content"
                    >
                        <button
                            className={styles.reloadButton}
                            type="button"
                            onClick={props.onReload}
                        >
                            <RefreshCwIcon
                                aria-hidden="true"
                                data-icon="inline-start"
                            />
                            {'重新载入'}
                        </button>
                        <a
                            className={styles.homeButton}
                            href="/create"
                            target="_top"
                        >
                            <HouseIcon
                                aria-hidden="true"
                                data-icon="inline-start"
                            />
                            {'返回创作中心'}
                        </a>
                    </div>
                )}
            </div>
            {!props.loading && (props.errorMessage || props.eventId) && (
                <div
                    className={styles.cardFooter}
                    data-slot="card-footer"
                >
                    <details className={styles.errorDetails}>
                        <summary>
                            <span>{'错误详情'}</span>
                            <ChevronDownIcon
                                aria-hidden="true"
                                className={styles.detailsChevron}
                            />
                        </summary>
                        {props.errorMessage && (
                            <pre className={styles.errorMessage}>{props.errorMessage}</pre>
                        )}
                        {props.eventId && (
                            <p className={styles.errorId}>{'错误编号：'}{props.eventId}</p>
                        )}
                    </details>
                </div>
            )}
        </Box>
    </div>
);

CrashMessage.propTypes = {
    eventId: PropTypes.string,
    errorMessage: PropTypes.string,
    loading: PropTypes.bool,
    onReload: PropTypes.func.isRequired
};

CrashMessage.defaultProps = {
    loading: false
};

export default CrashMessage;
