import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import * as imageApi from '../images/api/imageApi';

vi.mock('../auth/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test_firebase_uid', email: 'test@example.com' },
    getIdToken: vi.fn().mockResolvedValue('fake_id_token'),
  }),
}));

describe('CameraCaptureModal (PWA-002)', () => {
  let queryClient: QueryClient;
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const containerId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();

    // Mock URL.createObjectURL and revokeObjectURL for JSDOM
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-blob');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders input with accept and capture attributes when open', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CameraCaptureModal
          workspaceId={workspaceId}
          containerId={containerId}
          isOpen={true}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    const input = screen.getByLabelText(/Select or capture image/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(input.getAttribute('capture')).toBe('environment');
  });

  it('shows error when file size exceeds 10MB', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CameraCaptureModal
          workspaceId={workspaceId}
          containerId={containerId}
          isOpen={true}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    const file = new File(['a'.repeat(1024)], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    const input = screen.getByLabelText(/Select or capture image/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Image size exceeds 10 MB limit.');
    });
  });

  it('uploads selected image successfully and calls onSuccess', async () => {
    const uploadSpy = vi.spyOn(imageApi, 'uploadContainerImage').mockResolvedValue({
      id: 'img-123',
      workspaceId,
      containerId,
      contentType: 'image/jpeg',
      sizeBytes: 2048,
      createdAt: new Date().toISOString(),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CameraCaptureModal
          workspaceId={workspaceId}
          containerId={containerId}
          isOpen={true}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </QueryClientProvider>
    );

    const file = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/Select or capture image/i);
    fireEvent.change(input, { target: { files: [file] } });

    const uploadBtn = screen.getByText('Upload Photo');
    expect(uploadBtn).not.toBeDisabled();
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(workspaceId, containerId, file, 'fake_id_token');
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
