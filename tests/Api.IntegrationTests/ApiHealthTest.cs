using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ApiHealthTest : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiHealthTest(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthEndpoint_Returns200OK()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
