using System;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.Authentication;

namespace WherezIt.Application.AI.Services;

public interface IAICaptureReviewService
{
    Task<CaptureReviewResponseDto> GetCaptureReviewAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid captureId,
        CancellationToken cancellationToken = default);
}
