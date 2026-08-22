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
        getCostumes: () => [{name: '造型1'}],
        getSounds: () => [{name: '喵'}],
        currentCostume: 0,
        x: 12,
        y: -8,
        direction: 90,
        size: 100,
        visible: true,
        variables: {
            score: {name: '得分', type: '', value: 3, isCloud: false}
        },
        blocks: {
            getScripts: () => [],
            getBlock: jest.fn()
        }
    };
    return {
        editingTarget: target,
        runtime: {targets: [target], stageWidth: 480, stageHeight: 360}
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
            version: 2,
            source: 'scratch-vm-live-on-send',
            selectedTarget: {id: 'sprite-1', name: '角色1', isStage: false, scriptCount: 0},
            stageSize: {width: 480, height: 360},
            targets: [{
                id: 'sprite-1',
                state: {x: 12, y: -8, currentCostume: '造型1'},
                variables: [{id: 'score', name: '得分', type: 'scalar', value: '3'}],
                costumes: ['造型1'],
                sounds: ['喵']
            }],
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

    test('captures live block relationships for workspace-aware advice', () => {
        const editorVm = vm();
        const blocks = {
            event: {
                id: 'event',
                opcode: 'event_whenflagclicked',
                fields: {},
                inputs: {},
                next: 'say'
            },
            say: {
                id: 'say',
                opcode: 'looks_say',
                fields: {},
                inputs: {MESSAGE: {block: 'message', shadow: 'message'}},
                next: null
            },
            message: {
                id: 'message',
                opcode: 'text',
                fields: {TEXT: {value: '你好', id: null}},
                inputs: {},
                next: null
            }
        };
        editorVm.editingTarget.blocks = {
            getScripts: () => ['event'],
            getBlock: id => blocks[id]
        };

        const context = buildAssistantEditorContext(editorVm);
        const scriptBlocks = context.targets[0].scripts[0].blocks;

        expect(context.selectedTarget.scriptCount).toBe(1);
        expect(scriptBlocks).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'event', next: 'say'}),
            expect.objectContaining({
                id: 'say',
                inputs: {MESSAGE: {block: 'message', shadow: 'message'}}
            }),
            expect.objectContaining({
                id: 'message',
                fields: {TEXT: {value: '你好', id: null}}
            })
        ]));
    });

    test('bounds a large workspace snapshot to the backend context limit', () => {
        const blocks = {};
        for (let index = 0; index < 300; index++) {
            blocks[`block-${index}`] = {
                id: `block-${index}`,
                opcode: 'looks_say',
                fields: {TEXT: {value: '很长的工作台内容'.repeat(40), id: null}},
                inputs: {},
                next: index < 299 ? `block-${index + 1}` : null
            };
        }
        const targets = Array.from({length: 45}, (_, targetIndex) => ({
            id: `sprite-${targetIndex}`,
            isOriginal: true,
            isStage: false,
            getName: () => `角色${targetIndex}`,
            getCostumes: () => Array.from({length: 50}, (unused, assetIndex) => ({
                name: `造型-${targetIndex}-${assetIndex}-${'长'.repeat(30)}`
            })),
            getSounds: () => [],
            currentCostume: 0,
            variables: Object.fromEntries(Array.from({length: 100}, (unused, variableIndex) => [
                `variable-${targetIndex}-${variableIndex}`,
                {name: `变量${variableIndex}`, type: '', value: '值'.repeat(240), isCloud: false}
            ])),
            blocks: {
                getScripts: () => ['block-0'],
                getBlock: id => blocks[id]
            }
        }));
        const editorVm = {
            editingTarget: targets[0],
            runtime: {targets, stageWidth: 480, stageHeight: 360}
        };

        const context = buildAssistantEditorContext(editorVm);
        const bytes = new TextEncoder().encode(JSON.stringify(context)).length;

        expect(bytes).toBeLessThan(65536);
        expect(context.targets).toHaveLength(40);
        expect(context.summary.truncated).toBe(true);
    });
});
