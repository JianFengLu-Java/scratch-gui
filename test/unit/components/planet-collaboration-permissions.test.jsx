import React from 'react';
import {shallow} from 'enzyme';

import {Avatar} from '../../../src/components/editor-dock/planet-collaboration-permissions';

describe('PlanetCollaborationPermissions avatar', () => {
    test('falls back to the member initial when the image cannot load', () => {
        const wrapper = shallow(
            <Avatar
                member={{
                    avatarUrl: '/api/v1/files/88',
                    nickname: '陆剑峰'
                }}
            />
        );

        expect(wrapper.find('img').prop('src')).toBe('/backend-api/files/88');
        wrapper.find('img').simulate('error');

        expect(wrapper.find('img')).toHaveLength(0);
        expect(wrapper.text()).toBe('陆');
    });
});
