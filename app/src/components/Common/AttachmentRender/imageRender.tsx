import { useEffect, useMemo, useState } from 'react';
import { FileType } from '../Editor/type';
import { Image } from '@heroui/react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import { Icon } from '@/components/Common/Iconify/icons';
import { DeleteIcon, DownloadIcon, InsertConextButton, CopyIcon } from './icons';
import { observer } from 'mobx-react-lite';
import { useMediaQuery } from 'usehooks-ts';
import { DraggableFileGrid } from './DraggableFileGrid';
import { apiClient } from "@/lib/api-client";
import { getBlinkoEndpoint } from '@/lib/blinkoEndpoint';
import { RootStore } from '@/store';
import { UserStore } from '@/store/user';
import { useIntersectionObserver } from 'usehooks-ts';

type IProps = {
  files: FileType[]
  preview?: boolean
  columns?: number
  onReorder?: (newFiles: FileType[]) => void
}
export const ImageThumbnailRender = ({ src, className }: { src: string, className?: string }) => {
  const [isOriginalError, setIsOriginalError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('');
  const [loading, setLoading] = useState(true);

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
    rootMargin: '200px',
    freezeOnceVisible: true,
  })

  useEffect(() => {
    let objectUrl = '';

    const fetchImage = async () => {
      if (!isIntersecting) return;

      const token = RootStore.Get(UserStore).tokenData.value?.token;
      if (!token) return;

      // Primary Strategy: Direct URL with Token (Supports 302 Redirect & Native Loading)
      const directUrl = getBlinkoEndpoint(`${src}?token=${token}&thumbnail=true`);
      setCurrentSrc(directUrl);
      setLoading(false);
    };

    fetchImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, isIntersecting]);

  const handleFallback = async () => {
    if (isOriginalError || !src || currentSrc.startsWith('blob:')) {
      setIsOriginalError(true);
      setLoading(false);
      return;
    }

    console.warn(`[ImageRender] Fallback triggered for: ${src}`);
    try {
      const response = await apiClient.get(getBlinkoEndpoint(`${src}?thumbnail=true`), {
        responseType: 'blob',
        timeout: 5000 // Add timeout
      });
      const objectUrl = URL.createObjectURL(response.data as Blob);
      setCurrentSrc(objectUrl);
    } catch (error) {
      console.error(`[ImageRender] Persistent error for ${src}:`, error.message);
      setIsOriginalError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOriginalError) {
      setCurrentSrc('/image-fallback.svg')
    }
  }, [isOriginalError])

  return (
    <div ref={ref} className="w-full h-full">
      {loading && (
        <div className="flex items-center justify-center w-full h-full">
          <Icon icon="line-md:loading-twotone-loop" width="24" height="24" />
        </div>
      )}
      {!loading && (
        <Image
          src={currentSrc}
          classNames={{
            wrapper: '!max-w-full',
          }}
          draggable={false}
          onError={() => {
            handleFallback();
          }}
          className={`object-cover w-full h-full ${className}`}
        />
      )}
    </div>
  );
}

const ImageRender = observer((props: IProps) => {
  const { files, preview = false, columns } = props
  const isPc = useMediaQuery('(min-width: 768px)')

  const imageRenderClassName = useMemo(() => {
    if (!preview) {
      return 'flex flex-row gap-2 overflow-x-auto pb-2'
    }
    return 'flex flex-wrap gap-2'
  }, [preview, columns])

  const imageHeight = useMemo(() => {
    if (!preview) {
      return 'h-[160px] w-[160px]'
    }
    return 'h-[100px] w-[100px]'
  }, [preview, columns])

  const renderImage = (file: FileType) => (
    <div className={`relative group ${!preview ? 'min-w-[160px] flex-shrink-0' : ''} ${imageHeight}`}>
      {file.uploadPromise?.loading?.value && (
        <div className='absolute inset-0 flex items-center justify-center w-full h-full'>
          <Icon icon="line-md:uploading-loop" width="40" height="40" />
        </div>
      )}
      <div className='w-full'>
        <PhotoView src={getBlinkoEndpoint(`${file.preview}?token=${RootStore.Get(UserStore).tokenData.value?.token}`)}>
          <div className="w-full cursor-zoom-in">
            <ImageThumbnailRender
              src={file.preview}
              className={`!opacity-100 visibility-visible ${imageHeight} object-cover`}
            />
          </div>
        </PhotoView>
      </div>
      {!file.uploadPromise?.loading?.value && !preview &&
        <InsertConextButton className='absolute z-10 left-[5px] top-[5px]' files={files} file={file} />
      }
      {!file.uploadPromise?.loading?.value && !preview &&
        <DeleteIcon className='absolute z-10 right-[5px] top-[5px]' files={files} file={file} />
      }
      {preview && (
        <>
          <CopyIcon file={file} />
          <DownloadIcon file={file} />
        </>
      )}
    </div>
  )

  return (
    <PhotoProvider>
      <DraggableFileGrid
        files={files}
        preview={preview}
        columns={columns}
        type="image"
        className={imageRenderClassName}
        renderItem={renderImage}
        onReorder={props.onReorder}
      />
    </PhotoProvider>
  )
})

export { ImageRender }