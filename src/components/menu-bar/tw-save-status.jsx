import {connect} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {DownloadIcon, HardDriveIcon, SaveIcon} from 'lucide-react';
import InlineMessages from '../../containers/inline-messages.jsx';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import {filterInlineAlerts} from '../../reducers/alerts';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './save-status.css';

const TWSaveStatus = ({
    alertsList,
    fileHandle,
    projectChanged,
    showSaveFilePicker
}) => {
    const inlineAlerts = filterInlineAlerts(alertsList);
    const busy = inlineAlerts.some(alert => alert.iconSpinner);
    const Icon = fileHandle ? SaveIcon : DownloadIcon;
    const label = fileHandle ? `保存到 ${fileHandle.name}` : '下载作品文件';
    return (
        <React.Fragment>
            {inlineAlerts.length > 0 && (
                <div className={styles.localAlert} role="status">
                    <InlineMessages />
                </div>
            )}
            <SB3Downloader showSaveFilePicker={showSaveFilePicker}>
                {(_className, _downloadProjectCallback, {smartSave}) => (
                <button
                    aria-busy={busy}
                    aria-label={label}
                    className={classNames(styles.saveNow, {
                        [styles.desktopHidden]: !projectChanged || inlineAlerts.length > 0
                    })}
                    disabled={busy}
                    title={label}
                    type="button"
                    onClick={smartSave}
                >
                    <Icon
                        aria-hidden="true"
                        className={styles.mobileSaveIcon}
                    />
                    <span className={styles.mobileSaveLabel}>{busy ? '处理中' : fileHandle ? '保存' : '下载'}</span>
                    <span className={styles.saveLabel}>
                        {fileHandle ? (
                            <FormattedMessage
                                defaultMessage="Save as {file}"
                                description="Menu bar item to save project to an existing file on the user's computer"
                                id="tw.menuBar.saveAs"
                                values={{
                                    file: fileHandle.name
                                }}
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Save to your computer"
                                description="Menu bar item for downloading a project to your computer"
                                id="gui.menuBar.downloadToComputer"
                            />
                        )}
                    </span>
                </button>
                )}
            </SB3Downloader>
        </React.Fragment>
    );
};

TWSaveStatus.propTypes = {
    alertsList: PropTypes.arrayOf(PropTypes.object),
    fileHandle: PropTypes.shape({
        name: PropTypes.string
    }),
    projectChanged: PropTypes.bool,
    showSaveFilePicker: PropTypes.func
};

const mapStateToProps = state => ({
    alertsList: state.scratchGui.alerts.alertsList,
    fileHandle: state.scratchGui.tw.fileHandle,
    projectChanged: state.scratchGui.projectChanged
});

const ProjectFileStatus = ({fileHandle, projectChanged}) => {
    if (isPlanetProjectRoute()) return null;
    const label = projectChanged ? '未保存' : fileHandle ? '已保存' : '本地作品';
    const description = projectChanged ? '作品有修改，请下载保存' :
        fileHandle ? `已保存到 ${fileHandle.name}` : '当前为本地作品，可下载为项目文件';
    return (
        <span
            className={classNames(styles.localProjectStatus, {
                [styles.localUnsaved]: projectChanged,
                [styles.localSaved]: fileHandle && !projectChanged
            })}
            role="status"
            title={description}
        >
            <HardDriveIcon aria-hidden="true" className={styles.localProjectIcon} />
            <span className={styles.localProjectLabel}>{label}</span>
        </span>
    );
};

ProjectFileStatus.propTypes = {
    fileHandle: TWSaveStatus.propTypes.fileHandle,
    projectChanged: PropTypes.bool
};

export const LocalProjectStatus = connect(mapStateToProps)(ProjectFileStatus);

export default connect(
    mapStateToProps,
    () => ({})
)(TWSaveStatus);
