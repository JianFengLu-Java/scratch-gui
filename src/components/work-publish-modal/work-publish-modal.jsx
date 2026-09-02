/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-max-props-per-line, max-len */
import PropTypes from 'prop-types';
import React from 'react';
import {
    CheckIcon,
    FileDownIcon,
    ImageIcon,
    MonitorIcon,
    UploadCloudIcon,
    SparklesIcon,
    UploadIcon
} from 'lucide-react';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import {loadWorkPublishOptions, publishCurrentProject} from '../../lib/planet-work-publisher.js';

import styles from './work-publish-modal.css';

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const DRAFT_FIELDS = [
    'categoryId', 'tagIds', 'summary', 'instructions', 'visibility',
    'remixPolicy', 'versionType', 'changeLog', 'notifyFollowers'
];

const VISIBILITY_OPTIONS = [
    {value: 'PUBLIC', label: '公开', description: '审核通过后所有人可见'},
    {value: 'PRIVATE', label: '私密', description: '仅自己可以查看'}
];
const VERSION_OPTIONS = [
    {value: 'RELEASE', label: '正式版', description: '内容完整，可正式发布'},
    {value: 'IMPROVED', label: '改进版', description: '在原版本上继续完善'},
    {value: 'BETA', label: '测试版', description: '仍在测试与收集反馈'}
];
const REMIX_OPTIONS = [
    {value: 'OPEN', label: '开放改编', description: '其他用户确认条款后可直接创建改编'},
    {value: 'APPLICATION_REQUIRED', label: '申请后改编', description: '逐个审核并明确同意后才能改编'},
    {value: 'FORBIDDEN', label: '禁止改编', description: '当前作品不接受新的改编'}
];

const sourceAccessForPolicy = policy => ({
    OPEN: 'DOWNLOAD_AND_REMIX',
    APPLICATION_REQUIRED: 'VIEW_SOURCE',
    FORBIDDEN: 'NO_REMIX'
}[policy] || 'NO_REMIX');

const draftKey = projectId => `pp:work-publish-draft:${projectId || 'local-project'}`;

const readDraft = projectId => {
    try {
        return JSON.parse(localStorage.getItem(draftKey(projectId))) || null;
    } catch (error) {
        return null;
    }
};

const writeDraft = (projectId, state) => {
    const draft = {};
    DRAFT_FIELDS.forEach(field => {
        draft[field] = state[field];
    });
    localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
};

