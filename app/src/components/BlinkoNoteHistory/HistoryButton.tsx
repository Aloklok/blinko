import { observer } from 'mobx-react-lite';
import { Icon } from '@/components/Common/Iconify/icons';
import { Tooltip } from '@heroui/react';
import { RootStore } from '@/store';
import { DialogStore } from '@/store/module/Dialog';
import NoteHistoryModal from './NoteHistoryModal';
import { useTranslation } from 'react-i18next';

import { forwardRef } from 'react';

interface HistoryButtonProps {
  noteId: number;
  className?: string;
  onClick?: (e: any) => void;
}

export const HistoryButton = observer(forwardRef<HTMLDivElement, HistoryButtonProps>(({ noteId, className = '', onClick }, ref) => {
  const { t } = useTranslation();

  const handleOpenHistory = (e) => {
    e.stopPropagation();
    onClick?.(e);
    RootStore.Get(DialogStore).setData({
      isOpen: true,
      size: '2xl',
      title: t('Note History'),
      content: <NoteHistoryModal noteId={noteId} />,
    });
  };

  return (
    <Tooltip content={t('View History Versions')}>
      <div ref={ref} className="flex items-center gap-2 cursor-pointer" onClick={handleOpenHistory}>
        <Icon className={className} icon="lucide:history" width="16" height="16" />
      </div>
    </Tooltip>
  );
}));

export default HistoryButton;
