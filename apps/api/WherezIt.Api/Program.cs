using WherezIt.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddInfrastructure();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTimeOffset.UtcNow }));
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "Healthy", version = "v1", timestamp = DateTimeOffset.UtcNow }));

app.MapControllers();

app.Run();

public partial class Program { }
