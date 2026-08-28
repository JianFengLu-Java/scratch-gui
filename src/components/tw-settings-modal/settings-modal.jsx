import {defineMessages, FormattedMessage, intlShape, injectIntl} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import {
    CircleHelpIcon,
    GaugeIcon,
    SaveIcon,
    SparklesIcon,
    TriangleAlertIcon
} from 'lucide-react';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import Input from '../forms/input.jsx';
import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import DocumentationLink from '../tw-documentation-link/documentation-link.jsx';
import styles from './settings-modal.css';
import {APP_NAME} from '../../lib/brand.js';

/* eslint-disable react/no-multi-comp */

const BufferedInput = BufferedInputHOC(Input);

const messages = defineMessages({
    title: {
        defaultMessage: 'Advanced Settings',
        description: 'Title of settings modal',
        id: 'tw.settingsModal.title'
    },
    help: {
        defaultMessage: 'Click for help',
        description: 'Hover text of help icon in settings',
        id: 'tw.settingsModal.help'
    }
});

const LearnMore = props => (
    <React.Fragment>
        {' '}
        <DocumentationLink {...props}>
            <FormattedMessage
                defaultMessage="Learn more."
                id="gui.alerts.cloudInfoLearnMore"
            />
        </DocumentationLink>
    </React.Fragment>
);

class UnwrappedSetting extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClickHelp'
        ]);
        this.state = {
            helpVisible: false
        };
    }
    componentDidUpdate (prevProps) {
        if (this.props.active && !prevProps.active) {
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({
                helpVisible: true
            });
        }
    }
    handleClickHelp () {
        this.setState(prevState => ({
            helpVisible: !prevState.helpVisible
        }));
    }
    render () {
        const titleId = `advanced-setting-${this.props.slug}-title`;
        const detailId = `advanced-setting-${this.props.slug}-description`;
        return (
            <div
                className={classNames(styles.setting, {
                    [styles.active]: this.props.active
                })}
            >
                <div className={styles.settingMain}>
                    <div className={styles.settingContent}>
                        <div
                            className={styles.settingTitle}
                            id={titleId}
                        >
                            {this.props.primary}
                        </div>
                        {this.state.helpVisible && (
                            <div
                                className={styles.settingDescription}
                                id={detailId}
                            >
                                {this.props.help}
                                {this.props.slug && <LearnMore slug={this.props.slug} />}
                            </div>
                        )}
                    </div>
                    <div className={styles.settingActions}>
                        <button
                            type="button"
                            className={styles.helpIcon}
                            onClick={this.handleClickHelp}
                            title={this.props.intl.formatMessage(messages.help)}
                            aria-label={this.props.intl.formatMessage(messages.help)}
                            aria-expanded={this.state.helpVisible}
                            aria-controls={detailId}
                        >
                            <CircleHelpIcon aria-hidden="true" />
                        </button>
                        {this.props.control}
                    </div>
                </div>
                {this.props.secondary}
            </div>
        );
    }
}
UnwrappedSetting.propTypes = {
    intl: intlShape,
    active: PropTypes.bool,
    control: PropTypes.node,
    help: PropTypes.node,
    primary: PropTypes.node,
    secondary: PropTypes.node,
    slug: PropTypes.string
};
const Setting = injectIntl(UnwrappedSetting);

class Switch extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClick'
        ]);
    }
    handleClick () {
        this.props.onChange({target: {checked: !this.props.checked}});
    }
    render () {
        return (
            <button
                type="button"
                className={styles.switch}
                data-state={this.props.checked ? 'checked' : 'unchecked'}
                role="switch"
                aria-checked={this.props.checked}
                aria-labelledby={this.props.labelledBy}
                onClick={this.handleClick}
            >
                <span className={styles.switchThumb} />
            </button>
        );
    }
}
Switch.propTypes = {
    checked: PropTypes.bool.isRequired,
    labelledBy: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

const BooleanSetting = ({value, onChange, label, ...props}) => (
    <Setting
        {...props}
        active={value}
        primary={label}
        control={(
            <Switch
                checked={value}
                labelledBy={`advanced-setting-${props.slug}-title`}
                onChange={onChange}
            />
        )}
    />
);
BooleanSetting.propTypes = {
    onChange: PropTypes.func.isRequired,
    value: PropTypes.bool.isRequired,
    label: PropTypes.node.isRequired,
    slug: PropTypes.string.isRequired
};

const HighQualityPen = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="High Quality Pen"
                description="High quality pen setting"
                id="tw.settingsModal.highQualityPen"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Allows pen projects to render at higher resolutions and disables some coordinate rounding in the editor. Not all projects benefit from this setting and it may impact performance."
                description="High quality pen setting help"
                id="tw.settingsModal.highQualityPenHelp"
            />
        }
        slug="high-quality-pen"
    />
);

