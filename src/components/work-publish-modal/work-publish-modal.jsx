/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-max-props-per-line, max-len */
import PropTypes from 'prop-types';
import React from 'react';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import {
    loadWorkPublishOptions,
    publishCurrentProject,
    saveCurrentProjectDraft
} from '../../lib/planet-work-publisher.js';

import styles from './work-publish-modal.css';

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const DRAFT_FIELDS = [
    'name',
    'categoryId',
    'tagIds',
    'summary',
    'instructions',
    'visibility',
    'remixPermission',
    'versionType',
    'notifyFollowers',
    'copyrightAccepted'
];

const draftKey = projectId => `pp:work-publish-draft:${projectId || 'local-project'}`;

const readDraft = projectId => {
    try {
        return JSON.parse(localStorage.getItem(draftKey(projectId))) || null;
    } catch (error) {
        return null;
    }
};

const writeDraft = (projectId, state) => {
    const draft = {
        name: state.name,
        categoryId: state.categoryId,
        tagIds: state.tagIds,
        summary: state.summary,
        instructions: state.instructions,
        visibility: state.visibility,
        remixPermission: state.remixPermission,
        versionType: state.versionType,
        notifyFollowers: state.notifyFollowers,
        copyrightAccepted: state.copyrightAccepted
    };
    localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
};

