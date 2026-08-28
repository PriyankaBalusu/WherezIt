using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;

namespace WherezIt.Infrastructure.Services;

public class GeminiOptions
{
    public string ProjectId { get; set; } = "wherezit-505615";
    public string Location { get; set; } = "us-central1";
    public string ModelName { get; set; } = "gemini-2.0-flash-lite";
    public bool UseMockVision { get; set; } = false;
}

public class VertexAiGeminiVisionProvider : IInventoryVisionProvider
{
    private readonly GeminiOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<VertexAiGeminiVisionProvider> _logger;

    public VertexAiGeminiVisionProvider(
        IOptions<GeminiOptions> options,
        HttpClient httpClient,
        ILogger<VertexAiGeminiVisionProvider> logger)
    {
        _options = options.Value;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<IReadOnlyList<RawDetectionSuggestionDto>> AnalyzeImageAsync(
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

        string mimeType = contentType.Equals("image/jpg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg" : contentType.ToLowerInvariant();

        if (imageStream.CanSeek)
        {
            imageStream.Position = 0;
        }

        using var ms = new MemoryStream();
        await imageStream.CopyToAsync(ms, cancellationToken);
        var imageBytes = ms.ToArray();
        _logger.LogInformation("Image stream copied for analysis. MIME: {MimeType}, Bytes: {ByteCount}, CanSeek: {CanSeek}", mimeType, imageBytes.Length, imageStream.CanSeek);
        var base64Image = Convert.ToBase64String(imageBytes);

        GoogleCredential credential;
        try
        {
            credential = await GoogleCredential.GetApplicationDefaultAsync(cancellationToken);
            if (credential.IsCreateScopedRequired)
            {
                credential = credential.CreateScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Google Application Default Credentials (ADC).");
            throw new UnauthorizedAccessException("Google Application Default Credentials (ADC) were not found. Run 'gcloud auth application-default login' in terminal to authenticate.", ex);
        }

        var accessToken = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: cancellationToken);

        var endpointUrl = $"https://aiplatform.{_options.Location}.rep.googleapis.com/v1/projects/{_options.ProjectId}/locations/{_options.Location}/publishers/google/models/{_options.ModelName}:generateContent";

        var promptText = @"You are analyzing a photo of household/storage contents for a personal storage inventory application.

Identify practical stored items that a user may later search for.

Rules:
1. Return only clearly visible, useful inventory items.
2. Do not identify background materials, surfaces, colors, handles, straps, shadows, or visual fragments as separate items.
3. Group repeated similar objects when reasonable.
4. Estimate quantities conservatively.
5. If exact quantity is unclear because objects overlap or are obscured, prefer a conservative quantity rather than inventing hidden objects.
6. Give each suggestion a short searchable name.
7. Suggest one simple category.
8. Do not infer items that are not visible.
9. Confidence must represent confidence that the named item is actually visible.
10. Return structured JSON only conforming strictly to the response schema.";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new { text = promptText },
                        new
                        {
                            inlineData = new
                            {
                                mimeType = mimeType,
                                data = base64Image
                            }
                        }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                responseSchema = new
                {
                    type = "OBJECT",
                    properties = new
                    {
                        items = new
                        {
                            type = "ARRAY",
                            items = new
                            {
                                type = "OBJECT",
                                properties = new
                                {
                                    name = new { type = "STRING" },
                                    quantity = new { type = "INTEGER" },
                                    category = new { type = "STRING" },
                                    confidence = new { type = "NUMBER" }
                                },
                                required = new[] { "name", "quantity" }
                            }
                        }
                    },
                    required = new[] { "items" }
                },
                temperature = 0.2,
                maxOutputTokens = 2048
            }
        };

        var jsonPayload = JsonSerializer.Serialize(requestBody);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpointUrl);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        httpRequest.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        _logger.LogInformation("Invoking Vertex AI Gemini model {ModelName} in project {ProjectId} ({Location})...", _options.ModelName, _options.ProjectId, _options.Location);

        using var httpResponse = await _httpClient.SendAsync(httpRequest, cancellationToken);

        if (!httpResponse.IsSuccessStatusCode)
        {
            var errorContent = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Vertex AI HTTP {StatusCode} failure: {ErrorContent}", (int)httpResponse.StatusCode, errorContent);

            switch ((int)httpResponse.StatusCode)
            {
                case 401:
                case 403:
                    throw new UnauthorizedAccessException($"Vertex AI authorization failure ({(int)httpResponse.StatusCode}). Ensure active ADC and roles/aiplatform.user role for project {_options.ProjectId}. Details: {errorContent}");
                case 404:
                    throw new InvalidOperationException($"Vertex AI model endpoint not found (404). Model: {_options.ModelName}, Location: {_options.Location}. Details: {errorContent}");
                case 429:
                    throw new InvalidOperationException($"Vertex AI rate limit exceeded (429). Please try again shortly.");
                default:
                    throw new InvalidOperationException($"We couldn't analyze this photo right now. Try again.");
            }
        }

