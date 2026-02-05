import { IconButton } from './IconButton';
import { ShowAudioDialog } from '../../AudioDialog';
import { useTranslation } from 'react-i18next';

interface Props {
    onFileUpload: (files: File[]) => void;
    size?: number;
    containerSize?: number;
}

export const RecordingButton = ({ onFileUpload, size, containerSize }: Props) => {
    const { t } = useTranslation();

    return (
        <IconButton
            icon="solar:soundwave-bold"
            tooltip={t('recording')}
            classNames={{
                base: 'hover:bg-hover !rounded-full transition-all',
                icon: '!text-[#00e676]'
            }}
            size={size || 26}
            containerSize={containerSize || 50}
            onClick={() => ShowAudioDialog((file) => onFileUpload([file]))}
        />
    );
};
