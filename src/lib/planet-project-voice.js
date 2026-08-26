import {refreshPlanetSession} from './planet-session';

const API_ROOT = '/backend-api';
const VOICE_MAGIC = 'PLANETV1';
const VOICE_HEADER_BYTES = 13;
const VOICE_MAX_BYTES = 256 * 1024;
const VOICE_MAX_DURATION_MS = 60 * 1000;
const VOICE_MIN_DURATION_MS = 600;
const VOICE_MIME_CODES = Object.freeze({
    'audio/webm;codecs=opus': 1,
    'audio/ogg;codecs=opus': 2,
    'audio/mp4': 3
});
const VOICE_MIME_CANDIDATES = Object.keys(VOICE_MIME_CODES);

const voiceError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const stopStream = stream => {
    if (stream) stream.getTracks().forEach(track => track.stop());
};

export const selectPlanetVoiceMimeType = MediaRecorderClass => {
    const Recorder = MediaRecorderClass || (typeof MediaRecorder === 'undefined' ? null : MediaRecorder);
    if (!Recorder) return null;
    if (typeof Recorder.isTypeSupported !== 'function') return 'audio/webm;codecs=opus';
    return VOICE_MIME_CANDIDATES.find(candidate => Recorder.isTypeSupported(candidate)) || null;
};

export const createPlanetVoiceMessageFrame = (mimeType, durationMs, audioBuffer) => {
    const mimeCode = VOICE_MIME_CODES[mimeType];
    const audio = audioBuffer instanceof Uint8Array ? audioBuffer : new Uint8Array(audioBuffer);
    if (!mimeCode) throw voiceError('VOICE_FORMAT_UNSUPPORTED', '当前浏览器的录音格式暂不支持发送');
    if (!Number.isInteger(durationMs) || durationMs < VOICE_MIN_DURATION_MS ||
        durationMs > VOICE_MAX_DURATION_MS) {
        throw voiceError('VOICE_DURATION_INVALID', '语音时长需要在 1 到 60 秒之间');
    }
    if (!audio.byteLength || audio.byteLength > VOICE_MAX_BYTES) {
        throw voiceError('VOICE_TOO_LARGE', '语音消息过大，请缩短录音后重试');
    }
    const frame = new Uint8Array(VOICE_HEADER_BYTES + audio.byteLength);
    for (let index = 0; index < VOICE_MAGIC.length; index++) {
        frame[index] = VOICE_MAGIC.charCodeAt(index);
    }
    frame[VOICE_MAGIC.length] = mimeCode;
    new DataView(frame.buffer).setUint32(VOICE_MAGIC.length + 1, durationMs);
    frame.set(audio, VOICE_HEADER_BYTES);
    return frame;
};

export const startPlanetVoiceRecording = async ({onProgress} = {}) => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw voiceError('MICROPHONE_UNAVAILABLE', '当前页面无法访问麦克风，请使用 HTTPS 或 localhost 打开编辑器');
    }
    const mimeType = selectPlanetVoiceMimeType();
    if (!mimeType) throw voiceError('VOICE_FORMAT_UNSUPPORTED', '当前浏览器不支持可发送的语音格式');
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {autoGainControl: true, echoCancellation: true, noiseSuppression: true},
        video: false
    });
    let recorder;
    try {
        recorder = new MediaRecorder(stream, {audioBitsPerSecond: 24000, mimeType});
    } catch (error) {
        stopStream(stream);
        throw voiceError('VOICE_RECORDING_FAILED', '无法启动录音，请检查浏览器麦克风设置');
    }
    const chunks = [];
    const startedAt = Date.now();
    let cancelled = false;
    const timers = {limit: null, progress: null};
    let resolveResult;
    let rejectResult;
    const result = new Promise((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });
    const finish = async () => {
        clearTimeout(timers.limit);
        clearInterval(timers.progress);
        stopStream(stream);
        if (cancelled) {
            resolveResult({cancelled: true});
            return;
        }
        const durationMs = Math.min(VOICE_MAX_DURATION_MS, Math.round(Date.now() - startedAt));
        if (durationMs < VOICE_MIN_DURATION_MS) {
            rejectResult(voiceError('VOICE_TOO_SHORT', '说话时间太短'));
            return;
        }
        try {
            const blob = new Blob(chunks, {type: mimeType});
            const frame = createPlanetVoiceMessageFrame(mimeType, durationMs, await blob.arrayBuffer());
            resolveResult({cancelled: false, durationMs, frame, mimeType});
        } catch (error) {
            rejectResult(error);
        }
    };
    recorder.addEventListener('dataavailable', event => {
        if (event.data && event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener('error', () => {
        clearTimeout(timers.limit);
        clearInterval(timers.progress);
        stopStream(stream);
        rejectResult(voiceError('VOICE_RECORDING_FAILED', '录音中断，请重试'));
    });
    recorder.addEventListener('stop', finish);
    try {
        recorder.start(1000);
    } catch (error) {
        stopStream(stream);
        throw voiceError('VOICE_RECORDING_FAILED', '无法启动录音，请检查浏览器麦克风设置');
    }
    if (onProgress) {
        onProgress(0);
        timers.progress = setInterval(() => onProgress(Math.min(
            VOICE_MAX_DURATION_MS, Date.now() - startedAt)), 200);
    }
    timers.limit = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
    }, VOICE_MAX_DURATION_MS);
    return {
        cancel: () => {
            cancelled = true;
            if (recorder.state !== 'inactive') recorder.stop();
            return result;
        },
        result,
        stop: () => {
            if (recorder.state !== 'inactive') recorder.stop();
            return result;
        }
    };
};

