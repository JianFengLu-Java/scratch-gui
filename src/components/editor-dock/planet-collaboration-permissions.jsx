/* eslint-disable react/jsx-no-bind, react/jsx-max-props-per-line */
import {gsap} from 'gsap';
import {Draggable} from 'gsap/Draggable';
import {useGSAP} from '@gsap/react';
import {
    CatIcon,
    GripVerticalIcon,
    ImageIcon,
    LoaderCircleIcon,
    SaveIcon,
    ShieldCheckIcon,
    UsersIcon,
    XIcon
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
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './planet-collaboration-permissions.css';

gsap.registerPlugin(useGSAP, Draggable);

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

const DraggablePanel = ({children, onClose}) => {
    const panelRef = React.useRef(null);
    const handleRef = React.useRef(null);

    useGSAP(() => {
        const matchMedia = gsap.matchMedia();
        const draggable = Draggable.create(panelRef.current, {
            bounds: document.documentElement,
            edgeResistance: 0.88,
            trigger: handleRef.current,
            type: 'x,y'
        })[0];
        const keepInViewport = () => draggable.applyBounds(document.documentElement);
        matchMedia.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.fromTo(panelRef.current, {autoAlpha: 0, scale: 0.98}, {
                autoAlpha: 1,
                duration: 0.2,
                ease: 'power2.out',
                scale: 1
            });
        });
        window.addEventListener('resize', keepInViewport);
        return () => {
            window.removeEventListener('resize', keepInViewport);
            draggable.kill();
            matchMedia.revert();
        };
    }, {scope: panelRef});

    return (
        <section
            aria-describedby="planet-collaboration-permissions-description"
            aria-labelledby="planet-collaboration-permissions-title"
            className={styles.panel}
            ref={panelRef}
            role="dialog"
        >
            <header className={styles.header}>
                <div
                    aria-label="拖动角色权限窗口"
                    className={styles.dragHandle}
                    ref={handleRef}
                >
                    <GripVerticalIcon aria-hidden="true" />
                    <div className={styles.headerIcon}><ShieldCheckIcon aria-hidden="true" /></div>
                    <div className={styles.headerCopy}>
                        <h2 id="planet-collaboration-permissions-title">{'角色权限'}</h2>
                        <p id="planet-collaboration-permissions-description">{'管理角色与舞台的编辑范围'}</p>
                    </div>
                </div>
                <button aria-label="关闭角色权限" className={styles.iconButton} type="button" onClick={onClose}>
                    <XIcon aria-hidden="true" />
                </button>
            </header>
            {children}
        </section>
    );
};

DraggablePanel.propTypes = {
    children: PropTypes.node.isRequired,
    onClose: PropTypes.func.isRequired
};

