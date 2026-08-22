import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import Box from '../box/box.jsx';
import SpriteInfo from '../../containers/sprite-info.jsx';
import SpriteList from './sprite-list.jsx';
import {STAGE_DISPLAY_SIZES} from '../../lib/layout-constants';
import {PLANET_EDITOR_RESOURCE_COMMAND_EVENT} from '../../lib/editor-dock-events';

import styles from './sprite-selector.css';

const messages = defineMessages({
    addSpriteFromLibrary: {
        id: 'gui.spriteSelector.addSpriteFromLibrary',
        description: 'Button to add a sprite in the target pane from library',
        defaultMessage: 'Choose a Sprite'
    }
});

const SpriteSelectorComponent = function (props) {
    const {
        editingTarget,
        hoveredTarget,
        intl,
        onChangeSpriteDirection,
        onChangeSpriteName,
        onChangeSpriteRotationStyle,
        onChangeSpriteSize,
        onChangeSpriteVisibility,
        onChangeSpriteX,
        onChangeSpriteY,
        onDrop,
        onDeleteSprite,
        onDuplicateSprite,
        onExportSprite,
        onFileUploadClick,
        onNewSpriteClick,
        onPaintSpriteClick,
        onSelectSprite,
        onSpriteUpload,
        onSurpriseSpriteClick,
        raised,
        selectedId,
        spriteFileInput,
        sprites,
        stageSize,
        ...componentProps
    } = props;
    let selectedSprite = sprites[selectedId];
    let spriteInfoDisabled = false;
    if (typeof selectedSprite === 'undefined') {
        selectedSprite = {};
        spriteInfoDisabled = true;
    }
    React.useEffect(() => {
        const handleResourceCommand = event => {
            const command = event.detail && event.detail.command;
            if (command === 'sprite-library') onNewSpriteClick();
            else if (command === 'sprite-paint') onPaintSpriteClick();
            else if (command === 'sprite-surprise') onSurpriseSpriteClick();
            else if (command === 'sprite-upload') onFileUploadClick();
        };
        window.addEventListener(PLANET_EDITOR_RESOURCE_COMMAND_EVENT, handleResourceCommand);
        return () => window.removeEventListener(PLANET_EDITOR_RESOURCE_COMMAND_EVENT, handleResourceCommand);
    }, [onFileUploadClick, onNewSpriteClick, onPaintSpriteClick, onSurpriseSpriteClick]);
    return (
        <Box
            aria-label={intl.formatMessage(messages.addSpriteFromLibrary)}
            className={styles.spriteSelector}
            {...componentProps}
        >

            <SpriteInfo
                direction={selectedSprite.direction}
                disabled={spriteInfoDisabled}
                name={selectedSprite.name}
                rotationStyle={selectedSprite.rotationStyle}
                size={selectedSprite.size}
                stageSize={stageSize}
                visible={selectedSprite.visible}
                x={selectedSprite.x}
                y={selectedSprite.y}
                onChangeDirection={onChangeSpriteDirection}
                onChangeName={onChangeSpriteName}
                onChangeRotationStyle={onChangeSpriteRotationStyle}
                onChangeSize={onChangeSpriteSize}
                onChangeVisibility={onChangeSpriteVisibility}
                onChangeX={onChangeSpriteX}
                onChangeY={onChangeSpriteY}
            />

            <SpriteList
                editingTarget={editingTarget}
                hoveredTarget={hoveredTarget}
                items={Object.keys(sprites).map(id => sprites[id])}
                raised={raised}
                selectedId={selectedId}
                onDeleteSprite={onDeleteSprite}
                onDrop={onDrop}
                onDuplicateSprite={onDuplicateSprite}
                onExportSprite={onExportSprite}
                onSelectSprite={onSelectSprite}
            />
            <input
                accept=".svg,.png,.bmp,.jpg,.jpeg,.jfif,.webp,.sprite2,.sprite3,.gif"
                className={styles.fileInput}
                multiple
                ref={spriteFileInput}
                type="file"
                onChange={onSpriteUpload}
            />
        </Box>
    );
};

SpriteSelectorComponent.propTypes = {
    editingTarget: PropTypes.string,
    hoveredTarget: PropTypes.shape({
        hoveredSprite: PropTypes.string,
        receivedBlocks: PropTypes.bool
    }),
    intl: intlShape.isRequired,
    onChangeSpriteDirection: PropTypes.func,
    onChangeSpriteName: PropTypes.func,
    onChangeSpriteRotationStyle: PropTypes.func,
    onChangeSpriteSize: PropTypes.func,
    onChangeSpriteVisibility: PropTypes.func,
    onChangeSpriteX: PropTypes.func,
    onChangeSpriteY: PropTypes.func,
    onDeleteSprite: PropTypes.func,
    onDrop: PropTypes.func,
    onDuplicateSprite: PropTypes.func,
    onExportSprite: PropTypes.func,
    onFileUploadClick: PropTypes.func,
    onNewSpriteClick: PropTypes.func,
    onPaintSpriteClick: PropTypes.func,
    onSelectSprite: PropTypes.func,
    onSpriteUpload: PropTypes.func,
    onSurpriseSpriteClick: PropTypes.func,
    raised: PropTypes.bool,
    selectedId: PropTypes.string,
    spriteFileInput: PropTypes.func,
    sprites: PropTypes.shape({
        id: PropTypes.shape({
            costume: PropTypes.shape({
                url: PropTypes.string,
                name: PropTypes.string.isRequired,
                bitmapResolution: PropTypes.number.isRequired,
                rotationCenterX: PropTypes.number.isRequired,
                rotationCenterY: PropTypes.number.isRequired
            }),
            name: PropTypes.string.isRequired,
            order: PropTypes.number.isRequired
        })
    }),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired
};

export default injectIntl(SpriteSelectorComponent);