const CustomFPS = props => (
    <BooleanSetting
        value={props.framerate !== 30}
        onChange={props.onChange}
        label={
            <FormattedMessage
                defaultMessage="60 FPS (Custom FPS)"
                description="FPS setting"
                id="tw.settingsModal.fps"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Runs scripts 60 times per second instead of 30. Most projects will not work properly with this enabled. You should try Interpolation with 60 FPS mode disabled if that is the case. {customFramerate}."
                description="FPS setting help"
                id="tw.settingsModal.fpsHelp"
                values={{
                    customFramerate: (
                        <a
                            onClick={props.onCustomizeFramerate}
                            tabIndex="0"
                        >
                            <FormattedMessage
                                defaultMessage="Click to use a framerate other than 30 or 60"
                                description="FPS settings help"
                                id="tw.settingsModal.fpsHelp.customFramerate"
                            />
                        </a>
                    )
                }}
            />
        }
        slug="custom-fps"
    />
);
CustomFPS.propTypes = {
    framerate: PropTypes.number,
    onChange: PropTypes.func,
    onCustomizeFramerate: PropTypes.func
};

const Interpolation = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Interpolation"
                description="Interpolation setting"
                id="tw.settingsModal.interpolation"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Makes projects appear smoother by interpolating sprite motion. Interpolation should not be used on 3D projects, raytracers, pen projects, and laggy projects as interpolation will make them run slower without making them appear smoother."
                description="Interpolation setting help"
                id="tw.settingsModal.interpolationHelp"
            />
        }
        slug="interpolation"
    />
);

const InfiniteClones = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Infinite Clones"
                description="Infinite Clones setting"
                id="tw.settingsModal.infiniteClones"
            />
        }
        help={
            <FormattedMessage
                defaultMessage="Disables Scratch's 300 clone limit."
                description="Infinite Clones setting help"
                id="tw.settingsModal.infiniteClonesHelp"
            />
        }
        slug="infinite-clones"
    />
);

const RemoveFencing = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Remove Fencing"
                description="Remove Fencing setting"
                id="tw.settingsModal.removeFencing"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Allows sprites to move offscreen, become as large or as small as they want, and makes touching blocks work offscreen."
                description="Remove Fencing setting help"
                id="tw.settingsModal.removeFencingHelp"
            />
        }
        slug="remove-fencing"
    />
);

const RemoveMiscLimits = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Remove Miscellaneous Limits"
                description="Remove Miscellaneous Limits setting"
                id="tw.settingsModal.removeMiscLimits"
            />
        }
        help={
            <FormattedMessage
                defaultMessage="Removes sound effect limits and pen size limits."
                description="Remove Miscellaneous Limits setting help"
                id="tw.settingsModal.removeMiscLimitsHelp"
            />
        }
        slug="remove-misc-limits"
    />
);

const WarpTimer = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Warp Timer"
                description="Warp Timer setting"
                id="tw.settingsModal.warpTimer"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Makes scripts check if they are stuck in a long or infinite loop and run at a low framerate instead of getting stuck until the loop finishes. This fixes most crashes but has a significant performance impact, so it's only enabled by default in the editor."
                description="Warp Timer help"
                id="tw.settingsModal.warpTimerHelp"
            />
        }
        slug="warp-timer"
    />
);

