import React from 'react';

/* Higher Order Component to throttle updates to specific props.
 * Why? Because certain prop updates are expensive, and need to be throttled.
 * This allows renders when other properties change, and will use the last
 * rendered value of a prop for comparison.
 * @param {string} propName the name of the prop to throttle updates from.
 * @param {string} throttleTime the minimum time between updates to that specific property.
 * @returns {function} a function that accepts a component to wrap.
 */
const ThrottledPropertyHOC = function (propName, throttleTime) {
    /**
     * The function to be called with a React component to wrap it.
     * @param {React.Component} WrappedComponent - Component to wrap with throttler.
     * @returns {React.Component} the component wrapped with the throttler.
     */
    return function (WrappedComponent) {
        class ThrottledPropertyWrapper extends React.Component {
            shouldComponentUpdate (nextProps) {
                for (const property in nextProps) {
                    if (property !== propName && this.props[property] !== nextProps[property]) {
                        return true; // Always update if another property has changed
                    }
                }

                if (nextProps[propName] === this._lastRenderedValue) {
                    this.clearPendingUpdate();
                    return false;
                }

                const remainingTime = throttleTime - (Date.now() - this._lastRenderTime);
                if (remainingTime <= 0) {
                    return true;
                }

                // A final asset update must still render when no further updates arrive.
                if (!this._updateTimeout) {
                    this._updateTimeout = setTimeout(() => {
                        this._updateTimeout = null;
                        this.forceUpdate();
                    }, remainingTime);
                }

                return false;
            }
            componentDidUpdate () {
                this.clearPendingUpdate();
            }
            componentWillUnmount () {
                this.clearPendingUpdate();
            }
            clearPendingUpdate () {
                clearTimeout(this._updateTimeout);
                this._updateTimeout = null;
            }
            render () {
                this._lastRenderTime = Date.now();
                this._lastRenderedValue = this.props[propName];
                return (
                    <WrappedComponent {...this.props} />
                );
            }
        }

        return ThrottledPropertyWrapper;
    };
};

export default ThrottledPropertyHOC;
