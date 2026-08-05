import React from 'react';
import styles from './workspace-placeholder.css';

class WorkspacePlaceholder extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: false, x: 72, y: 72};
        this.drag = null;
        this.startDrag = this.startDrag.bind(this);
        this.move = this.move.bind(this);
        this.stop = this.stop.bind(this);
    }
    componentDidMount () {
        window.addEventListener('mousemove', this.move);
        window.addEventListener('mouseup', this.stop);
    }
    componentWillUnmount () {
        window.removeEventListener('mousemove', this.move);
        window.removeEventListener('mouseup', this.stop);
    }
    startDrag (event) {
        if (event.button !== 0) return;
        this.drag = {offsetX: event.clientX - this.state.x, offsetY: event.clientY - this.state.y};
        event.preventDefault();
    }
    move (event) {
        if (!this.drag) return;
        this.setState({
            x: Math.max(8, Math.min(window.innerWidth - 340, event.clientX - this.drag.offsetX)),
            y: Math.max(52, Math.min(window.innerHeight - 210, event.clientY - this.drag.offsetY))
        });
    }
    stop () {
        this.drag = null;
    }
    render () {
        return <React.Fragment>
            <button className={styles.trigger} onClick={() => this.setState({open: true})} title="打开浮动窗">
                <span>▣</span><span className={styles.label}>浮窗</span>
            </button>
            {this.state.open && <section className={styles.window} style={{left: this.state.x, top: this.state.y}}>
                <header className={styles.header} onMouseDown={this.startDrag}>
                    <span>自定义组件</span>
                    <button onClick={() => this.setState({open: false})} aria-label="关闭浮动窗">×</button>
                </header>
                <main className={styles.body}>
                    <strong>组件预留区</strong>
                    <p>这里将用于承载你后续定义的页面或组件。</p>
                    <small>可拖动标题栏，拖拽右下角调整窗口大小。</small>
                </main>
            </section>}
        </React.Fragment>;
    }
}

export default WorkspacePlaceholder;
