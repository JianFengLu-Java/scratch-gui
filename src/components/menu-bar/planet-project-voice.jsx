/* eslint-disable react/no-multi-comp -- Room controls and their voice bubble share one protocol surface. */
import {
    LoaderCircleIcon,
    MicIcon,
    MicOffIcon,
    PauseIcon,
    PhoneOffIcon,
    PlayIcon,
    RadioIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {
    getPlanetCollaborationVoiceState,
    PLANET_COLLABORATION_VOICE_EVENT,
    PLANET_COLLABORATION_VOICE_SEND_EVENT
} from '../../lib/planet-collaboration';
import {
    fetchPlanetVoiceClip,
    PlanetProjectVoiceRoom,
    startPlanetVoiceRecording
} from '../../lib/planet-project-voice';

import styles from './planet-project-chat.css';

const RECORD_CANCEL_DISTANCE = 60;
const VOICE_PLAY_EVENT = 'planet-project-voice-play';

const formatDuration = durationMs =>
    `${Math.max(1, Math.round(Number(durationMs || 0) / 1000))}″`;

export class PlanetProjectVoiceControls extends React.Component {
    constructor (props) {
        super(props);
        this.initialVoiceState = getPlanetCollaborationVoiceState();
        this.state = {
            canCreateRoom: Boolean(this.initialVoiceState && this.initialVoiceState.canCreateRoom),
            durationMs: 0,
            enabled: Boolean(this.initialVoiceState && this.initialVoiceState.enabled),
            error: this.initialVoiceState && !this.initialVoiceState.enabled ?
                '项目语音暂未配置' : '',
            joined: false,
            joining: false,
            muted: true,
            participants: this.initialVoiceState ? this.initialVoiceState.participants : [],
            participantLimit: this.initialVoiceState ? this.initialVoiceState.participantLimit : 4,
            ready: Boolean(this.initialVoiceState),
            recordCancel: false,
            recording: false,
            recordingPending: false,
            roomActive: Boolean(this.initialVoiceState && this.initialVoiceState.roomActive)
        };
        this.handleVoiceEvent = this.handleVoiceEvent.bind(this);
        this.handleRoomState = this.handleRoomState.bind(this);
        this.handleJoin = this.handleJoin.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
        this.handleRecordKeyDown = this.handleRecordKeyDown.bind(this);
        this.handleRecordKeyUp = this.handleRecordKeyUp.bind(this);
        this.handleRecordingError = this.handleRecordingError.bind(this);
        this.handleRecordingResult = this.handleRecordingResult.bind(this);
        this.handleToggleMute = this.handleToggleMute.bind(this);
        this.send = this.send.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        this.room = this.props.room ?
            new PlanetProjectVoiceRoom({onState: this.handleRoomState, send: this.send}) : null;
        window.addEventListener(PLANET_COLLABORATION_VOICE_EVENT, this.handleVoiceEvent);
        const latest = this.initialVoiceState;
        if (latest && this.room) {
            this.room.configure({iceServers: latest.iceServers, sessionId: latest.sessionId});
            this.room.updateParticipants(latest.participants);
        }
        this.initialVoiceState = null;
    }
    componentDidUpdate (previousProps) {
        if (previousProps.connected && !this.props.connected) {
            if (this.room) this.room.leave(false);
            this.cancelRecording();
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        window.removeEventListener(PLANET_COLLABORATION_VOICE_EVENT, this.handleVoiceEvent);
        this.cancelRecording();
        if (this.room) this.room.destroy();
    }
    handleVoiceEvent (event) {
        const detail = event.detail || {};
        if (detail.type === 'session-ready') {
            if (this.room) {
                this.room.configure({iceServers: detail.voiceIceServers, sessionId: detail.sessionId});
            }
            this.setState({
                canCreateRoom: Boolean(detail.voiceCanCreateRoom),
                enabled: Boolean(detail.voiceEnabled),
                error: detail.voiceEnabled ? '' : '项目语音暂未配置',
                ready: true
            });
        } else if (detail.type === 'voice-room') {
            const participants = Array.isArray(detail.participants) ? detail.participants : [];
            if (this.room) this.room.updateParticipants(participants);
            const own = this.room ?
                participants.find(participant => participant.sessionId === this.room.sessionId) : null;
            this.setState(previous => ({
                error: detail.active ? '' : previous.error,
                muted: own ? Boolean(own.muted) : previous.muted,
                participantLimit: Number(detail.participantLimit || previous.participantLimit),
                participants,
                roomActive: Boolean(detail.active)
            }));
        } else if (detail.type === 'voice-ice-servers') {
            if (this.room) {
                this.room.configure({
                    iceServers: detail.voiceIceServers,
                    sessionId: this.room.sessionId
                });
            }
        } else if (detail.type === 'voice-signal') {
            if (this.room) this.room.handleSignal(detail);
        } else if (detail.type === 'voice-error') {
            if (this.room && detail.code !== 'VOICE_SIGNAL_REJECTED') {
                this.room.leave(false);
            }
            this.setState({error: detail.message || '语音连接失败'});
        } else if (detail.type === 'voice-room-closed') {
            if (this.room) this.room.leave(false);
            this.setState({
                error: detail.message || '语音房已自动关闭',
                participants: [],
                roomActive: false
            });
        } else if (detail.type === 'collaboration-destroyed') {
            if (this.room) this.room.leave(false);
            this.setState({enabled: false, participants: [], ready: false});
        }
    }
    handleRoomState (next) {
        if (!this.mounted) return;
        this.setState(previous => ({
            error: next.error || previous.error,
            joined: next.joined,
            joining: next.joining,
            muted: next.muted
        }));
    }
    async handleJoin () {
        if (!this.props.connected || !this.state.enabled) return;
        if (!this.state.roomActive && !this.state.canCreateRoom) {
            this.setState({error: '付费会员可创建语音房；协作者可加入已有房间'});
            return;
        }
        this.setState({error: ''});
        try {
            await this.room.join();
        } catch (error) {
            if (this.mounted) this.setState({error: error.message || '无法加入语音房'});
        }
    }
    handleToggleMute () {
        this.room.setMuted(!this.state.muted);
    }
    handleLeave () {
        this.room.leave(true);
    }
    send (message) {
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_VOICE_SEND_EVENT, {
            detail: {message}
        }));
    }
    async startRecording () {
        if (!this.props.connected || !this.state.enabled || this.recorder ||
            this.state.recordingPending) return;
        this.setState({
            durationMs: 0,
            error: '',
            recordCancel: false,
            recordingPending: true
        });
        try {
            const recorder = await startPlanetVoiceRecording({
                onProgress: durationMs => {
                    if (this.mounted) this.setState({durationMs});
                }
            });
            this.recorder = recorder;
            recorder.result.then(this.handleRecordingResult, this.handleRecordingError);
            if (!this.recordGestureActive) {
                this.finishRecording(Boolean(this.cancelWhenReady));
            } else if (this.mounted) {
                this.setState({recording: true, recordingPending: false});
            }
        } catch (error) {
            this.recorder = null;
            this.handleRecordingError(error);
        }
    }
    finishRecording (cancelled) {
        this.recordGestureActive = false;
        this.cancelWhenReady = Boolean(cancelled);
        if (!this.recorder) return;
        const recorder = this.recorder;
        this.recorder = null;
        if (cancelled) recorder.cancel();
        else recorder.stop();
        if (this.mounted) this.setState({recording: false, recordingPending: false});
    }
    cancelRecording () {
        this.finishRecording(true);
    }
    handleRecordingResult (result) {
        if (!this.mounted) return;
        this.recorder = null;
        this.cancelWhenReady = false;
        this.setState({
            durationMs: 0,
            error: '',
            recordCancel: false,
            recording: false,
            recordingPending: false
        });
        if (!result.cancelled) {
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_VOICE_SEND_EVENT, {
                detail: {frame: result.frame}
            }));
        }
    }
    handleRecordingError (error) {
        if (!this.mounted) return;
        this.recorder = null;
        this.cancelWhenReady = false;
        this.recordGestureActive = false;
        this.setState({
            durationMs: 0,
            error: error.message || '录音失败，请重试',
            recordCancel: false,
            recording: false,
            recordingPending: false
        });
    }
    handlePointerDown (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        this.recordStartY = event.clientY;
        this.recordGestureActive = true;
        this.cancelWhenReady = false;
        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        this.startRecording();
    }
    handlePointerMove (event) {
        if (!this.recordGestureActive) return;
        const recordCancel = this.recordStartY - event.clientY >= RECORD_CANCEL_DISTANCE;
        if (recordCancel !== this.state.recordCancel) this.setState({recordCancel});
    }
    handlePointerUp (event) {
        if (!this.recordGestureActive) return;
        event.preventDefault();
        this.finishRecording(this.state.recordCancel);
    }
    handlePointerCancel () {
        this.finishRecording(true);
    }
    handleRecordKeyDown (event) {
        if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat) return;
        event.preventDefault();
        this.recordGestureActive = true;
        this.cancelWhenReady = false;
        this.startRecording();
    }
    handleRecordKeyUp (event) {
        if ((event.key !== ' ' && event.key !== 'Enter') || !this.recordGestureActive) return;
        event.preventDefault();
        this.finishRecording(false);
    }
    renderRoom () {
        if (!this.state.ready) return null;
        if (!this.state.enabled) {
            return <div className={styles.voiceUnavailable}>{'项目语音暂未开放'}</div>;
        }
        const joinIcon = this.state.joining ?
            <LoaderCircleIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />;
        const microphoneIcon = this.state.muted ?
            <MicOffIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />;
        const canJoin = this.state.roomActive || this.state.canCreateRoom;
        const idleAction = this.state.roomActive ? '加入语音' :
            (this.state.canCreateRoom ? '创建语音房' : '会员可创建');
        return (
            <section
                aria-label="项目语音房"
                className={styles.voiceRoom}
            >
                <div className={styles.voiceRoomHeader}>
                    <span className={styles.voiceRoomTitle}>
                        <RadioIcon aria-hidden="true" />
                        <strong>{'项目语音房'}</strong>
                        <small>{`${this.state.participants.length}/${this.state.participantLimit} 人`}</small>
                    </span>
                    {this.state.joined ? (
                        <span className={styles.voiceActions}>
                            <button
                                aria-label={this.state.muted ? '打开麦克风' : '静音麦克风'}
                                className={styles.voiceIconButton}
                                onClick={this.handleToggleMute}
                                title={this.state.muted ? '打开麦克风' : '静音麦克风'}
                                type="button"
                            >
                                {microphoneIcon}
                            </button>
                            <button
                                aria-label="退出语音房"
                                className={`${styles.voiceIconButton} ${styles.leaveVoiceButton}`}
                                onClick={this.handleLeave}
                                title="退出语音房"
                                type="button"
                            >
                                <PhoneOffIcon aria-hidden="true" />
                            </button>
                        </span>
                    ) : (
                        <button
                            className={styles.joinVoiceButton}
                            disabled={!this.props.connected || this.state.joining || !canJoin}
                            onClick={this.handleJoin}
                            title={canJoin ? idleAction : '付费会员可创建语音房；协作者可加入已有房间'}
                            type="button"
                        >
                            {joinIcon}
                            <span>{this.state.joining ? '正在加入' : idleAction}</span>
                        </button>
                    )}
                </div>
                {this.state.participants.length > 0 && (
                    <div className={styles.voiceParticipants}>
                        {this.state.participants.map(participant => (
                            <span
                                className={styles.voiceParticipant}
                                key={participant.sessionId}
                                title={participant.nickname || '协作者'}
                            >
                                <span style={{backgroundColor: participant.color || '#0ea5e9'}}>
                                    {(participant.nickname || '协').slice(0, 1)}
                                </span>
                                <b>{participant.nickname || '协作者'}</b>
                                {participant.host && <small>{'房主'}</small>}
                                {participant.muted && <MicOffIcon aria-label="已静音" />}
                            </span>
                        ))}
                    </div>
                )}
                {this.state.error && <div className={styles.voiceError}>{this.state.error}</div>}
            </section>
        );
    }
    renderRecorder () {
        if (!this.state.ready || !this.state.enabled) {
            return (
                <div className={styles.voiceComposer}>
                    <button
                        className={styles.recordButton}
                        disabled
                        type="button"
                    >
                        <MicOffIcon aria-hidden="true" />
                        <span>{this.state.ready ? '语音暂不可用' : '正在连接语音'}</span>
                    </button>
                </div>
            );
        }
        const recording = this.state.recording || this.state.recordingPending;
        const recordIcon = this.state.recordingPending ?
            <LoaderCircleIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />;
        return (
            <div className={styles.voiceComposer}>
                <button
                    className={`${styles.recordButton} ${recording ? styles.recording : ''} ${
                        this.state.recordCancel ? styles.recordCancel : ''}`}
                    disabled={!this.props.connected}
                    onKeyDown={this.handleRecordKeyDown}
                    onKeyUp={this.handleRecordKeyUp}
                    onPointerCancel={this.handlePointerCancel}
                    onPointerDown={this.handlePointerDown}
                    onPointerMove={this.handlePointerMove}
                    onPointerUp={this.handlePointerUp}
                    type="button"
                >
                    {recordIcon}
                    <span>{recording ? (this.state.recordCancel ? '松开取消' :
                        `松开发送 ${formatDuration(this.state.durationMs)}`) : '按住说话'}</span>
                </button>
            </div>
        );
    }
    render () {
        return (
            <React.Fragment>
                {this.props.room ? this.renderRoom() : null}
                {this.props.recorder ? this.renderRecorder() : null}
            </React.Fragment>
        );
    }
}

