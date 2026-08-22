const TOOL_NAME = 'blocks.create_script';
const MAX_STEPS = 60;
const MAX_DEPTH = 4;
const MAX_CONTEXT_BLOCKS = 240;
const MAX_CONTEXT_BLOCK_BYTES = 30 * 1024;
const MAX_CONTEXT_VARIABLE_BYTES = 8 * 1024;
const MAX_CONTEXT_ASSET_BYTES = 6 * 1024;
const MAX_CONTEXT_TARGETS = 40;
const MAX_CONTEXT_SCRIPTS_PER_TARGET = 40;
const MAX_CONTEXT_VARIABLES_PER_TARGET = 80;
const MAX_CONTEXT_ASSETS_PER_TARGET = 40;
const MOTION_STEPS = new Set([
    'move_steps', 'turn_right', 'turn_left', 'go_to_xy', 'change_x', 'change_y',
    'set_x', 'set_y', 'if_on_edge_bounce'
]);
const SUPPORTED_STEPS = new Set([
    ...MOTION_STEPS, 'say', 'say_for_seconds', 'wait', 'show', 'hide', 'repeat', 'forever'
]);

const number = (value, fallback = 0) => {
    const result = Number(value);
    if (!Number.isFinite(result) || Math.abs(result) > 1000000) return fallback;
    return result;
};

const xmlEscape = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const valueBlock = (name, type, field, value) => (
    `<value name="${name}"><shadow type="${type}"><field name="${field}">` +
    `${xmlEscape(value)}</field></shadow></value>`
);

const numberValue = (name, value) => valueBlock(name, 'math_number', 'NUM', number(value));
const textValue = (name, value) => valueBlock(name, 'text', 'TEXT', String(value || '').slice(0, 200));

const stepBlock = (step, childXml) => {
    switch (step.type) {
    case 'move_steps':
        return `<block type="motion_movesteps">${numberValue('STEPS', step.steps)}</block>`;
    case 'turn_right':
        return `<block type="motion_turnright">${numberValue('DEGREES', step.degrees)}</block>`;
    case 'turn_left':
        return `<block type="motion_turnleft">${numberValue('DEGREES', step.degrees)}</block>`;
    case 'go_to_xy':
        return `<block type="motion_gotoxy">${numberValue('X', step.x)}${numberValue('Y', step.y)}</block>`;
    case 'change_x':
        return `<block type="motion_changexby">${numberValue('DX', step.value)}</block>`;
    case 'change_y':
        return `<block type="motion_changeyby">${numberValue('DY', step.value)}</block>`;
    case 'set_x':
        return `<block type="motion_setx">${numberValue('X', step.value)}</block>`;
    case 'set_y':
        return `<block type="motion_sety">${numberValue('Y', step.value)}</block>`;
    case 'if_on_edge_bounce':
        return '<block type="motion_ifonedgebounce"></block>';
    case 'say':
        return `<block type="looks_say">${textValue('MESSAGE', step.message)}</block>`;
    case 'say_for_seconds':
        return `<block type="looks_sayforsecs">${textValue('MESSAGE', step.message)}` +
            `${numberValue('SECS', step.seconds)}</block>`;
    case 'wait':
        return `<block type="control_wait">${numberValue('DURATION', step.seconds)}</block>`;
    case 'show':
        return '<block type="looks_show"></block>';
    case 'hide':
        return '<block type="looks_hide"></block>';
    case 'repeat':
        return `<block type="control_repeat">${numberValue('TIMES', step.times)}` +
            `<statement name="SUBSTACK">${childXml}</statement></block>`;
    case 'forever':
        return `<block type="control_forever"><statement name="SUBSTACK">${childXml}` +
            '</statement></block>';
    default:
        throw new Error(`暂不支持步骤：${step.type}`);
    }
};

const validateSteps = (steps, depth, counter, isStage) => {
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('脚本步骤不能为空');
    if (depth > MAX_DEPTH) throw new Error(`循环最多嵌套 ${MAX_DEPTH} 层`);
    steps.forEach((step, index) => {
        if (!step || typeof step.type !== 'string') throw new Error('步骤格式不正确');
        if (!SUPPORTED_STEPS.has(step.type)) throw new Error(`暂不支持步骤：${step.type}`);
        if (isStage && MOTION_STEPS.has(step.type)) throw new Error('舞台不能使用运动积木');
        counter.count++;
        if (counter.count > MAX_STEPS) throw new Error(`一次最多创建 ${MAX_STEPS} 个步骤`);
        if (step.type === 'repeat' || step.type === 'forever') {
            if (step.type === 'forever' && index !== steps.length - 1) {
                throw new Error('无限循环必须是当前脚本的最后一步');
            }
            validateSteps(step.steps, depth + 1, counter, isStage);
        }
    });
};

