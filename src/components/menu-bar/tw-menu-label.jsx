import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import classNames from 'classnames';

import styles from './menu-bar.css';

class MenuLabel extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClick',
            'handleKeyDown',
            'handleMouseUp',
            'menuRef'
        ]);
    }
    componentDidMount () {
        if (this.props.open) this.addListeners();
    }
    componentDidUpdate (prevProps) {
        if (this.props.open && !prevProps.open) {
            this.addListeners();
            if (this.openedFromKeyboard) {
                this.openedFromKeyboard = false;
                const firstItem = this.menuEl.querySelector('[role="menuitem"]');
                if (firstItem) firstItem.focus();
            }
        }
        if (!this.props.open && prevProps.open) this.removeListeners();
    }
    componentWillUnmount () {
        this.removeListeners();
    }
    addListeners () {
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    removeListeners () {
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    handleClick (e) {
        // this is a bit sketchy, but we want to allow clicking on the menu itself and the images
        // and text directly inside it, but not the items inside the menu, which are under the button
        // in the DOM.
        if (e.target.closest('div') === this.menuEl) {
            if (this.props.open) {
                this.props.onClose();
            } else {
                this.props.onOpen();
            }
        }
    }
    handleMouseUp (e) {
        if (this.props.open && !this.menuEl.contains(e.target)) {
            this.props.onClose();
        }
    }
    handleKeyDown (e) {
        if (e.key === 'Escape' && this.props.open) {
            e.preventDefault();
            this.props.onClose();
            this.menuEl.focus();
            return;
        }
        if (e.target !== this.menuEl) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            this.openedFromKeyboard = true;
            e.preventDefault();
            if (this.props.open) {
                const firstItem = this.menuEl.querySelector('[role="menuitem"]');
                if (firstItem) firstItem.focus();
            } else {
                this.props.onOpen();
            }
        }
    }
    menuRef (c) {
        this.menuEl = c;
    }
    render () {
        return (
            <div
                aria-expanded={this.props.open}
                aria-haspopup="menu"
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.props.open
                })}
                onClick={this.handleClick}
                onKeyDown={this.handleKeyDown}
                ref={this.menuRef}
                role="button"
                tabIndex="0"
            >
                {this.props.children}
            </div>
        );
    }
}

MenuLabel.propTypes = {
    children: PropTypes.node,
    open: PropTypes.bool,
    onOpen: PropTypes.func,
    onClose: PropTypes.func
};

export default MenuLabel;
