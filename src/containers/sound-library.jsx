import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import VM from 'scratch-vm';
import AudioEngine from 'scratch-audio';
import SharedAudioContext from '../lib/audio/shared-audio-context';

import LibraryComponent from '../components/library/library.jsx';

import soundIcon from '../components/library-item/lib-icon--sound.svg';
import soundIconRtl from '../components/library-item/lib-icon--sound-rtl.svg';

import {getSoundLibrary} from '../lib/libraries/tw-async-libraries';
import soundTags from '../lib/libraries/sound-tags';
import log from '../lib/log';
import {
    finishAssetLoad,
    startAssetLoad,
    updateAssetLoad
} from '../lib/asset-load-feedback';

import {connect} from 'react-redux';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Sound',
        description: 'Heading for the sound library',
        id: 'gui.soundLibrary.chooseASound'
    }
});

// @todo need to use this hack to avoid library using md5 for image
const getSoundLibraryThumbnailData = (soundLibraryContent, isRtl) => soundLibraryContent.map(sound => {
    const {
        md5ext,
        ...otherData
    } = sound;
    return {
        _md5: md5ext,
        rawURL: isRtl ? soundIconRtl : soundIcon,
        ...otherData
    };
});

class SoundLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelected',
            'handleItemMouseEnter',
            'handleItemMouseLeave',
            'onStop',
            'setStopHandler'
        ]);

        /**
         * AudioEngine that will decode and play sounds for us.
         * @type {AudioEngine}
         */
        this.audioEngine = null;
        /**
         * A promise for the sound queued to play as soon as it loads and
         * decodes.
         * @type {Promise<SoundPlayer>}
         */
        this.playingSoundRequest = null;
        this.decodedSoundPlayers = new Map();

        /**
         * function to call when the sound ends
         */
        this.handleStop = null;

        this.state = {
            data: null
        };
    }
    componentDidMount () {
        const soundLibrary = getSoundLibrary();
        if (soundLibrary.then) {
            soundLibrary.then(data => this.setState({
                data: getSoundLibraryThumbnailData(data, this.props.isRtl)
            }));
        } else {
            // eslint-disable-next-line react/no-did-mount-set-state
            this.setState({
                data: getSoundLibraryThumbnailData(soundLibrary, this.props.isRtl)
            });
        }

        this.audioEngine = new AudioEngine(new SharedAudioContext());
        this.playingSoundRequest = null;
    }
    componentWillUnmount () {
        this.stopPlayingSound();
        this.decodedSoundPlayers.forEach(playerPromise => {
            playerPromise.then(soundPlayer => soundPlayer.dispose()).catch(() => {});
        });
        this.decodedSoundPlayers.clear();
    }
    onStop () {
        if (this.playingSoundRequest !== null) {
            const request = this.playingSoundRequest;
            request.promise.then(soundPlayer =>
                soundPlayer && soundPlayer.removeListener('stop', this.onStop)).catch(() => {});
            this.playingSoundRequest = null;
            if (this.handleStop) this.handleStop();
        }

    }
    setStopHandler (func) {
        this.handleStop = func;
    }
    stopPlayingSound () {
        // Playback is queued, playing, or has played recently and finished
        // normally.
        if (this.playingSoundRequest !== null) {
            const request = this.playingSoundRequest;
            request.cancelled = true;
            this.playingSoundRequest = null;
            request.promise.then(soundPlayer => {
                if (!soundPlayer) return;
                soundPlayer.removeListener('stop', this.onStop);
                if (request.isPlaying) soundPlayer.stop();
            }).catch(() => {});
        }
    }
    handleItemMouseEnter (soundItem) {
        const md5ext = soundItem._md5;
        const idParts = md5ext.split('.');
        const md5 = idParts[0];
        const extension = idParts[1];
        const vm = this.props.vm;

        // In case enter is called twice without a corresponding leave
        // inbetween, stop the last playback before queueing a new sound.
        this.stopPlayingSound();

        const request = {
            cancelled: false,
            isPlaying: false,
            promise: null
        };
        let soundPlayerPromise = this.decodedSoundPlayers.get(md5ext);
        if (!soundPlayerPromise) {
            soundPlayerPromise = vm.runtime.storage.load(vm.runtime.storage.AssetType.Sound, md5, extension)
                .then(soundAsset => {
                    if (!soundAsset) throw new Error(`Sound preview asset not found: ${md5ext}`);
                    return this.audioEngine.decodeSoundPlayer({
                        md5: md5ext,
                        name: soundItem.name,
                        format: soundItem.format,
                        data: soundAsset.data
                    });
                })
                .then(soundPlayer => {
                    soundPlayer.connect(this.audioEngine);
                    return soundPlayer;
                })
                .catch(error => {
                    this.decodedSoundPlayers.delete(md5ext);
                    throw error;
                });
            this.decodedSoundPlayers.set(md5ext, soundPlayerPromise);
        }
        request.promise = soundPlayerPromise
            .then(soundPlayer => {
                if (request.cancelled) return null;
                soundPlayer.play();
                soundPlayer.addListener('stop', this.onStop);
                request.isPlaying = true;
                return soundPlayer;
            })
            .catch(error => {
                if (!request.cancelled) {
                    log.error(error);
                    if (this.playingSoundRequest === request) {
                        this.playingSoundRequest = null;
                        if (this.handleStop) this.handleStop();
                    }
                }
                throw error;
            });
        this.playingSoundRequest = request;
        return request.promise;
    }
    handleItemMouseLeave () {
        this.stopPlayingSound();
    }
    handleItemSelected (soundItem) {
        const vm = this.props.vm;
        const md5ext = soundItem._md5;
        const idParts = md5ext.split('.');
        const loadId = startAssetLoad('sound', soundItem.name);
        updateAssetLoad(loadId, 0, 2);
        const vmSound = {
            format: soundItem.format,
            md5: md5ext,
            rate: soundItem.rate,
            sampleCount: soundItem.sampleCount,
            name: soundItem.name
        };
        vm.runtime.storage.load(vm.runtime.storage.AssetType.Sound, idParts[0], idParts[1])
            .then(soundAsset => {
                if (!soundAsset) throw new Error(`Sound asset not found: ${md5ext}`);
                vmSound.asset = soundAsset;
                updateAssetLoad(loadId, 1, 2);
                return vm.addSound(vmSound);
            })
            .then(() => {
                updateAssetLoad(loadId, 2, 2);
                this.props.onNewSound();
                finishAssetLoad(loadId, soundItem.name, 'success');
            })
            .catch(error => {
                log.error(error);
                finishAssetLoad(loadId, soundItem.name, 'error');
            });
    }
    render () {
        return (
            <LibraryComponent
                showPlayButton
                data={this.state.data}
                id="soundLibrary"
                setStopHandler={this.setStopHandler}
                tags={soundTags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                onItemMouseEnter={this.handleItemMouseEnter}
                onItemMouseLeave={this.handleItemMouseLeave}
                onItemSelected={this.handleItemSelected}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

SoundLibrary.propTypes = {
    intl: intlShape.isRequired,
    isRtl: PropTypes.bool,
    onNewSound: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl
});

const mapDispatchToProps = () => ({});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(SoundLibrary));
