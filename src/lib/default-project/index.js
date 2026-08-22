/* eslint-disable import/no-unresolved */
import defaultProjectArchive from '!arraybuffer-loader!./override-default-project.sb3';
/* eslint-enable import/no-unresolved */

const defaultProject = () => ([{
    id: 0,
    assetType: 'Project',
    dataFormat: 'JSON',
    data: defaultProjectArchive
}]);

export default defaultProject;
