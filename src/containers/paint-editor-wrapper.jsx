import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import VM from 'scratch-vm';
import classNames from 'classnames';
import {ChevronDownIcon, ChevronUpIcon, SlidersHorizontalIcon} from 'lucide-react';
import PaintEditor, {getPaintZoom, initializeMobilePaintView} from '../lib/tw-scratch-paint';
import {inlineSvgFonts, sanitizeSvg} from '@turbowarp/scratch-svg-renderer';
import ErrorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {openFontsModal} from '../reducers/modals';
import attachMobilePaintPan from '../lib/mobile-paint-pan';
import EditorFullscreenButton from '../components/editor-dock/editor-fullscreen-button.jsx';

import {connect} from 'react-redux';
import {Theme} from '../lib/themes/index.js';
import styles from '../components/paint-editor-wrapper/paint-editor-wrapper.css';

class PaintEditorWrapper extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleUpdateImage',
            'handleUpdateName',
            'handleUpdateFonts',
            'handleToggleSettings',
            'setEditorRef',
            'fontInlineFn'
        ]);
        this.state = {
            fonts: this.props.vm.runtime.fontManager.getFonts(),
            settingsExpanded: !window.matchMedia('(max-width: 1023px)').matches
        };
    }
    componentDidMount () {
        this.props.vm.runtime.fontManager.on('change', this.handleUpdateFonts);
        this.updatePanCanvas();
        // Paper resizes on window events. Also notify it when the mobile
        // toolbars or asset strip change the space available to its canvas.
        if (typeof ResizeObserver !== 'undefined' && this.editor) {
            this.resizeObserver = new ResizeObserver(() => {
                cancelAnimationFrame(this.resizeFrame);
                this.resizeFrame = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
            });
            this.resizeObserver.observe(this.editor);
            const canvas = this.editor.querySelector('[class*="paint-editor_canvas-container_"]');
            if (canvas) this.resizeObserver.observe(canvas);
        }
    }
    shouldComponentUpdate (nextProps, nextState) {
        return this.props.imageId !== nextProps.imageId ||
            this.props.rtl !== nextProps.rtl ||
            this.props.name !== nextProps.name ||
            this.props.theme !== nextProps.theme ||
            this.props.customStageSize !== nextProps.customStageSize ||
            this.state.fonts !== nextState.fonts ||
            this.state.settingsExpanded !== nextState.settingsExpanded;
    }
    componentDidUpdate () {
        this.updatePanCanvas();
    }
    componentWillUnmount () {
        this.props.vm.runtime.fontManager.off('change', this.handleUpdateFonts);
        if (this.panController) this.panController.dispose();
        if (this.disposePaintView) this.disposePaintView();
        if (this.resizeObserver) this.resizeObserver.disconnect();
        cancelAnimationFrame(this.resizeFrame);
    }
    setEditorRef (element) {
        this.editor = element;
    }
    updatePanCanvas () {
        const canvas = this.editor && this.editor.querySelector('[class*="paint-editor_canvas-container_"] canvas');
        if (canvas !== this.panCanvas) {
            if (this.panController) this.panController.dispose();
            if (this.disposePaintView) this.disposePaintView();
            this.panCanvas = canvas;
            this.disposePaintView = canvas ? initializeMobilePaintView(canvas, this.props.customStageSize) : null;
            this.panController = canvas ? attachMobilePaintPan(canvas, getPaintZoom) : null;
        }
    }
    handleToggleSettings () {
        this.setState(state => ({settingsExpanded: !state.settingsExpanded}));
    }
    handleUpdateFonts () {
        this.setState({
            fonts: this.props.vm.runtime.fontManager.getFonts()
        });
    }
    handleUpdateName (name) {
        this.props.vm.renameCostume(this.props.selectedCostumeIndex, name);
    }
    handleUpdateImage (isVector, image, rotationCenterX, rotationCenterY) {
        if (isVector) {
            this.props.vm.updateSvg(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY);
        } else {
            this.props.vm.updateBitmap(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY,
                2 /* bitmapResolution */);
        }
    }
    fontInlineFn (svgString) {
        return inlineSvgFonts(svgString, this.props.vm.renderer.customFonts);
    }
    render () {
        if (!this.props.imageId) return null;
        const {
            selectedCostumeIndex,
            vm,
            ...componentProps
        } = this.props;
        const costume = vm.getCostume(selectedCostumeIndex);
        return (
            <div
                className={classNames(styles.editor, {[styles.settingsCollapsed]: !this.state.settingsExpanded})}
                ref={this.setEditorRef}
            >
                <div className={styles.mobileToolbar}>
                    <button
                        aria-expanded={this.state.settingsExpanded}
                        className={styles.settingsToggle}
                        type="button"
                        onClick={this.handleToggleSettings}
                    >
                        <SlidersHorizontalIcon aria-hidden="true" />
                        <span>{'编辑设置'}</span>
                        {this.state.settingsExpanded ?
                            <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
                    </button>
                    <span className={styles.gestureHint}>{'双指平移 · 捏合缩放'}</span>
                    <EditorFullscreenButton className={styles.fullscreenToggle} />
                </div>
                <PaintEditor
                    {...componentProps}
                    image={this.props.imageFormat === 'svg' ? sanitizeSvg.sanitizeSvgText(costume) : costume}
                    onUpdateImage={this.handleUpdateImage}
                    onUpdateName={this.handleUpdateName}
                    fontInlineFn={this.fontInlineFn}
                    theme={this.props.theme.isDark() ? 'dark' : 'light'}
                    customFonts={this.state.fonts}
                    width={this.props.customStageSize.width}
                    height={this.props.customStageSize.height}
                />
            </div>
        );
    }
}

PaintEditorWrapper.propTypes = {
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    onManageFonts: PropTypes.func.isRequired,
    imageFormat: PropTypes.string.isRequired,
    imageId: PropTypes.string.isRequired,
    theme: PropTypes.instanceOf(Theme),
    name: PropTypes.string,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    selectedCostumeIndex: PropTypes.number.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = (state, {selectedCostumeIndex}) => {
    const targetId = state.scratchGui.vm.editingTarget.id;
    const sprite = state.scratchGui.vm.editingTarget.sprite;
    // Make sure the costume index doesn't go out of range.
    const index = selectedCostumeIndex < sprite.costumes.length ?
        selectedCostumeIndex : sprite.costumes.length - 1;
    const costume = state.scratchGui.vm.editingTarget.sprite.costumes[index];
    return {
        customStageSize: state.scratchGui.customStageSize,
        name: costume && costume.name,
        rotationCenterX: costume && costume.rotationCenterX,
        rotationCenterY: costume && costume.rotationCenterY,
        imageFormat: costume && costume.dataFormat,
        imageId: targetId && `${targetId}${costume.skinId}`,
        rtl: state.locales.isRtl,
        selectedCostumeIndex: index,
        theme: state.scratchGui.theme.theme,
        vm: state.scratchGui.vm,
        zoomLevelId: targetId
    };
};

const mapDispatchToProps = dispatch => ({
    onManageFonts: () => dispatch(openFontsModal())
});

export default ErrorBoundaryHOC('paint')(connect(
    mapStateToProps,
    mapDispatchToProps
)(PaintEditorWrapper));
