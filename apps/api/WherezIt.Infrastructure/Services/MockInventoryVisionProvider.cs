using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;

namespace WherezIt.Infrastructure.Services;

public class MockInventoryVisionProvider : IInventoryVisionProvider
{
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    };

    public Task<IReadOnlyList<RawDetectionSuggestionDto>> AnalyzeImageAsync(
        Stream imageStream,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(contentType) || !AllowedMimeTypes.Contains(contentType))
        {
            throw new ArgumentException($"Unsupported image content-type: '{contentType}'. Supported types are image/jpeg, image/png, image/webp.");
        }

        if (imageStream == null || imageStream.Length == 0)
        {
            throw new ArgumentException("Image stream must not be null or empty.");
        }

        IReadOnlyList<RawDetectionSuggestionDto> mockResults = new List<RawDetectionSuggestionDto>
        {
            new RawDetectionSuggestionDto
            {
                Name = "Sample Detected Item",
                Quantity = 1,
                Confidence = null // Omitted / nullable per contract
            }
        };

        return Task.FromResult(mockResults);
    }
}
