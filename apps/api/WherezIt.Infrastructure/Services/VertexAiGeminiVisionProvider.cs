using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;

namespace WherezIt.Infrastructure.Services;

public class GeminiOptions
{
    public string ProjectId { get; set; } = "wherezit-505615";
    public string Location { get; set; } = "us-central1";
    public string ModelName { get; set; } = "gemini-3.1-flash-lite";
}

public class VertexAiGeminiVisionProvider : IInventoryVisionProvider
{
    private readonly GeminiOptions _options;
    private readonly ILogger<VertexAiGeminiVisionProvider> _logger;

    public VertexAiGeminiVisionProvider(GeminiOptions options, ILogger<VertexAiGeminiVisionProvider> logger)
    {
        _options = options;
        _logger = logger;
    }

    public Task<IReadOnlyList<RawDetectionSuggestionDto>> AnalyzeImageAsync(
        Stream imageStream,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(contentType) ||
            (!contentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase) &&
             !contentType.Equals("image/jpg", StringComparison.OrdinalIgnoreCase) &&
             !contentType.Equals("image/png", StringComparison.OrdinalIgnoreCase) &&
             !contentType.Equals("image/webp", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException($"Unsupported image content-type: '{contentType}'.");
        }

        if (imageStream == null || imageStream.Length == 0)
        {
            throw new ArgumentException("Image stream must not be empty.");
        }

        // Wave 9 Guardrail: Live Gemini inference is NOT authorized.
        _logger.LogInformation("VertexAiGeminiVisionProvider configured with model {ModelName} in project {ProjectId}. Live call skipped per Wave 9 guardrail.", _options.ModelName, _options.ProjectId);

        IReadOnlyList<RawDetectionSuggestionDto> mockResults = new List<RawDetectionSuggestionDto>
        {
            new RawDetectionSuggestionDto
            {
                Name = "Gemini Detected Storage Box",
                Quantity = 1,
                Confidence = null
            }
        };

        return Task.FromResult(mockResults);
    }

    public static IReadOnlyList<RawDetectionSuggestionDto> ParseAndValidateStructuredResponse(string jsonResponse)
    {
        if (string.IsNullOrWhiteSpace(jsonResponse))
        {
            throw new InvalidOperationException("Gemini response was empty or null.");
        }

        try
        {
            using var doc = JsonDocument.Parse(jsonResponse);
            var root = doc.RootElement;
            if (!root.TryGetProperty("items", out var itemsElement) || itemsElement.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("Gemini JSON response missing 'items' array.");
            }

            var validSuggestions = new List<RawDetectionSuggestionDto>();

            foreach (var item in itemsElement.EnumerateArray())
            {
                if (!item.TryGetProperty("name", out var nameProp)) continue;
                var name = nameProp.GetString()?.Trim();
                if (string.IsNullOrEmpty(name)) continue;

                int quantity = 1;
                if (item.TryGetProperty("quantity", out var qtyProp) && qtyProp.ValueKind == JsonValueKind.Number)
                {
                    quantity = qtyProp.GetInt32();
                }

                if (quantity < 1) continue; // Discard invalid quantity < 1

                decimal? confidence = null;
                if (item.TryGetProperty("confidence", out var confProp) && confProp.ValueKind == JsonValueKind.Number)
                {
                    var val = confProp.GetDecimal();
                    if (val >= 0.0m && val <= 1.0m)
                    {
                        confidence = val;
                    }
                }

                validSuggestions.Add(new RawDetectionSuggestionDto
                {
                    Name = name,
                    Quantity = quantity,
                    Confidence = confidence
                });
            }

            return validSuggestions;
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Failed to parse Gemini structured JSON output.", ex);
        }
    }
}
