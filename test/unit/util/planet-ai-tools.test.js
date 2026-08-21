import {
    buildAssistantEditorContext,
    compileAssistantToolXml,
    executeAssistantTool,
    installAssistantFloatingInterface
} from '../../../src/lib/planet-ai-tools';

const toolCall = {
    id: 'tc-1',
    name: 'blocks.create_script',
    arguments: {
        targetId: 'sprite-1',
        x: 120,
        y: 90,
        script: {
            event: {type: 'green_flag'},
            steps: [
                {type: 'move_steps', steps: 10},
                {type: 'say', message: '你好'}
            ]
        }
    }
};

const vm = () => {
    const target = {
        id: 'sprite-1',
        isOriginal: true,
        isStage: false,
        getName: () => '角色1',
        blocks: {
            getScripts: () => [],
            getBlock: jest.fn()
        }
    };
    return {
        editingTarget: target,
        runtime: {targets: [target]}
    };
};

describe('planet AI tools', () => {
    beforeEach(() => {
        global.window = {dispatchEvent: jest.fn()};
        global.document = {documentElement: {lang: 'zh-cn'}};
        global.CustomEvent = class CustomEvent {
            constructor (name, options) {
                this.name = name;
                this.detail = options.detail;
            }
        };
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.CustomEvent;
    });

    test('compiles next block after the complete shadow value', () => {
        const xml = compileAssistantToolXml(toolCall.arguments);

        expect(xml).toContain('<block x="120" y="90" type="event_whenflagclicked">');
        expect(xml).toContain('</shadow></value><next><block type="looks_say">');
        expect(xml).toContain('<field name="TEXT">你好</field>');
    });

    test('rejects motion blocks on the stage', () => {
        expect(() => compileAssistantToolXml(toolCall.arguments, true))
            .toThrow('舞台不能使用运动积木');
    });

    test('executes a confirmed script through ScratchBlocks XML', () => {
        const editorVm = vm();
        const workspace = {resizeContents: jest.fn()};
        window.ScratchBlocks = {
            getMainWorkspace: () => workspace,
            Xml: {
                textToDom: jest.fn(text => ({text})),
                domToWorkspace: jest.fn(() => ['created-block'])
            }
        };

        const result = executeAssistantTool(editorVm, toolCall);

        expect(result.status).toBe('SUCCEEDED');
        expect(result.createdTopBlockIds).toEqual(['created-block']);
        expect(window.ScratchBlocks.Xml.domToWorkspace).toHaveBeenCalled();
        expect(workspace.resizeContents).toHaveBeenCalled();
    });

    test('builds scoped context and exposes only floating-window controls', () => {
        const editorVm = vm();
        expect(buildAssistantEditorContext(editorVm)).toMatchObject({
            selectedTarget: {id: 'sprite-1', name: '角色1', isStage: false},
            capabilityBoundary: {
                tools: ['blocks.create_script'],
                writeScope: 'ADD_SCRIPT_TO_SELECTED_TARGET_ONLY',
                requiresConfirmation: true
            }
        });
        const uninstall = installAssistantFloatingInterface({
            open: jest.fn(),
            close: jest.fn(),
            toggle: jest.fn(),
            newConversation: jest.fn()
        });

        expect(Object.keys(window.PlanetAiAssistant).sort()).toEqual([
            'close', 'newConversation', 'open', 'toggle', 'version'
        ]);
        expect(Object.isFrozen(window.PlanetAiAssistant)).toBe(true);
        uninstall();
        expect(window.PlanetAiAssistant).toBeUndefined();
    });
});
