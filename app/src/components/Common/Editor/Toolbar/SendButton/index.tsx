import { Icon } from '@/components/Common/Iconify/icons';
import { SendIcon } from '../../../Icons';
import { EditorStore } from '../../editorStore';
import { observer } from 'mobx-react-lite';

interface Props {
  store: EditorStore;
  isSendLoading?: boolean;
  containerSize?: number;
  width?: number;
  height?: number;
}

export const SendButton = observer(({ store, isSendLoading, containerSize, width: customWidth, height: customHeight }: Props) => {
  // 优先级：显式宽高 > containerSize (正方形) > 默认值 (68x44)
  const width = customWidth || containerSize || 68;
  const height = customHeight || containerSize || 44;
  const iconSize = height ? Math.round(height * 0.55) : 24;

  return (
    <div
      onClick={
        (e) => {
          if (isSendLoading) return
          store.handleSend()
        }
      }
      onTouchEnd={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSendLoading) return
        store.handleSend()
      }}
    >
      <div
        className='group ml-2 bg-[#10B981] text-white flex items-center justify-center rounded-full cursor-pointer hover:bg-[#059669] transition-all'
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {(store.files?.some(i => i.uploadPromise?.loading?.value) || isSendLoading) ? (
          <Icon icon="eos-icons:three-dots-loading" width={iconSize} height={iconSize} className='text-[#F5A524]' />
        ) : (
          <SendIcon className='primary-foreground !text-primary-foreground group-hover:rotate-[-35deg] !transition-all' />
        )}
      </div>
    </div>
  );
})