const chainXml = steps => {
    let xml = '';
    for (let index = steps.length - 1; index >= 0; index--) {
        const step = steps[index];
        const children = step.type === 'repeat' || step.type === 'forever' ? chainXml(step.steps) : '';
        const current = stepBlock(step, children);
        if (xml) {
            const closingBlock = current.lastIndexOf('</block>');
            xml = `${current.slice(0, closingBlock)}<next>${xml}</next>${current.slice(closingBlock)}`;
        } else {
            xml = current;
        }
    }
    return xml;
};

const eventXml = (event, isStage) => {
    switch (event.type) {
    case 'green_flag':
        return '<block type="event_whenflagclicked">';
    case 'sprite_clicked':
        return isStage ? '<block type="event_whenstageclicked">' :
            '<block type="event_whenthisspriteclicked">';
    case 'key_pressed':
        return `<block type="event_whenkeypressed"><field name="KEY_OPTION">` +
            `${xmlEscape(event.key || 'space')}</field>`;
    default:
        throw new Error('暂不支持这个事件');
    }
};

export const compileAssistantToolXml = (argumentsValue, isStage = false) => {
    const script = argumentsValue.script;
    if (!script || !script.event) throw new Error('Tool 参数不完整');
    validateSteps(script.steps, 0, {count: 0}, isStage);
    const x = Math.round(number(argumentsValue.x, 80));
    const y = Math.round(number(argumentsValue.y, 80));
    const event = eventXml(script.event, isStage)
        .replace('<block ', `<block x="${x}" y="${y}" `);
    return `<xml xmlns="http://www.w3.org/1999/xhtml">${event}` +
        `<next>${chainXml(script.steps)}</next></block></xml>`;
};

const stepLabel = step => {
    switch (step.type) {
    case 'move_steps': return `移动 ${number(step.steps)} 步`;
    case 'turn_right': return `右转 ${number(step.degrees)} 度`;
    case 'turn_left': return `左转 ${number(step.degrees)} 度`;
    case 'go_to_xy': return `移到 x:${number(step.x)} y:${number(step.y)}`;
    case 'change_x': return `x 增加 ${number(step.value)}`;
    case 'change_y': return `y 增加 ${number(step.value)}`;
    case 'set_x': return `将 x 设为 ${number(step.value)}`;
    case 'set_y': return `将 y 设为 ${number(step.value)}`;
    case 'if_on_edge_bounce': return '碰到边缘就反弹';
    case 'say': return `说“${String(step.message || '').slice(0, 30)}”`;
    case 'say_for_seconds': return `说“${String(step.message || '').slice(0, 30)}” ${number(step.seconds)} 秒`;
    case 'wait': return `等待 ${number(step.seconds)} 秒`;
    case 'show': return '显示';
    case 'hide': return '隐藏';
    case 'repeat': return `重复 ${number(step.times)} 次（${step.steps.map(stepLabel).join('、')}）`;
    case 'forever': return `重复执行（${step.steps.map(stepLabel).join('、')}）`;
    default: return step.type;
    }
};

const eventLabel = event => {
    if (event.type === 'green_flag') return '当绿旗被点击';
    if (event.type === 'sprite_clicked') return '当角色被点击';
    return `当按下 ${event.key || 'space'} 键`;
};

const compactValue = value => {
    if (Array.isArray(value)) {
        return {
            length: value.length,
            preview: value.slice(0, 12).map(item => String(item).slice(0, 120))
        };
    }
    if (value === null || typeof value === 'undefined') return '';
    return String(value).slice(0, 240);
};

const jsonByteLength = value => {
    const json = JSON.stringify(value);
    if (typeof TextEncoder === 'undefined') return json.length * 3;
    return new TextEncoder().encode(json).length;
};