const PlanetCollaborationPermissions = ({projectId, targets}) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [data, setData] = React.useState(null);
    const [mode, setMode] = React.useState('FREE');
    const [assignments, setAssignments] = React.useState({});
    const available = isPlanetProjectRoute() && collaborationEnabled() && projectId && String(projectId) !== '0';

    const applyData = React.useCallback(next => {
        setData(next);
        setMode(next.mode || 'FREE');
        setAssignments(assignmentMap(next));
    }, []);

    const load = React.useCallback(async () => {
        if (!available) return;
        setLoading(true);
        setError('');
        try {
            applyData(await fetchPlanetCollaborationPermissions(projectId));
        } catch (requestError) {
            setError(requestError.message || '角色权限加载失败');
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

    const setMemberPermission = (targetId, userId, enabled) => {
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
                })) : []
            };
            applyData(await savePlanetCollaborationPermissions(projectId, payload));
        } catch (requestError) {
            setError(requestError.message || '角色权限保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (!available || !open) return null;
    const members = data ? data.members.filter(member => member.role !== 'OWNER') : [];
    const viewerUserId = data && String(data.viewerUserId || '');

    return ReactDOM.createPortal(
        <DraggablePanel onClose={() => setOpen(false)}>
            <div className={styles.body}>
                {loading && !data ? (
                    <div className={styles.loading}><LoaderCircleIcon aria-hidden="true" />{'正在加载权限'}</div>
                ) : null}
                {error ? <div className={styles.alert} role="alert">{error}</div> : null}
                {data ? (
                    <React.Fragment>
                        <div aria-label="协作权限模式" className={styles.modeGroup} role="radiogroup">
                            <button
                                aria-checked={mode === 'FREE'}
                                className={mode === 'FREE' ? styles.modeActive : ''}
                                disabled={!data.canManage}
                                role="radio"
                                type="button"
                                onClick={() => setMode('FREE')}
                            >
                                <UsersIcon aria-hidden="true" />
                                <span><strong>{'自由编辑'}</strong><small>{'成员可抢占空闲角色'}</small></span>
                            </button>
                            <button
                                aria-checked={mode === 'ASSIGNED'}
                                className={mode === 'ASSIGNED' ? styles.modeActive : ''}
                                disabled={!data.canManage}
                                role="radio"
                                type="button"
                                onClick={() => setMode('ASSIGNED')}
                            >
                                <ShieldCheckIcon aria-hidden="true" />
                                <span><strong>{'指定成员'}</strong><small>{'仅分配账户可编辑'}</small></span>
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
                                <span><strong>{'角色锁仍然生效'}</strong><small>{'同一时间每个角色或舞台只允许一人编辑。'}</small></span>
                            </div>
                        ) : (
                            <div className={styles.targetList}>
                                {targets.map(target => {
                                    const Icon = target.stage ? ImageIcon : CatIcon;
                                    const selected = assignments[target.targetId] || [];
                                    const viewerAssigned = selected.includes(viewerUserId);
                                    return (
                                        <section className={styles.targetCard} key={target.targetId}>
                                            <header className={styles.targetHeader}>
                                                <span className={styles.targetIcon}><Icon aria-hidden="true" /></span>
                                                <div>
                                                    <strong>{target.targetName}</strong>
                                                    <small>{target.stage ? '舞台' : '角色'}</small>
                                                </div>
                                                <span className={styles.count}>
                                                    {data.canManage ? `${selected.length} 人` :
                                                        (viewerAssigned ? '可编辑' : '只读')}
                                                </span>
                                            </header>
                                            <div className={styles.memberList}>
                                                {members.length ? members.map(member => {
                                                    const checked = selected.includes(String(member.id));
                                                    const visible = data.canManage ||
                                                        String(member.id) === viewerUserId;
                                                    if (!visible) return null;
                                                    return (
                                                        <div className={styles.memberRow} key={member.id}>
                                                            <Avatar member={member} />
                                                            <span className={styles.memberCopy}>
                                                                <strong>{member.nickname}</strong>
                                                                <small>{member.online ? '在线' : '离线'}</small>
                                                            </span>
                                                            <button
                                                                aria-checked={checked}
                                                                aria-label={
                                                                    `${member.nickname}${checked ?
                                                                        '可以' : '不可以'}编辑${target.targetName}`
                                                                }
                                                                className={styles.switch}
                                                                disabled={!data.canManage}
                                                                role="switch"
                                                                type="button"
                                                                onClick={() => setMemberPermission(
                                                                    target.targetId, String(member.id), !checked
                                                                )}
                                                            >
                                                                <span />
                                                            </button>
                                                        </div>
                                                    );
                                                }) : <div className={styles.empty}>{'还没有可分配的协作者'}</div>}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </React.Fragment>
                ) : null}
            </div>
            {data && data.canManage ? (
                <footer className={styles.footer}>
                    <span>{'保存后立即清理不符合新规则的角色锁'}</span>
                    <button className={styles.saveButton} disabled={saving} type="button" onClick={save}>
                        {saving ? <LoaderCircleIcon aria-hidden="true" /> : <SaveIcon aria-hidden="true" />}
                        {saving ? '保存中' : '保存权限'}
                    </button>
                </footer>
            ) : null}
        </DraggablePanel>,
        document.body
    );
};

PlanetCollaborationPermissions.propTypes = {
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targets: PropTypes.arrayOf(PropTypes.shape({
        stage: PropTypes.bool.isRequired,
        targetId: PropTypes.string.isRequired,
        targetName: PropTypes.string.isRequired
    })).isRequired
};

const mapStateToProps = state => {
    const targets = state.scratchGui.targets;
    const stage = targets.stage ? [{
        stage: true,
        targetId: 'stage',
        targetName: targets.stage.name || '舞台'
    }] : [];
    const sprites = Object.values(targets.sprites || {}).map(sprite => ({
        stage: false,
        targetId: `sprite:${sprite.name}`,
        targetName: sprite.name
    }));
    return {
        projectId: state.scratchGui.projectState.projectId,
        targets: [...stage, ...sprites]
    };
};

export default connect(mapStateToProps)(PlanetCollaborationPermissions);
