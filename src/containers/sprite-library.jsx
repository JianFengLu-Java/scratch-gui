import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {injectIntl, intlShape, defineMessages} from 'react-intl';
import VM from 'scratch-vm';

import {getSpriteLibrary} from '../lib/libraries/tw-async-libraries';
import randomizeSpritePosition from '../lib/randomize-sprite-position';
import spriteTags from '../lib/libraries/sprite-tags';

import LibraryComponent from '../components/library/library.jsx';
import log from '../lib/log';
import {
    finishAssetLoad,
    startAssetLoad,
    updateAssetLoad
} from '../lib/asset-load-feedback';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Sprite',
        description: 'Heading for the sprite library',
        id: 'gui.spriteLibrary.chooseASprite'
    }
});

class SpriteLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
        this.state = {
            data: getSpriteLibrary()
        };
    }
    componentDidMount () {
        if (this.state.data.then) {
            this.state.data.then(data => this.setState({
                data
            }));
        }
    }
    handleItemSelect (item) {
        // Randomize position of library sprite
        randomizeSpritePosition(item);
        const vm = this.props.vm;
        const loadId = startAssetLoad('sprite', item.name);
        const baselineFinished = vm.runtime.finishedAssetRequests;
        const baselineTotal = vm.runtime.totalAssetRequests;
        const handleProgress = (finished, total) => updateAssetLoad(
            loadId,
            Math.max(0, finished - baselineFinished),
            Math.max(0, total - baselineTotal)
        );
        vm.on('ASSET_PROGRESS', handleProgress);
        vm.addSprite(JSON.stringify(item)).then(() => {
            vm.off('ASSET_PROGRESS', handleProgress);
            this.props.onActivateBlocksTab();
            finishAssetLoad(loadId, item.name, 'success');
        })
            .catch(error => {
                vm.off('ASSET_PROGRESS', handleProgress);
                log.error(error);
                finishAssetLoad(loadId, item.name, 'error');
            });
    }
    render () {
        return (
            <LibraryComponent
                data={this.state.data.then ? null : this.state.data}
                id="spriteLibrary"
                tags={spriteTags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                removedTrademarks
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

SpriteLibrary.propTypes = {
    intl: intlShape.isRequired,
    onActivateBlocksTab: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default injectIntl(SpriteLibrary);