const collectBlockGraph = (blocks, id, seen, output, budget) => {
    if (!id || seen.has(id) || budget.remaining <= 0 || budget.bytes <= 0) {
        if (id && !seen.has(id)) budget.truncated = true;
        return;
    }
    const block = blocks.getBlock(id);
    if (!block) return;
    const snapshot = {
        id: block.id,
        opcode: block.opcode,
        fields: Object.keys(block.fields || {}).reduce((result, key) => {
            const field = block.fields[key] || {};
            result[key] = {
                value: compactValue(field.value),
                id: field.id || null
            };
            return result;
        }, {}),
        inputs: Object.keys(block.inputs || {}).reduce((result, key) => {
            const input = block.inputs[key] || {};
            result[key] = {
                block: input.block || null,
                shadow: input.shadow || null
            };
            return result;
        }, {}),
        next: block.next || null
    };
    const snapshotBytes = jsonByteLength(snapshot);
    if (snapshotBytes > budget.bytes) {
        budget.truncated = true;
        return;
    }
    seen.add(id);
    budget.remaining--;
    budget.bytes -= snapshotBytes;
    output.push(snapshot);
    Object.keys(block.inputs || {}).forEach(key => collectBlockGraph(
        blocks,
        block.inputs[key].block,
        seen,
        output,
        budget
    ));
    collectBlockGraph(blocks, block.next, seen, output, budget);
};

const targetVariables = (target, budget) => {
    const ids = Object.keys(target.variables || {});
    const output = [];
    ids.slice(0, MAX_CONTEXT_VARIABLES_PER_TARGET).some(id => {
        const variable = target.variables[id];
        const snapshot = {
            id,
            name: variable.name,
            type: variable.type || 'scalar',
            value: compactValue(variable.value),
            isCloud: Boolean(variable.isCloud)
        };
        const snapshotBytes = jsonByteLength(snapshot);
        if (snapshotBytes > budget.bytes) {
            budget.truncated = true;
            return true;
        }
        budget.bytes -= snapshotBytes;
        output.push(snapshot);
        return false;
    });
    if (ids.length > output.length) budget.truncated = true;
    return output;
};

const targetAssets = (target, getter, budget) => {
    if (typeof target[getter] !== 'function') return [];
    const assets = target[getter]();
    const output = [];
    assets.slice(0, MAX_CONTEXT_ASSETS_PER_TARGET).some(asset => {
        const name = String(asset.name || '').slice(0, 120);
        const nameBytes = jsonByteLength(name);
        if (nameBytes > budget.bytes) {
            budget.truncated = true;
            return true;
        }
        budget.bytes -= nameBytes;
        output.push(name);
        return false;
    });
    if (assets.length > output.length) budget.truncated = true;
    return output;
};

const targetState = target => {
    const costumes = typeof target.getCostumes === 'function' ? target.getCostumes() : [];
    const currentCostume = costumes[target.currentCostume] ? costumes[target.currentCostume].name : null;
    if (target.isStage) {
        return {
            currentBackdrop: currentCostume,
            volume: number(target.volume, 100)
        };
    }
    return {
        x: number(target.x),
        y: number(target.y),
        direction: number(target.direction, 90),
        size: number(target.size, 100),
        visible: target.visible !== false,
        draggable: Boolean(target.draggable),
        rotationStyle: target.rotationStyle || 'all around',
        currentCostume,
        volume: number(target.volume, 100)
    };
};

const targetScripts = (target, budget) => {
    const topBlockIds = target.blocks.getScripts();
    const scripts = [];
    topBlockIds.slice(0, MAX_CONTEXT_SCRIPTS_PER_TARGET).forEach(topBlockId => {
        const blocks = [];
        collectBlockGraph(target.blocks, topBlockId, new Set(), blocks, budget);
        if (blocks.length) scripts.push({topBlockId, blocks});
    });
    return {
        scripts,
        scriptCount: topBlockIds.length,
        scriptsTruncated: topBlockIds.length > scripts.length || budget.remaining <= 0
    };
};

