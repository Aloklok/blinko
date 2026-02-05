import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react';
import { IconButton } from './IconButton';
import { ReferenceButton } from './ReferenceButton';
import { ResourceReferenceButton } from './ResourceReferenceButton';
import { AIWriteButton } from './AIWriteButton';
import { ViewModeButton } from './ViewModeButton';
import { EditorStore } from '../editorStore';
import { BlinkoStore } from '@/store/blinkoStore';
import { RootStore } from '@/store';
import { Icon } from '@/components/Common/Iconify/icons';

interface Props {
    store: EditorStore;
}

export const MoreOptionsButton = ({ store }: Props) => {
    const blinko = RootStore.Get(BlinkoStore);

    return (
        <Popover placement="top">
            <PopoverTrigger>
                <div className="hover:bg-hover rounded-md transition-all">
                    <IconButton icon="fluent:more-horizontal-24-regular" tooltip="more" />
                </div>
            </PopoverTrigger>
            <PopoverContent>
                <div className="flex flex-col p-2 gap-2 min-w-[200px]">
                    <div className="flex items-center gap-2 px-2 py-1 border-b border-border mb-1">
                        <Icon icon="fluent:settings-24-regular" width="18" height="18" />
                        <span className="text-sm font-medium">更多操作</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-hover cursor-pointer border border-border/50">
                            <ReferenceButton store={store} />
                            <span className="text-xs mt-1">引用</span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-hover cursor-pointer border border-border/50">
                            <ResourceReferenceButton store={store} />
                            <span className="text-xs mt-1">素材</span>
                        </div>

                        {blinko.config.value?.mainModelId && (
                            <div className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-hover cursor-pointer border border-border/50">
                                <AIWriteButton />
                                <span className="text-xs mt-1">AI 写作</span>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-hover cursor-pointer border border-border/50">
                            <ViewModeButton viewMode={store.viewMode} />
                            <span className="text-xs mt-1">视图切换</span>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