export const fetchPlanetVoiceClip = async (projectId, messageId) => {
    const session = await refreshPlanetSession();
    const response = await fetch(
        `${API_ROOT}/projects/${encodeURIComponent(projectId)}/chat-audio/${encodeURIComponent(messageId)}`,
        {
            credentials: 'include',
            headers: {Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`}
        }
    );
    if (!response.ok) {
        throw voiceError('VOICE_MESSAGE_EXPIRED', response.status === 404 ?
            '这条语音已过期' : `语音加载失败（${response.status}）`);
    }
    return response.blob();
};

export class PlanetProjectVoiceRoom {
    constructor ({onState, send}) {
        this.onState = onState;
        this.send = send;
        this.peers = new Map();
        this.remoteAudio = new Map();
    }

    configure ({iceServers, sessionId}) {
        const nextIceServers = Array.isArray(iceServers) ? iceServers : [];
        const changed = JSON.stringify(nextIceServers) !== JSON.stringify(this.iceServers || []);
        this.iceServers = nextIceServers;
        this.sessionId = String(sessionId || '');
        if (changed && this.joined) this.restartIce();
    }

    async join () {
        if (this.joined || this.joining) return;
        if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices ||
            typeof navigator.mediaDevices.getUserMedia !== 'function') {
            throw voiceError('VOICE_ROOM_UNAVAILABLE', '当前浏览器或页面环境无法使用语音房');
        }
        this.joining = true;
        this.notify();
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {autoGainControl: true, echoCancellation: true, noiseSuppression: true},
                video: false
            });
            this.joined = true;
            this.muted = false;
            this.send({type: 'voice-room-join'});
        } catch (error) {
            throw voiceError('MICROPHONE_DENIED', '无法加入语音房，请允许编辑器使用麦克风');
        } finally {
            this.joining = false;
            this.notify();
        }
    }

    setMuted (muted) {
        if (!this.joined || !this.stream) return;
        this.muted = Boolean(muted);
        this.stream.getAudioTracks().forEach(track => {
            track.enabled = !this.muted;
        });
        this.send({type: 'voice-room-mute', muted: this.muted});
        this.notify();
    }

    updateParticipants (participants) {
        this.participants = Array.isArray(participants) ? participants : [];
        if (!this.joined) return;
        if (!this.participants.some(participant => participant.sessionId === this.sessionId)) {
            this.leave(false);
            return;
        }
        const activeIds = new Set(this.participants.map(participant => participant.sessionId));
        Array.from(this.peers.keys()).forEach(sessionId => {
            if (!activeIds.has(sessionId)) this.closePeer(sessionId);
        });
        this.participants.forEach(participant => {
            const remoteId = participant.sessionId;
            if (!remoteId || remoteId === this.sessionId || this.peers.has(remoteId)) return;
            const state = this.createPeer(remoteId);
            if (this.sessionId < remoteId) this.offer(remoteId, state);
        });
    }

    async handleSignal (message) {
        if (!this.joined || !message || !message.signal) return;
        const remoteId = String(message.fromSessionId || '');
        if (!remoteId || remoteId === this.sessionId) return;
        const state = this.peers.get(remoteId) || this.createPeer(remoteId);
        const signal = message.signal;
        try {
            if (signal.kind === 'offer' || signal.kind === 'answer') {
                await state.peer.setRemoteDescription({type: signal.kind, sdp: signal.sdp});
                await this.flushCandidates(state);
                if (signal.kind === 'offer') {
                    const answer = await state.peer.createAnswer();
                    await state.peer.setLocalDescription(answer);
                    this.signal(remoteId, {kind: 'answer', sdp: answer.sdp});
                }
            } else if (signal.kind === 'ice') {
                const candidate = {
                    candidate: signal.candidate,
                    sdpMid: signal.sdpMid,
                    sdpMLineIndex: signal.sdpMLineIndex
                };
                if (state.peer.remoteDescription) {
                    await state.peer.addIceCandidate(candidate);
                } else {
                    state.candidates.push(candidate);
                }
            }
        } catch (error) {
            this.notify('语音连接失败，正在等待自动重连');
            this.closePeer(remoteId);
        }
    }

    leave (notifyServer = true) {
        if (notifyServer && this.joined) this.send({type: 'voice-room-leave'});
        this.joined = false;
        this.joining = false;
        this.muted = true;
        stopStream(this.stream);
        this.stream = null;
        Array.from(this.peers.keys()).forEach(sessionId => this.closePeer(sessionId));
        this.notify();
    }

    destroy () {
        this.leave(true);
    }

    createPeer (remoteId) {
        const peer = new RTCPeerConnection({iceServers: this.iceServers});
        const state = {candidates: [], peer};
        this.peers.set(remoteId, state);
        if (this.stream) {
            this.stream.getTracks().forEach(track => peer.addTrack(track, this.stream));
        }
        peer.addEventListener('icecandidate', event => {
            if (!event.candidate) return;
            this.signal(remoteId, {
                kind: 'ice',
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid || '',
                sdpMLineIndex: event.candidate.sdpMLineIndex
            });
        });
        peer.addEventListener('track', event => this.attachRemoteAudio(remoteId, event));
        peer.addEventListener('connectionstatechange', () => {
            if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
                this.closePeer(remoteId);
            }
        });
        return state;
    }

    async offer (remoteId, state, iceRestart = false) {
        try {
            const offer = iceRestart ? await state.peer.createOffer({iceRestart: true}) :
                await state.peer.createOffer();
            await state.peer.setLocalDescription(offer);
            this.signal(remoteId, {kind: 'offer', sdp: offer.sdp});
        } catch (error) {
            this.closePeer(remoteId);
            this.notify('无法连接部分语音成员');
        }
    }

    restartIce () {
        this.peers.forEach((state, remoteId) => {
            try {
                state.peer.setConfiguration({iceServers: this.iceServers});
                if (this.sessionId < remoteId) this.offer(remoteId, state, true);
            } catch (error) {
                this.closePeer(remoteId);
            }
        });
    }

    async flushCandidates (state) {
        const candidates = state.candidates.splice(0);
        for (const candidate of candidates) await state.peer.addIceCandidate(candidate);
    }

    signal (targetSessionId, signal) {
        this.send({type: 'voice-signal', targetSessionId, signal});
    }

    attachRemoteAudio (remoteId, event) {
        let audio = this.remoteAudio.get(remoteId);
        if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audio.playsInline = true;
            this.remoteAudio.set(remoteId, audio);
        }
        audio.srcObject = event.streams[0] || new MediaStream([event.track]);
        const playback = audio.play();
        if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    }

    closePeer (remoteId) {
        const state = this.peers.get(remoteId);
        if (state) state.peer.close();
        this.peers.delete(remoteId);
        const audio = this.remoteAudio.get(remoteId);
        if (audio) {
            audio.pause();
            audio.srcObject = null;
        }
        this.remoteAudio.delete(remoteId);
    }

    notify (error = '') {
        if (this.onState) {
            this.onState({
                error,
                joined: Boolean(this.joined),
                joining: Boolean(this.joining),
                muted: Boolean(this.muted)
            });
        }
    }
}
