/* eslint-disable react/jsx-no-bind, react/jsx-max-props-per-line */
import classNames from 'classnames';
import {
    CatIcon,
    ImageIcon,
    LoaderCircleIcon,
    PaletteIcon,
    SaveIcon,
    ShieldCheckIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import {
    PLANET_COLLABORATION_PERMISSIONS_READY_EVENT,
    PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT
} from '../../lib/editor-dock-events';
import {
    fetchPlanetCollaborationPermissions,
    savePlanetCollaborationPermissions
} from '../../lib/planet-collaboration-permissions';
import {
    collaborationEnabled,
    PLANET_COLLABORATION_PERMISSION_EVENT
} from '../../lib/planet-collaboration';
import {listPermissionTargets} from '../../lib/planet-collaboration-targets';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './planet-collaboration-permissions.css';
import DockPanel from './dock-panel.jsx';

const assignmentMap = data => (data.assignments || []).reduce((result, assignment) => ({
    ...result,
    [assignment.targetId]: assignment.userIds || []
}), {});

const initials = value => (String(value || '用户')
    .trim()
    .slice(0, 1) || '用').toUpperCase();

const Avatar = ({member}) => (
    <span className={styles.avatar}>
        {member.avatarUrl ? <img alt="" src={member.avatarUrl} /> : initials(member.nickname)}
    </span>
);

Avatar.propTypes = {
    member: PropTypes.shape({
        avatarUrl: PropTypes.string,
        nickname: PropTypes.string
    }).isRequired
};


const PlanetCollaborationPermissions = ({projectId, targets}) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [data, setData] = React.useState(null);
    const [mode, setMode] = React.useState('FREE');
    const [assignments, setAssignments] = React.useState({});
    const [selectedUserId, setSelectedUserId] = React.useState('');
    const available = isPlanetProjectRoute() && collaborationEnabled() && projectId && String(projectId) !== '0';

    const applyData = React.useCallback(next => {
        setData(next);
        setMode(next.mode || 'FREE');
        setAssignments(assignmentMap(next));
        setSelectedUserId(previous => {
            const members = next.members || [];
            const viewerUserId = String(next.viewerUserId || '');
            const visibleMembers = next.canManage ? members :
                members.filter(member => String(member.id) === viewerUserId);
            return visibleMembers.some(member => String(member.id) === previous) ?
                previous : visibleMembers.length ? String(visibleMembers[0].id) : '';
        });
    }, []);

    const load = React.useCallback(async () => {
        if (!available) return;
        setLoading(true);
        setError('');
        try {
            applyData(await fetchPlanetCollaborationPermissions(projectId));
        } catch (requestError) {
            setError(requestError.message || '协作权限加载失败');
        } finally {
            setLoading(false);
        }
    }, [applyData, available, projectId]);

    React.useEffect(() => {
        const api = Object.freeze({
            close: () => setOpen(false),
            open: () => setOpen(true),
            toggle: () => setOpen(previous => !previous)
        });
        const handlePermissionEvent = event => {
            if (event.detail && event.detail.type === 'collaboration-permissions-updated') load();
        };
        const handleEscape = event => {
            if (event.key === 'Escape') setOpen(false);
        };
        window.PlanetCollaborationPermissions = api;
        window.addEventListener(PLANET_COLLABORATION_PERMISSION_EVENT, handlePermissionEvent);
        document.addEventListener('keydown', handleEscape);
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_PERMISSIONS_READY_EVENT, {detail: api}));
        return () => {
            if (window.PlanetCollaborationPermissions === api) delete window.PlanetCollaborationPermissions;
            window.removeEventListener(PLANET_COLLABORATION_PERMISSION_EVENT, handlePermissionEvent);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [load]);

    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT, {
            detail: {open}
        }));
        if (open) load();
    }, [load, open]);

    const setUserTargetPermission = (userId, targetId, enabled) => {
        setAssignments(previous => {
            const current = previous[targetId] || [];
            return {
                ...previous,
                [targetId]: enabled ? [...new Set([...current, userId])] :
                    current.filter(value => value !== userId)
            };
        });
    };

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {
                mode,
                assignments: mode === 'ASSIGNED' ? targets.map(target => ({
                    targetId: target.targetId,
                    targetName: target.targetName,
                    userIds: assignments[target.targetId] || []
                })).filter(target => target.userIds.length) : []
            };
            applyData(await savePlanetCollaborationPermissions(projectId, payload));
        } catch (requestError) {
            setError(requestError.message || '协作权限保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (!available || !open) return null;
    const members = data ? data.members : [];
    const viewerUserId = data && String(data.viewerUserId || '');
    const visibleMembers = data && data.canManage ? members :
        members.filter(member => String(member.id) === viewerUserId);
    const selectedMember = visibleMembers.find(member => String(member.id) === selectedUserId);
    const selectedAssignedCount = selectedMember ? selectedMember.role === 'OWNER' ? targets.length :
        targets.reduce((count, target) => (
            (assignments[target.targetId] || []).includes(selectedUserId) ? count + 1 : count
        ), 0) : 0;
    const targetGroups = [
        {icon: ImageIcon, kind: 'stage', label: '舞台'},
        {icon: CatIcon, kind: 'sprite', label: '角色'},
        {icon: PaletteIcon, kind: 'costume', label: '造型'}
    ].map(group => ({
        ...group,
        targets: targets.filter(target => target.kind === group.kind)
    })).filter(group => group.targets.length);

    return ReactDOM.createPortal(
        <DockPanel
            className={styles.panel}
            description="按用户设置"
            dragLabel="拖动协作权限窗口"
            icon={ShieldCheckIcon}
            onClose={() => setOpen(false)}
            panelId="permissions"
            title="协作权限"
        >
            <div className={styles.body}>
                {loading && !data ? (
                    <div className={styles.loading}><LoaderCircleIcon aria-hidden="true" />{'正在加载权限'}</div>
                ) : null}
                {error ? <div className={styles.alert} role="alert">{error}</div> : null}
                {data ? (
                    <React.Fragment>
                        <div aria-label="协作权限模式" className={styles.modeSetting}>
                            <span className={styles.modeCopy}>
                                <strong>{'房主分配'}</strong>
                                <small>{mode === 'ASSIGNED' ? '按用户设置' : '关闭 · 自由编辑'}</small>
                            </span>
                            <button
                                aria-checked={mode === 'ASSIGNED'}
                                aria-label="房主分配"
                                className={styles.modeSwitch}
                                disabled={!data.canManage}
                                role="switch"
                                type="button"
                                onClick={() => setMode(mode === 'ASSIGNED' ? 'FREE' : 'ASSIGNED')}
                            >
                                <span />
                            </button>
                        </div>
                        {data.canManage ? null : (
                            <p className={styles.readOnlyHint}>
                                {'权限由项目房主配置，你可以查看自己的编辑范围。'}
                            </p>
                        )}
                        {mode === 'FREE' ? (
                            <div className={styles.freeState}>
                                <ShieldCheckIcon aria-hidden="true" />
                                <span><strong>{'自由编辑已开启'}</strong><small>{'成员可编辑空闲内容'}</small></span>
                            </div>
                        ) : (
                            <div className={styles.permissionLayout}>
                                <aside className={styles.userPane}>
                                    <header className={styles.paneTitle}>
                                        <strong>{'用户'}</strong>
                                        <span>{visibleMembers.length}</span>
                                    </header>
                                    <div aria-label="协作用户" className={styles.userList} role="listbox">
                                        {visibleMembers.length ? visibleMembers.map(member => {
                                            const userId = String(member.id);
                                            const assignedCount = member.role === 'OWNER' ? targets.length :
                                                targets.reduce((count, target) => (
                                                    (assignments[target.targetId] || []).includes(userId) ?
                                                        count + 1 : count
                                                ), 0);
                                            return (
                                                <button
                                                    aria-selected={userId === selectedUserId}
                                                    className={userId === selectedUserId ? styles.userActive : ''}
                                                    key={member.id}
                                                    role="option"
                                                    type="button"
                                                    onClick={() => setSelectedUserId(userId)}
                                                >
                                                    <Avatar member={member} />
                                                    <span className={styles.memberCopy}>
                                                        <strong className={classNames({[styles.memberName]: member.member})}>
                                                            {member.nickname}
                                                        </strong>
                                                        <small>
                                                            {member.role === 'OWNER' ? '房主 · 全部权限' :
                                                                (member.online ? '在线' : '离线')}
                                                        </small>
                                                    </span>
                                                    <span className={styles.userCount}>{assignedCount}</span>
                                                </button>
                                            );
                                        }) : <div className={styles.empty}>{'暂无协作者'}</div>}
                                    </div>
                                </aside>
                                <section className={styles.targetPane}>
                                    {selectedMember ? (
                                        <React.Fragment>
                                            <header className={styles.targetHeader}>
                                                <span>
                                                    <strong className={classNames({[styles.memberName]: selectedMember.member})}>
                                                        {selectedMember.nickname}
                                                    </strong>
                                                    <small>{selectedMember.role === 'OWNER' ? '全部权限' :
                                                        `${selectedAssignedCount}/${targets.length} 已开启`}</small>
                                                </span>
                                            </header>
                                            <div className={styles.resourceList}>
                                                {targetGroups.map(group => {
                                                    const Icon = group.icon;
                                                    return (
                                                        <section className={styles.resourceGroup} key={group.kind}>
                                                            <header>
                                                                <strong>{group.label}</strong>
                                                                <span>{group.targets.length}</span>
                                                            </header>
                                                            <div>
                                                                {group.targets.map(target => {
                                                                    const checked = selectedMember.role === 'OWNER' ||
                                                                        (assignments[target.targetId] || [])
                                                                            .includes(selectedUserId);
                                                                    return (
                                                                        <div
                                                                            className={styles.targetRow}
                                                                            key={target.targetId}
                                                                        >
                                                                            <span className={styles.targetIcon}>
                                                                                <Icon aria-hidden="true" />
                                                                            </span>
                                                                            <span className={styles.targetCopy}>
                                                                                <strong>{target.targetName}</strong>
                                                                                {target.parentName ?
                                                                                    <small>
                                                                                        {target.parentName}
                                                                                    </small> : null}
                                                                            </span>
                                                                            <button
                                                                                aria-checked={checked}
                                                                                aria-label={
                                                                                    `${selectedMember.nickname}` +
                                                                                    `${checked ? '可以' : '不可以'}` +
                                                                                    `编辑${target.targetName}`
                                                                                }
                                                                                className={styles.switch}
                                                                                disabled={!data.canManage ||
                                                                                    selectedMember.role === 'OWNER'}
                                                                                role="switch"
                                                                                type="button"
                                                                                onClick={() => setUserTargetPermission(
                                                                                    selectedUserId,
                                                                                    target.targetId,
                                                                                    !checked
                                                                                )}
                                                                            >
                                                                                <span />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </section>
                                                    );
                                                })}
                                                {targets.length ? null : (
                                                    <div className={styles.empty}>{'暂无可分配内容'}</div>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    ) : <div className={styles.empty}>{'请选择用户'}</div>}
                                </section>
                            </div>
                        )}
                    </React.Fragment>
                ) : null}
            </div>
            {data && data.canManage ? (
                <footer className={styles.footer}>
                    <button className={styles.saveButton} disabled={saving} type="button" onClick={save}>
                        {saving ? <LoaderCircleIcon aria-hidden="true" /> : <SaveIcon aria-hidden="true" />}
                        {saving ? '保存中' : '保存权限'}
                    </button>
                </footer>
            ) : null}
        </DockPanel>,
        document.body
    );
};

PlanetCollaborationPermissions.propTypes = {
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targets: PropTypes.arrayOf(PropTypes.shape({
        kind: PropTypes.oneOf(['stage', 'sprite', 'costume']).isRequired,
        parentName: PropTypes.string,
        targetId: PropTypes.string.isRequired,
        targetName: PropTypes.string.isRequired
    })).isRequired
};

const mapStateToProps = state => {
    const targets = state.scratchGui.targets;
    return {
        projectId: state.scratchGui.projectState.projectId,
        targets: listPermissionTargets(targets)
    };
};

export default connect(mapStateToProps)(PlanetCollaborationPermissions);
