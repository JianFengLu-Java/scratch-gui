import classNames from 'classnames';
import {Maximize2Icon, Minimize2Icon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import FullscreenAPI from '../../lib/tw-fullscreen-api';
import styles from './editor-fullscreen-button.css';

const EditorFullscreenButton = ({className, labelClassName, onComplete}) => {
    const [active, setActive] = React.useState(FullscreenAPI.enabled);
    const [pending, setPending] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        const update = () => setActive(FullscreenAPI.enabled());
        document.addEventListener('fullscreenchange', update);
        document.addEventListener('webkitfullscreenchange', update);
        return () => {
            mounted.current = false;
            document.removeEventListener('fullscreenchange', update);
            document.removeEventListener('webkitfullscreenchange', update);
        };
    }, []);
    React.useEffect(() => {
        const timer = message ? setTimeout(() => setMessage(''), 6000) : null;
        return () => clearTimeout(timer);
    }, [message]);
    const handleClick = React.useCallback(async () => {
        setMessage('');
        if (!FullscreenAPI.available()) {
            setMessage('当前浏览器不支持网页全屏，可将编辑器添加到主屏幕后打开。');
            return;
        }
        setPending(true);
        try {
            // Call synchronously within the click's user activation.
            await (FullscreenAPI.enabled() ? FullscreenAPI.exit() : FullscreenAPI.request());
            if (mounted.current && onComplete) onComplete();
        } catch (error) {
            if (mounted.current) setMessage('未能进入全屏，请再次点击或检查浏览器的全屏权限。');
        } finally {
            if (mounted.current) setPending(false);
        }
    }, [onComplete]);
    const label = active ? '退出全屏' : '全屏编辑';
    const Icon = active ? Minimize2Icon : Maximize2Icon;
    return (
        <React.Fragment>
            <button
                aria-label={label}
                aria-pressed={active}
                className={classNames(styles.button, className)}
                disabled={pending}
                title={label}
                type="button"
                onClick={handleClick}
            >
                <Icon aria-hidden="true" />
                <span className={labelClassName}>{label}</span>
            </button>
            {message && <div
                className={styles.message}
                role="status"
            >{message}</div>}
        </React.Fragment>
    );
};

EditorFullscreenButton.propTypes = {
    className: PropTypes.string,
    labelClassName: PropTypes.string,
    onComplete: PropTypes.func
};

export default EditorFullscreenButton;
