import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useStorageLocations, useCreateStorageLocation } from '../locations/hooks/useStorageLocations';
import { createContainer, updateContainer, moveContainer, fetchContainer, transferContainer, unpackContainer } from './api/containerApi';
import { compressImage } from '../images/utils/compressImage';
import { Container } from './types/container';
import { useContainers } from './hooks/useContainers';
import { useWorkspaceContext } from '../workspaces/context/WorkspaceContext';
import { CodeScanner } from '../identifiers/components/CodeScanner';
import { CreateWorkspaceModal } from '../workspaces/components/CreateWorkspaceModal';
import { useQueryClient } from '@tanstack/react-query';
import './QuickPackScreen.css';

type SaveState = 'IDLE' | 'CREATING_BOX' | 'BOX_CREATED' | 'UPLOADING_CAPTURE' | 'COMPLETE' | 'PARTIAL_SUCCESS' | 'ERROR';

type MoveStatus = 'IDLE' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'NOT_NEEDED';

interface BoxMoveState {
  moveStatus: MoveStatus;
  priorityStatus: MoveStatus;
  moveError?: string;
  priorityError?: string;
}

export const QuickPackScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getIdToken } = useAuth();
  const workspaceContext = useWorkspaceContext();
  const workspacesList = workspaceContext?.workspaces || [];

  const sourceWorkspace = workspacesList.find((w) => w.id.toLowerCase() === workspaceId?.toLowerCase()) || workspaceContext?.activeWorkspace;
  const sourceInventoryNamespaceId = sourceWorkspace?.inventoryNamespaceId;

  const sameInventoryWorkspaces = workspacesList.filter(
    (w) => w.inventoryNamespaceId === sourceInventoryNamespaceId
  );

  const { data: locations = [] } = useStorageLocations(workspaceId || '');
  const { data: containers = [] } = useContainers(workspaceId || '');
  const createLocationMutation = useCreateStorageLocation(workspaceId || '');

  // Workflow selection: PACK_BOX, MOVE_BOXES, UNPACK, or null
  const [workflow, setWorkflow] = useState<'PACK_BOX' | 'MOVE_BOXES' | 'UNPACK' | null>(
    (searchParams.get('workflow') as 'PACK_BOX' | 'MOVE_BOXES' | 'UNPACK') || null
  );

  // ----------------------------------------------------
  // UNPACK STATE
  // ----------------------------------------------------
  const [unpackStep, setUnpackStep] = useState<1 | 2>(1);
  const [unpackSelectedBox, setUnpackSelectedBox] = useState<Container | null>(null);
  const [unpackShowScanner, setUnpackShowScanner] = useState<boolean>(false);
  const [unpackSearchQuery, setUnpackSearchQuery] = useState<string>('');
  const [isUnpacking, setIsUnpacking] = useState<boolean>(false);
  const [unpackError, setUnpackError] = useState<string | null>(null);
  const [unpackSuccessMessage, setUnpackSuccessMessage] = useState<string | null>(null);

  // Scanner warnings / prompt overlays
  const [unpackArchivedPrompt, setUnpackArchivedPrompt] = useState<Container | null>(null);
  const [unpackAlreadyUnpackedPrompt, setUnpackAlreadyUnpackedPrompt] = useState<Container | null>(null);
  const [unpackCrossWorkspacePrompt, setUnpackCrossWorkspacePrompt] = useState<{
    workspaceId: string;
    workspaceName: string;
    container: Container;
  } | null>(null);

  // Common UI focus refs
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // PACK A BOX STATE
  // ----------------------------------------------------
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [storageNodeId, setStorageNodeId] = useState<string>('');
  const [destinationStorageNodeId, setDestinationStorageNodeId] = useState<string>('');
  const [isTemporaryLocation, setIsTemporaryLocation] = useState<boolean>(false);
  const [temporaryLocationName, setTemporaryLocationName] = useState<string>('');

  // Pack a Box inline location creation
  const [isAddingLocation, setIsAddingLocation] = useState<boolean>(false);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationParentId, setNewLocationParentId] = useState<string>('');
  const [locationAddError, setLocationAddError] = useState<string | null>(null);

  // Pack a Box Step 2 state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualNote, setManualNote] = useState<string | null>(null);

  // Pack a Box Step 3 state
  const [name, setName] = useState<string>('');
  const [movingPriority, setMovingPriority] = useState<string>('MEDIUM');
  const [isPacked, setIsPacked] = useState<boolean>(false);

  // Pack a Box Save State Machine
  const [saveState, setSaveState] = useState<SaveState>('IDLE');
  const [createdContainer, setCreatedContainer] = useState<Container | null>(null);

  // ----------------------------------------------------
  // MOVE EXISTING BOXES STATE
  // ----------------------------------------------------
  const [moveStep, setMoveStep] = useState<1 | 2 | 3>(1);
  const [selectedBoxes, setSelectedBoxes] = useState<Container[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [moveDestinationId, setMoveDestinationId] = useState<string>('');

  // Destination workspace states
  const [destinationWorkspaceId, setDestinationWorkspaceId] = useState<string>(workspaceId || '');
  const [isAddingSpace, setIsAddingSpace] = useState<boolean>(false);

  // Fetch destination locations and handle destination location mutations
  const { data: destinationLocations = [] } = useStorageLocations(destinationWorkspaceId);
  const createDestLocationMutation = useCreateStorageLocation(destinationWorkspaceId);

  // Per-box priority overrides (key is containerId)
  const [perBoxPriority, setPerBoxPriority] = useState<
    Record<string, { selectedPriority: string; priorityWasEdited: boolean }>
  >({});

  // Per-box execution outcomes (key is containerId)
  const [perBoxStatus, setPerBoxStatus] = useState<Record<string, BoxMoveState>>({});
  const [isMovingBoxes, setIsMovingBoxes] = useState<boolean>(false);

  // Cross-workspace switch prompt state
  const [workspaceSwitchRequest, setWorkspaceSwitchRequest] = useState<{
    workspaceId: string;
    workspaceName: string;
    containerId: string;
  } | null>(null);

  // General error banner
  const [error, setError] = useState<string | null>(null);
  const currentLocationObj = locations.find((l) => l.id === storageNodeId);
  const destinationLocationObj = locations.find((l) => l.id === destinationStorageNodeId);

  const getLocationPathString = (locId: string | null | undefined, locsList: any[]) => {
    if (!locId || !locsList || locsList.length === 0) return 'Unknown Location';
    const crumbs = [];
    let currentId: string | null | undefined = locId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const currentLoc = locsList.find((l) => l.id === currentId);
      if (!currentLoc) break;
      crumbs.unshift(currentLoc);
      currentId = currentLoc.parentId;
    }
    return crumbs.map((c) => c?.name || '').filter(Boolean).join(' → ') || 'Unknown Location';
  };

  // ----------------------------------------------------
  // EFFECTS
  // ----------------------------------------------------
  // Sync URL workflow parameter
  useEffect(() => {
    const wfParam = searchParams.get('workflow') as 'PACK_BOX' | 'MOVE_BOXES';
    if (wfParam && wfParam !== workflow) {
      setWorkflow(wfParam);
    }
  }, [searchParams]);

  // Initialize destinationWorkspaceId from the URL param once on mount (or if it becomes empty).
  // Do NOT reset if the user has already selected a different destination workspace.
  useEffect(() => {
    if (workspaceId && !destinationWorkspaceId) {
      setDestinationWorkspaceId(workspaceId);
    }
  }, [workspaceId]);

  // Pre-select current location from context if available in URL query string
  useEffect(() => {
    const preselected = searchParams.get('storageNodeId') || searchParams.get('locationId');
    if (preselected && locations?.some((l) => l.id === preselected) && !storageNodeId) {
      setStorageNodeId(preselected);
    }
  }, [locations, searchParams, storageNodeId]);

  // Focus step heading on step changes for accessibility
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step, moveStep, workflow]);

  // ----------------------------------------------------
  // PACK A BOX ACTIONS
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setManualNote(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationAddError(null);
    const targetWsId = workflow === 'MOVE_BOXES' ? destinationWorkspaceId : workspaceId;
    if (!newLocationName.trim() || !targetWsId) return;

    try {
      const activeMutation = workflow === 'MOVE_BOXES' ? createDestLocationMutation : createLocationMutation;
      const newLoc = await activeMutation.mutateAsync({
        name: newLocationName.trim(),
        parentId: newLocationParentId || null,
      });
      if (workflow === 'MOVE_BOXES') {
        setMoveDestinationId(newLoc.id);
      } else {
        setStorageNodeId(newLoc.id);
        setIsTemporaryLocation(false);
      }
      setNewLocationName('');
      setNewLocationParentId('');
      setIsAddingLocation(false);
    } catch (err: any) {
      setLocationAddError(err.message || 'Failed to create location.');
    }
  };

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTemporaryLocation) {
      if (!temporaryLocationName.trim()) {
        setError('Temporary location name is required.');
        return;
      }
    } else {
      if (!storageNodeId) {
        setError('Current location is required.');
        return;
      }
    }
    setError(null);
    setStep(2);
  };

  const handleStep2Continue = () => {
    setError(null);
    setStep(3);
  };

  const handleUploadCapture = async (containerId: string): Promise<string> => {
    if (!selectedFile || !workspaceId) throw new Error('No photo or workspace context.');

    const compressed = await compressImage(selectedFile);
    const formData = new FormData();
    formData.append('file', compressed.file);

    const token = await getIdToken();
    const uploadRes = await fetch(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/containers/${encodeURIComponent(containerId)}/captures`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.json().catch(() => ({}));
      throw new Error(errText.error || `Upload failed: ${uploadRes.statusText}`);
    }

    const captureData = await uploadRes.json();
    if (!captureData.captureId) {
      throw new Error('Capture ID was not returned by the server.');
    }

    return captureData.captureId;
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    if (isTemporaryLocation && !storageNodeId) {
      setError('A temporary location cannot be saved to the database. Please select or create a real storage location.');
      setStep(1);
      return;
    }

    if (!storageNodeId) {
      setError('Current location is required.');
      setStep(1);
      return;
    }

    let activeContainer = createdContainer;
    setError(null);

    try {
      if (!activeContainer) {
        setSaveState('CREATING_BOX');
        const container = await createContainer(
          workspaceId,
          {
            storageNodeId,
            name: name.trim() || undefined,
            destinationStorageNodeId: destinationStorageNodeId || undefined,
            isPacked,
            movingPriority: movingPriority || undefined,
          },
          getIdToken
        );
        activeContainer = container;
        setCreatedContainer(container);
        setSaveState('BOX_CREATED');
      }

      if (selectedFile) {
        setSaveState('UPLOADING_CAPTURE');
        const captureId = await handleUploadCapture(activeContainer.id);
        setSaveState('COMPLETE');
        navigate(`/workspaces/${workspaceId}/captures/${captureId}/review`);
      } else {
        setSaveState('COMPLETE');
        navigate(`/workspaces/${workspaceId}/containers/${activeContainer.id}`);
      }
    } catch (err: any) {
      if (activeContainer) {
        setSaveState('PARTIAL_SUCCESS');
        setError(`Box saved, but we couldn't analyze the photo: ${err.message}`);
      } else {
        setSaveState('ERROR');
        setError(err.message || 'Failed to save box.');
      }
    }
  };

  const handleRetryUpload = async () => {
    if (!createdContainer || !selectedFile) return;
    setError(null);

    try {
      setSaveState('UPLOADING_CAPTURE');
      const captureId = await handleUploadCapture(createdContainer.id);
      setSaveState('COMPLETE');
      navigate(`/workspaces/${workspaceId}/captures/${captureId}/review`);
    } catch (err: any) {
      setSaveState('PARTIAL_SUCCESS');
      setError(`Box saved, but we couldn't analyze the photo: ${err.message}`);
    }
  };

  // ----------------------------------------------------
  // MOVE EXISTING BOXES ACTIONS
  // ----------------------------------------------------
  const handleScannerResolve = async (result: any) => {
    if (result.workspaceId !== workspaceId) {
      setWorkspaceSwitchRequest({
        workspaceId: result.workspaceId,
        workspaceName: result.locationName || 'Other Space',
        containerId: result.containerId,
      });
      return;
    }

    if (selectedBoxes.some((b) => b.id === result.containerId)) {
      setError(`BOX ${String(result.boxNumber).padStart(3, '0')} is already selected.`);
      return;
    }

    setError(null);
    const activeContainers = containers.filter((c) => !c.isArchived);
    const found = activeContainers.find((c) => c.id === result.containerId);
    if (found) {
      setSelectedBoxes((prev) => [...prev, found]);
    } else {
      try {
        const containerDetails = await fetchContainer(workspaceId!, result.containerId, getIdToken);
        setSelectedBoxes((prev) => [...prev, containerDetails]);
      } catch {
        const containerDetails: Container = {
          id: result.containerId,
          workspaceId: result.workspaceId,
          storageNodeId: result.storageNodeId,
          boxNumber: result.boxNumber,
          boxId: result.boxDisplayId || `BOX ${String(result.boxNumber).padStart(3, '0')}`,
          name: result.locationName,
          isArchived: false,
          isPacked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSelectedBoxes((prev) => [...prev, containerDetails]);
      }
    }
  };

  const handleSwitchWorkspaceConfirm = async () => {
    if (!workspaceSwitchRequest) return;
    const targetWsId = workspaceSwitchRequest.workspaceId;
    const targetContId = workspaceSwitchRequest.containerId;
    setWorkspaceSwitchRequest(null);

    if (workspaceContext) {
      workspaceContext.setActiveWorkspaceId(targetWsId);
    }

    setSelectedBoxes([]);
    setMoveDestinationId('');
    setPerBoxPriority({});
    setPerBoxStatus({});
    setError(null);

    navigate(`/workspaces/${targetWsId}/quick-pack?workflow=MOVE_BOXES`);

    try {
      const containerDetails = await fetchContainer(targetWsId, targetContId, getIdToken);
      setSelectedBoxes([containerDetails]);
    } catch {
      // Graceful fallback
    }
  };

  // ----------------------------------------------------
  // UNPACK ACTIONS
  // ----------------------------------------------------
  const handleUnpackScannerResolve = async (result: any) => {
    setUnpackError(null);
    try {
      const containerDetails = await fetchContainer(result.workspaceId, result.containerId, getIdToken);
      
      if (containerDetails.isArchived) {
        setUnpackArchivedPrompt(containerDetails);
        return;
      }
      
      if (!containerDetails.isPacked) {
        setUnpackAlreadyUnpackedPrompt(containerDetails);
        return;
      }
      
      if (result.workspaceId?.toLowerCase() !== workspaceId?.toLowerCase()) {
        const targetWorkspace = workspacesList.find((w) => w.id.toLowerCase() === result.workspaceId?.toLowerCase());
        const targetWorkspaceName = targetWorkspace?.name || 'another Storage Space';
        
        setUnpackCrossWorkspacePrompt({
          workspaceId: result.workspaceId,
          workspaceName: targetWorkspaceName,
          container: containerDetails,
        });
        return;
      }
      
      setUnpackSelectedBox(containerDetails);
      setUnpackStep(2);
      setUnpackShowScanner(false);
    } catch (err: any) {
      setUnpackError(err.message || 'Failed to fetch scanned box details.');
    }
  };

  const handleUnpackCrossWorkspaceConfirm = () => {
    if (!unpackCrossWorkspacePrompt) return;
    const { container } = unpackCrossWorkspacePrompt;
    setUnpackCrossWorkspacePrompt(null);
    setUnpackSelectedBox(container);
    setUnpackStep(2);
    setUnpackShowScanner(false);
  };

  const handleUnpackSubmit = async () => {
    if (!unpackSelectedBox) return;
    setIsUnpacking(true);
    setUnpackError(null);
    setUnpackSuccessMessage(null);

    try {
      await unpackContainer(
        unpackSelectedBox.workspaceId,
        unpackSelectedBox.id,
        getIdToken
      );

      const boxLabel = unpackSelectedBox.boxId || `BOX ${String(unpackSelectedBox.boxNumber).padStart(3, '0')}`;
      setUnpackSuccessMessage(`${boxLabel} is unpacked.`);

      // Query invalidation
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['container', unpackSelectedBox.workspaceId, unpackSelectedBox.id] });
    } catch (err: any) {
      setUnpackError(err.message || 'We couldn\'t mark this box as unpacked.');
    } finally {
      setIsUnpacking(false);
    }
  };

  const handleUnpackSuccessAnother = () => {
    setUnpackSelectedBox(null);
    setUnpackStep(1);
    setUnpackShowScanner(false);
    setUnpackSearchQuery('');
    setUnpackError(null);
    setUnpackSuccessMessage(null);
  };

  const handleUnpackSuccessViewBox = () => {
    if (!unpackSelectedBox) return;
    if (workspaceContext && unpackSelectedBox.workspaceId !== workspaceId) {
      workspaceContext.setActiveWorkspaceId(unpackSelectedBox.workspaceId);
    }
    navigate(`/workspaces/${unpackSelectedBox.workspaceId}/containers/${unpackSelectedBox.id}`);
  };

  const handleUnpackSuccessDone = () => {
    setWorkflow(null);
    setUnpackSelectedBox(null);
    setUnpackStep(1);
    setUnpackShowScanner(false);
    setUnpackSearchQuery('');
    setUnpackError(null);
    setUnpackSuccessMessage(null);
  };

  const handleToggleSelectBox = (box: Container) => {
    setError(null);
    if (selectedBoxes.some((b) => b.id === box.id)) {
      setSelectedBoxes((prev) => prev.filter((b) => b.id !== box.id));
    } else {
      setSelectedBoxes((prev) => [...prev, box]);
    }
  };

  const handleRemoveSelectedBox = (boxId: string) => {
    setSelectedBoxes((prev) => prev.filter((b) => b.id !== boxId));
  };

  const handleMoveStep1Continue = () => {
    if (selectedBoxes.length === 0) {
      setError('Please select or scan at least one box.');
      return;
    }
    setError(null);
    if (!destinationWorkspaceId) {
      setDestinationWorkspaceId(workspaceId || '');
    }
    setMoveStep(2);
  };

  const handleDestinationWorkspaceChange = (newWsId: string) => {
    setDestinationWorkspaceId(newWsId);
    setMoveDestinationId('');
    setNewLocationName('');
    setNewLocationParentId('');
    setIsAddingLocation(false);
  };

  const handleMoveStep2Continue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationWorkspaceId || !moveDestinationId) {
      setError('Destination Storage Space and Location are required.');
      return;
    }
    setError(null);
    setMoveStep(3);
  };

  const executeSequentialMove = async (boxList: Container[]) => {
    if (!workspaceId) {
      return;
    }
    setIsMovingBoxes(true);
    setError(null);

    const statuses = { ...perBoxStatus };
    for (const box of boxList) {
      statuses[box.id] = {
        moveStatus: statuses[box.id]?.moveStatus === 'SUCCESS' ? 'SUCCESS' : 'IDLE',
        priorityStatus: statuses[box.id]?.priorityStatus === 'SUCCESS' ? 'SUCCESS' : 'IDLE',
      };
    }
    setPerBoxStatus(statuses);

    for (const box of boxList) {
      const boxWorkspace = workspacesList.find((w) => w.id.toLowerCase() === box.workspaceId?.toLowerCase());
      const boxNamespaceId = boxWorkspace?.inventoryNamespaceId;
      const isSameSpace = destinationWorkspaceId?.toLowerCase() === box.workspaceId?.toLowerCase();
      const isAlreadyAtDest = isSameSpace && box.storageNodeId === moveDestinationId;


      const boxStatus = statuses[box.id] || { moveStatus: 'IDLE', priorityStatus: 'IDLE' };

      let moveSuccess = isAlreadyAtDest;
      const boxLabel = box.boxId || `BOX ${String(box.boxNumber).padStart(3, '0')}`;

      // 1. Move or Transfer
      if (boxStatus.moveStatus !== 'SUCCESS' && boxStatus.moveStatus !== 'NOT_NEEDED') {
        if (isAlreadyAtDest) {
          statuses[box.id] = { ...statuses[box.id], moveStatus: 'NOT_NEEDED' };
          setPerBoxStatus({ ...statuses });
          moveSuccess = true;
        } else {
          statuses[box.id] = { ...statuses[box.id], moveStatus: 'IN_PROGRESS' };
          setPerBoxStatus({ ...statuses });

          try {
            if (isSameSpace) {
              await moveContainer(box.workspaceId, box.id, moveDestinationId, getIdToken);
            } else {
              if (!boxNamespaceId) {
                throw new Error(`Source Inventory Namespace is missing for ${boxLabel}. Cannot perform transfer.`);
              }
              await transferContainer(
                boxNamespaceId,
                box.id,
                destinationWorkspaceId,
                moveDestinationId,
                getIdToken
              );
            }
            statuses[box.id] = { ...statuses[box.id], moveStatus: 'SUCCESS', moveError: undefined };
            moveSuccess = true;
          } catch (err: any) {
            statuses[box.id] = {
              ...statuses[box.id],
              moveStatus: 'FAILED',
              moveError: err.message || `Couldn't move ${boxLabel}.`,
            };
            moveSuccess = false;
          }
          setPerBoxStatus({ ...statuses });
        }
      } else {
        moveSuccess = true;
      }

      // 2. Patch Priority
      if (moveSuccess) {
        const prioState = perBoxPriority[box.id];
        if (prioState?.priorityWasEdited && statuses[box.id].priorityStatus !== 'SUCCESS') {
          statuses[box.id] = { ...statuses[box.id], priorityStatus: 'IN_PROGRESS' };
          setPerBoxStatus({ ...statuses });

          try {
            const targetWsId = isSameSpace ? box.workspaceId : destinationWorkspaceId;
            await updateContainer(
              targetWsId,
              box.id,
              { movingPriority: prioState.selectedPriority },
              getIdToken
            );
            statuses[box.id] = { ...statuses[box.id], priorityStatus: 'SUCCESS', priorityError: undefined };
          } catch (err: any) {
            console.error('Priority patch failed with error:', err);
            statuses[box.id] = {
              ...statuses[box.id],
              priorityStatus: 'FAILED',
              priorityError: err.message || `${boxLabel} moved, but its priority couldn't be updated.`,
            };
          }
          setPerBoxStatus({ ...statuses });
        } else if (!prioState?.priorityWasEdited) {
          statuses[box.id] = { ...statuses[box.id], priorityStatus: 'NOT_NEEDED' };
          setPerBoxStatus({ ...statuses });
        }
      } else {
        statuses[box.id] = { ...statuses[box.id], priorityStatus: 'NOT_NEEDED' };
        setPerBoxStatus({ ...statuses });
      }
    }

    setIsMovingBoxes(false);
  };

  const handleRetryMoveBox = async (box: Container) => {
    const statuses = { ...perBoxStatus };
    statuses[box.id] = { moveStatus: 'IDLE', priorityStatus: 'IDLE' };
    setPerBoxStatus(statuses);
    await executeSequentialMove([box]);
  };

  const handleRetryPriorityOnly = async (box: Container) => {
    const statuses = { ...perBoxStatus };
    statuses[box.id] = { ...statuses[box.id], priorityStatus: 'IDLE' };
    setPerBoxStatus(statuses);
    await executeSequentialMove([box]);
  };

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  const handleExitWorkflow = () => {
    setWorkflow(null);
    setStep(1);
    setMoveStep(1);
    setSelectedBoxes([]);
    setMoveDestinationId('');
    setDestinationWorkspaceId(workspaceId || '');
    setPerBoxPriority({});
    setPerBoxStatus({});
    setError(null);
  };

  const PRIORITY_OPTIONS = [
    { value: 'HIGH', label: 'Open first' },
    { value: 'MEDIUM', label: 'Normal' },
    { value: 'LOW', label: 'Can wait' },
  ];

  // ----------------------------------------------------
  // LANDING PAGE RENDER
  // ----------------------------------------------------
  if (workflow === null) {
    return (
      <div className="quickpack-container">
        <div className="quickpack-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="quickpack-badge">MOVING ASSISTANT</span>
          <h2 className="quickpack-title" style={{ fontSize: '2.25rem' }}>Moving Assistant</h2>
          <p className="quickpack-subtitle">What are you doing today?</p>
        </div>

        <div className="quickpack-landing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
          <div className="quickpack-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>📦 Pack a Box</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Create a box and record what's inside.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn--md"
              style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setWorkflow('PACK_BOX');
                setStep(1);
              }}
            >
              Pack a Box
            </button>
          </div>

          <div className="quickpack-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>🚚 Move Boxes</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Move existing boxes to another location.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn--md"
              style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setWorkflow('MOVE_BOXES');
                setMoveStep(1);
              }}
            >
              Move Boxes
            </button>
          </div>

          <div className="quickpack-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>🔓 Unpack</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Find arriving boxes and mark them unpacked.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn--md"
              style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setWorkflow('UNPACK');
                setUnpackStep(1);
                setUnpackSelectedBox(null);
                setUnpackShowScanner(false);
                setUnpackSearchQuery('');
                setUnpackError(null);
                setUnpackSuccessMessage(null);
              }}
            >
              Unpack
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // PACK A BOX FLOW RENDER
  // ----------------------------------------------------
  if (workflow === 'PACK_BOX') {
    return (
      <div className="quickpack-container">
        {/* Page Header */}
        <div className="quickpack-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="quickpack-badge">MOVING ASSISTANT</span>
            <h2 className="quickpack-title">Pack a Box</h2>
            <p className="quickpack-subtitle">Keep track of what's packed and where it's going.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            onClick={handleExitWorkflow}
          >
            Exit Assistant
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="quickpack-progress-bar">
          <span className="quickpack-progress-text">Step {step} of 3</span>
          <div className="quickpack-progress-track">
            <div className="quickpack-progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        {error && (
          <div role="alert" className="quickpack-error-banner">
            {error}
            {saveState === 'PARTIAL_SUCCESS' && createdContainer && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-primary btn--sm" onClick={handleRetryUpload}>
                  Try Photo Again
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => navigate(`/workspaces/${workspaceId}/containers/${createdContainer.id}`)}
                >
                  Go to Box
                </button>
              </div>
            )}
          </div>
        )}

        {/* Card Content per Step */}
        <div className="quickpack-card">
          {/* STEP 1: WHERE IS THIS BOX? */}
          {step === 1 && (
            <div>
              <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
                Where is this box?
              </h3>

              {isAddingLocation ? (
                <form
                  onSubmit={handleAddLocationSubmit}
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>
                    Add a Storage Location
                  </h4>
                  {locationAddError && (
                    <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      {locationAddError}
                    </div>
                  )}

                  <div className="quickpack-field-group">
                    <label htmlFor="new-location-name" className="quickpack-label">
                      Location Name *
                    </label>
                    <input
                      id="new-location-name"
                      type="text"
                      className="quickpack-input"
                      placeholder="e.g. Master Bedroom, Storage Shelf A"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="quickpack-field-group">
                    <label htmlFor="new-location-parent" className="quickpack-label">
                      Belongs inside (Optional)
                    </label>
                    <select
                      id="new-location-parent"
                      className="quickpack-select"
                      value={newLocationParentId}
                      onChange={(e) => setNewLocationParentId(e.target.value)}
                    >
                      <option value="">-- No parent / Root location --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn--sm"
                      onClick={() => setIsAddingLocation(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn--sm"
                      disabled={createLocationMutation.isPending}
                    >
                      {createLocationMutation.isPending ? 'Creating...' : 'Create Location'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleStep1Continue}>
                  <div className="quickpack-field-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label
                        htmlFor={
                          isTemporaryLocation
                            ? 'quickpack-temporary-location'
                            : 'quickpack-current-location'
                        }
                        className="quickpack-label"
                      >
                        Current location *
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0,
                          }}
                          onClick={() => setIsAddingLocation(true)}
                        >
                          + Add a Storage Location
                        </button>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0,
                          }}
                          onClick={() => {
                            setIsTemporaryLocation(!isTemporaryLocation);
                            setError(null);
                          }}
                        >
                          {isTemporaryLocation
                            ? 'Use existing Storage Location'
                            : 'Use a temporary location'}
                        </button>
                      </div>
                    </div>

                    {isTemporaryLocation ? (
                      <div>
                        <input
                          id="quickpack-temporary-location"
                          type="text"
                          className="quickpack-input"
                          placeholder="e.g. Moving Truck, Hallway, Garage Floor"
                          value={temporaryLocationName}
                          onChange={(e) => setTemporaryLocationName(e.target.value)}
                          required
                        />
                        <span className="quickpack-help-text">
                          A temporary location represents moving context and is not saved to the permanent
                          database.
                        </span>
                      </div>
                    ) : (
                      <select
                        id="quickpack-current-location"
                        className="quickpack-select"
                        value={storageNodeId}
                        onChange={(e) => setStorageNodeId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Current Location --</option>
                        {locations?.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="quickpack-field-group">
                    <label htmlFor="quickpack-destination-location" className="quickpack-label">
                      Where will it go?
                    </label>
                    <select
                      id="quickpack-destination-location"
                      className="quickpack-select"
                      value={destinationStorageNodeId}
                      onChange={(e) => setDestinationStorageNodeId(e.target.value)}
                    >
                      <option value="">-- I don't know yet --</option>
                      {locations?.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="quickpack-actions-row">
                    <button
                      type="button"
                      className="btn btn-secondary btn--md"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn--md">
                      Continue
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 2: WHAT'S INSIDE? */}
          {step === 2 && (
            <div>
              <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
                What's inside?
              </h3>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                id="quickpack-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {!selectedFile ? (
                <div className="quickpack-photo-box">
                  <button
                    type="button"
                    className="btn btn-primary btn--md quickpack-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📷 Take / Choose Contents Photo
                  </button>
                  <p className="quickpack-help-text" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
                    AI can suggest the items it sees. You'll review everything before it's added.
                  </p>

                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn--sm"
                      onClick={() => {
                        setManualNote('You can add items from the box page after this box is created.');
                      }}
                    >
                      Add items after saving
                    </button>
                    {manualNote && (
                      <p
                        className="quickpack-help-text"
                        style={{ color: '#0284c7', marginTop: '0.5rem', fontWeight: 600 }}
                      >
                        {manualNote}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="quickpack-photo-box" style={{ backgroundColor: '#ffffff', borderStyle: 'solid' }}>
                  <p style={{ fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                    Photo Selected ({selectedFile.name})
                  </p>
                  {previewUrl && (
                    <div className="quickpack-preview-container">
                      <img src={previewUrl} alt="Contents Preview" className="quickpack-preview-img" />
                    </div>
                  )}
                  <div className="quickpack-preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn--sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Photo
                    </button>
                    <button type="button" className="btn btn-danger btn--sm" onClick={handleClearFile}>
                      Remove Photo
                    </button>
                  </div>
                </div>
              )}

              <div className="quickpack-actions-row">
                <button type="button" className="btn btn-secondary btn--md" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-secondary btn--md" onClick={handleStep2Continue}>
                  Skip for now
                </button>
                <button type="button" className="btn btn-primary btn--md" onClick={handleStep2Continue}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINISH THIS BOX */}
          {step === 3 && (
            <form onSubmit={handleSaveBox}>
              <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
                Finish this box
              </h3>

              <div className="quickpack-field-group">
                <label htmlFor="quickpack-container-name" className="quickpack-label">
                  Box name (optional)
                </label>
                <input
                  id="quickpack-container-name"
                  type="text"
                  className="quickpack-input"
                  placeholder="e.g. Kitchen Appliances"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="quickpack-field-group">
                <label className="quickpack-label">When will you need it?</label>
                <div className="quickpack-priority-grid">
                  <button
                    type="button"
                    className={`quickpack-priority-pill ${
                      movingPriority === 'HIGH' ? 'quickpack-priority-pill--selected' : ''
                    }`}
                    onClick={() => setMovingPriority('HIGH')}
                  >
                    Open first
                  </button>
                  <button
                    type="button"
                    className={`quickpack-priority-pill ${
                      movingPriority === 'MEDIUM' ? 'quickpack-priority-pill--selected' : ''
                    }`}
                    onClick={() => setMovingPriority('MEDIUM')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`quickpack-priority-pill ${
                      movingPriority === 'LOW' ? 'quickpack-priority-pill--selected' : ''
                    }`}
                    onClick={() => setMovingPriority('LOW')}
                  >
                    Can wait
                  </button>
                </div>
              </div>

              <div className="quickpack-field-group">
                <label className="quickpack-checkbox-label">
                  <input
                    id="quickpack-is-packed"
                    type="checkbox"
                    className="quickpack-checkbox-input"
                    checked={isPacked}
                    onChange={(e) => setIsPacked(e.target.checked)}
                  />
                  This box is packed
                </label>
              </div>

              {/* Temporary Location Enforcer in Step 3 */}
              {isTemporaryLocation && !storageNodeId && (
                <div
                  className="quickpack-field-group"
                  style={{
                    padding: '1rem',
                    border: '1px solid #fca5a5',
                    borderRadius: '0.5rem',
                    backgroundColor: '#fff5f5',
                    color: '#c53030',
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700 }}>
                    ⚠️ A temporary location cannot be saved to the database.
                  </p>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem' }}>
                    Please select or create a real storage location to save this box.
                  </p>
                  <select
                    id="quickpack-step3-real-location"
                    className="quickpack-select"
                    value={storageNodeId}
                    onChange={(e) => setStorageNodeId(e.target.value)}
                    required
                  >
                    <option value="">-- Map to Real Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn--sm"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => setStep(1)}
                  >
                    Go back to create a location
                  </button>
                </div>
              )}

              {/* Summary Block */}
              <div className="quickpack-summary-card">
                <div className="quickpack-summary-title">SUMMARY</div>
                <div className="quickpack-summary-grid">
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">BOX</span>
                    <span className="quickpack-summary-value">{name.trim() || 'Unnamed Box'}</span>
                  </div>
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">NOW</span>
                    <span className="quickpack-summary-value">
                      {isTemporaryLocation
                        ? `${temporaryLocationName} (Temporary${storageNodeId ? ' - mapped' : ''})`
                        : currentLocationObj?.name || 'Not selected'}
                    </span>
                  </div>
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">DESTINATION</span>
                    <span className="quickpack-summary-value">
                      {destinationLocationObj?.name || "I don't know yet"}
                    </span>
                  </div>
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">CONTENTS</span>
                    <span className="quickpack-summary-value">
                      {selectedFile ? 'Photo attached for AI review' : 'No items added yet'}
                    </span>
                  </div>
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">STATUS</span>
                    <span className="quickpack-summary-value">{isPacked ? 'Packed' : 'Unpacked'}</span>
                  </div>
                  <div className="quickpack-summary-item">
                    <span className="quickpack-summary-label">NEED IT</span>
                    <span className="quickpack-summary-value">
                      {movingPriority === 'HIGH' ? 'Open first' : movingPriority === 'LOW' ? 'Can wait' : 'Normal'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="quickpack-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setStep(2)}
                  disabled={saveState === 'CREATING_BOX' || saveState === 'UPLOADING_CAPTURE'}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn--md"
                  disabled={
                    saveState === 'CREATING_BOX' ||
                    saveState === 'UPLOADING_CAPTURE' ||
                    (isTemporaryLocation && !storageNodeId)
                  }
                >
                  {saveState === 'CREATING_BOX'
                    ? 'Saving Box...'
                    : saveState === 'UPLOADING_CAPTURE'
                    ? 'Analyzing photo...'
                    : 'Save Box'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // UNPACK BOXES SEARCH & SORTING
  // ----------------------------------------------------
  const getPriorityWeight = (priority: string | null | undefined) => {
    if (!priority) return 4;
    const norm = priority.toUpperCase();
    if (norm === 'HIGH') return 1;
    if (norm === 'MEDIUM') return 2;
    if (norm === 'LOW') return 3;
    return 4;
  };

  // Find packed boxes user can access in the CURRENT workspace/Storage Space
  const unpackAvailableBoxes = containers
    .filter((c) => !c.isArchived && c.isPacked)
    .sort((a, b) => {
      const wA = getPriorityWeight(a.movingPriority);
      const wB = getPriorityWeight(b.movingPriority);
      if (wA !== wB) return wA - wB;
      return a.boxNumber - b.boxNumber;
    });

  const filteredUnpackBoxes = unpackAvailableBoxes.filter((c) => {
    const q = unpackSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const boxIdStr = c.boxId || `BOX ${String(c.boxNumber).padStart(3, '0')}`;
    const nameStr = c.name || '';
    const locName = locations.find((l) => l.id === c.storageNodeId)?.name || '';
    return (
      boxIdStr.toLowerCase().includes(q) ||
      nameStr.toLowerCase().includes(q) ||
      locName.toLowerCase().includes(q)
    );
  });

  const handleViewBoxAndSwitch = (box: Container) => {
    if (workspaceContext && box.workspaceId !== workspaceId) {
      workspaceContext.setActiveWorkspaceId(box.workspaceId);
    }
    navigate(`/workspaces/${box.workspaceId}/containers/${box.id}`);
  };

  if (workflow === 'UNPACK') {
    return (
      <div className="quickpack-container">
        {/* Page Header */}
        <div className="quickpack-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="quickpack-badge">MOVING ASSISTANT</span>
            <h2 className="quickpack-title">Unpack</h2>
            <p className="quickpack-subtitle">Find arriving boxes and mark them unpacked.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            onClick={handleUnpackSuccessDone}
            disabled={isUnpacking}
          >
            Exit Assistant
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="quickpack-progress-bar">
          <span className="quickpack-progress-text">Step {unpackStep} of 2</span>
          <div className="quickpack-progress-track">
            <div className="quickpack-progress-fill" style={{ width: `${(unpackStep / 2) * 100}%` }} />
          </div>
        </div>

        {unpackError && (
          <div role="alert" className="quickpack-error-banner">
            {unpackError}
          </div>
        )}

        {unpackSuccessMessage && (
          <div className="quickpack-card" style={{ textAlign: 'center', padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 ref={(el) => el?.focus()} tabIndex={-1} style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: '#0f172a' }}>
              {unpackSuccessMessage}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '320px', margin: '0 auto' }}>
              <button
                type="button"
                className="btn btn-primary btn--md"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleUnpackSuccessAnother}
              >
                Unpack Another Box
              </button>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleUnpackSuccessViewBox}
              >
                View Box
              </button>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleUnpackSuccessDone}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Modal warning: Cross-workspace scan confirmation */}
        {unpackCrossWorkspacePrompt && (
          <div className="quickpack-modal-overlay" role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="quickpack-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>Box in Another Storage Space</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                This box is in <strong>{unpackCrossWorkspacePrompt.workspaceName}</strong>. Do you want to continue unpacking it using its storage space context?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setUnpackCrossWorkspacePrompt(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn--md"
                  onClick={handleUnpackCrossWorkspaceConfirm}
                >
                  Continue with this box
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal warning: Already unpacked */}
        {unpackAlreadyUnpackedPrompt && (
          <div className="quickpack-modal-overlay" role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="quickpack-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>Box Already Unpacked</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                <strong>{unpackAlreadyUnpackedPrompt.boxId || `BOX ${String(unpackAlreadyUnpackedPrompt.boxNumber).padStart(3, '0')}`}</strong> is already unpacked.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setUnpackAlreadyUnpackedPrompt(null)}
                >
                  Scan Another
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn--md"
                  onClick={() => {
                    const box = unpackAlreadyUnpackedPrompt;
                    setUnpackAlreadyUnpackedPrompt(null);
                    handleViewBoxAndSwitch(box);
                  }}
                >
                  View Box
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal warning: Archived */}
        {unpackArchivedPrompt && (
          <div className="quickpack-modal-overlay" role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="quickpack-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>Box is Archived</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                This box is archived. You cannot unpack archived boxes.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn--md"
                  onClick={() => setUnpackArchivedPrompt(null)}
                >
                  Scan Another
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn--md"
                  onClick={() => {
                    const box = unpackArchivedPrompt;
                    setUnpackArchivedPrompt(null);
                    handleViewBoxAndSwitch(box);
                  }}
                >
                  View Box
                </button>
              </div>
            </div>
          </div>
        )}

        {!unpackSuccessMessage && (
          <div className="quickpack-card">
            {/* STEP 1: SELECT BOX */}
            {unpackStep === 1 && (
              <div>
                <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
                  Which box are you unpacking?
                </h3>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn--md"
                    onClick={() => setUnpackShowScanner(!unpackShowScanner)}
                  >
                    {unpackShowScanner ? 'Hide Scanner' : 'Scan a Box'}
                  </button>
                </div>

                {unpackShowScanner && (
                  <div style={{ marginBottom: '1.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem', backgroundColor: '#f8fafc' }}>
                    <CodeScanner onResolve={handleUnpackScannerResolve} buttonText="📷 Scan Box Code" />
                  </div>
                )}

                {/* Selection/Search form */}
                <div className="quickpack-field-group">
                  <label htmlFor="unpack-box-search" className="quickpack-label">Search boxes by ID, name, or location</label>
                  <input
                    id="unpack-box-search"
                    type="text"
                    className="quickpack-input"
                    placeholder="e.g. BOX 004, Kitchen"
                    value={unpackSearchQuery}
                    onChange={(e) => setUnpackSearchQuery(e.target.value)}
                  />
                </div>

                {/* Selectable packed boxes list */}
                <div className="quickpack-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem' }}>
                  {filteredUnpackBoxes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                      {unpackAvailableBoxes.length === 0 ? (
                        <div>
                          <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0', color: '#64748b' }}>No packed boxes here.</p>
                          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Scan a box from another Storage Space or choose another Storage Space.</p>
                        </div>
                      ) : (
                        'No matching packed boxes found.'
                      )}
                    </div>
                  ) : (
                    filteredUnpackBoxes.map((box) => {
                      const boxLocName = locations.find((l) => l.id === box.storageNodeId)?.name || 'Unknown Location';
                      const boxWsName = workspacesList.find((w) => w.id.toLowerCase() === box.workspaceId?.toLowerCase())?.name || 'Unknown Space';
                      const locationDisplay = `${boxWsName} / ${boxLocName}`;

                      return (
                        <div
                          key={box.id}
                          onClick={() => {
                            setUnpackSelectedBox(box);
                            setUnpackStep(2);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'border-color 0.2s',
                          }}
                          className="unpack-choice-row"
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                              {box.boxId || `BOX ${String(box.boxNumber).padStart(3, '0')}`}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '0.125rem' }}>
                              {box.name || 'Unnamed Box'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                              📍 {locationDisplay}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                              Packed
                            </span>
                            {box.movingPriority && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: box.movingPriority === 'HIGH' ? '#15803d' : box.movingPriority === 'MEDIUM' ? '#b45309' : '#4b5563', backgroundColor: box.movingPriority === 'HIGH' ? '#dcfce7' : box.movingPriority === 'MEDIUM' ? '#fef3c7' : '#f3f4f6', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                                {box.movingPriority === 'HIGH' ? 'Open first' : box.movingPriority === 'MEDIUM' ? 'Normal' : 'Can wait'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: CONFIRM & UNPACK */}
            {unpackStep === 2 && unpackSelectedBox && (
              <div>
                <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
                  Ready to unpack this box?
                </h3>

                <div className="quickpack-review-summary" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', backgroundColor: '#f8fafc', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        {unpackSelectedBox.boxId || `BOX ${String(unpackSelectedBox.boxNumber).padStart(3, '0')}`}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>
                        {unpackSelectedBox.name || 'Unnamed Box'}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                      Packed
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', marginBottom: '0.125rem' }}>Current location</span>
                      <strong style={{ color: '#0f172a' }}>
                        {workspacesList.find((w) => w.id.toLowerCase() === unpackSelectedBox.workspaceId?.toLowerCase())?.name || 'Unknown Space'} / {locations.find((l) => l.id === unpackSelectedBox.storageNodeId)?.name || 'Unknown Location'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', marginBottom: '0.125rem' }}>Moving priority</span>
                      {unpackSelectedBox.movingPriority ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: unpackSelectedBox.movingPriority === 'HIGH' ? '#15803d' : unpackSelectedBox.movingPriority === 'MEDIUM' ? '#b45309' : '#4b5563', backgroundColor: unpackSelectedBox.movingPriority === 'HIGH' ? '#dcfce7' : unpackSelectedBox.movingPriority === 'MEDIUM' ? '#fef3c7' : '#f3f4f6', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', display: 'inline-block', marginTop: '0.125rem' }}>
                          {unpackSelectedBox.movingPriority === 'HIGH' ? 'Open first' : unpackSelectedBox.movingPriority === 'MEDIUM' ? 'Normal' : 'Can wait'}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No priority</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn--md"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleUnpackSubmit}
                    disabled={isUnpacking}
                  >
                    {isUnpacking ? 'Unpacking...' : 'Mark as Unpacked'}
                  </button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn--md"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setUnpackStep(1)}
                      disabled={isUnpacking}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn--md"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleViewBoxAndSwitch(unpackSelectedBox)}
                      disabled={isUnpacking}
                    >
                      View Box
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // MOVE EXISTING BOXES RENDER
  // ----------------------------------------------------
  const workspaceContainers = containers.filter((c) => !c.isArchived);

  // Client-side search filters Box ID, Name, Location Name
  const filteredSearchContainers = workspaceContainers.filter((c) => {
    const boxNumText = `BOX ${String(c.boxNumber).padStart(3, '0')}`;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const locName = locations.find((l) => l.id === c.storageNodeId)?.name || '';
    return (
      (c.name || '').toLowerCase().includes(query) ||
      boxNumText.toLowerCase().includes(query) ||
      (c.boxId || '').toLowerCase().includes(query) ||
      locName.toLowerCase().includes(query)
    );
  });

  const getMoveCTA = () => {
    if (isMovingBoxes) return 'Moving boxes...';
    return selectedBoxes.length === 1 ? 'Move Box' : `Move ${selectedBoxes.length} Boxes`;
  };

  const getMoveSuccessCount = () => {
    return Object.values(perBoxStatus).filter(
      (s) => s.moveStatus === 'SUCCESS' || s.moveStatus === 'NOT_NEEDED'
    ).length;
  };

  const getMoveFailureCount = () => {
    return Object.values(perBoxStatus).filter((s) => s.moveStatus === 'FAILED').length;
  };

  const hasExecutedMove = Object.keys(perBoxStatus).length > 0;
  const allMovesSucceeded =
    hasExecutedMove &&
    Object.values(perBoxStatus).every(
      (s) =>
        (s.moveStatus === 'SUCCESS' || s.moveStatus === 'NOT_NEEDED') &&
        (s.priorityStatus === 'SUCCESS' || s.priorityStatus === 'NOT_NEEDED')
    );

  return (
    <div className="quickpack-container">
      {/* Page Header */}
      <div className="quickpack-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="quickpack-badge">MOVING ASSISTANT</span>
          <h2 className="quickpack-title">Move Boxes</h2>
          <p className="quickpack-subtitle">Move existing boxes to their next location.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn--sm"
          onClick={handleExitWorkflow}
          disabled={isMovingBoxes}
        >
          Exit Assistant
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="quickpack-progress-bar">
        <span className="quickpack-progress-text">Step {moveStep} of 3</span>
        <div className="quickpack-progress-track">
          <div className="quickpack-progress-fill" style={{ width: `${(moveStep / 3) * 100}%` }} />
        </div>
      </div>

      {error && (
        <div role="alert" className="quickpack-error-banner">
          {error}
        </div>
      )}

      {/* Cross-workspace switch prompt modal */}
      {workspaceSwitchRequest && (
        <div className="quickpack-modal-overlay" role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="quickpack-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>Switch Storage Space?</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              This box is in another Storage Space.
              {selectedBoxes.length > 0 && ` You already selected ${selectedBoxes.length} box(es). Switching Storage Space will clear this selection.`}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setWorkspaceSwitchRequest(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                onClick={handleSwitchWorkspaceConfirm}
              >
                Switch Storage Space
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quickpack-card">
        {/* STEP 1: SELECT BOXES */}
        {moveStep === 1 && (
          <div>
            <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
              Which boxes are you moving?
            </h3>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setShowScanner(!showScanner)}
              >
                {showScanner ? 'Hide Scanner' : 'Scan a Box'}
              </button>
            </div>

            {showScanner && (
              <div style={{ marginBottom: '1.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <CodeScanner onResolve={handleScannerResolve} buttonText="📷 Scan Box Code" />
              </div>
            )}

            {/* Selection/Search form */}
            <div className="quickpack-field-group">
              <label htmlFor="box-search" className="quickpack-label">Search boxes by ID, name, or location</label>
              <input
                id="box-search"
                type="text"
                className="quickpack-input"
                placeholder="e.g. BOX 004, Kitchen, Attic"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Accessible boxes multi-select list */}
            <div className="quickpack-field-group" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem' }}>
              {filteredSearchContainers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                  No boxes found.
                </div>
              ) : (
                filteredSearchContainers.map((box) => {
                  const boxLoc = locations.find((l) => l.id === box.storageNodeId)?.name || 'Unknown Location';
                  const isChecked = selectedBoxes.some((b) => b.id === box.id);
                  return (
                    <label
                      key={box.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        borderRadius: '0.25rem',
                        backgroundColor: isChecked ? '#f0f9ff' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        className="quickpack-checkbox-input"
                        checked={isChecked}
                        onChange={() => handleToggleSelectBox(box)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                            {box.boxId || `BOX ${String(box.boxNumber).padStart(3, '0')}`}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📍 {boxLoc}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.125rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                            {box.name || 'Unnamed Box'}
                          </span>
                          <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            {box.isPacked && (
                              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Packed</span>
                            )}
                            {box.movingPriority && (
                              <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
                                {box.movingPriority === 'HIGH' ? 'Open first' : box.movingPriority === 'LOW' ? 'Can wait' : 'Normal'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Selected Boxes Summary block */}
            <div className="quickpack-summary-card" style={{ marginTop: '1.5rem', backgroundColor: '#f8fafc' }}>
              <div className="quickpack-summary-title">Selected Boxes ({selectedBoxes.length})</div>
              {selectedBoxes.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>No boxes selected yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedBoxes.map((box) => {
                    const boxLoc = locations.find((l) => l.id === box.storageNodeId)?.name || 'Unknown Location';
                    return (
                      <div
                        key={box.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '0.375rem',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', marginRight: '0.5rem' }}>
                            {box.boxId || `BOX ${String(box.boxNumber).padStart(3, '0')}`}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                            {box.name || 'Unnamed Box'}
                          </span>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>📍 {boxLoc}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn--sm"
                          onClick={() => handleRemoveSelectedBox(box.id)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="quickpack-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={handleExitWorkflow}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                disabled={selectedBoxes.length === 0}
                onClick={handleMoveStep1Continue}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT DESTINATION */}
        {moveStep === 2 && (
          <div>
            <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
              Where are these boxes going?
            </h3>

            {isAddingLocation ? (
              <form
                onSubmit={handleAddLocationSubmit}
                style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f8fafc',
                }}
              >
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>
                  Add a Storage Location
                </h4>
                {locationAddError && (
                  <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    {locationAddError}
                  </div>
                )}

                <div className="quickpack-field-group">
                  <label htmlFor="new-location-name-move" className="quickpack-label">
                    Location Name *
                  </label>
                  <input
                    id="new-location-name-move"
                    type="text"
                    className="quickpack-input"
                    placeholder="e.g. Moving Truck, Garage Floor, Living Room"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    required
                  />
                </div>

                <div className="quickpack-field-group">
                  <label htmlFor="new-location-parent-move" className="quickpack-label">
                    Belongs inside (Optional)
                  </label>
                  <select
                    id="new-location-parent-move"
                    className="quickpack-select"
                    value={newLocationParentId}
                    onChange={(e) => setNewLocationParentId(e.target.value)}
                  >
                    <option value="">-- No parent / Root location --</option>
                    {destinationLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn--sm"
                    onClick={() => setIsAddingLocation(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn--sm"
                    disabled={createDestLocationMutation.isPending}
                  >
                    {createDestLocationMutation.isPending ? 'Creating...' : 'Create Location'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMoveStep2Continue}>
                {/* Destination Storage Space Selector */}
                <div className="quickpack-field-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label htmlFor="quickpack-move-dest-workspace" className="quickpack-label">
                      Destination Storage Space *
                    </label>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#0284c7',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                      onClick={() => setIsAddingSpace(true)}
                    >
                      + Add Storage Space
                    </button>
                  </div>

                  <select
                    id="quickpack-move-dest-workspace"
                    className="quickpack-select"
                    value={destinationWorkspaceId}
                    onChange={(e) => handleDestinationWorkspaceChange(e.target.value)}
                    required
                  >
                    <option value="">-- Select Storage Space --</option>
                    {sameInventoryWorkspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Location Selector */}
                <div className="quickpack-field-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label htmlFor="quickpack-move-destination" className="quickpack-label">
                      Destination Storage Location *
                    </label>
                    {destinationWorkspaceId && (
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#0284c7',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                        onClick={() => setIsAddingLocation(true)}
                      >
                        + Add Storage Location
                      </button>
                    )}
                  </div>

                  {destinationWorkspaceId ? (
                    destinationLocations.length === 0 ? (
                      <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem', padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>No locations in this Storage Space yet.</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn--sm"
                          onClick={() => setIsAddingLocation(true)}
                        >
                          + Add Storage Location
                        </button>
                      </div>
                    ) : (
                      <select
                        id="quickpack-move-destination"
                        className="quickpack-select"
                        value={moveDestinationId}
                        onChange={(e) => setMoveDestinationId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Destination --</option>
                        {destinationLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    )
                  ) : (
                    <select
                      id="quickpack-move-destination"
                      className="quickpack-select"
                      value=""
                      disabled
                      required
                    >
                      <option value="">-- Select Storage Space First --</option>
                    </select>
                  )}
                </div>

                <div className="quickpack-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn--md"
                    onClick={() => setMoveStep(1)}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary btn--md" disabled={!moveDestinationId || !destinationWorkspaceId}>
                    Continue
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        {/* STEP 3: REVIEW AND CONFIRM */}
        {moveStep === 3 && (
          <div>
            <h3 ref={stepHeadingRef} tabIndex={-1} className="quickpack-step-heading">
              Review Move
            </h3>

            {/* Results/Warnings Area */}
            {hasExecutedMove && (
              <div
                role="alert"
                className={`quickpack-error-banner ${allMovesSucceeded ? 'quickpack-error-banner--success' : ''}`}
                style={{
                  backgroundColor: allMovesSucceeded ? '#f0fdf4' : '#fef2f2',
                  color: allMovesSucceeded ? '#15803d' : '#dc2626',
                  borderColor: allMovesSucceeded ? '#bbf7d0' : '#fca5a5',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                {allMovesSucceeded ? (
                  <div>
                    <p style={{ fontWeight: 800, margin: 0 }}>
                      🎉 {selectedBoxes.length} boxes moved successfully to{' '}
                      {workspaceContext.workspaces.find((w) => w.id.toLowerCase() === destinationWorkspaceId?.toLowerCase())?.name || 'Unknown Space'} /{' '}
                      {getLocationPathString(moveDestinationId, destinationLocations)}!
                    </p>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn--sm"
                        onClick={handleExitWorkflow}
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn--sm"
                        onClick={() => {
                          if (workspaceContext) {
                            workspaceContext.setActiveWorkspaceId(destinationWorkspaceId);
                          }
                          navigate(`/workspaces/${destinationWorkspaceId}`);
                        }}
                      >
                        Open Destination
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 800, margin: 0 }}>
                      {getMoveSuccessCount()} box(es) moved, {getMoveFailureCount()} box(es) couldn't be moved.
                    </p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', margin: 0 }}>
                      Please review the box statuses below to retry failed moves.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>
              Moving {selectedBoxes.length} box(es) to:{' '}
              <strong style={{ color: '#0f172a' }}>
                {workspaceContext.workspaces.find((w) => w.id.toLowerCase() === destinationWorkspaceId?.toLowerCase())?.name || 'Unknown Space'} /{' '}
                {getLocationPathString(moveDestinationId, destinationLocations)}
              </strong>
            </div>
{/* Table of Boxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedBoxes.map((box) => {
                const sourceLoc = getLocationPathString(box.storageNodeId, locations);
                const destLoc = getLocationPathString(moveDestinationId, destinationLocations);
                const isSameSpace = destinationWorkspaceId?.toLowerCase() === box.workspaceId?.toLowerCase();
                const isAlreadyAtDest = isSameSpace && box.storageNodeId === moveDestinationId;

                const prioState = perBoxPriority[box.id] || {
                  selectedPriority: box.movingPriority || 'MEDIUM',
                  priorityWasEdited: false,
                };

                const outcomes = perBoxStatus[box.id] || {
                  moveStatus: isAlreadyAtDest ? 'NOT_NEEDED' : 'IDLE',
                  priorityStatus: 'IDLE',
                };

                const sourceWorkspaceName = workspaceContext.workspaces.find((w) => w.id.toLowerCase() === box.workspaceId.toLowerCase())?.name || 'Unknown Space';
                const destWorkspaceName = workspaceContext.workspaces.find((w) => w.id.toLowerCase() === destinationWorkspaceId?.toLowerCase())?.name || 'Unknown Space';

                return (
                  <div
                    key={box.id}
                    className="quickpack-summary-card"
                    style={{
                      marginTop: 0,
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                        {box.boxId || `BOX ${String(box.boxNumber).padStart(3, '0')}`} — {box.name || 'Unnamed Box'}
                      </span>

                      {/* Execution outcomes */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {outcomes.moveStatus === 'IN_PROGRESS' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Moving...
                          </span>
                        )}
                        {outcomes.moveStatus === 'SUCCESS' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Moved successfully
                          </span>
                        )}
                        {outcomes.moveStatus === 'NOT_NEEDED' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Already in {destLoc}
                          </span>
                        )}
                        {outcomes.moveStatus === 'FAILED' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Couldn't be moved
                          </span>
                        )}

                        {outcomes.priorityStatus === 'IN_PROGRESS' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Updating Priority...
                          </span>
                        )}
                        {outcomes.priorityStatus === 'FAILED' && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            Priority failed
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.375rem' }}>
                      {sourceWorkspaceName} / {sourceLoc} → {destWorkspaceName} / {destLoc}
                    </div>

                    {/* Retry Buttons */}
                    {(outcomes.moveStatus === 'FAILED' || outcomes.priorityStatus === 'FAILED') && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {outcomes.moveStatus === 'FAILED' && (
                          <button
                            type="button"
                            className="btn btn-primary btn--sm"
                            disabled={isMovingBoxes}
                            onClick={() => handleRetryMoveBox(box)}
                          >
                            Try Again
                          </button>
                        )}
                        {outcomes.moveStatus === 'SUCCESS' && outcomes.priorityStatus === 'FAILED' && (
                          <button
                            type="button"
                            className="btn btn-primary btn--sm"
                            disabled={isMovingBoxes}
                            onClick={() => handleRetryPriorityOnly(box)}
                          >
                            Retry Priority
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn--sm"
                          onClick={() => navigate(`/workspaces/${workspaceId}/containers/${box.id}`)}
                        >
                          Go to Box
                        </button>
                      </div>
                    )}

                    {/* Priority Selector per Box */}
                    <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid #f1f5f9' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.375rem' }}>
                        When will you need it?
                      </label>
                      <div className="quickpack-priority-grid" style={{ maxWidth: '420px' }}>
                        {PRIORITY_OPTIONS.map((opt) => {
                          const isSelected = prioState.selectedPriority === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`quickpack-priority-pill ${isSelected ? 'quickpack-priority-pill--selected' : ''}`}
                              style={{ fontSize: '0.8rem', padding: '0.375rem 0.5rem' }}
                              disabled={isMovingBoxes || outcomes.moveStatus === 'SUCCESS' || outcomes.moveStatus === 'NOT_NEEDED'}
                              onClick={() => {
                                setPerBoxPriority((prev) => ({
                                  ...prev,
                                  [box.id]: {
                                    selectedPriority: opt.value,
                                    priorityWasEdited: opt.value !== box.movingPriority,
                                  },
                                }));
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="quickpack-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => setMoveStep(2)}
                disabled={isMovingBoxes || allMovesSucceeded}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn--md"
                disabled={isMovingBoxes || allMovesSucceeded}
                onClick={() => executeSequentialMove(selectedBoxes)}
              >
                {getMoveCTA()}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isAddingSpace}
        onClose={() => setIsAddingSpace(false)}
        inventoryNamespaceId={sourceInventoryNamespaceId}
        onCreated={(newWorkspaceId) => {
          setDestinationWorkspaceId(newWorkspaceId);
          setMoveDestinationId('');
          setIsAddingSpace(false);
        }}
      />
    </div>
  );
};
