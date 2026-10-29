import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import DragConstants from '../../lib/drag-constants';

import Box from '../box/box.jsx';
import SpriteSelectorItem from '../../containers/sprite-selector-item.jsx';
import SortableHOC from '../../lib/sortable-hoc.jsx';
import SortableAsset from '../asset-panel/sortable-asset.jsx';
import ThrottledPropertyHOC from '../../lib/throttled-property-hoc.jsx';

import styles from './sprite-selector.css';

const ThrottledSpriteSelectorItem = ThrottledPropertyHOC('asset', 500)(SpriteSelectorItem);

const SpriteList = function (props) {
    const {
        containerRef,
        editingTarget,
        draggingIndex,
        draggingType,
        horizontalScroll,
        hoveredTarget,
        onDeleteSprite,
        onDuplicateSprite,
        onExportSprite,
        onSelectSprite,
        onAddSortable,
        onRemoveSortable,
        ordering,
        readOnly,
        raised,
        selectedId,
        items
    } = props;

    const listRef = React.useRef(null);
    const setContainerRef = React.useCallback(node => {
        listRef.current = node;
        containerRef(node);
    }, [containerRef]);
    React.useLayoutEffect(() => {
        const list = listRef.current;
        if (!horizontalScroll || !list || !list.clientWidth ||
            !window.matchMedia('(max-width: 1023px)').matches) return;
        const selected = list.querySelector('[data-sprite-selected="true"]');
        if (!selected) return;
        const viewport = list.getBoundingClientRect();
        const tile = selected.getBoundingClientRect();
        // Scroll only this rail, keeping the stage and editor viewport stationary.
        if (tile.left < viewport.left + 8) list.scrollLeft += tile.left - viewport.left - 8;
        else if (tile.right > viewport.right - 8) list.scrollLeft += tile.right - viewport.right + 8;
    }, [horizontalScroll, selectedId, items.length]);

    const isSpriteDrag = draggingType === DragConstants.SPRITE;

    return (
        <Box
            aria-label={horizontalScroll ? '角色列表，左右滑动查看更多角色' : null}
            className={classNames(styles.scrollWrapper, {
                [styles.scrollWrapperDragging]: draggingType === DragConstants.BACKPACK_SPRITE
            })}
            componentRef={setContainerRef}
            role={horizontalScroll ? 'region' : null}
            tabIndex={horizontalScroll ? 0 : null}
        >
            <Box
                className={styles.itemsWrapper}
            >
                {items.map((sprite, index) => {

                    // If the sprite has just received a block drop, used for green highlight
                    const receivedBlocks = (
                        hoveredTarget.sprite === sprite.id &&
                    sprite.id !== editingTarget &&
                    hoveredTarget.receivedBlocks
                    );

                    // If the sprite is indicating it can receive block dropping, used for blue highlight
                    let isRaised = !receivedBlocks && raised && sprite.id !== editingTarget;

                    // A sprite is also raised if a costume or sound is being dragged.
                    // Note the absence of the self-sharing check: a sprite can share assets with itself.
                    // This is a quirk of 2.0, but seems worth leaving possible, it
                    // allows quick (albeit unusual) duplication of assets.
                    isRaised = isRaised || [
                        DragConstants.COSTUME,
                        DragConstants.SOUND,
                        DragConstants.BACKPACK_COSTUME,
                        DragConstants.BACKPACK_SOUND,
                        DragConstants.BACKPACK_CODE].includes(draggingType);

                    return (
                        <SortableAsset
                            className={classNames(styles.spriteWrapper, {
                                [styles.placeholder]: isSpriteDrag && index === draggingIndex})}
                            index={isSpriteDrag ? ordering.indexOf(index) : index}
                            key={sprite.name}
                            onAddSortable={onAddSortable}
                            onRemoveSortable={onRemoveSortable}
                        >
                            <ThrottledSpriteSelectorItem
                                asset={sprite.costume && sprite.costume.asset}
                                className={classNames(styles.sprite, {
                                    [styles.raised]: isRaised,
                                    [styles.receivedBlocks]: receivedBlocks
                                })}
                                dragPayload={sprite.id}
                                dragType={DragConstants.SPRITE}
                                horizontalScroll={horizontalScroll}
                                id={sprite.id}
                                index={index}
                                key={sprite.id}
                                name={sprite.name}
                                readOnly={readOnly}
                                selected={sprite.id === selectedId}
                                onClick={onSelectSprite}
                                onDeleteButtonClick={onDeleteSprite}
                                onDuplicateButtonClick={onDuplicateSprite}
                                onExportButtonClick={onExportSprite}
                            />
                        </SortableAsset>
                    );
                })}
            </Box>
        </Box>
    );
};

SpriteList.propTypes = {
    containerRef: PropTypes.func,
    draggingIndex: PropTypes.number,
    draggingType: PropTypes.oneOf(Object.keys(DragConstants)),
    editingTarget: PropTypes.string,
    horizontalScroll: PropTypes.bool,
    hoveredTarget: PropTypes.shape({
        hoveredSprite: PropTypes.string,
        receivedBlocks: PropTypes.bool,
        sprite: PropTypes.string
    }),
    items: PropTypes.arrayOf(PropTypes.shape({
        costume: PropTypes.shape({
            url: PropTypes.string,
            name: PropTypes.string.isRequired,
            bitmapResolution: PropTypes.number.isRequired,
            rotationCenterX: PropTypes.number.isRequired,
            rotationCenterY: PropTypes.number.isRequired
        }),
        name: PropTypes.any, // modified by folders addon
        order: PropTypes.number.isRequired
    })),
    onAddSortable: PropTypes.func,
    onDeleteSprite: PropTypes.func,
    onDuplicateSprite: PropTypes.func,
    onExportSprite: PropTypes.func,
    onRemoveSortable: PropTypes.func,
    onSelectSprite: PropTypes.func,
    ordering: PropTypes.arrayOf(PropTypes.number),
    raised: PropTypes.bool,
    readOnly: PropTypes.bool,
    selectedId: PropTypes.string
};

export default SortableHOC(SpriteList);