PlanetProjectVoiceControls.propTypes = {
    connected: PropTypes.bool.isRequired,
    recorder: PropTypes.bool,
    room: PropTypes.bool
};

PlanetProjectVoiceControls.defaultProps = {
    recorder: true,
    room: true
};

export class PlanetProjectVoiceMessage extends React.Component {
    constructor (props) {
        super(props);
        this.state = {loading: false, playing: false};
        this.handleOtherPlayback = this.handleOtherPlayback.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        window.addEventListener(VOICE_PLAY_EVENT, this.handleOtherPlayback);
    }
    componentWillUnmount () {
        this.mounted = false;
        window.removeEventListener(VOICE_PLAY_EVENT, this.handleOtherPlayback);
        this.stop();
        if (this.url) URL.revokeObjectURL(this.url);
    }
    handleOtherPlayback (event) {
        if (event.detail !== this.props.message.messageId) this.stop();
    }
    stop () {
        if (this.audio) this.audio.pause();
        this.audio = null;
        if (this.mounted) this.setState({playing: false});
    }
    async handleToggle () {
        if (this.state.playing) {
            this.stop();
            return;
        }
        this.setState({loading: true});
        try {
            if (!this.url) {
                const blob = await fetchPlanetVoiceClip(
                    this.props.projectId, this.props.message.messageId);
                this.url = URL.createObjectURL(blob);
            }
            if (!this.mounted) return;
            window.dispatchEvent(new CustomEvent(VOICE_PLAY_EVENT, {
                detail: this.props.message.messageId
            }));
            const audio = new Audio(this.url);
            this.audio = audio;
            audio.addEventListener('ended', () => this.stop());
            await audio.play();
            if (this.mounted) this.setState({loading: false, playing: true});
        } catch (error) {
            this.stop();
            if (this.mounted) this.setState({loading: false});
        }
    }
    render () {
        const message = this.props.message;
        return (
            <button
                aria-label={`${this.state.playing ? '暂停' : '播放'} ${formatDuration(message.durationMs)} 语音`}
                className={styles.voiceMessage}
                disabled={this.state.loading || !this.props.projectId}
                onClick={this.handleToggle}
                type="button"
            >
                {this.state.loading ? <LoaderCircleIcon aria-hidden="true" /> : this.state.playing ?
                    <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
                <span
                    aria-hidden="true"
                    className={styles.voiceWave}
                >
                    <i /><i /><i /><i />
                </span>
                <span>{formatDuration(message.durationMs)}</span>
            </button>
        );
    }
}

PlanetProjectVoiceMessage.propTypes = {
    message: PropTypes.shape({
        durationMs: PropTypes.number,
        messageId: PropTypes.string.isRequired
    }).isRequired,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};
