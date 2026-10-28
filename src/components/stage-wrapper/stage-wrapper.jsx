import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import {STAGE_DISPLAY_SIZES} from '../../lib/layout-constants.js';
import StageHeader from '../../containers/stage-header.jsx';
import Stage from '../../containers/stage.jsx';
import Loader from '../loader/loader.jsx';

import styles from './stage-wrapper.css';

const StageWrapperComponent = function (props) {
    const {
        availableSize,
        inScenePanel,
        isEmbedded,
        isFullScreen,
        isRtl,
        isRendererSupported,
        loading,
        readOnly,
        stageSize,
        vm
    } = props;
    const mobileStage = stageSize === STAGE_DISPLAY_SIZES.mobile && !isFullScreen;

    return (
        <Box
            className={classNames(
                styles.stageWrapper,
                {
                    [styles.embedded]: isEmbedded,
                    [styles.fullScreen]: isFullScreen,
                    [styles.loading]: loading,
                    [styles.mobile]: mobileStage,
                    [styles.scene]: mobileStage && inScenePanel,
                    [styles.offsetControls]: !(isEmbedded || isFullScreen)
                }
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <Box
                className={styles.stageMenuWrapper}
                data-scene-controls={mobileStage && inScenePanel ? 'true' : null}
            >
                <StageHeader
                    availableSize={availableSize}
                    stageSize={stageSize}
                    vm={vm}
                />
            </Box>
            <Box
                className={styles.stageCanvasWrapper}
                data-stage-canvas-area
            >
                {
                    isRendererSupported ?
                        <Stage
                            availableSize={availableSize}
                            readOnly={readOnly}
                            stageSize={stageSize}
                            vm={vm}
                        /> :
                        null
                }
            </Box>
            {loading ? (
                <Loader isFullScreen={isFullScreen} />
            ) : null}
        </Box>
    );
};

StageWrapperComponent.propTypes = {
    availableSize: PropTypes.shape({width: PropTypes.number, height: PropTypes.number}),
    customStageSize: PropTypes.shape({width: PropTypes.number, height: PropTypes.number}),
    inScenePanel: PropTypes.bool,
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isRendererSupported: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool.isRequired,
    loading: PropTypes.bool,
    readOnly: PropTypes.bool,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

StageWrapperComponent.defaultProps = {
    readOnly: false
};

export default StageWrapperComponent;
