using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using WherezIt.Infrastructure.Services;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class AiVisionProviderTests
{
    [Fact]
    public async Task SupportedMimeTypes_Accepted_UnsupportedRejected()
    {
        var provider = new MockInventoryVisionProvider();
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("fake_image_data"));

        // Valid MIME types
        var jpegResult = await provider.AnalyzeImageAsync(stream, "image/jpeg");
        Assert.NotEmpty(jpegResult);

        var pngResult = await provider.AnalyzeImageAsync(stream, "image/png");
        Assert.NotEmpty(pngResult);

        var webpResult = await provider.AnalyzeImageAsync(stream, "image/webp");
        Assert.NotEmpty(webpResult);

        // Invalid MIME type
        await Assert.ThrowsAsync<ArgumentException>(async () =>
        {
            await provider.AnalyzeImageAsync(stream, "application/pdf");
        });
    }

    [Fact]
    public void ParseStructuredResponse_ValidJson_ParsesCorrectly()
    {
        var json = @"{
            ""items"": [
                { ""name"": ""  Screwdriver Set  "", ""quantity"": 2, ""confidence"": 0.95 },
                { ""name"": ""Flashlight"", ""quantity"": 1 }
            ]
        }";

        var results = VertexAiGeminiVisionProvider.ParseAndValidateStructuredResponse(json);

        Assert.Equal(2, results.Count);
        Assert.Equal("Screwdriver Set", results[0].Name);
        Assert.Equal(2, results[0].Quantity);
        Assert.Equal(0.95m, results[0].Confidence);

        Assert.Equal("Flashlight", results[1].Name);
        Assert.Equal(1, results[1].Quantity);
        Assert.Null(results[1].Confidence); // Optional / null
    }

    [Fact]
    public void ParseStructuredResponse_DiscardsBlankNamesAndInvalidQuantities()
    {
        var json = @"{
            ""items"": [
                { ""name"": """", ""quantity"": 1 },
                { ""name"": ""Hammer"", ""quantity"": 0 },
                { ""name"": ""Valid Wrench"", ""quantity"": 3 }
            ]
        }";

        var results = VertexAiGeminiVisionProvider.ParseAndValidateStructuredResponse(json);

        Assert.Single(results);
        Assert.Equal("Valid Wrench", results[0].Name);
        Assert.Equal(3, results[0].Quantity);
    }

    [Fact]
    public void ParseStructuredResponse_MalformedJson_ThrowsInvalidOperationException()
    {
        var malformedJson = "{ invalid_json }";

        Assert.Throws<InvalidOperationException>(() =>
        {
            VertexAiGeminiVisionProvider.ParseAndValidateStructuredResponse(malformedJson);
        });
    }
}
