import PropTypes from 'prop-types';
import React from 'react';

import styles from './addon-settings-modal.css';

const getSettingsUrl = addonId => {
    const path = process.env.ROUTING_STYLE === 'wildcard' ? 'addons' : 'addons.html';
    return `${process.env.ROOT}${path}${addonId ? `#${addonId}` : ''}`;
};

class AddonSettingsModal extends React.Component {
    constructor (props) {
        super(props);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBackdropClick = this.handleBackdropClick.bind(this);
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyDown);
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    handleKeyDown (event) {
        if (event.key === 'Escape') this.props.onClose();
    }
    handleBackdropClick (event) {
        if (event.target === event.currentTarget) this.props.onClose();
    }
    render () {
        const {addonId, onClose} = this.props;
        return (
            <div
                className={styles.backdrop}
                onMouseDown={this.handleBackdropClick}
                role="presentation"
            >
                <section
                    aria-label="插件设置"
                    aria-modal="true"
                    className={styles.modal}
                    role="dialog"
                >
                    <header className={styles.header}>
                        <h2>插件设置</h2>
                        <button aria-label="关闭插件设置" className={styles.close} onClick={onClose} type="button">×</button>
                    </header>
                    <iframe
                        className={styles.frame}
                        src={getSettingsUrl(addonId)}
                        title="TurboWarp 插件设置"
                    />
                </section>
            </div>
        );
    }
}

AddonSettingsModal.propTypes = {
    addonId: PropTypes.string,
    onClose: PropTypes.func.isRequired
};

export default AddonSettingsModal;
