import { observer } from "mobx-react-lite";
import { Button, Input } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { RootStore } from "@/store";
import { ResourceStore } from "@/store/resourceStore";
import { api } from "@/lib/trpc";
import { DialogStore } from "@/store/module/Dialog";
import { useState, useCallback, useEffect } from "react";
import { showTipsDialog } from "../Common/TipsDialog";
import { PromiseCall } from "@/store/standard/PromiseState";
import { ToastPlugin } from "@/store/module/Toast/Toast";
import { DialogStandaloneStore } from "@/store/module/DialogStandalone";
import { downloadFromLink } from "@/lib/tauriHelper";
import { getBlinkoEndpoint } from "@/lib/blinkoEndpoint";
import {
  Menu,
  MenuItem,
  ControlledMenu,
  useMenuState,
} from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/zoom.css';

const MenuIconItem = ({ icon, label, className = '' }: { icon: string; label: string; className?: string }) => (
  <div className={`flex items-center gap-2 ${className} `}>
    <Icon icon={icon} className="w-5 h-5" />
    <span>{label}</span>
  </div>
);

// 全局监听器存储
const resourceContextMenuListeners: Record<string, (e: React.MouseEvent) => void> = {};

export const ResourceContextMenuTrigger = ({
  id,
  children
}: {
  id: string,
  children: React.ReactNode
}) => {
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (resourceContextMenuListeners[id]) {
      resourceContextMenuListeners[id](e);
    }
  }, [id]);

  return (
    <div onContextMenu={handleContextMenu} className="w-full h-full">
      {children}
    </div>
  );
};

