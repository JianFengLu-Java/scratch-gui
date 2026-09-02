import PropTypes from 'prop-types';
import React from 'react';

import {loadPlanetMessageUi} from '../../lib/planet-message-ui';
import styles from './planet-project-chat.css';

class PlanetRichMessageComposer extends React.Component {
    constructor (props) {
        super(props);
        this.host = React.createRef();
        this.state = {error: '', loading: true};
        this.handleRetry = this.handleRetry.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        this.load();
    }
    componentDidUpdate () {
        if (this.composer) this.composer.update(this.composerProps());
    }
    componentWillUnmount () {
        this.mounted = false;
        if (this.composer) this.composer.unmount();
    }
    composerProps () {
        const {disabled, label, maxLength, onChange, onSubmit, placeholder, sendLabel, value} = this.props;
        return {disabled, label, maxLength, onChange, onSubmit, placeholder, sendLabel, value};
    }
    load () {
        loadPlanetMessageUi().then(runtime => {
            if (!this.mounted) return;
            this.composer = runtime.mountComposer(this.host.current, this.composerProps());
            this.setState({loading: false, error: ''});
        })
            .catch(error => {
                if (this.mounted) this.setState({loading: false, error: error.message});
            });
    }
    handleRetry () {
        this.setState({loading: true, error: ''});
        this.load();
    }
    render () {
        return (
            <div className={styles.richComposer}>
                <div ref={this.host} />
                {this.state.loading ? <span role="status">{'正在加载输入框…'}</span> : null}
                {this.state.error ? (
                    <div role="alert">
                        <span>{this.state.error}</span>
                        <button
                            type="button"
                            onClick={this.handleRetry}
                        >{'重试'}</button>
                    </div>
                ) : null}
            </div>
        );
    }
}

PlanetRichMessageComposer.propTypes = {
    disabled: PropTypes.bool,
    label: PropTypes.string.isRequired,
    maxLength: PropTypes.number,
    onChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    sendLabel: PropTypes.string,
    value: PropTypes.string.isRequired
};

export default PlanetRichMessageComposer;
