using System.Net;
using WherezIt.Api.IntegrationTests.Fixtures;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ApiHealthTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ApiHealthTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task HealthEndpoint_Returns200OK()
    {
        var client = _fixture.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