export const ResourceContextMenu = observer(({ id }: { id: string }) => {
  const { t } = useTranslation();
  const resourceStore = RootStore.Get(ResourceStore);
  const resource = resourceStore.contextMenuResource;
  const [menuProps, toggleMenu] = useMenuState({ transition: true });
  const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const listener = (e: React.MouseEvent) => {
      setAnchorPoint({ x: e.clientX, y: e.clientY });
      toggleMenu(true);
    };
    resourceContextMenuListeners[id] = listener;
    return () => {
      delete resourceContextMenuListeners[id];
    };
  }, [id, toggleMenu]);

  const handleDownload = () => {
    if (!resource?.path) return;
    downloadFromLink(getBlinkoEndpoint(resource.path));
  };

  const handleRename = async () => {
    if (!resource) return;
    const currentName = resource.isFolder ? resource.folderName : resource.name;

    RootStore.Get(DialogStore).setData({
      isOpen: true,
      title: t('rename'),
      content: () => {
        const getNameAndExt = (filename: string) => {
          const lastDotIndex = filename.lastIndexOf('.');
          if (lastDotIndex === -1 || resource.isFolder) return { name: filename, ext: '' };
          return {
            name: filename.substring(0, lastDotIndex),
            ext: filename.substring(lastDotIndex)
          };
        };

        const { name: initialName, ext } = getNameAndExt(currentName || '');
        const [newName, setNewName] = useState<string>(initialName);

        const getFullFolderPath = (name: string) => {
          if (!resource.isFolder) return undefined;
          if (resourceStore.currentFolder) {
            return `${resourceStore.currentFolder}/${name}`;
          }
          return name;
        };

        return (
          <div className="flex flex-col gap-2 p-2">
            <Input
              label={resource.isFolder ? t('folder-name') : t('file-name')}
              value={newName}
              endContent={<div className="pointer-events-none text-default-400">{ext}</div>}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button
              color="primary"
              className="mt-2"
              onPress={async () => {
                const finalName = resource.isFolder ? newName : `${newName}${ext}`;
                const oldPath = getFullFolderPath(resource.folderName!);
                const newPath = getFullFolderPath(finalName);
                await RootStore.Get(ToastPlugin).promise(
                  PromiseCall(api.attachments.rename.mutate({
                    id: resource?.id ?? undefined,
                    newName: newPath?.split('/').join(',') || finalName,
                    isFolder: resource.isFolder,
                    oldFolderPath: oldPath?.split('/').join(',')
                  }), { autoAlert: false }), {
                  loading: t("operation-in-progress"),
                  success: t("operation-success"),
                  error: t("operation-failed")
                }
                );
                RootStore.Get(DialogStore).close();
                resourceStore.refreshTicker++;
              }}
            >
              {t('confirm')}
            </Button>
          </div>
        );
      }
    });
  };

  const handleDelete = async () => {
    if (!resource) return;
    showTipsDialog({
      title: t('confirm-delete'),
      content: t('confirm-delete-content', {
        name: resource.isFolder ? resource.folderName : resource.name
      }),
      onConfirm: async () => {
        if (resource.isFolder) {
          const folderPath = resourceStore.currentFolder
            ? `${resourceStore.currentFolder}/${resource.folderName}`
            : resource.folderName;

          await RootStore.Get(ToastPlugin).promise(
            PromiseCall(api.attachments.delete.mutate({
              id: resource.id!,
              isFolder: resource.isFolder,
              folderPath: folderPath?.split('/').join(',')
            }), { autoAlert: false }), {
            loading: t("operation-in-progress"),
            success: t("operation-success"),
            error: t("operation-failed")
          }
          );
        } else {
          await PromiseCall(api.attachments.delete.mutate({
            id: resource.id!,
            isFolder: false
          }));
        }
        RootStore.Get(DialogStandaloneStore).close();
        resourceStore.refreshTicker++;
      }
    });
  };

  const handleCut = () => {
    if (resource) resourceStore.setCutItems([resource]);
  };

  const handlePaste = async () => {
    if (!resource || !resourceStore.clipboard || !resource.isFolder) return;

    const { items } = resourceStore.clipboard;
    const targetPath = resourceStore.currentFolder
      ? `${resourceStore.currentFolder}/${resource.folderName}`
      : resource.folderName;

    await RootStore.Get(ToastPlugin).promise(PromiseCall(api.attachments.move.mutate({
      sourceIds: items.map(item => item.id!),
      targetFolder: targetPath!.split('/').join(',')
    }), { autoAlert: false }), {
      loading: t("operation-in-progress"),
      success: t("operation-success"),
      error: t("operation-failed")
    });

    resourceStore.clearClipboard();
    resourceStore.refreshTicker++;
  };

  const handleMoveToParent = async () => {
    if (!resource || !resourceStore.currentFolder) return;
    await RootStore.Get(ToastPlugin).promise(
      resourceStore.moveToParentFolder([resource]),
      {
        loading: t("operation-in-progress"),
        success: t("operation-success"),
        error: t("operation-failed")
      }
    );
  };

  const canPaste = resource?.isFolder && resourceStore.clipboard && resourceStore.clipboard.items.length > 0;

  return (
    <ControlledMenu
      {...menuProps}
      anchorPoint={anchorPoint}
      onClose={() => toggleMenu(false)}
      transition
      className="szh-menu"
    >
      {!resource?.isFolder && (
        <MenuItem onClick={handleDownload}>
          <MenuIconItem icon="material-symbols:download" label={t('download')} />
        </MenuItem>
      )}

      <MenuItem onClick={handleRename}>
        <MenuIconItem icon="gg:rename" label={t('rename')} />
      </MenuItem>

      {resourceStore.currentFolder && (
        <MenuItem onClick={handleMoveToParent}>
          <MenuIconItem
            icon="material-symbols:drive-file-move-outline"
            label={t('move-up')}
          />
        </MenuItem>
      )}

      {!resource?.isFolder && (
        <MenuItem onClick={handleCut}>
          <MenuIconItem icon="material-symbols:content-cut" label={t('cut')} />
        </MenuItem>
      )}

      {canPaste && (
        <MenuItem onClick={handlePaste}>
          <MenuIconItem icon="material-symbols:content-paste" label={t('paste')} />
        </MenuItem>
      )}

      <MenuItem onClick={handleDelete} className="text-danger">
        <MenuIconItem
          icon="material-symbols:delete-outline"
          label={t('delete')}
          className="text-danger"
        />
      </MenuItem>
    </ControlledMenu>
  );
});