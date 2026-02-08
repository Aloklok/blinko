import { Card, Checkbox, Tooltip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import dayjs from '@/lib/dayjs';
import { FileIcons } from '@/components/Common/AttachmentRender/FileIcon';
import { memo, useCallback, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { type ResourceType } from '@shared/lib/types';
import { ResourceContextMenu, ResourceContextMenuTrigger } from './ResourceContextMenu';
import { RootStore } from '@/store';
import { ResourceStore } from '@/store/resourceStore';
import { _ } from '@/lib/lodash';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { ImageThumbnailRender } from '../Common/AttachmentRender/imageRender';
import { getBlinkoEndpoint } from '@/lib/blinkoEndpoint';
import { UserStore } from '@/store/user';


function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}


// Reusable component for rendering resource preview
export const ResourceItemPreview = ({
  item,
  onClick,
  showExtraInfo = true,
  showAssociationIcon = true,
  className = '',
}: {
  item: ResourceType;
  onClick?: () => void;
  showExtraInfo?: boolean;
  showAssociationIcon?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation();
  const isImage = item.type?.startsWith('image/');
  const isS3File = item.path?.includes('s3file');

  const fileNameAndExt = useMemo(() => {
    const lastDotIndex = item.name.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return { name: item.name, ext: '' };
    }
    return {
      name: item.name.substring(0, lastDotIndex),
      ext: item.name.substring(lastDotIndex + 1).toLowerCase(),
    };
  }, [item.name]);

  return (
    <div className={`w-full flex items-center gap-2 p-2 rounded-md cursor-pointer group ${className}`} onClick={onClick}>
      {isImage ? (
        <PhotoProvider>
          <PhotoView src={getBlinkoEndpoint(`${item.path}?token=${RootStore.Get(UserStore).tokenData.value?.token}`)}>
            <div>
              <ImageThumbnailRender src={item.path} className="!w-[28px] !h-[28px] object-cover rounded" />
            </div>
          </PhotoView>
        </PhotoProvider>
      ) : (
        <div className="w-[28px] h-[28px] flex items-center justify-center">
          <FileIcons path={item.path} size={28} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm flex items-center gap-2">
          <span className="max-w-[100px] truncate md:max-w-[250px]">{fileNameAndExt.name}</span>
          {isS3File && showExtraInfo && (
            <Tooltip content={t('cloud-file')}>
              <Icon icon="fluent-color:cloud-16" className="w-4 h-4" />
            </Tooltip>
          )}
          {showAssociationIcon && !item.noteId && showExtraInfo && (
            <Tooltip content={t('no-note-associated')}>
              <Icon icon="ic:twotone-no-backpack" className="w-4 h-4 text-yellow-500" />
            </Tooltip>
          )}
        </div>
        {showExtraInfo && (
          <div className="text-xs text-gray-500 flex items-center gap-2 my-1">
            <span className="rounded-md px-1.5 py-0.5 bg-default-100 text-default-600">{fileNameAndExt.ext}</span>
            {formatBytes(Number(item.size))} · {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
          </div>
        )}
        {!showExtraInfo && <div className="text-xs text-gray-500">{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</div>}
      </div>
    </div>
  );
};

interface ResourceItemProps {
  item: ResourceType;
  index: number;
  onSelect: (id: number) => void;
  isSelected: boolean;
  onFolderClick: (folderName: string) => void;
}

interface ResourceCardProps {
  item: ResourceType;
  isSelected: boolean;
  onSelect: (id: number) => void;
  isDragging?: boolean;
  isDraggingOver?: boolean;
  // children?: React.ReactNode;
}

const getCardClassName = (isDragging?: boolean, isDraggingOver?: boolean) => {
  const baseClasses = 'mb-2 p-4 hover:bg-hover bg-background !transition-all duration-200';

  if (isDraggingOver) {
    return `${baseClasses} relative overflow-visible ring-2 ring-primary/30 bg-primary/10`;
  }

  if (isDragging) {
    return `${baseClasses} opacity-50 bg-primary/10`;
  }

  return baseClasses;
};

const ResourceCard = observer(({ item, isSelected, onSelect, isDragging, isDraggingOver }: ResourceCardProps) => {
  const { t } = useTranslation();
  const resourceStore = RootStore.Get(ResourceStore);
  const isImage =
    item.type?.startsWith('image/') ||
    item.name?.endsWith('.jpg') ||
    item.name?.endsWith('.png') ||
    item.name?.endsWith('.jpeg') ||
    item.name?.endsWith('.gif') ||
    item.name?.endsWith('.bmp') ||
    item.name?.endsWith('.tiff') ||
    item.name?.endsWith('.ico') ||
    item.name?.endsWith('.webp');

  const fileNameAndExt = useMemo(() => {
    const fileName = toJS(item.name);
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return { name: fileName, ext: '' };
    return {
      name: fileName.substring(0, lastDotIndex),
      ext: fileName.substring(lastDotIndex + 1),
    };
  }, [item.name]);

  const isS3File = useMemo(() => item.path?.includes('s3file'), [item.path]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    resourceStore.setContextMenuResource(_.cloneDeep(item));
  }, [item, resourceStore]);

  const cardProps = {
    className: getCardClassName(isDragging, isDraggingOver),
  };

  if (item.isFolder) {
    return (
      <Card {...cardProps} shadow="none">
        <ResourceContextMenuTrigger id="resource-item-menu">
          <div onContextMenu={handleContextMenu} className="flex items-center gap-4 ml-[45px]">
            <div className="w-[36px] h-[36px] ml-[-7px] flex items-center justify-center">
              <Icon icon="material-symbols:folder" className="w-full h-full text-yellow-500" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{item.folderName}</div>
            </div>
          </div>
        </ResourceContextMenuTrigger>
      </Card>
    );
  }

  return (
    <Card {...cardProps} shadow="none">
      <ResourceContextMenuTrigger id="resource-item-menu">
        <div onContextMenu={handleContextMenu} className="flex items-center gap-4">
          <Checkbox isSelected={isSelected} onChange={() => onSelect(item.id!)} className="z-10" />
          <ResourceItemPreview item={item} />
        </div>
      </ResourceContextMenuTrigger>
    </Card>
  );
});

const ResourceItem = observer(({ item, index, onSelect, isSelected, onFolderClick }: ResourceItemProps) => {
  const { t } = useTranslation();

  const handleClick = useMemo(
    () => (e: React.MouseEvent) => {
      if (item.isFolder) {
        e.preventDefault();
        onFolderClick(item.folderName || '');
      }
    },
    [item.isFolder, item.folderName, onFolderClick],
  );

  const draggableId = useMemo(() => (item.isFolder ? `folder-${item.folderName}` : String(item.id)), [item.isFolder, item.folderName, item.id]);
  const droppableId = useMemo(() => (item.isFolder ? `folder-${item.folderName}` : 'void'), [item.isFolder, item.folderName]);

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { index, item },
    disabled: item.isFolder
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !item.isFolder
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    cursor: item.isFolder ? 'pointer' : 'default',
  };

  return (
    <div
      ref={setDraggableRef}
      {...attributes}
      {...listeners}
      className={`relative group`}
      onClick={handleClick}
      style={style}
    >
      <motion.div
      // initial={{ opacity: 0, y: 20 }}
      // animate={{ opacity: 1, y: 0 }}
      // transition={{
      //   duration: 0.2,
      //   delay: index * 0.05,
      //   ease: 'easeOut',
      // }}
      >
        {item.isFolder ? (
          <div ref={setDroppableRef} className="w-full h-full relative">
            <ResourceCard item={item} isSelected={isSelected} onSelect={onSelect} isDraggingOver={isOver} />
          </div>
        ) : (
          <ResourceCard item={item} isSelected={isSelected} onSelect={onSelect} isDragging={isDragging} />
        )}
      </motion.div>
    </div>
  );
});

export const MemoizedResourceItem = memo(ResourceItem, (prevProps, nextProps) => {
  const prevItem = toJS(prevProps.item);
  const nextItem = toJS(nextProps.item);

  if (prevItem.isFolder && nextItem.isFolder) {
    return prevItem.folderName === nextItem.folderName && prevProps.isSelected === nextProps.isSelected && prevProps.index === nextProps.index;
  }

  return (
    prevItem.id === nextItem.id &&
    prevItem.name === nextItem.name &&
    prevItem.path === nextItem.path &&
    prevItem.size === nextItem.size &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.index === nextProps.index
  );
});
