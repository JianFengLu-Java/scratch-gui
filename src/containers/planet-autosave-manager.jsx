import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {
    emitPlanetAutosaveStatus,
    openPlanetWriteSession,
    PLANET_AUTOSAVE_REQUEST_EVENT,
    planetCloudState,
    savePlanetCloudAutosave,
    sha256PlanetBlob
} from '../lib/planet-cloud-autosave';
import {isPlanetProjectRoute} from '../lib/planet-project-loader';
import {refreshPlanetSession} from '../lib/planet-session';
import {getIsShowingProject} from '../reducers/project-state';
import {setProjectUnchanged} from '../reducers/project-changed';

const DEBOUNCE_MS = 20000;
const DEBOUNCE_JITTER_MS = 5000;
const MAX_WAIT_MS = 60000;
const RETRY_MS = 15000;

class PlanetAutosaveManager extends React.Component {
    constructor (props) {
        super(props);
        this.changeRevision = 0;
        this.savedRevision = 0;
        this.saving = false;
        this.mounted = false;
        this.handleProjectChanged = this.handleProjectChanged.bind(this);
        this.handleSaveRequest = this.handleSaveRequest.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.queueDebouncedSave = this.queueDebouncedSave.bind(this);
        this.save = this.save.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        this.props.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
        window.addEventListener(PLANET_AUTOSAVE_REQUEST_EVENT, this.handleSaveRequest);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        if (this.active()) emitPlanetAutosaveStatus({status: 'saved'});
    }
    componentDidUpdate (prevProps) {
        if (String(prevProps.projectId) !== String(this.props.projectId)) this.reset();
        if (this.active() && !prevProps.isShowingProject) emitPlanetAutosaveStatus({status: 'saved'});
    }
    componentWillUnmount () {
        this.mounted = false;
        this.clearTimers();
        this.props.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
        window.removeEventListener(PLANET_AUTOSAVE_REQUEST_EVENT, this.handleSaveRequest);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    active () {
        return isPlanetProjectRoute() && this.props.isShowingProject && this.props.projectId &&
            String(this.props.projectId) !== '0';
    }
    reset () {
        this.clearTimers();
        this.changeRevision = 0;
        this.savedRevision = 0;
        this.editorSession = null;
        this.saving = false;
    }
    clearTimers () {
        clearTimeout(this.debounceTimer);
        clearTimeout(this.maxWaitTimer);
        clearTimeout(this.retryTimer);
        this.debounceTimer = null;
        this.maxWaitTimer = null;
        this.retryTimer = null;
    }
    handleProjectChanged () {
        if (!this.active()) return;
        this.changeRevision += 1;
        emitPlanetAutosaveStatus({status: 'pending'});
        clearTimeout(this.debounceTimer);
        this.queueDebouncedSave();
        if (!this.maxWaitTimer) this.maxWaitTimer = setTimeout(this.save, MAX_WAIT_MS);
    }
    queueDebouncedSave () {
        const delay = DEBOUNCE_MS + Math.floor(Math.random() * DEBOUNCE_JITTER_MS);
        this.debounceTimer = setTimeout(this.save, delay);
    }
    handleSaveRequest () {
        if (this.active()) this.save();
    }
    handleVisibilityChange () {
        if (document.visibilityState === 'hidden' && this.active()) this.save();
    }
    async writeSessionToken () {
        const expiresAt = this.editorSession && Date.parse(this.editorSession.expiresAt);
        if (this.editorSession && expiresAt > Date.now() + 30000) {
            return this.editorSession.sessionToken;
        }
        const session = await refreshPlanetSession();
        this.editorSession = await openPlanetWriteSession(session, this.props.projectId);
        return this.editorSession.sessionToken;
    }
    async save () {
        if (!this.active() || this.changeRevision <= this.savedRevision) return;
        if (this.saving) {
            this.saveQueued = true;
            return;
        }
        clearTimeout(this.debounceTimer);
        clearTimeout(this.maxWaitTimer);
        this.debounceTimer = null;
        this.maxWaitTimer = null;
        this.saving = true;
        const capturedRevision = this.changeRevision;
        emitPlanetAutosaveStatus({status: 'saving'});
        try {
            const content = await this.props.vm.saveProjectSb3();
            const file = new File([content], `project-${this.props.projectId}.sb3`, {
                type: 'application/x.scratch.sb3'
            });
            const contentSha256 = await sha256PlanetBlob(file);
            if (planetCloudState(this.props.projectId).contentSha256 !== contentSha256) {
                await savePlanetCloudAutosave({
                    contentSha256,
                    editorSessionToken: await this.writeSessionToken(),
                    file,
                    projectId: this.props.projectId
                });
            }
            this.savedRevision = capturedRevision;
            if (this.mounted && this.changeRevision === capturedRevision) {
                this.props.onProjectUnchanged();
            }
            emitPlanetAutosaveStatus({status: 'saved', savedAt: new Date().toISOString()});
        } catch (error) {
            if (error.status === 401) this.editorSession = null;
            emitPlanetAutosaveStatus({
                status: error.autosaveConflict ? 'conflict' : 'error',
                message: error.message
            });
            if (!error.autosaveConflict) this.retryTimer = setTimeout(this.save, RETRY_MS);
        } finally {
            this.saving = false;
            if (this.saveQueued || this.changeRevision > capturedRevision) {
                this.saveQueued = false;
                clearTimeout(this.debounceTimer);
                this.queueDebouncedSave();
            }
        }
    }
    render () {
        return null;
    }
}

PlanetAutosaveManager.propTypes = {
    isShowingProject: PropTypes.bool,
    onProjectUnchanged: PropTypes.func.isRequired,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState)
});

const mapDispatchToProps = dispatch => ({
    onProjectUnchanged: () => dispatch(setProjectUnchanged())
});

export default connect(mapStateToProps, mapDispatchToProps)(PlanetAutosaveManager);
