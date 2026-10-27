import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import log from '../lib/log';
import {fetchExtensionLibrary, mirroredResourceURL} from '../lib/planet-extension-mirror';
import {
    EXTENSION_STATE_CHANGED, closeExtension, enableExtension,
    getRegisteredExtensions, installExtensionManagement, isExtensionEnabled
} from '../lib/planet-extension-management';

import extensionLibraryContent, {
    galleryError,
    galleryLoading,
    galleryMore
} from '../lib/libraries/extensions/index.jsx';
import extensionTags from '../lib/libraries/tw-extension-tags';

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    }
});

const toLibraryItem = extension => {
    if (typeof extension === 'object') {
        return ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        });
    }
    return extension;
};

const translateGalleryItem = (extension, locale) => ({
    ...extension,
    name: extension.nameTranslations[locale] || extension.name,
    description: extension.descriptionTranslations[locale] || extension.description
});

let cachedGallery = null;

const fetchLibrary = async () => {
    const data = await fetchExtensionLibrary();
    return data.extensions.map(extension => ({
        name: extension.name,
        nameTranslations: extension.nameTranslations || {},
        description: extension.description,
        descriptionTranslations: extension.descriptionTranslations || {},
        extensionId: extension.id,
        extensionURL: `https://extensions.turbowarp.org/${extension.slug}.js`,
        iconURL: mirroredResourceURL(data, extension.image || 'images/unknown.svg'),
        tags: ['tw'],
        credits: [
            ...(extension.original || []),
            ...(extension.by || [])
        ].map(credit => {
            if (credit.link) {
                return (
                    <a
                        href={credit.link}
                        target="_blank"
                        rel="noreferrer"
                        key={credit.name}
                    >
                        {credit.name}
                    </a>
                );
            }
            return credit.name;
        }),
        docsURI: extension.docs ? `https://extensions.turbowarp.org/${extension.slug}` : null,
        samples: extension.samples ? extension.samples.map(sample => ({
            href: `${process.env.ROOT}editor?project_url=${encodeURIComponent(
                mirroredResourceURL(data, `samples/${sample}.sb3`)
            )}`,
            text: sample
        })) : null,
        incompatibleWithScratch: !extension.scratchCompatible,
        featured: true
    }));
};

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect',
            'handleToggleExtension',
            'refreshExtensions',
            'loadGallery'
        ]);
        installExtensionManagement(props.vm);
        this.state = {
            gallery: cachedGallery,
            galleryError: null,
            galleryTimedOut: false,
            extensions: getRegisteredExtensions(props.vm),
            pendingExtension: null,
            statusMessage: '',
            statusIsError: false
        };
    }
    componentDidMount () {
        this.mounted = true;
        this.props.vm.on(EXTENSION_STATE_CHANGED, this.refreshExtensions);
        this.props.vm.on('EXTENSION_ADDED', this.refreshExtensions);
        this.loadGallery();
    }
    componentWillUnmount () {
        this.mounted = false;
        this.props.vm.removeListener(EXTENSION_STATE_CHANGED, this.refreshExtensions);
        this.props.vm.removeListener('EXTENSION_ADDED', this.refreshExtensions);
        clearTimeout(this.galleryTimeout);
    }
    refreshExtensions () {
        this.setState({extensions: getRegisteredExtensions(this.props.vm)});
    }
    async handleToggleExtension (item) {
        if (this.togglingExtension) return;
        this.togglingExtension = true;
        const id = item.extensionId;
        const wasEnabled = isExtensionEnabled(this.props.vm, id);
        this.setState({pendingExtension: id,
            statusMessage: wasEnabled ? '' : '正在加载扩展，请稍候…',
            statusIsError: false});
        try {
            if (wasEnabled) {
                closeExtension(this.props.vm, id);
            } else {
                await enableExtension(this.props.vm, id, item.extensionURL || id);
            }
            if (this.mounted) {
                this.setState({statusMessage: wasEnabled ?
                    '扩展已关闭，可随时重新启用。' : '扩展已启用，积木已添加到积木栏。'});
            }
        } catch (error) {
            log.error(error);
            if (this.mounted) {
                this.setState({statusMessage: error.message || '扩展操作失败，请重试。', statusIsError: true});
            }
        } finally {
            this.togglingExtension = false;
            if (this.mounted) {
                this.setState({pendingExtension: null});
            }
        }
    }
    loadGallery () {
        if (!this.state.gallery) {
            this.setState({galleryError: null, galleryTimedOut: false});
            this.galleryTimeout = setTimeout(() => {
                this.setState({
                    galleryTimedOut: true
                });
            }, 750);

            fetchLibrary()
                .then(gallery => {
                    cachedGallery = gallery;
                    if (this.mounted) {
                        this.setState({gallery});
                    }
                    clearTimeout(this.galleryTimeout);
                })
                .catch(error => {
                    log.error(error);
                    if (this.mounted) {
                        this.setState({galleryError: error});
                    }
                    clearTimeout(this.galleryTimeout);
                });
        }
    }
    handleItemSelect (item) {
        if (item.extensionId === 'gallery_retry') {
            this.loadGallery();
            return;
        }
        if (item.href) {
            return;
        }

        const extensionId = item.extensionId;

        if (extensionId === 'custom_extension') {
            this.props.onOpenCustomExtensionModal();
            return;
        }

        if (extensionId === 'procedures_enable_return') {
            this.props.onEnableProcedureReturns();
            this.props.onCategorySelected('myBlocks');
            return;
        }

        if (this.togglingExtension) return;
        const url = item.extensionURL ? item.extensionURL : extensionId;
        if (!item.disabled) {
            if (isExtensionEnabled(this.props.vm, extensionId)) {
                this.props.onCategorySelected(extensionId);
            } else {
                enableExtension(this.props.vm, extensionId, url)
                    .then(() => {
                        this.props.onCategorySelected(extensionId);
                    })
                    .catch(err => {
                        log.error(err);
                        // eslint-disable-next-line no-alert
                        alert(err);
                    });
            }
        }
    }
    render () {
        // 内置扩展不依赖在线扩展库。先渲染它们，避免网络请求被拦截或较慢时出现空白入口。
        let library = extensionLibraryContent.map(toLibraryItem);
        if (this.state.gallery || this.state.galleryError || this.state.galleryTimedOut) {
            library.push('---');
            if (this.state.gallery) {
                library.push(toLibraryItem(galleryMore));
                const locale = this.props.intl.locale;
                library.push(
                    ...this.state.gallery
                        .filter(i => i.extensionId !== 'faceSensing')
                        .map(i => translateGalleryItem(i, locale))
                        .map(toLibraryItem)
                );
            } else if (this.state.galleryError) {
                library.push(toLibraryItem({
                    ...galleryError,
                    href: null,
                    extensionId: 'gallery_retry',
                    keepOpen: true,
                    name: '扩展库暂时不可用',
                    description: '点击重试。内置扩展仍可正常使用。'
                }));
            } else {
                library.push(toLibraryItem(galleryLoading));
            }
        }

        // Include project-specific custom extensions even when the online gallery is unavailable.
        const listed = new Set(library.filter(item => typeof item === 'object').map(item => item.extensionId));
        for (const extension of this.state.extensions) {
            if (listed.has(extension.id)) continue;
            library.push(toLibraryItem({
                name: extension.name || extension.id,
                extensionId: extension.id,
                iconURL: extension.iconURL,
                description: '当前项目加载的扩展。',
                featured: true,
                tags: ['tw']
            }));
        }
        library = library.map(item => {
            if (typeof item !== 'object' || !item.extensionId || item.href || item.disabled ||
                ['custom_extension', 'procedures_enable_return', 'gallery_retry'].includes(item.extensionId)) {
                return item;
            }
            const enabled = this.state.extensions.some(extension => (
                extension.id === item.extensionId && extension.enabled
            ));
            return {...item,
                extensionEnabled: enabled,
                extensionBusy: this.state.pendingExtension !== null,
                tags: [...(item.tags || []), ...(enabled ? ['enabled'] : [])]
            };
        });

        return (
            <LibraryComponent
                data={library}
                filterable
                persistableKey="extensionId"
                id="extensionLibrary"
                tags={[{tag: 'enabled', intlLabel: '已启用'}, ...extensionTags]}
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                statusMessage={this.state.statusMessage}
                statusIsError={this.state.statusIsError}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onToggleExtension={this.handleToggleExtension}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onEnableProcedureReturns: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onRequestClose: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

export default injectIntl(ExtensionLibrary);
