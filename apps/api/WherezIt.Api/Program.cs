using WherezIt.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();

// Process liveness endpoint (API alive, no external DB dependency check)
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTimeOffset.UtcNow }));
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "Healthy", version = "v1", timestamp = DateTimeOffset.UtcNow }));

// Database readiness endpoint (verifies active PostgreSQL connection)
app.MapHealthChecks("/health/ready");

app.MapControllers();

app.Run();

public partial class Program { }
