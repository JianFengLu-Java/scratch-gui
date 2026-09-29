import React from 'react';
import {shallow} from 'enzyme';
import VM from 'scratch-vm';

import PlanetAiAssistant from '../../../src/components/planet-ai-assistant/planet-ai-assistant';
import DockPanel from '../../../src/components/editor-dock/dock-panel';

jest.mock('scratch-vm', () => function VM () {});
jest.mock('../../../src/lib/planet-ai-assistant-api', () => ({
    createAssistantConversation: jest.fn(),
    listAssistantConversations: jest.fn(),
    loadAssistantMessages: jest.fn(),
    sendAssistantMessage: jest.fn(),
    submitAssistantToolResults: jest.fn()
}));
jest.mock('../../../src/lib/planet-ai-tools', () => ({
    buildAssistantEditorContext: jest.fn(() => ({})),
    executeAssistantTool: jest.fn(),
    installAssistantFloatingInterface: jest.fn(() => jest.fn()),
    previewAssistantTool: jest.fn(() => ({
        title: '添加移动脚本',
        description: '为当前角色添加一组积木。'
    }))
}));

describe('PlanetAiAssistant workspace', () => {
    let wrapper;

    beforeEach(() => {
        global.location = {pathname: '/'};
        wrapper = shallow(<PlanetAiAssistant vm={new VM()} />, {disableLifecycleMethods: true});
        wrapper.setState({open: true});
    });

    afterEach(() => {
        wrapper.unmount();
        delete global.location;
    });

    test('uses the shared conversation shell and lets starter prompts seed the composer', () => {
        expect(wrapper.find(DockPanel).prop('appearance')).toBe('conversation');
        const starter = wrapper.find('[aria-label="示例问题"] button').first();
        const prompt = starter.find('span').first().text();
        starter.simulate('click');
        expect(wrapper.state('input')).toBe(prompt);
    });

    test('renders a compact thinking state while a turn is running', () => {
        wrapper.setState({sending: true});
        const status = wrapper.find('[role="status"]');
        expect(status.text()).toContain('正在构思');
        expect(status.find('i')).toHaveLength(9);
    });
});
