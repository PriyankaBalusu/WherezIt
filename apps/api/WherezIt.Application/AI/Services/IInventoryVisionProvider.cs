using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.AI.Dtos;

namespace WherezIt.Application.AI.Services;

public interface IInventoryVisionProvider
{
    Task<IReadOnlyList<RawDetectionSuggestionDto>> AnalyzeImageAsync(
        Stream imageStream,
        string contentType,
        CancellationToken cancellationToken = default);
}