const DisableCompiler = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Disable Compiler"
                description="Disable Compiler setting"
                id="tw.settingsModal.disableCompiler"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Disables the {APP_NAME} compiler. You may want to enable this while editing projects so that scripts update immediately. Otherwise, you should never enable this."
                description="Disable Compiler help"
                id="tw.settingsModal.disableCompilerHelp"
                values={{
                    APP_NAME
                }}
            />
        }
        slug="disable-compiler"
    />
);

const CustomStageSize = ({
    customStageSizeEnabled,
    stageWidth,
    onStageWidthChange,
    stageHeight,
    onStageHeightChange
}) => (
    <Setting
        active={customStageSizeEnabled}
        primary={(
            <FormattedMessage
                defaultMessage="Custom Stage Size"
                description="Custom Stage Size option"
                id="tw.settingsModal.customStageSize"
            />
        )}
        control={(
            <div className={styles.customStageSize}>
                <label
                    className={styles.dimensionLabel}
                    htmlFor="advanced-stage-width"
                >
                    {'W'}
                </label>
                <BufferedInput
                    id="advanced-stage-width"
                    value={stageWidth}
                    onSubmit={onStageWidthChange}
                    className={styles.customStageSizeInput}
                    type="number"
                    min="0"
                    max="1024"
                    step="1"
                />
                <span
                    className={styles.stageSizeSeparator}
                    aria-hidden="true"
                >
                    {'×'}
                </span>
                <label
                    className={styles.dimensionLabel}
                    htmlFor="advanced-stage-height"
                >
                    {'H'}
                </label>
                <BufferedInput
                    id="advanced-stage-height"
                    value={stageHeight}
                    onSubmit={onStageHeightChange}
                    className={styles.customStageSizeInput}
                    type="number"
                    min="0"
                    max="1024"
                    step="1"
                />
            </div>
        )}
        secondary={
            (stageWidth >= 1000 || stageHeight >= 1000) && (
                <div
                    className={styles.warning}
                    role="alert"
                >
                    <TriangleAlertIcon aria-hidden="true" />
                    <div>
                        <FormattedMessage
                            // eslint-disable-next-line max-len
                            defaultMessage="Using a custom stage size this large is not recommended! Instead, use a lower size with the same aspect ratio and let fullscreen mode upscale it to match the user's display."
                            description="Warning about using stages that are too large in settings modal"
                            id="tw.settingsModal.largeStageWarning"
                        />
                        <LearnMore slug="custom-stage-size" />
                    </div>
                </div>
            )
        }
        help={(
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Changes the size of the Scratch stage from 480x360 to something else. Try 640x360 to make the stage widescreen. Very few projects will handle this properly."
                description="Custom Stage Size option"
                id="tw.settingsModal.customStageSizeHelp"
            />
        )}
        slug="custom-stage-size"
    />
);
CustomStageSize.propTypes = {
    customStageSizeEnabled: PropTypes.bool,
    stageWidth: PropTypes.number,
    onStageWidthChange: PropTypes.func,
    stageHeight: PropTypes.number,
    onStageHeightChange: PropTypes.func
};

const StoreProjectOptions = ({onStoreProjectOptions}) => (
    <div className={styles.storeProjectOptions}>
        <div className={styles.storeProjectContent}>
            <div className={styles.storeProjectDescription}>
                <FormattedMessage
                    // eslint-disable-next-line max-len
                    defaultMessage="Stores the selected settings in the project so they will be automatically applied when TurboWarp loads this project. Warp timer and disable compiler will not be saved."
                    description="Help text for the store settings in project button"
                    id="tw.settingsModal.storeProjectOptionsHelp"
                />
            </div>
        </div>
        <button
            type="button"
            onClick={onStoreProjectOptions}
            className={styles.button}
        >
            <SaveIcon aria-hidden="true" />
            <FormattedMessage
                defaultMessage="Store settings in project"
                description="Button in settings modal"
                id="tw.settingsModal.storeProjectOptions"
            />
        </button>
    </div>
);
StoreProjectOptions.propTypes = {
    onStoreProjectOptions: PropTypes.func
};

