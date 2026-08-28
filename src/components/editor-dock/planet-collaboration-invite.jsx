/* eslint-disable react/jsx-no-bind, react/jsx-max-props-per-line */
import classNames from 'classnames';
import {
    CheckIcon,
    CopyIcon,
    LinkIcon,
    LoaderCircleIcon,
    RefreshCwIcon,
    SearchIcon,
    SendIcon,
    Trash2Icon,
    UserPlusIcon,
    UsersIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import {
    PLANET_COLLABORATION_INVITE_READY_EVENT,
    PLANET_COLLABORATION_INVITE_STATE_EVENT
} from '../../lib/editor-dock-events';
import {
    createPlanetCollaborationLink,
    fetchPlanetCollaborationInviteData,
    invitePlanetFriend,
    removePlanetCollaborator
} from '../../lib/planet-collaboration-invitations';
import {collaborationEnabled} from '../../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import DockPanel from './dock-panel.jsx';
import PlanetUserAvatar from './planet-user-avatar.jsx';
import styles from './planet-collaboration-invite.css';

const PersonAvatar = ({person}) => (
    <PlanetUserAvatar
        className={styles.avatar}
        member={person}
    />
);

PersonAvatar.propTypes = {
    person: PropTypes.shape({
        avatarUrl: PropTypes.string,
        nickname: PropTypes.string
    }).isRequired
};

const PlanetCollaborationInvite = ({projectId}) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [data, setData] = React.useState(null);
    const [query, setQuery] = React.useState('');
    const [shareUrl, setShareUrl] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [creatingLink, setCreatingLink] = React.useState(false);
    const [pendingUserId, setPendingUserId] = React.useState('');
    const [invitedUserIds, setInvitedUserIds] = React.useState(() => new Set());
    const [removingUserId, setRemovingUserId] = React.useState('');
    const [confirmUserId, setConfirmUserId] = React.useState('');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');
    const openedFromUrl = React.useRef(false);
    const available = isPlanetProjectRoute() && collaborationEnabled() && projectId && String(projectId) !== '0';

    const load = React.useCallback(async (quiet = false) => {
        if (!available) return;
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            setData(await fetchPlanetCollaborationInviteData(projectId));
        } catch (requestError) {
            setError(requestError.message || '协作信息加载失败');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [available, projectId]);

    React.useEffect(() => {
        const api = Object.freeze({
            close: () => setOpen(false),
            open: () => setOpen(true),
            toggle: () => setOpen(previous => !previous)
        });
        window.PlanetCollaborationInvite = api;
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_INVITE_READY_EVENT, {detail: api}));
        return () => {
            if (window.PlanetCollaborationInvite === api) delete window.PlanetCollaborationInvite;
        };
    }, []);

    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_INVITE_STATE_EVENT, {
            detail: {open}
        }));
        if (open) load();
    }, [load, open]);

    React.useEffect(() => {
        if (!available || openedFromUrl.current) return;
        openedFromUrl.current = true;
        if (new URLSearchParams(window.location.search).get('panel') === 'invite') setOpen(true);
    }, [available]);

    const availableFriends = React.useMemo(() => {
        if (!data) return [];
        const memberIds = new Set(data.members.map(member => String(member.id)));
        const normalized = query.trim().toLocaleLowerCase('zh-CN');
        return data.friends.filter(friend => {
            if (memberIds.has(String(friend.id))) return false;
            if (!normalized) return true;
            return `${friend.nickname || ''} ${friend.uid || ''}`
                .toLocaleLowerCase('zh-CN')
                .includes(normalized);
        });
    }, [data, query]);

    const createLink = async () => {
        if (creatingLink) return;
        setCreatingLink(true);
        setError('');
        setSuccess('');
        try {
            const link = await createPlanetCollaborationLink(projectId);
            setShareUrl(new URL(link.path, window.location.origin).toString());
            setCopied(false);
        } catch (requestError) {
            setError(requestError.message || '邀请链接生成失败');
        } finally {
            setCreatingLink(false);
        }
    };

    const copyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setSuccess('邀请链接已复制');
            setError('');
        } catch (copyError) {
            setError('无法自动复制，请手动选择链接');
        }
    };

    const invite = async friend => {
        const userId = String(friend.id);
        if (pendingUserId || invitedUserIds.has(userId)) return;
        setPendingUserId(userId);
        setError('');
        setSuccess('');
        try {
            await invitePlanetFriend(projectId, userId);
            setInvitedUserIds(previous => new Set(previous).add(userId));
            setSuccess(`已向 ${friend.nickname || '好友'} 发送邀请`);
        } catch (requestError) {
            setError(requestError.message || '好友邀请发送失败');
        } finally {
            setPendingUserId('');
        }
    };

    const removeMember = async member => {
        const userId = String(member.id);
        if (removingUserId) return;
        setRemovingUserId(userId);
        setError('');
        setSuccess('');
        try {
            await removePlanetCollaborator(projectId, userId);
            setConfirmUserId('');
            setSuccess(`已移除 ${member.nickname || '协作者'}`);
            await load(true);
        } catch (requestError) {
            setError(requestError.message || '协作者移除失败');
        } finally {
            setRemovingUserId('');
        }
    };

    if (!available || !open) return null;

    const refreshButton = (
        <button
            aria-label="刷新协作信息"
            className={styles.iconButton}
            disabled={loading || refreshing}
            title="刷新"
            type="button"
            onClick={() => load(true)}
        >
            <RefreshCwIcon aria-hidden="true" className={refreshing ? styles.spinning : ''} />
        </button>
    );

    return ReactDOM.createPortal(
        <DockPanel
            actions={refreshButton}
            className={styles.panel}
            dragLabel="拖动邀请协作窗口"
            icon={UserPlusIcon}
            onClose={() => setOpen(false)}
            panelId="invite"
            title="邀请协作"
        >
            <div className={styles.body}>
                {error ? <div className={styles.error} role="alert">{error}</div> : null}
                {success ? (
                    <div className={styles.success} role="status">
                        <CheckIcon aria-hidden="true" />
                        <span>{success}</span>
                    </div>
                ) : null}

                {loading && !data ? (
                    <div className={styles.loading}>
                        <LoaderCircleIcon aria-hidden="true" />
                        <span>{'正在读取协作信息'}</span>
                    </div>
                ) : null}

                {data && data.canManage ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div>
                                <h3>{'邀请链接'}</h3>
                                <p>{'24 小时内有效'}</p>
                            </div>
                            {shareUrl ? null : (
                                <button
                                    className={styles.secondaryButton}
                                    disabled={creatingLink}
                                    type="button"
                                    onClick={createLink}
                                >
                                    {creatingLink ?
                                        <LoaderCircleIcon aria-hidden="true" /> :
                                        <LinkIcon aria-hidden="true" />}
                                    <span>{creatingLink ? '生成中' : '生成链接'}</span>
                                </button>
                            )}
                        </header>
                        {shareUrl ? (
                            <div className={styles.inputGroup}>
                                <input aria-label="协作邀请链接" readOnly value={shareUrl} />
                                <button aria-label="复制协作邀请链接" type="button" onClick={copyLink}>
                                    {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                                    <span>{copied ? '已复制' : '复制'}</span>
                                </button>
                            </div>
                        ) : null}
                    </section>
                ) : null}

                {data && data.canManage ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div>
                                <h3>{'邀请好友'}</h3>
                            </div>
                        </header>
                        <label className={styles.search}>
                            <SearchIcon aria-hidden="true" />
                            <span className={styles.srOnly}>{'搜索好友'}</span>
                            <input
                                placeholder="搜索昵称或 UID"
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                            />
                        </label>
                        <div className={styles.list}>
                            {availableFriends.length ? availableFriends.map(friend => {
                                const friendId = String(friend.id);
                                const invited = invitedUserIds.has(friendId);
                                const pending = pendingUserId === friendId;
                                let InviteStatusIcon = SendIcon;
                                if (pending) InviteStatusIcon = LoaderCircleIcon;
                                else if (invited) InviteStatusIcon = CheckIcon;
                                return (
                                    <div className={styles.personRow} key={friendId}>
                                        <PersonAvatar person={friend} />
                                        <span className={styles.personCopy}>
                                            <strong className={classNames({[styles.memberName]: friend.member})}>
                                                {friend.nickname || '好友'}
                                            </strong>
                                            <small>{friend.uid ? `@${friend.uid}` : '好友'}</small>
                                        </span>
                                        <button
                                            className={styles.rowButton}
                                            disabled={Boolean(pendingUserId) || invited}
                                            type="button"
                                            onClick={() => invite(friend)}
                                        >
                                            <InviteStatusIcon aria-hidden="true" />
                                            <span>{invited ? '已发送' : '邀请'}</span>
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className={styles.empty}>
                                    <UsersIcon aria-hidden="true" />
                                    <strong>{query ? '没有匹配的好友' : '暂无可邀请的好友'}</strong>
                                </div>
                            )}
                        </div>
                    </section>
                ) : null}

                {data ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div>
                                <h3>{'项目成员'}</h3>
                                <p>{`${data.members.length} 人`}</p>
                            </div>
                            {data.canManage ? null : (
                                <span className={styles.ownerBadge}>{'房主管理'}</span>
                            )}
                        </header>
                        <div className={styles.list}>
                            {data.members.map(member => {
                                const memberId = String(member.id);
                                const owner = member.role === 'OWNER';
                                const confirming = confirmUserId === memberId;
                                const removing = removingUserId === memberId;
                                const RemoveStatusIcon = removing ? LoaderCircleIcon : Trash2Icon;
                                return (
                                    <div className={styles.personRow} key={memberId}>
                                        <span className={styles.avatarWrap}>
                                            <PersonAvatar person={member} />
                                            <span
                                                aria-label={member.online ? '在线' : '离线'}
                                                className={member.online ? styles.online : styles.offline}
                                            />
                                        </span>
                                        <span className={styles.personCopy}>
                                            <strong className={classNames({[styles.memberName]: member.member})}>
                                                {member.nickname || '用户'}
                                            </strong>
                                            <small>{owner ? '房主' : (member.online ? '在线' : '离线')}</small>
                                        </span>
                                        {data.canManage && !owner ? (
                                            confirming ? (
                                                <span className={styles.confirmActions}>
                                                    <button
                                                        className={styles.cancelButton}
                                                        disabled={removing}
                                                        type="button"
                                                        onClick={() => setConfirmUserId('')}
                                                    >{'取消'}</button>
                                                    <button
                                                        className={styles.dangerButton}
                                                        disabled={removing}
                                                        type="button"
                                                        onClick={() => removeMember(member)}
                                                    >
                                                        <RemoveStatusIcon aria-hidden="true" />
                                                        <span>{removing ? '移除中' : '确认移除'}</span>
                                                    </button>
                                                </span>
                                            ) : (
                                                <button
                                                    aria-label={`移除 ${member.nickname || '协作者'}`}
                                                    className={styles.iconButton}
                                                    disabled={Boolean(removingUserId)}
                                                    title="移除协作者"
                                                    type="button"
                                                    onClick={() => setConfirmUserId(memberId)}
                                                >
                                                    <Trash2Icon aria-hidden="true" />
                                                </button>
                                            )
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}
            </div>
        </DockPanel>,
        document.body
    );
};

PlanetCollaborationInvite.propTypes = {
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

const mapStateToProps = state => ({
    projectId: state.scratchGui.projectState.projectId
});

export default connect(mapStateToProps)(PlanetCollaborationInvite);
