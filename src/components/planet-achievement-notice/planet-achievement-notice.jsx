import React, {useCallback, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {ACHIEVEMENT_NOTICE} from '../../lib/planet-achievement-extension';
import styles from './planet-achievement-notice.css';

const PlanetAchievementNotice = ({vm}) => {
    const [message, setMessage] = useState('');
    useEffect(() => {
        let timer;
        const show = value => {
            clearTimeout(timer);
            setMessage(value);
            timer = setTimeout(() => setMessage(''), 5000);
        };
        vm.runtime.on(ACHIEVEMENT_NOTICE, show);
        return () => {
            clearTimeout(timer); vm.runtime.removeListener(ACHIEVEMENT_NOTICE, show);
        };
    }, [vm]);
    const dismiss = useCallback(() => setMessage(''), []);
    return message ? <div
        className={styles.notice}
        role="status"
    >
        <span>{message}</span>
        <button
            type="button"
            aria-label="关闭成就提示"
            onClick={dismiss}
        >{'×'}</button>
    </div> : null;
};
PlanetAchievementNotice.propTypes = {vm: PropTypes.object.isRequired};
export default PlanetAchievementNotice;
