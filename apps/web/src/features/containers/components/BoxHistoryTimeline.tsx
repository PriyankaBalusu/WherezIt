import React, { useState } from 'react';
import { useBoxHistory, BoxHistoryItem } from '../hooks/useBoxHistory';
import { RecentActivitySection } from './RecentActivitySection';
import { ActivityHistoryModal } from './ActivityHistoryModal';

interface BoxHistoryTimelineProps {
  workspaceId: string;
  containerId: string;
}

export const BoxHistoryTimeline: React.FC<BoxHistoryTimelineProps> = ({
  workspaceId,
  containerId,
}) => {
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allModalItems, setAllModalItems] = useState<BoxHistoryItem[]>([]);

  // Fetch initial top 10 for box detail timeline
  const { data: initialItems = [], isLoading, isError } = useBoxHistory(workspaceId, containerId, 1, 10);

  // Query for paginated modal view
  const { data: modalPageItems = [], isLoading: isModalLoading } = useBoxHistory(
    workspaceId,
    containerId,
    page,
    20
  );

  React.useEffect(() => {
    if (modalPageItems.length > 0) {
      setAllModalItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = modalPageItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  }, [modalPageItems]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (allModalItems.length === 0 && initialItems.length > 0) {
      setAllModalItems(initialItems);
    }
  };

  return (
    <>
      <RecentActivitySection
        title="Box History"
        subtitle="Read-only timeline of activity for this box."
        items={initialItems}
        isLoading={isLoading}
        isError={isError}
        onViewAll={handleOpenModal}
        hasMore={initialItems.length >= 10}
        emptyText="No activity recorded yet."
      />

      <ActivityHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Box Activity History"
        items={allModalItems.length > 0 ? allModalItems : initialItems}
        isLoading={isModalLoading}
        hasMore={modalPageItems.length >= 20}
        onLoadMore={() => setPage((p) => p + 1)}
      />
    </>
  );
};
