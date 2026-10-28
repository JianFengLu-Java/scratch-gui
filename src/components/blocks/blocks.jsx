import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
import {CatIcon, ChevronDownIcon, ChevronUpIcon, Code2Icon, ImageIcon, MonitorIcon} from 'lucide-react';
import Box from '../box/box.jsx';
import styles from './blocks.css';

const panels = {
    blocks: {icon: Code2Icon, label: '积木库', panelId: 'mobile-blocks-library'},
    preview: {icon: MonitorIcon, label: '舞台预览', panelId: 'mobile-blocks-preview'},
    sprites: {icon: CatIcon, label: '角色', panelId: 'mobile-blocks-targets'},
    stage: {icon: ImageIcon, label: '舞台', panelId: 'mobile-blocks-targets'}
};
const panelIds = Object.keys(panels);

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
    const handleTabKeyDown = event => {
        const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
        const index = tabs.indexOf(event.target);
        if (index < 0) return;
        let nextIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const rtl = window.getComputedStyle(event.currentTarget).direction === 'rtl';
            const step = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
            nextIndex = (index + step + tabs.length) % tabs.length;
        } else return;
        event.preventDefault();
        event.stopPropagation();
        tabs[nextIndex].focus({preventScroll: true});
        onSelectPalette(panelIds[nextIndex]);
    };
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
                        {/* react-tabs uses this boundary to ignore tabs owned by a nested container. */}
                        <div
                            aria-label="上方区域内容"
                            aria-orientation="horizontal"
                            className={styles.paletteTabs}
                            data-tabs="true"
                            role="tablist"
                            onKeyDown={handleTabKeyDown}
                        >
                            {panelIds.map(id => {
                                const panel = panels[id];
                                const Icon = panel.icon;
                                return (
                                    <button
                                        key={id}
                                        aria-controls={panel.panelId}
                                        aria-selected={mobilePanel === id}
                                        className={styles.paletteTab}
                                        id={`mobile-blocks-tab-${id}`}
                                        role="tab"
                                        tabIndex={mobilePanel === id ? 0 : -1}
                                        title={id === 'blocks' ? '积木库：上下滑动，按住拖出积木' : panel.label}
                                        type="button"
                                        onClick={() => onSelectPalette(id)}
                                    >
                                        <Icon aria-hidden="true" />
                                        <span>{panel.label}</span>
                                    </button>
                                );
                            })}
                        </div>
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
                        aria-labelledby="mobile-blocks-tab-preview"
                        className={styles.palettePreview}
                        id="mobile-blocks-preview"
                        role="tabpanel"
                    />
                    <div
                        ref={onMobileTargetsHost}
                        aria-labelledby={`mobile-blocks-tab-${mobilePanel === 'stage' ? 'stage' : 'sprites'}`}
                        className={styles.paletteTargets}
                        id="mobile-blocks-targets"
                        role="tabpanel"
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