export const buildAssistantEditorContext = vm => {
    const originalTargets = vm.runtime.targets.filter(target => target.isOriginal);
    const selected = vm.editingTarget;
    const budget = {
        remaining: MAX_CONTEXT_BLOCKS,
        bytes: MAX_CONTEXT_BLOCK_BYTES,
        truncated: false
    };
    const variableBudget = {bytes: MAX_CONTEXT_VARIABLE_BYTES, truncated: false};
    const assetBudget = {bytes: MAX_CONTEXT_ASSET_BYTES, truncated: false};
    const orderedTargets = selected ? [selected, ...originalTargets.filter(target => target !== selected)] :
        originalTargets;
    const capturedTargets = orderedTargets.slice(0, MAX_CONTEXT_TARGETS);
    const scriptsByTarget = capturedTargets.reduce((result, target) => {
        result[target.id] = targetScripts(target, budget);
        return result;
    }, {});
    const targets = capturedTargets.map(target => ({
        id: target.id,
        name: target.getName(),
        isStage: target.isStage,
        selected: selected === target,
        state: targetState(target),
        variables: targetVariables(target, variableBudget),
        costumes: targetAssets(target, 'getCostumes', assetBudget),
        sounds: targetAssets(target, 'getSounds', assetBudget),
        ...scriptsByTarget[target.id]
    }));
    const selectedSnapshot = selected ? targets.find(target => target.id === selected.id) : null;
    return {
        version: 2,
        capturedAt: new Date().toISOString(),
        source: 'scratch-vm-live-on-send',
        locale: document.documentElement.lang || 'zh-cn',
        selectedTarget: selected ? {
            id: selected.id,
            name: selected.getName(),
            isStage: selected.isStage,
            scriptCount: selectedSnapshot ? selectedSnapshot.scriptCount : 0
        } : null,
        stageSize: {
            width: number(vm.runtime.stageWidth, 480),
            height: number(vm.runtime.stageHeight, 360)
        },
        summary: {
            targetCount: originalTargets.length,
            capturedBlockCount: MAX_CONTEXT_BLOCKS - budget.remaining,
            truncated: originalTargets.length > capturedTargets.length || budget.truncated ||
                variableBudget.truncated || assetBudget.truncated ||
                targets.some(target => target.scriptsTruncated)
        },
        targets,
        capabilityBoundary: {
            tools: [TOOL_NAME],
            writeScope: 'ADD_SCRIPT_TO_SELECTED_TARGET_ONLY',
            requiresConfirmation: true
        }
    };
};

export const previewAssistantTool = (vm, toolCall) => {
    if (!toolCall || toolCall.name !== TOOL_NAME) throw new Error('未开放这个 Tool');
    const args = toolCall.arguments;
    if (!args || !args.script || !args.script.event) throw new Error('Tool 参数不完整');
    if (!vm.editingTarget || args.targetId !== vm.editingTarget.id) {
        throw new Error('目标角色已变化，请让 AI 根据当前角色重新规划');
    }
    compileAssistantToolXml(args, vm.editingTarget.isStage);
    return {
        title: `给“${vm.editingTarget.getName()}”新增脚本`,
        description: `${eventLabel(args.script.event)}：${args.script.steps.map(stepLabel).join(' → ')}`
    };
};

export const executeAssistantTool = (vm, toolCall) => {
    const preview = previewAssistantTool(vm, toolCall);
    const ScratchBlocks = window.ScratchBlocks;
    const workspace = ScratchBlocks && ScratchBlocks.getMainWorkspace();
    if (!ScratchBlocks || !workspace) throw new Error('积木工作区尚未准备好');
    const dom = ScratchBlocks.Xml.textToDom(compileAssistantToolXml(
        toolCall.arguments,
        vm.editingTarget.isStage
    ));
    const blockIds = ScratchBlocks.Xml.domToWorkspace(dom, workspace);
    if (!blockIds.length) throw new Error('没有创建任何积木');
    workspace.resizeContents();
    return {
        status: 'SUCCEEDED',
        preview,
        createdTopBlockIds: blockIds,
        targetId: vm.editingTarget.id
    };
};

export const installAssistantFloatingInterface = handlers => {
    const api = Object.freeze({
        version: 1,
        open: handlers.open,
        close: handlers.close,
        toggle: handlers.toggle,
        newConversation: handlers.newConversation
    });
    window.PlanetAiAssistant = api;
    window.dispatchEvent(new CustomEvent('planet-ai-assistant-ready', {detail: api}));
    return () => {
        if (window.PlanetAiAssistant === api) delete window.PlanetAiAssistant;
    };
};
