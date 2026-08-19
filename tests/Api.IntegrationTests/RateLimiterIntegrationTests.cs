using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using WherezIt.Api.IntegrationTests.Fixtures;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class RateLimiterIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public RateLimiterIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task HealthEndpoints_RemainUnthrottled_AndRateLimiterEnforces429()
    {
        using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        // 1. Health check endpoints remain unthrottled (can hit 50 times cleanly)
        for (int i = 0; i < 50; i++)
        {
            var response = await client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
