import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {
    assignmentHostControls, ASSIGNMENT_HOST_STATE_EVENT, getAssignmentHostState,
    requestAssignmentSave, requestAssignmentClose
} from '../../lib/planet-assignment-bridge';
import styles from './assignment-controls.css';

const AssignmentControls = ({readOnly}) => {
    const [state, setState] = useState(getAssignmentHostState);
    useEffect(() => {
        const update = () => setState(getAssignmentHostState());
        window.addEventListener(ASSIGNMENT_HOST_STATE_EVENT, update);
        update();
        return () => window.removeEventListener(ASSIGNMENT_HOST_STATE_EVENT, update);
    }, []);
    if (!assignmentHostControls) return null;
    return (
        <div className={styles.controls}>
            <span role="status">
                {readOnly ? '仅查看' : state.saving ? '正在上传并保存…' :
                    state.error ? '保存未完成' : state.saved ? '已保存到云端' : state.dirty ? '未保存' : ''}
            </span>
            {!readOnly && <button
                className={styles.save}
                disabled={!state.ready || state.saving}
                type="button"
                onClick={requestAssignmentSave}
            >{state.saving ? '保存中…' : state.saveLabel}</button>}
            <button disabled={state.saving} type="button" onClick={requestAssignmentClose}>关闭编辑器</button>
        </div>
    );
};
AssignmentControls.propTypes = {readOnly: PropTypes.bool};
export default AssignmentControls;
