import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { useStorageLocations } from '../../locations/hooks/useStorageLocations';
import { useContainers } from '../../containers/hooks/useContainers';
import { ContainerList } from '../../containers/components/ContainerList';
import { StorageLocationList } from '../../locations/components/StorageLocationList';
import { getStorageSpaceDisplayName } from '../utils/formatWorkspaceName';
import { useWorkspaceHistory } from '../../containers/hooks/useBoxHistory';
import { RecentActivitySection } from '../../containers/components/RecentActivitySection';
import { ActivityHistoryModal } from '../../containers/components/ActivityHistoryModal';

export const StorageSpaceDetailPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const workspaceContext = useWorkspaceContext();

  const workspace = workspaceContext?.workspaces?.find((w) => w.id === workspaceId);

  const { data: locations = [], isLoading: isLocationsLoading } = useStorageLocations(workspaceId || '');
  const { data: containers = [], isLoading: isContainersLoading } = useContainers(workspaceId || '');

  if (isLocationsLoading || isContainersLoading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: '#64748b' }}>
        Loading Storage Space details...
      </div>
    );
  }

  if (!workspaceId || (!workspace && workspaceContext?.workspaces?.length > 0)) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Storage Space Not Found</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          You do not have access to this Storage Space or it does not exist.
        </p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          Return Home
        </button>
      </div>
    );
  }

  const displayName = getStorageSpaceDisplayName(workspace?.name || 'Storage Space');
  const activeBoxes = containers.filter((c) => !c.isArchived);

  return (
    <div style={{ maxWidth: '1000px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Breadcrumb Trail */}
      <nav aria-label="Storage Space Breadcrumb" style={{ marginBottom: '1rem', display: 'flex', gap: '0.375rem', alignItems: 'center', fontSize: '0.875rem' }}>
        <Link to="/" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
          Home
        </Link>
        <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>/</span>
        <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 700 }}>{displayName}</span>
      </nav>

      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--color-card-bg, #ffffff)',
          border: '1px solid var(--color-card-border, #e2e8f0)',
          borderRadius: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-primary-text, #0284c7)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              STORAGE SPACE
            </span>
            <h1 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              🏠 {displayName}
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Authorized Storage Space · {activeBoxes.length} {activeBoxes.length === 1 ? 'Box' : 'Boxes'} · {locations.length} {locations.length === 1 ? 'Location' : 'Locations'}
            </p>
          </div>
          <Link to="/" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Home
          </Link>
        </div>
      </div>

      {/* Locations Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.75rem' }}>
          Storage Locations
        </h2>
        <StorageLocationList
          workspaceId={workspaceId!}
          readOnly={true}
          selectedLocationId={null}
          onSelectLocation={(locId) => {
            if (locId) {
              navigate(`/workspaces/${workspaceId}/locations/${locId}`);
            }
          }}
        />
      </div>

      {/* Boxes Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: '0.75rem' }}>
          Boxes ({activeBoxes.length})
        </h2>
        <ContainerList
          workspaceId={workspaceId!}
        />
      </div>

      {/* Storage Space Activity History */}
      <StorageSpaceHistorySection workspaceId={workspaceId!} />
    </div>
  );
};

const StorageSpaceHistorySection: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [page, setPage] = React.useState(1);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [allModalItems, setAllModalItems] = React.useState<any[]>([]);

  const { data: initialItems = [], isLoading, isError } = useWorkspaceHistory(workspaceId, 1, 10);
  const { data: modalPageItems = [], isLoading: isModalLoading } = useWorkspaceHistory(workspaceId, page, 20);

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
        title="Recent Activity"
        subtitle="Recent activity across this Storage Space."
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
        title="Storage Space Activity History"
        items={allModalItems.length > 0 ? allModalItems : initialItems}
        isLoading={isModalLoading}
        hasMore={modalPageItems.length >= 20}
        onLoadMore={() => setPage((p) => p + 1)}
      />
    </>
  );
};
