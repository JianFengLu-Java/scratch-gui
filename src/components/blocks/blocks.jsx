import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
import {CatIcon, ChevronDownIcon, ChevronUpIcon, Code2Icon, ImageIcon, MonitorIcon} from 'lucide-react';
import Box from '../box/box.jsx';
import styles from './blocks.css';

const panels = {
    blocks: {icon: Code2Icon, label: '积木库'},
    preview: {icon: MonitorIcon, label: '舞台预览'},
    sprites: {icon: CatIcon, label: '角色'},
    stage: {icon: ImageIcon, label: '舞台'}
};

const BlocksComponent = props => {
    const {
        containerRef,
        dragOver,
        mobileLayout,
        mobilePanel,
        paletteExpanded,
        onMobilePreviewHost,
        onMobileTargetsHost,
        onSelectPalette,
        onTogglePalette,
        readOnly,
        ...componentProps
    } = props;
    const selectedPanel = panels[mobilePanel];
    const PanelIcon = selectedPanel.icon;
    return (
        <Box
            className={classNames(styles.blocks, {
                [styles.dragOver]: dragOver,
                [styles.mobile]: mobileLayout,
                [styles.readOnly]: readOnly
            })}
            {...componentProps}
            componentRef={containerRef}
            data-mobile-blocks={mobileLayout ? 'true' : undefined}
            data-palette-expanded={paletteExpanded ? 'true' : 'false'}
            data-palette-panel={mobilePanel}
        >
            {mobileLayout ? (
                <React.Fragment>
                    <div className={styles.paletteHeader}>
                        <label className={styles.paletteSelect}>
                            <PanelIcon aria-hidden="true" />
                            <span>{selectedPanel.label}</span>
                            <ChevronDownIcon aria-hidden="true" />
                            <select
                                aria-label="切换上方区域内容"
                                value={mobilePanel}
                                onChange={event => onSelectPalette(event.target.value)}
                            >
                                {Object.keys(panels).map(id => <option key={id} value={id}>
                                    {panels[id].label}
                                </option>)}
                            </select>
                        </label>
                        {mobilePanel === 'blocks' && <span className={styles.paletteHint}>
                            {'上下滑动 · 按住拖出'}
                        </span>}
                        <button
                            aria-expanded={paletteExpanded}
                            aria-label={paletteExpanded ? '收起上方区域' : '展开上方区域'}
                            className={styles.paletteToggle}
                            title={paletteExpanded ? '收起上方区域' : '展开上方区域'}
                            type="button"
                            onClick={onTogglePalette}
                        >
                            {paletteExpanded ? <ChevronUpIcon aria-hidden="true" /> :
                                <ChevronDownIcon aria-hidden="true" />}
                        </button>
                    </div>
                    <div
                        ref={onMobilePreviewHost}
                        aria-label="舞台预览"
                        className={styles.palettePreview}
                        id="mobile-blocks-preview"
                        role="region"
                    />
                    <div
                        ref={onMobileTargetsHost}
                        aria-label={mobilePanel === 'stage' ? '舞台与背景' : '角色与属性'}
                        className={styles.paletteTargets}
                        role="region"
                    />
                    <div
                        aria-label="调整上方区域与工作画布的高度"
                        aria-orientation="horizontal"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={38}
                        className={styles.paletteSplitter}
                        data-mobile-blocks-splitter="true"
                        role="separator"
                        tabIndex={0}
                        title="上下拖动调整高度，也可使用方向键"
                    >
                        <span aria-hidden="true" />
                    </div>
                </React.Fragment>
            ) : null}
        </Box>
    );
};
BlocksComponent.propTypes = {
    containerRef: PropTypes.func,
    dragOver: PropTypes.bool,
    mobileLayout: PropTypes.bool,
    mobilePanel: PropTypes.oneOf(['blocks', 'preview', 'sprites', 'stage']),
    paletteExpanded: PropTypes.bool,
    onMobilePreviewHost: PropTypes.func,
    onMobileTargetsHost: PropTypes.func,
    onSelectPalette: PropTypes.func,
    onTogglePalette: PropTypes.func,
    readOnly: PropTypes.bool
};
BlocksComponent.defaultProps = {
    mobilePanel: 'blocks',
    readOnly: false
};
export default BlocksComponent;
