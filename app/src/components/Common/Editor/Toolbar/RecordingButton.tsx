import { IconButton } from './IconButton';
import { ShowAudioDialog } from '../../AudioDialog';
import { useTranslation } from 'react-i18next';

interface Props {
    onFileUpload: (files: File[]) => void;
    size?: number;
    containerSize?: number;
    isRound?: boolean;
}

export const RecordingButton = ({ onFileUpload, size, containerSize, isRound = true }: Props) => {
    const { t } = useTranslation();

    return (
        <IconButton
            icon="solar:soundwave-bold"
            tooltip={t('recording')}
            classNames={{
                base: `hover:bg-hover transition-all ${isRound ? '!rounded-full' : ''}`,
                icon: '!text-[#00e676]'
            }}
            size={size}
            containerSize={containerSize}
            onClick={() => ShowAudioDialog((file) => onFileUpload([file]))}
        />
    );
};
