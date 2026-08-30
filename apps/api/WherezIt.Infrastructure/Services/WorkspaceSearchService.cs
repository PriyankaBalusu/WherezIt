using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Search.Dtos;
using WherezIt.Application.Search.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class WorkspaceSearchService : IWorkspaceSearchService
{
    private static readonly Regex BoxQueryRegex = new(@"^(?:BOX\s*[#-]?\s*)?(\d{1,6})$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "where", "where's", "wheres", "where is", "where are", "my", "the", "a", "an", "find",
        "show", "me", "stuff in the", "stuff", "containing", "with", "located in", "what's in", "in", "is", "are"
    };

    private readonly WherezItDbContext _dbContext;
    private readonly IBreadcrumbService _breadcrumbService;

    public WorkspaceSearchService(
        WherezItDbContext dbContext,
        IBreadcrumbService breadcrumbService)
    {
        _dbContext = dbContext;
        _breadcrumbService = breadcrumbService;
    }

    public async Task<IReadOnlyList<SearchResultDto>> SearchWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string query,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<SearchResultDto>();
        }

        // Build Structured Query Context
        var context = BuildQueryContext(query);
        if (context.Components.Count == 0 && string.IsNullOrWhiteSpace(context.CleanedQuery))
        {
            return Array.Empty<SearchResultDto>();
        }

        // Fetch Candidate Data
        var containers = await _dbContext.Containers
            .AsNoTracking()
            .Include(c => c.StorageNode)
            .Where(c => c.WorkspaceId == workspaceId && !c.IsArchived)
            .ToListAsync(cancellationToken);

        var items = await _dbContext.Items
            .AsNoTracking()
            .Include(i => i.Container)
            .ThenInclude(c => c.StorageNode)
            .Where(i => i.WorkspaceId == workspaceId && !i.IsArchived && !i.Container.IsArchived)
            .ToListAsync(cancellationToken);

        // Score & Rank Candidates
        var candidateScores = new List<(double Score, SearchResultDto Dto)>();
        var containerIdsAdded = new HashSet<Guid>();
        var itemIdsAdded = new HashSet<Guid>();

        // Score Containers
        foreach (var c in containers)
        {
            double score = ScoreContainer(c, context);
            if (score > 0 && containerIdsAdded.Add(c.Id))
            {
                var (locationId, locationName, breadcrumbSegments, breadcrumbDisplay) =
                    await ResolveLocationBreadcrumbAsync(identity, workspaceId, c.StorageNodeId, c.StorageNode?.Name, cancellationToken);

                var boxDisplayId = c.BoxNumber < 1000 ? $"BOX {c.BoxNumber:D3}" : $"BOX {c.BoxNumber}";

                candidateScores.Add((score, new SearchResultDto
                {
                    ResultType = "CONTAINER",
                    ItemId = null,
                    ItemName = null,
                    Quantity = null,
                    ContainerId = c.Id,
                    BoxNumber = c.BoxNumber,
                    BoxDisplayId = boxDisplayId,
                    LocationId = locationId,
                    LocationName = locationName,
                    Breadcrumb = breadcrumbSegments,
                    BreadcrumbDisplay = breadcrumbDisplay
                }));
            }
        }

        // Score Items
        foreach (var item in items)
        {
            double score = ScoreItem(item, context);
            if (score > 0 && itemIdsAdded.Add(item.Id))
            {
                var (locationId, locationName, breadcrumbSegments, breadcrumbDisplay) =
                    await ResolveLocationBreadcrumbAsync(identity, workspaceId, item.Container.StorageNodeId, item.Container.StorageNode?.Name, cancellationToken);

                var boxDisplayId = item.Container.BoxNumber < 1000 ? $"BOX {item.Container.BoxNumber:D3}" : $"BOX {item.Container.BoxNumber}";

                candidateScores.Add((score, new SearchResultDto
                {
                    ResultType = "ITEM",
                    ItemId = item.Id,
                    ItemName = item.Name,
                    Quantity = item.Quantity,
                    ContainerId = item.ContainerId,
                    BoxNumber = item.Container.BoxNumber,
                    BoxDisplayId = boxDisplayId,
                    LocationId = locationId,
                    LocationName = locationName,
                    Breadcrumb = breadcrumbSegments,
                    BreadcrumbDisplay = breadcrumbDisplay
                }));
            }
        }

        return candidateScores
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Dto.BoxNumber)
            .Select(x => x.Dto)
            .ToList();
    }

    private static SearchQueryContext BuildQueryContext(string rawQuery)
    {
        var rawTrimmed = rawQuery.Trim();
        if (rawTrimmed.Length > 150)
        {
            rawTrimmed = rawTrimmed.Substring(0, 150).Trim();
        }

        var (cleanedQuery, tokens) = NormalizeQuery(rawTrimmed);
        int? targetBoxNumber = DetectBoxNumber(rawTrimmed, cleanedQuery);
        bool isShortQuery = cleanedQuery.Length <= 3 && !targetBoxNumber.HasValue;

        var components = new List<QueryComponent>();
        var addedTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var token in tokens)
        {
            if (!addedTokens.Add(token)) continue;

            var concepts = SearchVocabulary.FindConceptsForTerm(token);
            if (concepts.Count > 0)
            {
                components.Add(new QueryComponent(token, concepts[0]));
            }
            else if (!isShortQuery && token.Length >= 4)
            {
                string? bestTerm = FindClosestVocabularyTerm(token);
                if (bestTerm != null)
                {
                    var typoConcepts = SearchVocabulary.FindConceptsForTerm(bestTerm);
                    if (typoConcepts.Count > 0)
                    {
                        components.Add(new QueryComponent(token, typoConcepts[0]));
                        continue;
                    }
                }
                components.Add(new QueryComponent(token, concept: null));
            }
            else
            {
                components.Add(new QueryComponent(token, concept: null));
            }
        }

        return new SearchQueryContext(rawTrimmed, cleanedQuery, components, targetBoxNumber, isShortQuery);
    }

    private static (string CleanedQuery, List<string> Tokens) NormalizeQuery(string rawQuery)
    {
        string q = rawQuery.ToLowerInvariant();

        // Remove filler phrases
        foreach (var stop in StopWords)
        {
            if (q.StartsWith(stop + " "))
            {
                q = q.Substring(stop.Length).Trim();
            }
            else if (q.EndsWith(" " + stop))
            {
                q = q.Substring(0, q.Length - stop.Length).Trim();
            }
        }

        q = Regex.Replace(q, @"[^\w\s#\-]", " ");
        q = Regex.Replace(q, @"\s+", " ").Trim();

        var rawTokens = q.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        var tokens = new List<string>();

        foreach (var t in rawTokens)
        {
            if (StopWords.Contains(t)) continue;

            string normalized = NormalizePlural(t);
            tokens.Add(normalized);
        }

        return (q, tokens);
    }

    private static string NormalizePlural(string word)
    {
        if (word.EndsWith("ies") && word.Length > 4)
            return word.Substring(0, word.Length - 3) + "y";
        if (word.EndsWith("es") && word.Length > 3 && !word.EndsWith("shoes") && !word.EndsWith("clothes") && !word.EndsWith("glasses"))
            return word.Substring(0, word.Length - 2);
        if (word.EndsWith("s") && word.Length > 3 && !word.EndsWith("ss") && !word.EndsWith("shoes") && !word.EndsWith("clothes") && !word.EndsWith("glasses"))
            return word.Substring(0, word.Length - 1);

        return word;
    }

    private static int? DetectBoxNumber(string rawQuery, string cleanedQuery)
    {
        var match = BoxQueryRegex.Match(rawQuery);
        if (match.Success && int.TryParse(match.Groups[1].Value, out int num1))
        {
            return num1;
        }

        match = BoxQueryRegex.Match(cleanedQuery);
        if (match.Success && int.TryParse(match.Groups[1].Value, out int num2))
        {
            return num2;
        }

        if (int.TryParse(cleanedQuery, out int directNum))
        {
            return directNum;
        }

        return null;
    }

    private static string? FindClosestVocabularyTerm(string queryToken)
    {
        string? bestTerm = null;
        int minDistance = int.MaxValue;

        foreach (var concept in SearchVocabulary.Concepts)
        {
            foreach (var term in concept.Terms)
            {
                int dist = LevenshteinDistance(queryToken, term);
                int maxAllowed = queryToken.Length <= 5 ? 1 : 2;

                if (dist <= maxAllowed && dist < minDistance)
                {
                    minDistance = dist;
                    bestTerm = term;
                }
            }
        }

        return bestTerm;
    }

    private static double ScoreContainer(Container container, SearchQueryContext context)
    {
        // 1. Exact Box Number Match (Weight: VERY HIGH - 100)
        if (context.TargetBoxNumber.HasValue && container.BoxNumber == context.TargetBoxNumber.Value)
        {
            return 100;
        }

        var boxDisplay = container.BoxNumber < 1000 ? $"BOX {container.BoxNumber:D3}" : $"BOX {container.BoxNumber}";
        var cName = (container.Name ?? "").ToLowerInvariant();
        var cLabel = (container.PhysicalLabel ?? "").ToLowerInvariant();
        var cDesc = (container.Description ?? "").ToLowerInvariant();
        var locName = (container.StorageNode?.Name ?? "").ToLowerInvariant();

        // 2. Exact Container Name Match (Weight: 90)
        if (!string.IsNullOrEmpty(cName) && (cName == context.CleanedQuery || cName == context.RawQuery.ToLowerInvariant()))
        {
            return 90;
        }
        if (!string.IsNullOrEmpty(cLabel) && (cLabel == context.CleanedQuery || cLabel == context.RawQuery.ToLowerInvariant()))
        {
            return 85;
        }

        if (boxDisplay.Equals(context.RawQuery, StringComparison.OrdinalIgnoreCase))
        {
            return 95;
        }

        double rawScore = 0;
        int matchedComponents = 0;

        foreach (var component in context.Components)
        {
            bool compMatched = false;
            double compScore = 0;

            if (cName.Contains(component.Token))
            {
                compScore += cName.Equals(component.Token) ? 40 : 30;
                compMatched = true;
            }
            else if (cLabel.Contains(component.Token))
            {
                compScore += 25;
                compMatched = true;
            }
            else if (component.Concept != null)
            {
                var words = cName.Split(new[] { ' ', '-', '_', '/' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var w in words)
                {
                    if (component.Concept.ContainsTerm(w))
                    {
                        compScore += 20;
                        compMatched = true;
                        break;
                    }
                }
            }

            if (!compMatched)
            {
                if (locName.Contains(component.Token))
                {
                    compScore += 15;
                    compMatched = true;
                }
                else if (cDesc.Contains(component.Token))
                {
                    compScore += 10;
                    compMatched = true;
                }
            }

            if (compMatched)
            {
                matchedComponents++;
                rawScore += compScore;
            }
        }

        if (matchedComponents == 0)
        {
            if (!context.IsShortQuery && (IsFuzzyMatch(context.CleanedQuery, cName) || IsFuzzyMatch(context.CleanedQuery, cLabel)))
            {
                return 20;
            }
            return 0;
        }

        // Multi-component Coverage Ratio Calculation
        if (context.Components.Count > 1)
        {
            double coverageRatio = (double)matchedComponents / context.Components.Count;

            if (coverageRatio >= 1.0)
            {
                rawScore += 35;
            }
            else
            {
                rawScore *= (coverageRatio * 0.35);
            }
        }

        return rawScore;
    }

    private static double ScoreItem(Item item, SearchQueryContext context)
    {
        var iName = (item.Name ?? "").ToLowerInvariant();
        var iCategory = (item.Category ?? "").ToLowerInvariant();
        var locName = (item.Container?.StorageNode?.Name ?? "").ToLowerInvariant();
        var cDesc = (item.Container?.Description ?? "").ToLowerInvariant();

        // 1. Exact Item Name Match (Weight: 95)
        if (iName == context.CleanedQuery || iName == context.RawQuery.ToLowerInvariant())
        {
            return 95;
        }

        // 2. Item Name Prefix Match (Weight: 80)
        if (iName.StartsWith(context.CleanedQuery))
        {
            return 80;
        }

        double rawScore = 0;
        int matchedComponents = 0;
        var itemWords = iName.Split(new[] { ' ', '-', '_', '/', '.' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var component in context.Components)
        {
            bool compMatched = false;
            double compScore = 0;

            // Direct literal match in item name
            if (iName.Contains(component.Token))
            {
                compScore += iName.Equals(component.Token) ? 40 : 30;
                compMatched = true;
            }
            else if (component.Concept != null)
            {
                // Concept sibling term match in item name
                foreach (var word in itemWords)
                {
                    if (component.Concept.ContainsTerm(word))
                    {
                        compScore += 25;
                        compMatched = true;
                        break;
                    }
                }

                if (!compMatched && component.Concept.MatchesCategory(iCategory))
                {
                    compScore += 18;
                    compMatched = true;
                }
            }

            // Location or description match
            if (!compMatched)
            {
                if (locName.Contains(component.Token))
                {
                    compScore += 15;
                    compMatched = true;
                }
                else if (cDesc.Contains(component.Token))
                {
                    compScore += 10;
                    compMatched = true;
                }
            }

            if (compMatched)
            {
                matchedComponents++;
                rawScore += compScore;
            }
        }

        if (matchedComponents == 0)
        {
            if (!context.IsShortQuery && IsFuzzyMatch(context.CleanedQuery, iName))
            {
                return 20;
            }
            return 0;
        }

        // Multi-component Coverage Ratio Calculation
        if (context.Components.Count > 1)
        {
            double coverageRatio = (double)matchedComponents / context.Components.Count;

            if (coverageRatio >= 1.0)
            {
                // Full coverage bonus for matching all query components
                rawScore += 35;
            }
            else
            {
                // Soft-AND Penalty for missing explicit query components (e.g. missing "nike" in "nike shoes")
                rawScore *= (coverageRatio * 0.35);
            }
        }

        return rawScore;
    }

    private static bool IsFuzzyMatch(string query, string target)
    {
        if (string.IsNullOrWhiteSpace(query) || string.IsNullOrWhiteSpace(target)) return false;
        string q = query.Trim().ToLowerInvariant();
        string t = target.Trim().ToLowerInvariant();

        if (t.Contains(q)) return true;

        var tokens = t.Split(new[] { ' ', '-', '_', '/', '.', ',' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var token in tokens)
        {
            if (token.StartsWith(q) || q.StartsWith(token)) return true;

            int maxDist = q.Length <= 3 ? 0 : q.Length <= 7 ? 1 : 2;
            if (LevenshteinDistance(q, token) <= maxDist) return true;
        }

        int fullMaxDist = q.Length <= 3 ? 0 : q.Length <= 7 ? 1 : 2;
        return LevenshteinDistance(q, t) <= fullMaxDist;
    }

    private static int LevenshteinDistance(string s, string t)
    {
        if (string.IsNullOrEmpty(s)) return t?.Length ?? 0;
        if (string.IsNullOrEmpty(t)) return s.Length;

        int n = s.Length;
        int m = t.Length;
        int[,] d = new int[n + 1, m + 1];

        for (int i = 0; i <= n; d[i, 0] = i++) { }
        for (int j = 0; j <= m; d[0, j] = j++) { }

        for (int i = 1; i <= n; i++)
        {
            for (int j = 1; j <= m; j++)
            {
                int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }
        return d[n, m];
    }

    private async Task<(Guid? locationId, string? locationName, IReadOnlyList<string> breadcrumbSegments, string breadcrumbDisplay)> ResolveLocationBreadcrumbAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid storageNodeId,
        string? storageNodeName,
        CancellationToken cancellationToken)
    {
        if (storageNodeId == Guid.Empty)
        {
            return (null, null, Array.Empty<string>(), string.Empty);
        }

        try
        {
            var breadcrumbDto = await _breadcrumbService.GetBreadcrumbAsync(identity, workspaceId, storageNodeId, cancellationToken);
            var segments = breadcrumbDto.Segments.Select(s => s.Name).ToList();
            return (storageNodeId, storageNodeName, segments, breadcrumbDto.DisplayPath);
        }
        catch
        {
            var name = storageNodeName ?? string.Empty;
            return (storageNodeId, storageNodeName, new[] { name }, name);
        }
    }
}
