using System;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.Authentication;

namespace WherezIt.Application.AI.Services;

public interface IAICaptureConfirmationService
{
    Task<ConfirmCaptureResponseDto> ConfirmCaptureAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid captureId,
        ConfirmCaptureRequestDto request,
        CancellationToken cancellationToken = default);
}
