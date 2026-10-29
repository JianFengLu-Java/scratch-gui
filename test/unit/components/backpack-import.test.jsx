import React from 'react';
import {shallow} from 'enzyme';
import VM from 'scratch-vm';
import {shallowWithIntl} from '../../helpers/intl-helpers.jsx';
import {Backpack} from '../../../src/containers/backpack';
import BackpackView from '../../../src/components/backpack/backpack';
import importBackpackItem from '../../../src/lib/backpack/import-item';
import SpriteItem from '../../../src/components/sprite-selector-item/sprite-selector-item';

jest.mock('scratch-vm', () => function VM () {});
jest.mock('../../../src/lib/storage', () => ({}));
jest.mock('../../../src/lib/backpack-api', () => ({LOCAL_API: '_local_'}));
jest.mock('../../../src/lib/drop-area-hoc', () => () => component => component);
jest.mock('../../../src/lib/backpack/import-item', () => jest.fn());
jest.mock('../../../src/components/editor-dock/dock-panel', () => 'DockPanel');
jest.mock('../../../src/containers/sprite-selector-item', () => 'SpriteItem');

describe('backpack click and touch import', () => {
    let wrapper;
    let activateTab;
    beforeEach(() => {
        jest.clearAllMocks();
        importBackpackItem.mockReset().mockResolvedValue();
        activateTab = jest.fn();
        wrapper = shallow(<Backpack
            editingTarget="sprite-1"
            targets={[{id: 'sprite-1', name: '角色1'}, {id: 'stage', name: '舞台'}]}
            workspaceMetrics={{targets: {}}}
            onActivateTab={activateTab}
            vm={Object.assign(new VM(), {setEditingTarget: jest.fn()})}
        />, {disableLifecycleMethods: true});
        wrapper.setState({expanded: true, contents: [{id: '1', name: '移动代码', type: 'script'}]});
    });
    afterEach(() => {
        // No browser event listeners are mounted in this isolated container test.
        wrapper.instance().componentWillUnmount = () => {};
        wrapper.unmount();
    });

    test('locks a pending import to its original target and prevents duplicate taps', async () => {
        let finish;
        importBackpackItem.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const container = wrapper.instance();
        container.handleSelectItem('1');
        const first = container.handleImport();
        container.handleImport();
        wrapper.setProps({editingTarget: 'stage'});
        expect(importBackpackItem).toHaveBeenCalledTimes(1);
        expect(importBackpackItem.mock.calls[0][0].targetId).toBe('sprite-1');
        expect(wrapper.state('importing')).toBe(true);
        finish();
        await first;
        expect(wrapper.prop('onSelectItem')).toBe(container.handleSelectItem);
        expect(wrapper.state('importMessage')).toContain('角色1');
        expect(wrapper.state('importing')).toBe(false);
        expect(activateTab).toHaveBeenCalledWith(0);
    });

    test('keeps the selection and contents after failure, then allows a successful retry', async () => {
        importBackpackItem.mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce();
        const container = wrapper.instance();
        container.handleSelectItem('1');
        await container.handleImport();
        expect(wrapper.state('importMessage')).toContain('网络异常');
        expect(wrapper.state('contents')).toHaveLength(1);
        expect(wrapper.state('selectedItemId')).toBe('1');
        expect(wrapper.state('importFailed')).toBe(true);
        await container.handleImport();
        expect(wrapper.state('importFailed')).toBe(false);
        expect(wrapper.state('importMessage')).toContain('已将');
    });

    test('shows an explicit target picker and requires a selected material before adding', () => {
        const view = shallowWithIntl(<BackpackView {...wrapper.props()} />).dive();
        expect(view.find('select[aria-label="书包素材添加目标"]').prop('value')).toBe('sprite-1');
        expect(view.find('button[aria-busy]').prop('disabled')).toBe(true);
        wrapper.instance().handleSelectItem('1');
        view.setProps(wrapper.props());
        expect(view.find('button[aria-busy]').prop('disabled')).toBe(false);
        view.find('button[aria-busy]').simulate('click');
        expect(importBackpackItem).toHaveBeenCalledTimes(1);
    });

    test('allows keyboard selection while preserving the normal sprite tile behavior', () => {
        const onClick = jest.fn();
        const tile = shallow(<SpriteItem activationLabel="选择书包素材" name="素材" selected={false} onClick={onClick} />);
        const attrs = tile.prop('attributes');
        const node = {};
        attrs.onKeyDown({key: 'Enter', target: node, currentTarget: node, preventDefault: jest.fn()});
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(attrs.role).toBe('button');
        tile.setProps({activationLabel: null});
        expect(tile.prop('attributes').role).not.toBeDefined();
    });
});
