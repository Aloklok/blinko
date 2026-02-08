import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileType } from '../Editor/type';
import { api } from '@/lib/trpc';

type DraggableFileGridProps = {
  files: FileType[];
  preview?: boolean;
  columns?: number;
  onReorder?: (newFiles: FileType[]) => void;
  type: 'image' | 'other';
  className?: string;
  renderItem?: (file: FileType) => React.ReactNode;
};

const SortableFileItem = ({ file, renderItem, disabled }: { file: FileType, renderItem: any, disabled: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: file.name, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderItem?.(file)}
    </div>
  );
};

export const DraggableFileGrid = ({
  files,
  preview = false,
  onReorder,
  type,
  className,
  renderItem
}: DraggableFileGridProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const filteredFiles = files.filter(i => i.previewType === type);
    const allFiles = Array.from(files);

    const oldIndex = filteredFiles.findIndex(f => f.name === active.id);
    const newIndex = filteredFiles.findIndex(f => f.name === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedFiltered = arrayMove(filteredFiles, oldIndex, newIndex);

      let filteredIdx = 0;
      const newFiles = allFiles.map(file => {
        if (file.previewType === type) {
          return reorderedFiltered[filteredIdx++] || file;
        }
        return file;
      });

      onReorder?.(newFiles);

      try {
        await api.notes.updateAttachmentsOrder.mutate({
          attachments: newFiles.map((file, index) => ({
            name: file.name,
            sortOrder: index
          }))
        });
      } catch (error) {
        console.error('Failed to update attachments order:', error);
      }
    }
  };

  const currentFiles = files.filter(i => i.previewType === type);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={currentFiles.map(f => f.name)}
        strategy={rectSortingStrategy}
      >
        <div className={className}>
          {currentFiles.map((file) => (
            <SortableFileItem
              key={file.name}
              file={file}
              disabled={preview}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};