const SettingsSection = ({children, icon: Icon, title, variant}) => (
    <section
        className={styles.settingsSection}
        data-variant={variant}
    >
        <header className={styles.sectionHeader}>
            <div className={styles.sectionMedia}>
                <Icon aria-hidden="true" />
            </div>
            <h3 className={styles.sectionTitle}>
                {title}
            </h3>
        </header>
        <div className={styles.fieldGroup}>
            {children}
        </div>
    </section>
);
SettingsSection.propTypes = {
    children: PropTypes.node,
    icon: PropTypes.oneOfType([PropTypes.func, PropTypes.object]).isRequired,
    title: PropTypes.node.isRequired,
    variant: PropTypes.string
};

const SettingsModalComponent = props => (
    <Modal
        className={styles.modalContent}
        headerClassName={styles.modalHeader}
        overlayClassName={styles.modalOverlay}
        onRequestClose={props.onClose}
        contentLabel={props.intl.formatMessage(messages.title)}
        id="settingsModal"
    >
        <Box className={styles.body}>
            <div className={styles.settingsLayout}>
                <SettingsSection
                    icon={SparklesIcon}
                    title={(
                        <FormattedMessage
                            defaultMessage="Featured"
                            description="Settings modal section"
                            id="tw.settingsModal.featured"
                        />
                    )}
                >
                    <CustomFPS
                        framerate={props.framerate}
                        onChange={props.onFramerateChange}
                        onCustomizeFramerate={props.onCustomizeFramerate}
                    />
                    <Interpolation
                        value={props.interpolation}
                        onChange={props.onInterpolationChange}
                    />
                    <HighQualityPen
                        value={props.highQualityPen}
                        onChange={props.onHighQualityPenChange}
                    />
                    <WarpTimer
                        value={props.warpTimer}
                        onChange={props.onWarpTimerChange}
                    />
                </SettingsSection>
                <SettingsSection
                    icon={GaugeIcon}
                    title={(
                        <FormattedMessage
                            defaultMessage="Remove Limits"
                            description="Settings modal section"
                            id="tw.settingsModal.removeLimits"
                        />
                    )}
                >
                    <InfiniteClones
                        value={props.infiniteClones}
                        onChange={props.onInfiniteClonesChange}
                    />
                    <RemoveFencing
                        value={props.removeFencing}
                        onChange={props.onRemoveFencingChange}
                    />
                    <RemoveMiscLimits
                        value={props.removeLimits}
                        onChange={props.onRemoveLimitsChange}
                    />
                </SettingsSection>
                <SettingsSection
                    icon={TriangleAlertIcon}
                    variant="destructive"
                    title={(
                        <FormattedMessage
                            defaultMessage="Danger Zone"
                            description="Settings modal section"
                            id="tw.settingsModal.dangerZone"
                        />
                    )}
                >
                    {!props.isEmbedded && (
                        <CustomStageSize
                            {...props}
                        />
                    )}
                    <DisableCompiler
                        value={props.disableCompiler}
                        onChange={props.onDisableCompilerChange}
                    />
                    {!props.isEmbedded && (
                        <StoreProjectOptions
                            {...props}
                        />
                    )}
                </SettingsSection>
            </div>
        </Box>
    </Modal>
);

SettingsModalComponent.propTypes = {
    intl: intlShape,
    onClose: PropTypes.func,
    isEmbedded: PropTypes.bool,
    framerate: PropTypes.number,
    onFramerateChange: PropTypes.func,
    onCustomizeFramerate: PropTypes.func,
    highQualityPen: PropTypes.bool,
    onHighQualityPenChange: PropTypes.func,
    interpolation: PropTypes.bool,
    onInterpolationChange: PropTypes.func,
    infiniteClones: PropTypes.bool,
    onInfiniteClonesChange: PropTypes.func,
    removeFencing: PropTypes.bool,
    onRemoveFencingChange: PropTypes.func,
    removeLimits: PropTypes.bool,
    onRemoveLimitsChange: PropTypes.func,
    warpTimer: PropTypes.bool,
    onWarpTimerChange: PropTypes.func,
    disableCompiler: PropTypes.bool,
    onDisableCompilerChange: PropTypes.func
};

export default injectIntl(SettingsModalComponent);
