import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {BriefcaseIcon, PlusIcon} from 'lucide-react';
import {FormattedMessage, defineMessages, injectIntl, intlShape} from 'react-intl';
import DockPanel from '../editor-dock/dock-panel.jsx';
import DragConstants from '../../lib/drag-constants';
import SpriteSelectorItem from '../../containers/sprite-selector-item.jsx';
import styles from './backpack.css';

const dragTypeMap = { // Keys correspond with the backpack-server item types
    costume: DragConstants.BACKPACK_COSTUME,
    sound: DragConstants.BACKPACK_SOUND,
    script: DragConstants.BACKPACK_CODE,
    sprite: DragConstants.BACKPACK_SPRITE
};

const labelMap = defineMessages({
    costume: {
        id: 'gui.backpack.costumeLabel',
        defaultMessage: 'costume',
        description: 'Label for costume backpack item'
    },
    sound: {
        id: 'gui.backpack.soundLabel',
        defaultMessage: 'sound',
        description: 'Label for sound backpack item'
    },
    script: {
        id: 'gui.backpack.scriptLabel',
        defaultMessage: 'script',
        description: 'Label for script backpack item'
    },
    sprite: {
        id: 'gui.backpack.spriteLabel',
        defaultMessage: 'sprite',
        description: 'Label for sprite backpack item'
    }
});

const Backpack = ({
    blockDragOver,
    containerRef,
    contents,
    dragOver,
    error,
    expanded,
    intl,
    importing,
    importMessage,
    importFailed,
    loading,
    selectedItemId,
    targets,
    targetId,
    showMore,
    onClose,
    onDelete,
    onRename,
    onMouseEnter,
    onMouseLeave,
    onMore,
    onSelectItem,
    onSelectTarget,
    onImport
}) => {
    const selectedItem = contents.find(item => item.id === selectedItemId);
    const target = targets.find(item => item.id === targetId);
    const newSprite = selectedItem && selectedItem.type === 'sprite';
    return expanded ? (
        <DockPanel
            className={styles.backpackPanel}
            description="选择素材后添加，电脑也可拖拽复用"
            dragLabel="拖动书包窗口"
            icon={BriefcaseIcon}
            onClose={onClose}
            panelId="backpack"
            title="书包"
        >
            <div className={styles.destination}>
                <label>
                    <span>{'添加到'}</span>
                    <select
                        aria-label="书包素材添加目标"
                        disabled={importing || newSprite}
                        value={targetId || ''}
                        onChange={onSelectTarget}
                    >
                        {!target && <option value="">{'选择角色或舞台'}</option>}
                        {targets.map(item => (<option
                            key={item.id}
                            value={item.id}
                        >{item.name}</option>))}
                    </select>
                </label>
                <span>{newSprite ? '角色素材将作为新角色添加' : '造型、声音和积木加入所选目标'}</span>
            </div>
            <div
                className={classNames(styles.backpackList, {
                    [styles.dragOver]: dragOver || blockDragOver
                })}
                ref={containerRef}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {/* eslint-disable-next-line no-negated-condition */}
                {error !== false ? (
                    <div className={styles.statusMessage}>
                        <FormattedMessage
                            defaultMessage="Error loading backpack"
                            description="Error backpack message"
                            id="gui.backpack.errorBackpack"
                        />
                        <div className={styles.errorMessage}>{error}</div>
                    </div>
                ) : (
                    loading ? (
                        <div className={styles.statusMessage}>
                            <FormattedMessage
                                defaultMessage="Loading..."
                                description="Loading backpack message"
                                id="gui.backpack.loadingBackpack"
                            />
                        </div>
                    ) : (
                        contents.length > 0 ? (
                            <div className={styles.backpackListInner}>
                                {contents.map(item => (
                                    <SpriteSelectorItem
                                        className={styles.backpackItem}
                                        activationLabel={`选择书包素材「${item.name}」`}
                                        costumeURL={item.thumbnailUrl}
                                        details={item.name}
                                        dragPayload={item}
                                        dragType={dragTypeMap[item.type]}
                                        id={item.id}
                                        key={item.id}
                                        name={intl.formatMessage(labelMap[item.type])}
                                        selected={selectedItemId === item.id}
                                        onClick={onSelectItem}
                                        onDeleteButtonClick={onDelete}
                                        // Currently, renaming sprites is not supported.
                                        onRenameButtonClick={item.type === 'sprite' ? null : onRename}
                                    />
                                ))}
                                {showMore && (
                                    <button
                                        className={styles.more}
                                        onClick={onMore}
                                    >
                                        <FormattedMessage
                                            defaultMessage="More"
                                            description="Load more from backpack"
                                            id="gui.backpack.more"
                                        />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className={styles.statusMessage}>
                                <FormattedMessage
                                    defaultMessage="Backpack is empty"
                                    description="Empty backpack message"
                                    id="gui.backpack.emptyBackpack"
                                />
                            </div>
                        )
                    )
                )}
            </div>
            <div className={styles.importBar}>
                <div className={styles.importCopy}>
                    <strong>{selectedItem ? selectedItem.name : '选择要添加的素材'}</strong>
                    <span
                        className={importFailed ? styles.importError : null}
                        role={importFailed ? 'alert' : 'status'}
                    >
                        {importing ? '正在添加，请稍候…' : importMessage ||
                        (selectedItem ? intl.formatMessage(labelMap[selectedItem.type]) : '支持角色、造型、声音和积木')}
                    </span>
                </div>
                <button
                    aria-busy={importing}
                    className={styles.importButton}
                    disabled={importing || loading || !selectedItem || (!newSprite && !target)}
                    type="button"
                    onClick={onImport}
                >
                    <PlusIcon aria-hidden="true" />
                    <span>{importing ? '添加中…' : newSprite ? '添加新角色' : '添加到所选目标'}</span>
                </button>
            </div>
        </DockPanel>
    ) : null;
};

Backpack.propTypes = {
    blockDragOver: PropTypes.bool,
    containerRef: PropTypes.func,
    contents: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        thumbnailUrl: PropTypes.string,
        type: PropTypes.string,
        name: PropTypes.string
    })),
    dragOver: PropTypes.bool,
    error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    expanded: PropTypes.bool,
    intl: intlShape,
    importing: PropTypes.bool,
    importMessage: PropTypes.string,
    importFailed: PropTypes.bool,
    loading: PropTypes.bool,
    selectedItemId: PropTypes.string,
    targetId: PropTypes.string,
    targets: PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string, name: PropTypes.string})),
    onClose: PropTypes.func.isRequired,
    onDelete: PropTypes.func,
    onRename: PropTypes.func,
    onMore: PropTypes.func,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onSelectItem: PropTypes.func,
    onSelectTarget: PropTypes.func,
    onImport: PropTypes.func,
    showMore: PropTypes.bool
};

Backpack.defaultProps = {
    blockDragOver: false,
    contents: [],
    dragOver: false,
    expanded: false,
    loading: false,
    importing: false,
    importMessage: '',
    importFailed: false,
    targets: [],
    showMore: false,
    onMore: null
};

export default injectIntl(Backpack);
