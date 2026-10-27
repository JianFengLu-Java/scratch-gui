import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import Modal from '../../containers/modal.jsx';
import styles from './planet-achievement-manager.css';

export const MANAGE_ACHIEVEMENTS = 'PLANET_ACHIEVEMENT_MANAGE';

export const PlanetAchievementManager = ({vm, theme}) => {
    const [context, setContext] = useState(null);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const frame = useRef(null);
    const close = useCallback(() => setContext(null), []);
    const retry = useCallback(() => {
        setFailed(false);
        setAttempt(value => value + 1);
    }, []);
    useLayoutEffect(() => {
        setReady(false);
        setFailed(false);
    }, [theme]);
    useEffect(() => {
        const open = projectId => {
            if (/^\d{1,20}$/.test(String(projectId))) {
                setReady(false);
                setFailed(false);
                setAttempt(0);
                setContext({projectId: String(projectId), channel: crypto.randomUUID()});
            }
        };
        vm.runtime.on(MANAGE_ACHIEVEMENTS, open);
        vm.runtime.on('PROJECT_LOADED', close);
        return () => {
            vm.runtime.removeListener(MANAGE_ACHIEVEMENTS, open);
            vm.runtime.removeListener('PROJECT_LOADED', close);
        };
    }, [vm, close]);
    useEffect(() => {
        if (!context) return;
        const listener = event => {
            const message = event.data;
            if (event.source !== (frame.current && frame.current.contentWindow) ||
                event.origin !== location.origin || !message || message.channel !== context.channel ||
                message.projectId !== context.projectId) return;
            if (message.type === 'PLANET_ACHIEVEMENT_SAVED') vm.runtime.planetAchievementClient.reload();
            if (message.type === 'PLANET_ACHIEVEMENT_READY' && message.theme === theme) {
                setReady(true);
                setFailed(false);
            }
            if (message.type === 'PLANET_ACHIEVEMENT_CLOSE') close();
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [context, vm, close, theme]);
    useEffect(() => {
        if (!context || ready) return;
        const timeout = setTimeout(() => setFailed(true), 15000);
        return () => clearTimeout(timeout);
    }, [context, ready, attempt]);
    if (!context) return null;
    const params = new URLSearchParams({embedded: '1', channel: context.channel, theme});
    return (
        <Modal
            id="planetAchievementManager"
            className={styles.modal}
            headerClassName={styles.header}
            contentLabel="管理游戏成就"
            onRequestClose={close}
            shouldCloseOnOverlayClick={false}
        >
            <div className={styles.body}>
                {!ready && !failed && (
                    <div
                        className={styles.loading}
                        role="status"
                        aria-label="正在加载成就"
                    >
                        <div
                            className={styles.sidebarPlaceholder}
                            aria-hidden="true"
                        >
                            <span /><span /><span /><span />
                        </div>
                        <div
                            className={styles.formPlaceholder}
                            aria-hidden="true"
                        >
                            <span /><span /><span /><span /><span />
                        </div>
                    </div>
                )}
                {!ready && failed && (
                    <div
                        className={styles.failure}
                        role="alert"
                    >
                        <p><FormattedMessage
                            defaultMessage="加载失败，请重试"
                            description="Achievement manager initialization failed"
                            id="gui.planetAchievements.loadFailure"
                        /></p>
                        <button
                            type="button"
                            onClick={retry}
                        >
                            <FormattedMessage
                                defaultMessage="重新加载"
                                description="Retry loading the achievement manager"
                                id="gui.planetAchievements.retry"
                            />
                        </button>
                    </div>
                )}
                <iframe
                    key={attempt}
                    ref={frame}
                    className={styles.frame}
                    title="游戏成就管理"
                    data-ready={ready}
                    aria-hidden={!ready}
                    src={`/projects/${context.projectId}/achievements?${params}`}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    referrerPolicy="same-origin"
                />
            </div>
        </Modal>
    );
};
PlanetAchievementManager.propTypes = {vm: PropTypes.object.isRequired, theme: PropTypes.string.isRequired};
export default connect(state => ({theme: state.scratchGui.theme.theme.isDark() ? 'dark' : 'light'}))(
    PlanetAchievementManager
);
