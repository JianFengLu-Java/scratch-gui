import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import styles from './menu.css';

const getDirectMenuItems = menu => Array.from(menu.querySelectorAll('[role="menuitem"]'))
    .filter(item => item.closest('[role="menu"]') === menu);

const handleMenuKeyDown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = getDirectMenuItems(event.currentTarget);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    else nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex].focus();
};

const handleMenuItemKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const link = event.currentTarget.querySelector('a');
        if (link) link.click();
        else event.currentTarget.click();
    }
};

const MenuComponent = ({
    className = '',
    children,
    componentRef,
    place = 'right'
}) => (
    <ul
        className={classNames(
            styles.menu,
            className,
            {
                [styles.left]: place === 'left',
                [styles.right]: place === 'right'
            }
        )}
        onKeyDown={handleMenuKeyDown}
        ref={componentRef}
        role="menu"
    >
        {children}
    </ul>
);

MenuComponent.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    componentRef: PropTypes.func,
    place: PropTypes.oneOf(['left', 'right'])
};


const Submenu = ({children, className, place, ...props}) => (
    <div
        className={classNames(
            styles.submenu,
            className,
            {
                [styles.left]: place === 'left',
                [styles.right]: place === 'right'
            }
        )}
    >
        <MenuComponent
            place={place}
            {...props}
        >
            <MenuSection>{children}</MenuSection>
        </MenuComponent>
    </div>
);

Submenu.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    place: PropTypes.oneOf(['left', 'right'])
};

const MenuItem = ({
    children,
    className,
    expanded = false,
    icon: Icon,
    onClick
}) => (
    <li
        className={classNames(
            styles.menuItem,
            styles.hoverable,
            className,
            {[styles.expanded]: expanded}
        )}
        onClick={onClick}
        onKeyDown={handleMenuItemKeyDown}
        role="menuitem"
        tabIndex="-1"
    >
        {Icon ? <Icon data-icon="inline-start" /> : null}
        {children}
    </li>
);

MenuItem.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    expanded: PropTypes.bool,
    icon: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
    onClick: PropTypes.func
};

const MenuSection = ({children}) => (
    <li
        className={styles.menuSection}
        role="presentation"
    >
        <ul
            className={styles.menuGroup}
            role="group"
        >
            {children}
        </ul>
    </li>
);

MenuSection.propTypes = {
    children: PropTypes.node
};

export {
    MenuComponent as default,
    MenuItem,
    MenuSection,
    Submenu
};
