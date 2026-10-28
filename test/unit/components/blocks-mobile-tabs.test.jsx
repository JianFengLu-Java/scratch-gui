import React from 'react';
import {shallow} from 'enzyme';
import {Tab, TabList} from 'react-tabs';
import UncontrolledTabs from 'react-tabs/lib/components/UncontrolledTabs';

import Blocks from '../../../src/components/blocks/blocks';

// Supply DOM ancestry to the real react-tabs event handlers without mounting Blockly.
const element = (props, parent = null) => ({
    getAttribute: name => props[name] === undefined ? null : String(props[name]),
    parentNode: parent,
    parentElement: parent
});

describe('mobile palette tabs nested in the main editor tabs', () => {
    let wrapper;
    let outerTabs;
    let onActivateEditorTab;
    let onSelectPalette;
    let paletteList;
    let paletteButtons;

    beforeEach(() => {
        onActivateEditorTab = jest.fn();
        onSelectPalette = jest.fn();
        wrapper = shallow(<Blocks
            mobileLayout
            paletteExpanded
            onSelectPalette={onSelectPalette}
        />);
        outerTabs = new UncontrolledTabs({
            children: <TabList><Tab>代码</Tab><Tab>造型</Tab><Tab>声音</Tab></TabList>,
            onSelect: onActivateEditorTab,
            selectedIndex: 0
        });
        outerTabs.node = element({'data-tabs': true});
        paletteList = element(wrapper.find('[role="tablist"]').props(), outerTabs.node);
        paletteButtons = wrapper.find('button[role="tab"]').map(button => element(button.props(), paletteList));
        paletteList.children = paletteButtons;
        paletteList.querySelectorAll = () => paletteButtons;
    });

    afterEach(() => wrapper.unmount());

    test.each(['blocks', 'preview', 'sprites', 'stage'])(
        'clicking %s only changes the upper panel', panel => {
            const button = wrapper.find(`#mobile-blocks-tab-${panel}`);
            const target = paletteButtons.find(node => node.getAttribute('id') === button.prop('id'));
            button.simulate('click');
            // A text/icon click bubbles through the button to the main Tabs container.
            outerTabs.handleClick({target: element({}, target)});
            expect(onSelectPalette).toHaveBeenCalledWith(panel);
            expect(onActivateEditorTab).not.toHaveBeenCalled();
        }
    );

    test.each([['Enter', 13], [' ', 32]])('%s does not activate a main editor tab', (key, keyCode) => {
        const event = {
            key,
            keyCode,
            target: paletteButtons[2],
            currentTarget: paletteList,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        };
        wrapper.find('[role="tablist"]').simulate('keydown', event);
        outerTabs.handleKeyDown(event);
        expect(onActivateEditorTab).not.toHaveBeenCalled();
        // Let the native button generate its click for keyboard activation.
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('the main editor tabs still navigate normally', () => {
        const list = element({role: 'tablist'}, outerTabs.node);
        list.children = [0, 1, 2].map(() => element({role: 'tab'}, list));
        const event = {target: list.children[1]};
        outerTabs.handleClick(event);
        expect(onActivateEditorTab).toHaveBeenCalledWith(1, 0, event);
    });
});
