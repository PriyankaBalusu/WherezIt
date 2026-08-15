# Runtime base stage for Cloud Run (.NET 10)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Build stage (.NET 10 SDK, root context required)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy Central Package Management file for restore layer caching
COPY ["Directory.Packages.props", "."]
COPY ["WherezIt.sln", "."]

# Copy C# project files for dependency restoration
COPY ["apps/api/WherezIt.Domain/WherezIt.Domain.csproj", "apps/api/WherezIt.Domain/"]
COPY ["apps/api/WherezIt.Application/WherezIt.Application.csproj", "apps/api/WherezIt.Application/"]
COPY ["apps/api/WherezIt.Infrastructure/WherezIt.Infrastructure.csproj", "apps/api/WherezIt.Infrastructure/"]
COPY ["apps/api/WherezIt.Api/WherezIt.Api.csproj", "apps/api/WherezIt.Api/"]

# Restore packages for API project
RUN dotnet restore "apps/api/WherezIt.Api/WherezIt.Api.csproj"

# Copy backend source code
COPY ["apps/api/", "apps/api/"]

# Build release binaries
WORKDIR "/src/apps/api/WherezIt.Api"
RUN dotnet build "WherezIt.Api.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "WherezIt.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final production stage
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WherezIt.Api.dll"]
