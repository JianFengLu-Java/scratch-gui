/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-max-props-per-line, max-len */
import PropTypes from 'prop-types';
import React from 'react';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';

import styles from './work-publish-modal.css';

const MOCK_STORAGE_KEY = 'pp:mock-work-submissions';
const POPULAR_CATEGORIES = ['游戏', '动画', '互动故事', '艺术', '音乐', '工具', '教程'];
const MAX_COVER_SIZE = 5 * 1024 * 1024;

const readUser = () => {
    try {
        return JSON.parse(localStorage.getItem('pp-user')) || null;
    } catch (e) {
        return null;
    }
};

const readDraft = projectId => {
    try {
        const items = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY)) || [];
        return items.find(item => item.projectId === projectId) || null;
    } catch (e) {
        return null;
    }
};

const storeDraft = draft => {
    const stored = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY)) || [];
    const next = stored.filter(item => item.projectId !== draft.projectId);
    next.unshift(draft);
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(next.slice(0, 20)));
};

class WorkPublishModal extends React.Component {
    constructor (props) {
        super(props);
        const draft = readDraft(props.projectId);
        const currentUser = readUser();
        this.state = {
            name: draft ? draft.name : props.projectTitle,
            cover: null,
            coverPreview: '',
            coverName: draft && draft.cover ? draft.cover.name : '',
            categories: draft ? draft.categories : [],
            keywords: draft ? draft.keywords : [],
            keywordInput: '',
            summary: draft ? draft.summary : '',
            instructions: draft ? draft.instructions : '',
            includeSelf: draft ? draft.includeSelf : true,
            friendAccounts: draft ? draft.friendAccounts : [],
            friendInput: '',
            workshop: draft ? draft.workshop : '',
            error: '',
            notice: '',
            exporting: false,
            currentUser
        };
        this.coverInput = React.createRef();
        this.handleCoverChange = this.handleCoverChange.bind(this);
        this.handleSave = this.handleSave.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleKeywordKeyDown = this.handleKeywordKeyDown.bind(this);
        this.handleFriendKeyDown = this.handleFriendKeyDown.bind(this);
    }
    componentWillUnmount () {
        if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
    }
    handleCoverChange (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            this.setState({error: '封面仅支持 JPG、PNG 或 WebP。', notice: ''});
            return;
        }
        if (file.size > MAX_COVER_SIZE) {
            this.setState({error: '封面不能超过 5 MB。', notice: ''});
            return;
        }
        if (this.state.coverPreview) URL.revokeObjectURL(this.state.coverPreview);
        this.setState({
            cover: file,
            coverPreview: URL.createObjectURL(file),
            coverName: file.name,
            error: '',
            notice: ''
        });
    }
    toggleCategory (category) {
        this.setState(state => ({
            categories: state.categories.includes(category) ?
                state.categories.filter(item => item !== category) :
                state.categories.concat(category),
            notice: ''
        }));
    }
    addKeyword () {
        const keyword = this.state.keywordInput.trim().replace(/^#/, '');
        if (!keyword) return;
        if (keyword.length > 20) {
            this.setState({error: '单个关键词不能超过 20 个字符。'});
            return;
        }
        if (this.state.keywords.includes(keyword)) {
            this.setState({keywordInput: ''});
            return;
        }
        if (this.state.keywords.length >= 8) {
            this.setState({error: '最多添加 8 个自定义关键词。'});
            return;
        }
        this.setState(state => ({
            keywords: state.keywords.concat(keyword),
            keywordInput: '',
            error: '',
            notice: ''
        }));
    }
    handleKeywordKeyDown (event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            this.addKeyword();
        }
    }
    addFriend () {
        const account = this.state.friendInput.trim();
        if (!/^\d{5,18}$/.test(account)) {
            this.setState({error: '好友账号须为 5–18 位数字 UID。'});
            return;
        }
        if (this.state.friendAccounts.includes(account)) {
            this.setState({friendInput: ''});
            return;
        }
        this.setState(state => ({
            friendAccounts: state.friendAccounts.concat(account),
            friendInput: '',
            error: '',
            notice: ''
        }));
    }
    handleFriendKeyDown (event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            this.addFriend();
        }
    }
    validate (complete) {
        const name = this.state.name.trim();
        if (name.length < 2 || name.length > 40) return '作品名称需为 2–40 个字符。';
        if (!complete) return '';
        if (!this.state.cover && !this.state.coverName) return '请添加作品封面。';
        if (this.state.categories.length === 0) return '请至少选择一个热门分类。';
        if (this.state.summary.trim().length < 10 || this.state.summary.trim().length > 500) {
            return '作品介绍需为 10–500 个字符。';
        }
        if (this.state.instructions.length > 1000) return '操作说明不能超过 1000 个字符。';
        if (!this.state.includeSelf && this.state.friendAccounts.length === 0) return '请至少添加一位作者。';
        return '';
    }
    buildDraft (status) {
        const user = this.state.currentUser;
        return {
            mock: true,
            schemaVersion: 1,
            projectId: this.props.projectId || 'local-project',
            name: this.state.name.trim(),
            cover: this.state.cover ? {
                name: this.state.cover.name,
                type: this.state.cover.type,
                size: this.state.cover.size
            } : (this.state.coverName ? {name: this.state.coverName} : null),
            categories: this.state.categories,
            keywords: this.state.keywords,
            summary: this.state.summary.trim(),
            instructions: this.state.instructions.trim(),
            includeSelf: this.state.includeSelf,
            friendAccounts: this.state.friendAccounts,
            authors: [
                ...(this.state.includeSelf ? [{
                    type: 'SELF',
                    id: user && user.id,
                    account: user && user.uid,
                    nickname: user && user.nickname
                }] : []),
                ...this.state.friendAccounts.map(account => ({type: 'FRIEND', account}))
            ],
            workshop: this.state.workshop.trim(),
            status,
            updatedAt: new Date().toISOString()
        };
    }
    persist (status, complete) {
        const error = this.validate(complete);
        if (error) {
            this.setState({error, notice: ''});
            return null;
        }
        const draft = this.buildDraft(status);
        try {
            storeDraft(draft);
            this.props.onSaveProjectTitle(draft.name);
            return draft;
        } catch (e) {
            this.setState({error: '浏览器空间不足，暂时无法保存 mock 项目。', notice: ''});
            return null;
        }
    }
    handleSave () {
        if (!this.persist('DRAFT', false)) return;
        this.setState({error: '', notice: '项目资料已保存到本机（Mock）。'});
    }
    handleExport () {
        if (!this.persist('EXPORTED', true)) return;
        this.setState({exporting: true, error: '', notice: '正在导出 .sb3 作品文件…'});
        Promise.resolve(this.props.onExport())
            .then(() => {
                this.setState({exporting: false, notice: '作品已导出，Mock 资料也已保存。'});
            })
            .catch(() => {
                this.setState({exporting: false, error: '作品导出失败，请稍后再试。', notice: ''});
            });
    }
    render () {
        const selfLabel = this.state.currentUser ?
            `${this.state.currentUser.nickname}（${this.state.currentUser.uid}）` :
            '当前登录账号';
        return (
            <Modal
                className={styles.modalContent}
                contentLabel="上传作品"
                headerClassName={styles.modalHeader}
                id="workPublishModal"
                overlayClassName={styles.modalOverlay}
                onRequestClose={this.props.onCancel}
            >
                <Box className={styles.body}>
                    <section className={styles.introRow}>
                        <div className={styles.introIcon} aria-hidden="true">↗</div>
                        <div className={styles.introCopy}>
                            <strong>分享你的创作</strong>
                            <p>补充作品信息，保存项目或导出可以分享的 .sb3 文件。</p>
                        </div>
                        <span className={styles.mockBadge}><i />本机草稿</span>
                    </section>
                    <form className={styles.form} onSubmit={event => event.preventDefault()}>
                        <section className={`${styles.surfaceCard} ${styles.coverColumn}`}>
                            <div className={styles.sectionHeading}>
                                <span>作品封面</span>
                                <small>必填</small>
                            </div>
                            <button
                                className={styles.coverPicker}
                                type="button"
                                onClick={() => this.coverInput.current.click()}
                            >
                                {this.state.coverPreview ? (
                                    <img src={this.state.coverPreview} alt="作品封面预览" />
                                ) : (
                                    <span>
                                        <b>＋</b>
                                        <em>{this.state.coverName || '添加舞台封面'}</em>
                                        <small>JPG / PNG / WebP · 最大 5 MB</small>
                                    </span>
                                )}
                            </button>
                            <input
                                ref={this.coverInput}
                                className={styles.hiddenInput}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={this.handleCoverChange}
                            />
                            <label className={styles.field}>
                                <span>圈子 / 工作室 <small>选填</small></span>
                                <input
                                    value={this.state.workshop}
                                    maxLength={80}
                                    placeholder="输入圈子或工作室名称"
                                    onChange={event => this.setState({workshop: event.target.value, notice: ''})}
                                />
                            </label>
                        </section>
                        <section className={styles.fieldsColumn}>
                            <div className={styles.surfaceCard}>
                                <div className={styles.sectionHeading}>
                                    <span>基本信息</span>
                                    <small>名称与分类</small>
                                </div>
                                <label className={styles.field}>
                                    <span>作品名称</span>
                                    <input
                                        autoFocus
                                        value={this.state.name}
                                        maxLength={40}
                                        placeholder="给作品起一个名字"
                                        onChange={event => this.setState({name: event.target.value, notice: ''})}
                                    />
                                </label>
                                <fieldset className={styles.fieldset}>
                                    <legend>热门分类 <small>可多选</small></legend>
                                    <div className={styles.choiceList}>
                                        {POPULAR_CATEGORIES.map(category => {
                                            const active = this.state.categories.includes(category);
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    aria-pressed={active}
                                                    className={active ? styles.choiceActive : styles.choice}
                                                    onClick={() => this.toggleCategory(category)}
                                                >
                                                    {active && <span aria-hidden="true">✓</span>}
                                                    {category}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                                <label className={styles.field}>
                                    <span>自定义关键词 <small>按回车添加</small></span>
                                    <div className={styles.tokenInput}>
                                        {this.state.keywords.map(keyword => (
                                            <button
                                                key={keyword}
                                                type="button"
                                                title="移除关键词"
                                                onClick={() => this.setState(state => ({keywords: state.keywords.filter(item => item !== keyword)}))}
                                            >#{keyword} <span aria-hidden="true">×</span></button>
                                        ))}
                                        <input
                                            value={this.state.keywordInput}
                                            maxLength={20}
                                            placeholder={this.state.keywords.length ? '继续添加关键词' : '例如：双人、像素风'}
                                            onBlur={() => this.addKeyword()}
                                            onChange={event => this.setState({keywordInput: event.target.value})}
                                            onKeyDown={this.handleKeywordKeyDown}
                                        />
                                    </div>
                                </label>
                            </div>
                            <div className={styles.surfaceCard}>
                                <div className={styles.sectionHeading}>
                                    <span>作品说明</span>
                                    <small>让大家快速了解玩法</small>
                                </div>
                                <div className={styles.textareaGrid}>
                                    <label className={styles.field}>
                                        <span>作品介绍</span>
                                        <textarea
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
                                            value={this.state.instructions}
                                            maxLength={1000}
                                            placeholder="例如：方向键移动，空格键跳跃"
                                            onChange={event => this.setState({instructions: event.target.value, notice: ''})}
                                        />
                                        <small>{this.state.instructions.length}/1000</small>
                                    </label>
                                </div>
                            </div>
                            <section className={`${styles.surfaceCard} ${styles.fieldset}`}>
                                <div className={styles.sectionHeading}>
                                    <span>创作者</span>
                                    <small>自己或好友账号</small>
                                </div>
                                <label className={styles.selfAuthor}>
                                    <input
                                        type="checkbox"
                                        checked={this.state.includeSelf}
                                        onChange={event => this.setState({includeSelf: event.target.checked, notice: ''})}
                                    />
                                    <span><b>添加自己</b><small>{selfLabel}</small></span>
                                </label>
                                <div className={styles.authorInput}>
                                    {this.state.friendAccounts.map(account => (
                                        <button
                                            key={account}
                                            type="button"
                                            title="移除作者"
                                            onClick={() => this.setState(state => ({friendAccounts: state.friendAccounts.filter(item => item !== account)}))}
                                        >好友 {account} <span aria-hidden="true">×</span></button>
                                    ))}
                                    <input
                                        value={this.state.friendInput}
                                        inputMode="numeric"
                                        maxLength={18}
                                        placeholder="输入好友 UID，按回车添加"
                                        onChange={event => this.setState({friendInput: event.target.value})}
                                        onKeyDown={this.handleFriendKeyDown}
                                    />
                                </div>
                            </section>
                        </section>
                    </form>
                    {(this.state.error || this.state.notice) && (
                        <p className={this.state.error ? styles.error : styles.notice} role="status">
                            {this.state.error || this.state.notice}
                        </p>
                    )}
                    <footer className={styles.footer}>
                        <span><b>Mock 模式</b> · 项目信息仅保存在当前浏览器</span>
                        <div className={styles.footerActions}>
                            <button type="button" className={styles.saveButton} onClick={this.handleSave}>保存项目</button>
                            <button
                                type="button"
                                className={styles.exportButton}
                                disabled={this.state.exporting}
                                onClick={this.handleExport}
                            >
                                {this.state.exporting ? '正在导出…' : '导出作品'}
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
    onSaveProjectTitle: PropTypes.func.isRequired,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string
};

WorkPublishModal.defaultProps = {
    projectId: 'local-project',
    projectTitle: '未命名作品'
};

export default WorkPublishModal;