class WorkPublishModal extends React.Component {
    constructor (props) {
        super(props);
        const draft = readDraft(props.projectId);
        this.state = {
            name: props.projectTitle,
            cover: null,
            coverPreview: '',
            coverSource: '',
            categoryId: draft ? draft.categoryId : '',
            tagIds: draft && Array.isArray(draft.tagIds) ? draft.tagIds : [],
            summary: draft ? draft.summary : '',
            instructions: draft ? draft.instructions : '',
            visibility: draft && draft.visibility ? draft.visibility : 'PUBLIC',
            remixPolicy: draft && draft.remixPolicy ? draft.remixPolicy : 'FORBIDDEN',
            versionType: draft && draft.versionType ? draft.versionType : 'RELEASE',
            changeLog: draft && draft.changeLog ? draft.changeLog : '',
            notifyFollowers: draft ? draft.notifyFollowers !== false : true,
            copyrightAccepted: false,
            remixAuthorizationConfirmed: false,
            hasRecoveredDraft: Boolean(draft),
            publicationMode: 'CHECKING',
            latestReleaseNo: 0,
            existingWorkId: '',
            categories: [],
            tags: [],
            profile: null,
            session: null,
            loadingOptions: true,
            error: '',
            notice: '',
            progress: 0,
            progressLabel: '',
            publishing: false,
            generatingCover: false,
            exporting: false,
            submitted: false
        };
        this.mounted = false;
        this.coverInput = React.createRef();
        this.handleCoverChange = this.handleCoverChange.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleNameChange = this.handleNameChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleUseStage = this.handleUseStage.bind(this);
        this.loadOptions = this.loadOptions.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        this.loadOptions();
        this.handleUseStage(true);
    }
    componentDidUpdate (previousProps, previousState) {
        if (this.state.submitted) return;
        const changed = DRAFT_FIELDS.some(key => this.state[key] !== previousState[key]);
        if (changed) {
            try {
                writeDraft(this.props.projectId, this.state);
            } catch (error) {
                // Publishing form recovery is best effort; the project itself is cloud-saved separately.
            }
        }
        if (previousProps.projectId !== this.props.projectId) {
            localStorage.removeItem(draftKey(previousProps.projectId));
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
    }
    async loadOptions () {
        try {
            const context = await loadWorkPublishOptions(this.props.projectId);
            if (!this.mounted) return;
            this.setState(state => ({
                categories: context.categories || [],
                tags: context.tags || [],
                categoryId: state.hasRecoveredDraft ? state.categoryId :
                    (context.existingWork && context.existingWork.category && context.existingWork.category.id) ||
                    state.categoryId || (context.categories[0] && context.categories[0].id) || '',
                tagIds: state.hasRecoveredDraft ? state.tagIds :
                    ((context.existingWork && context.existingWork.tags) || []).map(tag => tag.id),
                name: context.existingWork ? context.existingWork.title : state.name,
                summary: state.hasRecoveredDraft ? state.summary :
                    (context.existingWork && context.existingWork.summary) || state.summary,
                instructions: state.hasRecoveredDraft ? state.instructions :
                    (context.existingWork && context.existingWork.instruction) || state.instructions,
                visibility: state.hasRecoveredDraft ? state.visibility :
                    (context.existingWork && context.existingWork.visibility) || state.visibility,
                remixPolicy: state.hasRecoveredDraft ? state.remixPolicy :
                    (context.existingWork && context.existingWork.remixPolicy) || state.remixPolicy,
                versionType: state.hasRecoveredDraft ? state.versionType :
                    (context.publicationMode === 'UPDATE' ? 'IMPROVED' : state.versionType),
                publicationMode: context.publicationMode,
                latestReleaseNo: context.latestReleaseNo,
                existingWorkId: context.existingWork ? context.existingWork.id : '',
                profile: context.profile,
                session: context.session,
                loadingOptions: false,
                error: ''
            }));
        } catch (error) {
            if (!this.mounted) return;
            this.setState({
                loadingOptions: false,
                error: error.status === 401 ?
                    '登录状态已失效，请返回首页重新登录后再发布。' :
                    `发布配置加载失败：${error.message}`
            });
        }
    }
    handleNameChange (event) {
        const name = event.target.value;
        this.setState({name, notice: ''});
        this.props.onChangeProjectTitle(name);
    }
    handleCoverChange (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            this.setState({error: '封面仅支持 JPG、PNG 或 WebP。', notice: ''});
            return;
        }
        if (file.size > MAX_COVER_SIZE) {
            this.setState({error: '封面不能超过 10 MB。', notice: ''});
            return;
        }
        if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
        this.setState({
            cover: file,
            coverPreview: URL.createObjectURL(file),
            coverSource: 'upload',
            error: '',
            notice: '已选择自定义作品封面。'
        });
        event.target.value = '';
    }
    handleUseStage (automatic = false) {
        if (this.state.generatingCover) return;
        this.setState({
            generatingCover: true,
            error: '',
            notice: automatic ? '正在准备舞台封面…' : '正在重新截取当前舞台…'
        });
        Promise.resolve(this.props.onGenerateCover(this.state.name.trim() || this.props.projectTitle))
            .then(file => {
                if (!this.mounted) return;
                if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
                this.setState({
                    cover: file,
                    coverPreview: URL.createObjectURL(file),
                    coverSource: 'stage',
                    generatingCover: false,
                    error: '',
                    notice: automatic ? '' : '已更新为当前舞台封面。'
                });
            })
            .catch(error => {
                if (!this.mounted) return;
                this.setState({
                    generatingCover: false,
                    error: error.message || '生成舞台封面失败，请重试或上传图片。',
                    notice: ''
                });
            });
    }
    toggleTag (tagId) {
        this.setState(state => {
            if (state.tagIds.includes(tagId)) {
                return {tagIds: state.tagIds.filter(id => id !== tagId), error: '', notice: ''};
            }
            if (state.tagIds.length >= 5) {
                return {error: '最多选择 5 个标签。', notice: ''};
            }
            return {tagIds: state.tagIds.concat(tagId), error: '', notice: ''};
        });
    }
    validate () {
        if (this.state.publicationMode === 'CHECKING') return '正在检查作品发布状态，请稍后重试。';
        const name = this.state.name.trim();
        if (name.length < 2 || name.length > 40) return '作品名称需为 2–40 个字符。';
        if (!this.state.cover) return '请先准备作品封面。';
        if (!this.state.categoryId) return '请选择作品分类。';
        if (this.state.summary.trim().length < 10 || this.state.summary.trim().length > 500) {
            return '作品介绍需为 10–500 个字符。';
        }
        if (this.state.instructions.length > 1000) return '操作说明不能超过 1000 个字符。';
        if (this.state.publicationMode === 'UPDATE' &&
            (this.state.changeLog.trim().length < 2 || this.state.changeLog.trim().length > 500)) {
            return '更新说明需为 2–500 个字符。';
        }
        if (this.state.publicationMode === 'FIRST' && this.state.remixPolicy !== 'FORBIDDEN' &&
            !this.state.remixAuthorizationConfirmed) {
            return '开放改编前，请完整阅读并确认改编授权。';
        }
        if (!this.state.copyrightAccepted) return '请确认版权承诺后再发布。';
        if (!this.state.session) return '发布会话尚未就绪，请稍后重试。';
        return '';
    }
    formValue () {
        return {
            name: this.state.name,
            categoryId: this.state.categoryId,
            tagIds: this.state.tagIds,
            summary: this.state.summary,
            instructions: this.state.instructions,
            visibility: this.state.visibility,
            remixPolicy: this.state.remixPolicy,
            sourceAccess: sourceAccessForPolicy(this.state.remixPolicy),
            remixAuthorizationConfirmed: this.state.publicationMode === 'UPDATE' ||
                this.state.remixPolicy === 'FORBIDDEN' || this.state.remixAuthorizationConfirmed,
            versionType: this.state.versionType,
            changeLog: this.state.changeLog.trim(),
            stageWidth: this.props.stageWidth,
            stageHeight: this.props.stageHeight,
            notifyFollowers: this.state.notifyFollowers,
            copyrightAccepted: this.state.copyrightAccepted
        };
    }
    async handleSubmit () {
        const error = this.validate();
        if (error) {
            this.setState({error, notice: ''});
            return;
        }
        const normalizedName = this.state.name.trim();
        this.props.onChangeProjectTitle(normalizedName);
        this.setState({
            publishing: true,
            error: '',
            notice: '',
            progress: 2,
            progressLabel: this.state.publicationMode === 'UPDATE' ? '准备更新版本' : '准备首次发布'
        });
        try {
            await this.props.onSaveProjectTitle(normalizedName);
            const result = await publishCurrentProject({
                coverFile: this.state.cover,
                form: this.formValue(),
                projectId: this.props.projectId,
                projectTitle: normalizedName,
                serializeProject: this.props.onSerializeProject,
                session: this.state.session,
                onProgress: (progressLabel, progress) => this.setState({progressLabel, progress})
            });
            localStorage.removeItem(draftKey(this.props.projectId));
            this.setState({
                publishing: false,
                submitted: true,
                notice: this.state.publicationMode === 'UPDATE' ?
                    `更新版本已提交审核（版本编号 ${result.submission.id}），当前公开版本不受影响。` :
                    `作品已提交首次发布审核（作品编号 ${result.submission.id}）。`,
                progress: 100,
                progressLabel: '已进入审核队列'
            });
        } catch (publishError) {
            this.setState({
                publishing: false,
                error: `${publishError.message} 当前创作草稿不会丢失。`,
                notice: ''
            });
        }
    }
    handleExport () {
        this.setState({exporting: true, error: '', notice: '正在导出本地备份…'});
        Promise.resolve(this.props.onExport())
            .then(() => this.setState({exporting: false, notice: '本地 .sb3 备份已导出。'}))
            .catch(() => this.setState({exporting: false, error: '作品导出失败，请稍后再试。', notice: ''}));
    }
    renderOptionGroup (name, value, options, locked = false) {
        const busy = this.state.publishing || this.state.exporting;
        return (
            <div className={styles.optionGroup} role="radiogroup" aria-label={name}>
                {options.map(option => {
                    const active = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={active ? styles.optionActive : styles.option}
                            disabled={busy || locked}
                            role="radio"
                            aria-checked={active}
                            onClick={() => this.setState({
                                [name]: option.value,
                                remixAuthorizationConfirmed: name === 'remixPolicy' ? false :
                                    this.state.remixAuthorizationConfirmed,
                                notice: ''
                            })}
                        >
                            <span className={styles.optionIndicator} aria-hidden="true">
                                {active && <CheckIcon />}
                            </span>
                            <span><b>{option.label}</b><small>{option.description}</small></span>
                        </button>
                    );
                })}
            </div>
        );
    }
    render () {
        const busy = this.state.publishing || this.state.exporting;
        const updating = this.state.publicationMode === 'UPDATE';
        const metadataLocked = busy || updating;
        const profileLabel = this.state.profile ?
            `${this.state.profile.nickname} · UID ${this.state.profile.uid}` : '正在确认登录账号';
        const dimensionLabel = `${this.props.stageWidth} × ${this.props.stageHeight}`;
        return (
            <Modal
                className={styles.modalContent}
                contentLabel={updating ? '发布更新版本' : '首次发布作品'}
                headerClassName={styles.modalHeader}
                id="workPublishModal"
                overlayClassName={styles.modalOverlay}
                onRequestClose={busy ? () => {} : this.props.onCancel}
            >
                <Box className={styles.body}>
                    <section
                        aria-live="polite"
                        className={updating ? styles.updateContext : styles.firstPublishContext}
                    >
                        <div>
                            <strong>{updating ? '更新已发布作品' : '首次发布作品'}</strong>
                            <span>{updating ?
                                `本次将创建不可变的 v${this.state.latestReleaseNo + 1}，审核期间旧版本继续公开运行。` :
                                '本次审核通过后会生成作品入口和首个不可变发布版本。'}</span>
                        </div>
                        <b>{updating ? '版本更新' : '首次发布'}</b>
                    </section>
                    <form className={styles.form} onSubmit={event => event.preventDefault()}>
                        <aside className={styles.coverPanel}>
                            <div className={styles.sectionHeader}>
                                <span><ImageIcon />作品封面</span>
                                <small>必填</small>
                            </div>
                            <button
                                aria-label={this.state.coverPreview ? '预览作品封面' : '选择作品封面'}
                                className={styles.coverPicker}
                                disabled={busy || this.state.generatingCover}
                                type="button"
                                onClick={() => !this.state.coverPreview && this.coverInput.current.click()}
                            >
                                {this.state.coverPreview ? (
                                    <img src={this.state.coverPreview} alt="待发布作品封面预览" />
                                ) : (
                                    <span>
                                        <ImageIcon aria-hidden="true" />
                                        <b>{this.state.generatingCover ? '正在生成封面' : '添加作品封面'}</b>
                                        <small>支持 JPG、PNG、WebP，最大 10 MB</small>
                                    </span>
                                )}
                            </button>
                            <div className={styles.coverActions}>
                                <button type="button" className={styles.secondaryButton} disabled={busy || this.state.generatingCover} onClick={() => this.handleUseStage(false)}>
                                    <MonitorIcon data-icon="inline-start" />
                                    {this.state.coverSource === 'stage' ? '重新截取' : '使用舞台'}
                                </button>
                                <button type="button" className={styles.secondaryButton} disabled={busy || this.state.generatingCover} onClick={() => this.coverInput.current.click()}>
                                    <UploadIcon data-icon="inline-start" />上传图片
                                </button>
                            </div>
                            <input ref={this.coverInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={this.handleCoverChange} />
                            <dl className={styles.metadataList}>
                                <div><dt>发布账号</dt><dd>{profileLabel}</dd></div>
                                <div><dt>作品尺寸</dt><dd>{dimensionLabel}</dd></div>
                                <div><dt>发布类型</dt><dd>{updating ?
                                    `更新为 v${this.state.latestReleaseNo + 1}` : '首次发布'}</dd></div>
                                <div><dt>草稿状态</dt><dd>创作中心自动保存</dd></div>
                            </dl>
                        </aside>

                        <main className={styles.formSections}>
                            <section className={styles.formSection}>
                                <div className={styles.sectionHeader}>
                                    <span><SparklesIcon />基本信息</span>
                                    <small>用于社区展示与检索</small>
                                </div>
                                <div className={styles.fieldList}>
                                    <label className={styles.fieldRow}>
                                        <span className={styles.fieldCopy}><b>作品名称</b><small>与编辑器 Header 和项目名称保持一致</small></span>
                                        <span className={styles.fieldControl}>
                                            <input autoFocus disabled={metadataLocked} value={this.state.name} maxLength={40} placeholder="给作品起一个名字" onChange={this.handleNameChange} />
                                            <small>{this.state.name.length}/40</small>
                                        </span>
                                    </label>
                                    <label className={styles.fieldRow}>
                                        <span className={styles.fieldCopy}><b>作品分类</b><small>选择最符合内容的分类</small></span>
                                        <span className={styles.fieldControl}>
                                            <select disabled={metadataLocked || this.state.loadingOptions} value={this.state.categoryId} onChange={event => this.setState({categoryId: event.target.value, notice: ''})}>
                                                <option value="">请选择分类</option>
                                                {this.state.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                            </select>
                                        </span>
                                    </label>
                                    <fieldset className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <legend className={styles.fieldCopy}><b>作品标签</b><small>最多选择 5 个，帮助别人发现作品</small></legend>
                                        <div className={styles.tagOptions} aria-busy={this.state.loadingOptions}>
                                            {this.state.tags.map(tag => {
                                                const active = this.state.tagIds.includes(tag.id);
                                                return (
                                                    <button key={tag.id} type="button" disabled={metadataLocked} aria-pressed={active} className={active ? styles.tagActive : styles.tag} onClick={() => this.toggleTag(tag.id)}>
                                                        {active && <CheckIcon />}{tag.name}
                                                    </button>
                                                );
                                            })}
                                            {!this.state.loadingOptions && this.state.tags.length === 0 && <span className={styles.emptyOptions}>暂时没有可用标签</span>}
                                        </div>
                                    </fieldset>
                                </div>
                            </section>

                            <section className={styles.formSection}>
                                <div className={styles.sectionHeader}>
                                    <span>作品说明</span>
                                    <small>简洁说明玩法和操作方式</small>
                                </div>
                                <div className={`${styles.fieldList} ${styles.descriptionGrid}`}>
                                    <label className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <span className={styles.fieldCopy}><b>作品介绍</b><small>10–500 个字符</small></span>
                                        <span className={styles.fieldControl}>
                                            <textarea disabled={metadataLocked} value={this.state.summary} maxLength={500} placeholder="介绍玩法、故事或创作灵感" onChange={event => this.setState({summary: event.target.value, notice: ''})} />
                                            <small>{this.state.summary.length}/500</small>
                                        </span>
                                    </label>
                                    <label className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <span className={styles.fieldCopy}><b>操作说明</b><small>选填，最多 1000 个字符</small></span>
                                        <span className={styles.fieldControl}>
                                            <textarea disabled={metadataLocked} value={this.state.instructions} maxLength={1000} placeholder="例如：方向键移动，空格键跳跃" onChange={event => this.setState({instructions: event.target.value, notice: ''})} />
                                            <small>{this.state.instructions.length}/1000</small>
                                        </span>
                                    </label>
                                </div>
                            </section>

                            <section className={styles.formSection}>
                                <div className={styles.sectionHeader}>
                                    <span>{updating ? '更新发布选项' : '首次发布选项'}</span>
                                    <small>{updating ? '填写本次版本说明并重新提交审核' : '选择可见范围、版本和改编策略'}</small>
                                </div>
                                <div className={styles.fieldList}>
                                    {updating && (
                                        <label className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                            <span className={styles.fieldCopy}><b>本次更新说明</b><small>2–500 个字符，会展示在版本历史中</small></span>
                                            <span className={styles.fieldControl}>
                                                <textarea disabled={busy} value={this.state.changeLog} maxLength={500} placeholder="例如：新增第二关，修复角色移动问题" onChange={event => this.setState({changeLog: event.target.value, notice: ''})} />
                                                <small>{this.state.changeLog.length}/500</small>
                                            </span>
                                        </label>
                                    )}
                                    <fieldset className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <legend className={styles.fieldCopy}><b>可见范围</b><small>决定审核通过后的访问范围</small></legend>
                                        {this.renderOptionGroup('visibility', this.state.visibility, VISIBILITY_OPTIONS, updating)}
                                    </fieldset>
                                    <fieldset className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <legend className={styles.fieldCopy}><b>版本类型</b><small>标记当前发布版本的完成度</small></legend>
                                        {this.renderOptionGroup('versionType', this.state.versionType, VERSION_OPTIONS)}
                                    </fieldset>
                                    <fieldset className={`${styles.fieldRow} ${styles.fieldRowStack}`}>
                                        <legend className={styles.fieldCopy}><b>改编策略</b><small>{updating ?
                                            '更新发布不改变当前授权；如需收回请在作品管理中调整' :
                                            '控制其他用户直接改编、申请改编或禁止改编'}</small></legend>
                                        {this.renderOptionGroup('remixPolicy', this.state.remixPolicy, REMIX_OPTIONS, updating)}
                                    </fieldset>
                                    {!updating && this.state.remixPolicy !== 'FORBIDDEN' && (
                                        <label className={styles.checkRow}>
                                            <input type="checkbox" disabled={busy} checked={this.state.remixAuthorizationConfirmed} onChange={event => this.setState({remixAuthorizationConfirmed: event.target.checked})} />
                                            <span><b>我已完整理解并确认开启改编授权</b><small>{this.state.remixPolicy === 'OPEN' ?
                                                '其他用户无需逐次申请即可复制当前公开版本；之后收回只影响新的改编。' :
                                                '只有我逐次审批并确认同意后，对方才能复制当前公开版本。'}</small></span>
                                        </label>
                                    )}
                                    <label className={styles.checkRow}>
                                        <input type="checkbox" disabled={busy} checked={this.state.notifyFollowers} onChange={event => this.setState({notifyFollowers: event.target.checked})} />
                                        <span><b>审核通过后通知关注者</b><small>仅公开作品会发送站内通知</small></span>
                                    </label>
                                    <label className={styles.checkRow}>
                                        <input type="checkbox" disabled={busy} checked={this.state.copyrightAccepted} onChange={event => this.setState({copyrightAccepted: event.target.checked})} />
                                        <span><b>我确认拥有发布与授权该作品的权利</b><small>版权承诺会随本次发布版本留存</small></span>
                                    </label>
                                </div>
                            </section>
                        </main>
                    </form>

                    {(this.state.publishing || this.state.progress > 0) && (
                        <section className={styles.progressPanel} aria-live="polite" aria-label="作品发布进度">
                            <div><strong>{this.state.progressLabel}</strong><span>{this.state.progress}%</span></div>
                            <progress max="100" value={this.state.progress}>{this.state.progress}%</progress>
                        </section>
                    )}
                    {this.state.error && <p className={styles.error} role="alert">{this.state.error}</p>}
                    {this.state.notice && <p className={styles.notice} aria-live="polite">{this.state.notice}</p>}

                    <footer className={styles.footer}>
                        <span>{busy ? '正在生成不可变发布版本，请保持页面打开' : updating ?
                            '更新审核期间，当前公开版本继续运行；审核通过后才切换。' :
                            '创作草稿会继续自动保存，不需要在此重复保存。'}</span>
                        <div className={styles.footerActions}>
                            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={this.handleExport}>
                                <FileDownIcon data-icon="inline-start" />
                                {this.state.exporting ? '正在导出…' : '导出备份'}
                            </button>
                            <button type="button" className={styles.primaryButton} disabled={busy || this.state.loadingOptions || this.state.submitted || this.state.generatingCover || this.state.publicationMode === 'CHECKING'} onClick={this.handleSubmit}>
                                <UploadCloudIcon data-icon="inline-start" />
                                {this.state.publishing ? (updating ? '正在提交更新…' : '正在发布…') :
                                    this.state.submitted ? '已提交审核' : updating ? '提交更新版本' : '首次发布作品'}
                            </button>
                        </div>
                    </footer>
                </Box>
            </Modal>
        );
    }
}

WorkPublishModal.propTypes = {
    onCancel: PropTypes.func.isRequired,
    onChangeProjectTitle: PropTypes.func.isRequired,
    onExport: PropTypes.func.isRequired,
    onGenerateCover: PropTypes.func.isRequired,
    onSaveProjectTitle: PropTypes.func.isRequired,
    onSerializeProject: PropTypes.func.isRequired,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string,
    stageHeight: PropTypes.number,
    stageWidth: PropTypes.number
};

WorkPublishModal.defaultProps = {
    projectId: 'local-project',
    projectTitle: '未命名作品',
    stageHeight: 360,
    stageWidth: 480
};

export default WorkPublishModal;
