import { observer } from 'mobx-react-lite'
import { BlinkoStore } from '@/store/blinkoStore'
import { RootStore } from '@/store'
import { EditorStore } from '../../editorStore'
import { useEffect } from 'react'
import { BlinkoSelectNote } from '@/components/Common/BlinkoSelectNote'

interface Props {
  store: EditorStore;
  size?: number;
  containerSize?: number;
}

export const ReferenceButton = observer(({ store, size, containerSize }: Props) => {
  const blinko = RootStore.Get(BlinkoStore)
  useEffect(() => {
    blinko.referenceSearchList.resetAndCall({ searchText: ' ' })
  }, [])
  return (
    <BlinkoSelectNote
      onSelect={(item) => {
        if (store.references?.includes(item.id)) return;
        store.addReference(item.id);
      }}
      blackList={store.references}
      size={size}
      containerSize={containerSize}
    />
  )
}) 