class WorkPublishModal extends React.Component {
    constructor (props) {
        super(props);
        const draft = readDraft(props.projectId);
        this.state = {
            name: draft && draft.name ? draft.name : props.projectTitle,
            cover: null,
            coverPreview: '',
            coverSource: '',
            categoryId: draft ? draft.categoryId : '',
            tagIds: draft && Array.isArray(draft.tagIds) ? draft.tagIds : [],
            summary: draft ? draft.summary : '',
            instructions: draft ? draft.instructions : '',
            visibility: draft && draft.visibility ? draft.visibility : 'PUBLIC',
            remixPermission: draft && draft.remixPermission ? draft.remixPermission : 'DOWNLOAD_AND_REMIX',
            versionType: draft && draft.versionType ? draft.versionType : 'RELEASE',
            notifyFollowers: draft ? draft.notifyFollowers !== false : true,
            copyrightAccepted: draft ? draft.copyrightAccepted === true : false,
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
            savingDraft: false,
            generatingCover: false,
            exporting: false,
            submitted: false
        };
        this.mounted = false;
        this.coverInput = React.createRef();
        this.handleCoverChange = this.handleCoverChange.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleSaveDraft = this.handleSaveDraft.bind(this);
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
                // A local draft is a convenience only; publishing remains available.
            }
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
    }
    async loadOptions () {
        try {
            const context = await loadWorkPublishOptions();
            if (!this.mounted) return;
            this.setState(state => ({
                categories: context.categories || [],
                tags: context.tags || [],
                categoryId: state.categoryId || (context.categories[0] && context.categories[0].id) || '',
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
            notice: '已使用上传图片作为作品封面。'
        });
        event.target.value = '';
    }
    handleUseStage (automatic = false) {
        if (this.state.generatingCover) return;
        this.setState({
            generatingCover: true,
            error: '',
            notice: automatic ? '正在从当前舞台生成封面…' : '正在重新截取当前舞台…'
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
                    notice: '已使用当前舞台生成作品封面。'
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
    validate (forSubmission) {
        const name = this.state.name.trim();
        if (name.length < 2 || name.length > 40) return '作品名称需为 2–40 个字符。';
        if (!this.state.cover) return '请选择一张作品封面。';
        if (!this.state.categoryId) return '请选择作品分类。';
        if (this.state.summary.trim().length < 10 || this.state.summary.trim().length > 500) {
            return '作品介绍需为 10–500 个字符。';
        }
        if (this.state.instructions.length > 1000) return '操作说明不能超过 1000 个字符。';
        if (forSubmission && !this.state.copyrightAccepted) return '请确认版权承诺后再提交审核。';
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
            remixPermission: this.state.remixPermission,
            versionType: this.state.versionType,
            notifyFollowers: this.state.notifyFollowers,
            copyrightAccepted: this.state.copyrightAccepted
        };
    }
    async handleSubmit () {
        const error = this.validate(true);
        if (error) {
            this.setState({error, notice: ''});
            return;
        }
        this.props.onSaveProjectTitle(this.state.name.trim());
        this.setState({publishing: true, error: '', notice: '', progress: 2, progressLabel: '准备发布'});
        try {
            const result = await publishCurrentProject({
                coverFile: this.state.cover,
                form: this.formValue(),
                projectId: this.props.projectId,
                projectTitle: this.props.projectTitle,
                serializeProject: this.props.onSerializeProject,
                session: this.state.session,
                onProgress: (progressLabel, progress) => this.setState({progressLabel, progress})
            });
            localStorage.removeItem(draftKey(this.props.projectId));
            this.setState({
                publishing: false,
                submitted: true,
                notice: `作品已提交审核（作品编号 ${result.submission.id}）。`,
                progress: 100,
                progressLabel: '已进入审核队列'
            });
        } catch (publishError) {
            this.setState({
                publishing: false,
                error: `${publishError.message} 请修正后重试，已完成的上传不会影响当前编辑内容。`,
                notice: ''
            });
        }
    }
    async handleSaveDraft () {
        const error = this.validate(false);
        if (error) {
            this.setState({error, notice: ''});
            return;
        }
        this.props.onSaveProjectTitle(this.state.name.trim());
        this.setState({savingDraft: true, error: '', notice: '', progress: 2, progressLabel: '准备保存草稿'});
        try {
            const result = await saveCurrentProjectDraft({
                coverFile: this.state.cover,
                form: this.formValue(),
                projectId: this.props.projectId,
                projectTitle: this.props.projectTitle,
                serializeProject: this.props.onSerializeProject,
                session: this.state.session,
                onProgress: (progressLabel, progress) => this.setState({progressLabel, progress})
            });
            writeDraft(result.projectId, this.state);
            this.setState({
                savingDraft: false,
                notice: `云端草稿已保存（作品编号 ${result.work.id}），尚未提交审核。`,
                progress: 100,
                progressLabel: '云端草稿已保存'
            });
        } catch (saveError) {
            this.setState({
                savingDraft: false,
                error: `${saveError.message} 请修正后重试，当前编辑内容不会丢失。`,
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
    render () {
        const busy = this.state.publishing || this.state.savingDraft || this.state.exporting;
        const profileLabel = this.state.profile ?
            `${this.state.profile.nickname} · UID ${this.state.profile.uid}` : '正在确认登录账号';
        return (
            <Modal
                className={styles.modalContent}
                contentLabel="上传并提交作品"
                headerClassName={styles.modalHeader}
                id="workPublishModal"
                overlayClassName={styles.modalOverlay}
                onRequestClose={busy ? () => {} : this.props.onCancel}
            >
                <Box className={styles.body}>
                    <section className={styles.introRow}>
                        <div className={styles.introIcon} aria-hidden="true">↑</div>
                        <div className={styles.introCopy}>
                            <strong>上传当前项目并提交审核</strong>
                            <p>可先保存云端草稿；准备完成后再提交审核，审核通过才会出现在社区。</p>
                        </div>
                        <span className={styles.mockBadge}><i />发布服务</span>
                    </section>
                    <form className={styles.form} onSubmit={event => event.preventDefault()}>
                        <section className={`${styles.surfaceCard} ${styles.coverColumn}`}>
                            <div className={styles.sectionHeading}>
                                <span>作品封面</span>
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
                                        <b aria-hidden="true">{this.state.generatingCover ? '…' : '＋'}</b>
                                        <em>{this.state.generatingCover ? '正在生成舞台封面' : '添加作品封面'}</em>
                                        <small>使用当前舞台，或上传一张图片</small>
                                    </span>
                                )}
                            </button>
                            <div className={styles.coverActions}>
                                <button
                                    type="button"
                                    className={styles.stageCoverButton}
                                    disabled={busy || this.state.generatingCover}
                                    onClick={() => this.handleUseStage(false)}
                                >
                                    <span aria-hidden="true">▣</span>
                                    {this.state.coverSource === 'stage' ? '重新截取当前舞台' : '使用当前舞台'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.uploadCoverButton}
                                    disabled={busy || this.state.generatingCover}
                                    onClick={() => this.coverInput.current.click()}
                                >
                                    上传图片
                                </button>
                            </div>
                            <input
                                ref={this.coverInput}
                                className={styles.hiddenInput}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={busy}
                                onChange={this.handleCoverChange}
                            />
                            <div className={styles.accountSummary}>
                                <span>发布账号</span>
                                <strong>{profileLabel}</strong>
                            </div>
                        </section>
                        <section className={styles.fieldsColumn}>
                            <div className={styles.surfaceCard}>
                                <div className={styles.sectionHeading}>
                                    <span>基本信息</span>
                                    <small>名称、分类与标签</small>
                                </div>
                                <div className={styles.twoColumnGrid}>
                                    <label className={styles.field}>
                                        <span>作品名称</span>
                                        <input
                                            autoFocus
                                            disabled={busy}
                                            value={this.state.name}
                                            maxLength={40}
                                            placeholder="给作品起一个名字"
                                            onChange={event => this.setState({name: event.target.value, notice: ''})}
                                        />
                                    </label>
                                    <label className={styles.field}>
                                        <span>作品分类</span>
                                        <select
                                            disabled={busy || this.state.loadingOptions}
                                            value={this.state.categoryId}
                                            onChange={event => this.setState({categoryId: event.target.value, notice: ''})}
                                        >
                                            <option value="">请选择分类</option>
                                            {this.state.categories.map(category => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <fieldset className={styles.fieldset}>
                                    <legend>作品标签 <small>最多选择 5 个</small></legend>
                                    <div className={styles.choiceList} aria-busy={this.state.loadingOptions}>
                                        {this.state.tags.map(tag => {
                                            const active = this.state.tagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    disabled={busy}
                                                    aria-pressed={active}
                                                    className={active ? styles.choiceActive : styles.choice}
                                                    onClick={() => this.toggleTag(tag.id)}
                                                >
                                                    {active && <span aria-hidden="true">✓</span>}
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                        {!this.state.loadingOptions && this.state.tags.length === 0 && (
                                            <span className={styles.emptyOptions}>暂时没有可用标签</span>
                                        )}
                                    </div>
                                </fieldset>
                            </div>
                            <div className={styles.surfaceCard}>
                                <div className={styles.sectionHeading}>
                                    <span>作品说明</span>
                                    <small>让审核人员和学习者快速了解玩法</small>
                                </div>
                                <div className={styles.textareaGrid}>
                                    <label className={styles.field}>
                                        <span>作品介绍</span>
                                        <textarea
                                            disabled={busy}
                                            value={this.state.summary}
                                            maxLength={500}
                                            placeholder="介绍玩法、故事或创作灵感（10–500 字）"
                                            onChange={event => this.setState({summary: event.target.value, notice: ''})}
                                        />
                                        <small>{this.state.summary.length}/500</small>
                                    </label>
                                    <label className={styles.field}>
                                        <span>操作说明 <small>选填</small></span>
                                        <textarea
                                            disabled={busy}
                                            value={this.state.instructions}
                                            maxLength={1000}
                                            placeholder="例如：方向键移动，空格键跳跃"
                                            onChange={event => this.setState({instructions: event.target.value, notice: ''})}
                                        />
                                        <small>{this.state.instructions.length}/1000</small>
                                    </label>
                                </div>
                            </div>
                            <div className={styles.surfaceCard}>
                                <div className={styles.sectionHeading}>
                                    <span>发布设置</span>
                                    <small>可见范围、版本与源码权限</small>
                                </div>
                                <div className={styles.threeColumnGrid}>
                                    <label className={styles.field}>
                                        <span>可见范围</span>
                                        <select disabled={busy} value={this.state.visibility} onChange={event => this.setState({visibility: event.target.value})}>
                                            <option value="PUBLIC">公开</option>
                                            <option value="PRIVATE">私密</option>
                                        </select>
                                    </label>
                                    <label className={styles.field}>
                                        <span>版本类型</span>
                                        <select disabled={busy} value={this.state.versionType} onChange={event => this.setState({versionType: event.target.value})}>
                                            <option value="RELEASE">正式版</option>
                                            <option value="IMPROVED">改进版</option>
                                            <option value="BETA">测试版</option>
                                        </select>
                                    </label>
                                    <label className={styles.field}>
                                        <span>源码权限</span>
                                        <select disabled={busy} value={this.state.remixPermission} onChange={event => this.setState({remixPermission: event.target.value})}>
                                            <option value="DOWNLOAD_AND_REMIX">允许下载与改编</option>
                                            <option value="VIEW_SOURCE">仅查看源码</option>
                                            <option value="NO_REMIX">不开放源码</option>
                                        </select>
                                    </label>
                                </div>
                                <div className={styles.confirmations}>
                                    <label>
                                        <input type="checkbox" disabled={busy} checked={this.state.notifyFollowers} onChange={event => this.setState({notifyFollowers: event.target.checked})} />
                                        <span><b>审核通过后通知关注者</b><small>仅公开作品会发送站内通知</small></span>
                                    </label>
                                    <label>
                                        <input type="checkbox" disabled={busy} checked={this.state.copyrightAccepted} onChange={event => this.setState({copyrightAccepted: event.target.checked})} />
                                        <span><b>我确认拥有发布与授权该作品的权利</b><small>提交后将进入人工审核，版权承诺会随版本留存</small></span>
                                    </label>
                                </div>
                            </div>
                        </section>
                    </form>
                    {(this.state.publishing || this.state.progress > 0) && (
                        <section className={styles.progressPanel} aria-live="polite" aria-label="作品上传进度">
                            <div><strong>{this.state.progressLabel}</strong><span>{this.state.progress}%</span></div>
                            <progress max="100" value={this.state.progress}>{this.state.progress}%</progress>
                        </section>
                    )}
                    {this.state.error && <p className={styles.error} role="alert">{this.state.error}</p>}
                    {this.state.notice && <p className={styles.notice} aria-live="polite">{this.state.notice}</p>}
                    <footer className={styles.footer}>
                        <span>{busy ? '正在处理，请保持当前页面打开' : '保存草稿不会进入审核，也不会公开作品'}</span>
                        <div className={styles.footerActions}>
                            <button type="button" className={styles.saveButton} disabled={busy} onClick={this.handleExport}>
                                {this.state.exporting ? '正在导出…' : '导出本地备份'}
                            </button>
                            <button
                                type="button"
                                className={styles.draftButton}
                                disabled={busy || this.state.loadingOptions || this.state.submitted || this.state.generatingCover}
                                onClick={this.handleSaveDraft}
                            >
                                {this.state.savingDraft ? '正在保存草稿…' : '保存云端草稿'}
                            </button>
                            <button
                                type="button"
                                className={styles.exportButton}
                                disabled={busy || this.state.loadingOptions || this.state.submitted || this.state.generatingCover}
                                onClick={this.handleSubmit}
                            >
                                {this.state.publishing ? '正在上传并提交…' : this.state.submitted ? '已提交审核' : '上传并提交审核'}
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
    onExport: PropTypes.func.isRequired,
    onGenerateCover: PropTypes.func.isRequired,
    onSaveProjectTitle: PropTypes.func.isRequired,
    onSerializeProject: PropTypes.func.isRequired,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string
};

WorkPublishModal.defaultProps = {
    projectId: 'local-project',
    projectTitle: '未命名作品'
};

export default WorkPublishModal;
