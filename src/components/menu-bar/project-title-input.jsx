/* eslint-disable react/jsx-no-bind */
import classNames from 'classnames';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, intlShape, injectIntl} from 'react-intl';
import {setProjectTitle} from '../../reducers/project-title';
import {emitPlanetAutosaveStatus} from '../../lib/planet-cloud-autosave';
import {isPlanetProjectRoute, savePlanetProjectName} from '../../lib/planet-project-loader';

import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import Input from '../forms/input.jsx';
const BufferedInput = BufferedInputHOC(Input);

import styles from './project-title-input.css';

const messages = defineMessages({
    projectTitlePlaceholder: {
        id: 'gui.gui.projectTitlePlaceholder',
        description: 'Placeholder for project title when blank',
        defaultMessage: 'Project title here'
    }
});

const ProjectTitleInput = ({
    className,
    intl,
    onSubmit,
    projectId,
    projectTitle
}) => {
    const handleSubmit = title => {
        onSubmit(title);
        if (!isPlanetProjectRoute()) return;
        emitPlanetAutosaveStatus({status: 'saving'});
        savePlanetProjectName(projectId, title)
            .then(() => emitPlanetAutosaveStatus({status: 'saved', savedAt: new Date().toISOString()}))
            .catch(error => emitPlanetAutosaveStatus({status: 'error', message: error.message}));
    };
    return (
        <BufferedInput
            className={classNames(styles.titleField, className)}
            maxLength="40"
            placeholder={intl.formatMessage(messages.projectTitlePlaceholder)}
            tabIndex="0"
            type="text"
            value={projectTitle}
            onSubmit={handleSubmit}
        />
    );
};

ProjectTitleInput.propTypes = {
    className: PropTypes.string,
    intl: intlShape.isRequired,
    onSubmit: PropTypes.func,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    projectTitle: PropTypes.string
};

const mapStateToProps = state => ({
    projectId: state.scratchGui.projectState.projectId,
    projectTitle: state.scratchGui.projectTitle
});

const mapDispatchToProps = dispatch => ({
    onSubmit: title => dispatch(setProjectTitle(title))
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(ProjectTitleInput));
