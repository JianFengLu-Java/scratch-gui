import classNames from 'classnames';
import React from 'react';
import {ChevronDownIcon} from 'lucide-react';

import {
    readPlanetEnvelope,
    refreshPlanetSession,
    resolvePlanetAssetUrl
} from '../../lib/planet-session';

import styles from './planet-user-menu.css';

const PROFILE_ENDPOINT = '/backend-api/users/me';

class PlanetUserMenu extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            avatarFailed: false,
            menuOpen: false,
            profile: null,
            status: 'loading'
        };
        this.handleBlur = this.handleBlur.bind(this);
        this.handleAvatarError = this.handleAvatarError.bind(this);
        this.handleCloseMenu = this.handleCloseMenu.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleOpenMenu = this.handleOpenMenu.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.loadProfile = this.loadProfile.bind(this);
    }
    componentDidMount () {
        this.abortController = new AbortController();
        this.loadProfile();
    }
    componentWillUnmount () {
        this.abortController.abort();
    }
    async loadProfile () {
        try {
            const session = await refreshPlanetSession();
            if (this.abortController.signal.aborted) return;
            const profile = await fetch(PROFILE_ENDPOINT, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`
                },
                signal: this.abortController.signal
            }).then(readPlanetEnvelope);
            this.setState({
                profile: {
                    ...profile,
                    avatarUrl: resolvePlanetAssetUrl(profile.avatarUrl)
                },
                status: 'ready'
            });
        } catch (error) {
            if (error.name === 'AbortError') return;
            this.setState({status: [401, 403].includes(error.status) ? 'signedOut' : 'error'});
        }
    }
    handleAvatarError () {
        this.setState({avatarFailed: true});
    }
    handleOpenMenu () {
        if (this.state.status === 'ready') this.setState({menuOpen: true});
    }
    handleCloseMenu () {
        this.setState({menuOpen: false});
    }
    handleToggle () {
        if (this.state.status === 'ready') {
            this.setState(state => ({menuOpen: !state.menuOpen}));
        }
    }
    handleBlur (event) {
        if (!event.currentTarget.contains(event.relatedTarget)) this.handleCloseMenu();
    }
    handleKeyDown (event) {
        if (event.key === 'Escape') {
            this.handleCloseMenu();
            event.currentTarget.querySelector('button').focus();
        }
    }
    renderProfileDetails () {
        const {profile} = this.state;
        const region = [profile.province, profile.city].filter(Boolean).join(' · ');
        return (
            <div
                aria-label={`${profile.nickname}的用户详情`}
                className={styles.popover}
                id="planet-user-details"
                role="group"
            >
                <div className={styles.profileHeader}>
                    <span
                        aria-hidden="true"
                        className={styles.largeAvatar}
                    >
                        {profile.nickname.trim().charAt(0) || '星'}
                        {profile.avatarUrl && !this.state.avatarFailed ? (
                            <img
                                alt=""
                                height="48"
                                src={profile.avatarUrl}
                                width="48"
                                onError={this.handleAvatarError}
                            />
                        ) : null}
                    </span>
                    <span className={styles.profileIdentity}>
                        <strong
                            className={classNames({[styles.memberName]: profile.member})}
                            title={profile.nickname}
                        >
                            {profile.nickname}
                        </strong>
                        <span>{`UID ${profile.uid}`}</span>
                    </span>
                </div>
                <dl className={styles.details}>
                    <div>
                        <dt>{'账号状态'}</dt>
                        <dd>{'已登录'}</dd>
                    </div>
                    {profile.school ? (
                        <div>
                            <dt>{'学校'}</dt>
                            <dd title={profile.school}>{profile.school}</dd>
                        </div>
                    ) : null}
                    {region ? (
                        <div>
                            <dt>{'地区'}</dt>
                            <dd title={region}>{region}</dd>
                        </div>
                    ) : null}
                </dl>
            </div>
        );
    }
    render () {
        if (this.state.status === 'loading') {
            return (
                <div
                    aria-label="正在同步用户信息"
                    className={classNames(styles.trigger, styles.loading)}
                    role="status"
                >
                    <span
                        aria-hidden="true"
                        className={styles.loadingAvatar}
                    />
                    <span
                        aria-hidden="true"
                        className={styles.loadingName}
                    />
                </div>
            );
        }

        if (this.state.status !== 'ready') {
            return (
                <a
                    className={classNames(styles.trigger, styles.signedOut)}
                    href="/"
                    title={this.state.status === 'error' ? '用户信息同步失败，返回首页重试' : '返回首页登录'}
                >
                    {'返回首页登录'}
                </a>
            );
        }

        const {profile} = this.state;
        return (
            <div
                className={styles.userMenu}
                onBlur={this.handleBlur}
                onFocus={this.handleOpenMenu}
                onKeyDown={this.handleKeyDown}
                onMouseEnter={this.handleOpenMenu}
                onMouseLeave={this.handleCloseMenu}
            >
                <button
                    aria-controls="planet-user-details"
                    aria-expanded={this.state.menuOpen}
                    aria-haspopup="true"
                    aria-label={`${profile.nickname}的用户详情`}
                    className={styles.trigger}
                    type="button"
                    onClick={this.handleToggle}
                >
                    <span
                        aria-hidden="true"
                        className={styles.avatar}
                    >
                        {profile.nickname.trim().charAt(0) || '星'}
                        {profile.avatarUrl && !this.state.avatarFailed ? (
                            <img
                                alt=""
                                height="28"
                                src={profile.avatarUrl}
                                width="28"
                                onError={this.handleAvatarError}
                            />
                        ) : null}
                    </span>
                    <span
                        className={classNames(styles.nickname, {[styles.memberName]: profile.member})}
                        title={profile.nickname}
                    >
                        {profile.nickname}
                    </span>
                    <ChevronDownIcon
                        className={styles.caret}
                        data-icon="inline-end"
                    />
                </button>
                {this.state.menuOpen ? this.renderProfileDetails() : null}
            </div>
        );
    }
}

export default PlanetUserMenu;
