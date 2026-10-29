import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {Trash2Icon} from 'lucide-react';

import styles from './delete-button.css';
import deleteIcon from './icon--delete.svg';

const stopGesture = event => event.stopPropagation();

const DeleteButton = props => {
    const activate = React.useCallback(event => {
        event.stopPropagation();
        props.onClick(event);
    }, [props.onClick]);
    const handleKeyDown = React.useCallback(event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (event.repeat) event.stopPropagation();
        else activate(event);
    }, [activate]);
    return (
        <div
            aria-label="Delete"
            className={classNames(
                styles.deleteButton,
                props.className
            )}
            role="button"
            tabIndex={props.tabIndex}
            onClick={activate}
            onMouseDown={stopGesture}
            onTouchStart={stopGesture}
            onKeyDown={handleKeyDown}
        >
            <div className={styles.deleteButtonVisible}>
                <img
                    aria-hidden="true"
                    className={styles.deleteIcon}
                    src={deleteIcon}
                    draggable={false}
                />
                <Trash2Icon
                    aria-hidden="true"
                    className={styles.compactIcon}
                />
            </div>
        </div>

    );
};

DeleteButton.propTypes = {
    className: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    tabIndex: PropTypes.number
};

DeleteButton.defaultProps = {
    tabIndex: 0
};

export default DeleteButton;
