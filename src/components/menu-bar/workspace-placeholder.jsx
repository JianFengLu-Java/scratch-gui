/* eslint-disable react/jsx-no-bind, react/jsx-handler-names */
import React from 'react';
import {BookOpenIcon, XIcon} from 'lucide-react';
import styles from './workspace-placeholder.css';

class WorkspacePlaceholder extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: false, x: 72, y: 72, dragging: false};
        this.panel = React.createRef();
        this.trigger = React.createRef();
        this.move = this.move.bind(this);
        this.stop = this.stop.bind(this);
        this.clamp = this.clamp.bind(this);
        this.close = this.close.bind(this);
    }
    componentDidMount () {
        window.addEventListener('pointermove', this.move);
        window.addEventListener('pointerup', this.stop);
        window.addEventListener('pointercancel', this.stop);
        window.addEventListener('resize', this.clamp);
    }
    componentWillUnmount () {
        window.removeEventListener('pointermove', this.move);
        window.removeEventListener('pointerup', this.stop);
        window.removeEventListener('pointercancel', this.stop);
        window.removeEventListener('resize', this.clamp);
    }
    clamp (x = this.state.x, y = this.state.y) {
        const rect = this.panel.current && this.panel.current.getBoundingClientRect();
        this.setState({
            x: Math.max(8, Math.min(window.innerWidth - (rect ? rect.width : 480) - 8,
                typeof x === 'number' ? x : this.state.x)),
            y: Math.max(52, Math.min(window.innerHeight - (rect ? rect.height : 560) - 8, y))
        });
    }
    move (event) {
        if (this.drag) this.clamp(event.clientX - this.drag.x, event.clientY - this.drag.y);
    }
    stop () {
        this.drag = null;
        this.setState({dragging: false});
    }
    close () {
        this.stop();
        this.setState({open: false}, () => this.trigger.current.focus());
    }
    render () {
        return (<React.Fragment>
            <button
                ref={this.trigger}
                type="button"
                className={styles.trigger}
                aria-expanded={this.state.open}
                onClick={() => this.setState({open: !this.state.open}, this.clamp)}
                title="选课并在浮窗中观看"
            >
                <BookOpenIcon
                    size={16}
                    aria-hidden="true"
                /><span>{'课程'}</span>
            </button>
            {this.state.open && <section
                ref={this.panel}
                role="dialog"
                aria-label="课程学习浮窗"
                className={styles.window}
                style={{left: this.state.x, top: this.state.y}}
                onKeyDown={event => {
                    if (event.key === 'Escape') this.close();
                }}
            >
                <header className={styles.header}>
                    <button
                        type="button"
                        className={styles.dragHandle}
                        aria-label="移动课程窗口，使用方向键调整位置"
                        onPointerDown={event => {
                            if (event.button !== 0) return;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            this.drag = {x: event.clientX - this.state.x, y: event.clientY - this.state.y};
                            this.setState({dragging: true});
                        }}
                        onKeyDown={event => {
                            const offsets = {ArrowLeft: [-20, 0],
                                ArrowRight: [20, 0],
                                ArrowUp: [0, -20],
                                ArrowDown: [0, 20]};
                            const offset = offsets[event.key];
                            if (offset) {
                                event.preventDefault(); this.clamp(this.state.x + offset[0], this.state.y + offset[1]);
                            }
                        }}
                    >
                        <BookOpenIcon
                            size={16}
                            aria-hidden="true"
                        />
                        {'课程学习'}<span>{'拖动 · 边看边练'}</span>
                    </button>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={this.close}
                        aria-label="关闭课程窗口并停止播放"
                    ><XIcon size={18} /></button>
                </header>
                <iframe
                    className={styles.body}
                    style={{pointerEvents: this.state.dragging ? 'none' : 'auto'}}
                    src="/editor-courses"
                    title="选课与课程播放器"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                />
            </section>}
        </React.Fragment>);
    }
}

export default WorkspacePlaceholder;
