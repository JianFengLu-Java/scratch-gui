import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import VM from 'scratch-vm';

import {getBackdropLibrary} from '../lib/libraries/tw-async-libraries';
import backdropTags from '../lib/libraries/backdrop-tags';
import LibraryComponent from '../components/library/library.jsx';
import log from '../lib/log';
import {
    finishAssetLoad,
    startAssetLoad,
    updateAssetLoad
} from '../lib/asset-load-feedback';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Backdrop',
        description: 'Heading for the backdrop library',
        id: 'gui.costumeLibrary.chooseABackdrop'
    }
});


class BackdropLibrary extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
        this.state = {
            data: getBackdropLibrary()
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
        const vm = this.props.vm;
        const loadId = startAssetLoad('backdrop', item.name);
        const baselineFinished = vm.runtime.finishedAssetRequests;
        const baselineTotal = vm.runtime.totalAssetRequests;
        const handleProgress = (finished, total) => updateAssetLoad(
            loadId,
            Math.max(0, finished - baselineFinished),
            Math.max(0, total - baselineTotal)
        );
        const vmBackdrop = {
            name: item.name,
            rotationCenterX: item.rotationCenterX,
            rotationCenterY: item.rotationCenterY,
            bitmapResolution: item.bitmapResolution,
            skinId: null
        };
        // Do not switch to stage, just add the backdrop
        vm.on('ASSET_PROGRESS', handleProgress);
        vm.addBackdrop(item.md5ext, vmBackdrop).then(() => {
            vm.off('ASSET_PROGRESS', handleProgress);
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
                id="backdropLibrary"
                tags={backdropTags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

BackdropLibrary.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default injectIntl(BackdropLibrary);