        var responseJson = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
        _logger.LogInformation("Vertex AI response received successfully. Parsing structured response...");

        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("Vertex AI returned no candidate completions.");
        }

        var candidate = candidates[0];
        if (!candidate.TryGetProperty("content", out var content) ||
            !content.TryGetProperty("parts", out var parts) ||
            parts.ValueKind != JsonValueKind.Array || parts.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("Vertex AI candidate missing content parts.");
        }

        var text = parts[0].GetProperty("text").GetString();
        return ParseAndValidateStructuredResponse(text ?? "");
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

            JsonElement itemsElement = root;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("items", out var itemsProp))
            {
                itemsElement = itemsProp;
            }

            if (itemsElement.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("Gemini JSON response missing 'items' array.");
            }

            var validSuggestions = new List<RawDetectionSuggestionDto>();

            foreach (var item in itemsElement.EnumerateArray())
            {
                if (!item.TryGetProperty("name", out var nameProp)) continue;
                var name = nameProp.GetString()?.Trim();
                if (string.IsNullOrEmpty(name)) continue;

                if (name.Length > 200) name = name.Substring(0, 200).Trim();

                int quantity = 1;
                if (item.TryGetProperty("quantity", out var qtyProp) && qtyProp.ValueKind == JsonValueKind.Number)
                {
                    quantity = qtyProp.GetInt32();
                }

                if (quantity < 1) continue;
                if (quantity > 1000) quantity = 1000;

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

    public async Task<string?> ExtractLabelTextAsync(
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

        string mimeType = contentType.Equals("image/jpg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg" : contentType.ToLowerInvariant();

        if (imageStream.CanSeek)
        {
            imageStream.Position = 0;
        }

        using var ms = new MemoryStream();
        await imageStream.CopyToAsync(ms, cancellationToken);
        var imageBytes = ms.ToArray();
        _logger.LogInformation("Image stream copied for OCR. MIME: {MimeType}, Bytes: {ByteCount}, CanSeek: {CanSeek}", mimeType, imageBytes.Length, imageStream.CanSeek);
        var base64Image = Convert.ToBase64String(imageBytes);

        GoogleCredential credential;
        try
        {
            credential = await GoogleCredential.GetApplicationDefaultAsync(cancellationToken);
            if (credential.IsCreateScopedRequired)
            {
                credential = credential.CreateScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Google Application Default Credentials (ADC).");
            throw new UnauthorizedAccessException("Google Application Default Credentials (ADC) were not found.", ex);
        }

        var accessToken = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: cancellationToken);
        var endpointUrl = $"https://aiplatform.{_options.Location}.rep.googleapis.com/v1/projects/{_options.ProjectId}/locations/{_options.Location}/publishers/google/models/{_options.ModelName}:generateContent";

        var promptText = @"You are reading a photograph of a physical label, tag, sticker, handwritten marking, or printed packaging text on an item or container.

Transcribe visible text that could help a user recognize or identify the item or container.

Rules:
1. Transcribe only text that is visibly present.
2. Preserve useful identifying words, names, codes, or short phrases.
3. Ignore unrelated background text when possible.
4. Do not invent missing words or guess unreadable letters.
5. Do not infer a generic category or label name that is not visibly written.
6. If there is no useful readable text, return empty JSON with detectedText = null.";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new { text = promptText },
                        new
                        {
                            inlineData = new
                            {
                                mimeType = mimeType,
                                data = base64Image
                            }
                        }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                responseSchema = new
                {
                    type = "OBJECT",
                    properties = new
                    {
                        detectedText = new { type = "STRING" }
                    }
                },
                temperature = 0.1,
                maxOutputTokens = 256
            }
        };

        var jsonPayload = JsonSerializer.Serialize(requestBody);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpointUrl);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        httpRequest.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        _logger.LogInformation("Invoking Vertex AI Gemini model {ModelName} for label OCR...", _options.ModelName);

        using var httpResponse = await _httpClient.SendAsync(httpRequest, cancellationToken);
        if (!httpResponse.IsSuccessStatusCode)
        {
            var errorContent = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Vertex AI OCR HTTP {StatusCode} failure: {ErrorContent}", (int)httpResponse.StatusCode, errorContent);
            return null;
        }

        var responseJson = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
        {
            return null;
        }

        var candidate = candidates[0];
        if (!candidate.TryGetProperty("content", out var content) ||
            !content.TryGetProperty("parts", out var parts) ||
            parts.ValueKind != JsonValueKind.Array || parts.GetArrayLength() == 0)
        {
            return null;
        }

        var text = parts[0].GetProperty("text").GetString();
        if (string.IsNullOrWhiteSpace(text)) return null;

        try
        {
            using var labelDoc = JsonDocument.Parse(text);
            if (labelDoc.RootElement.TryGetProperty("detectedText", out var detectedProp))
            {
                var result = detectedProp.GetString()?.Trim();
                return string.IsNullOrWhiteSpace(result) ? null : result;
            }
        }
        catch
        {
            var rawTrimmed = text.Trim();
            return string.IsNullOrWhiteSpace(rawTrimmed) ? null : rawTrimmed;
        }

        return null;
    }
}
