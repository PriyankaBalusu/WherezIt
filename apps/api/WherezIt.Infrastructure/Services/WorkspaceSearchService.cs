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
        // Verify workspace membership
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.FirebaseUid == identity.FirebaseUid, cancellationToken);
        if (user == null)
        {
            throw new UnauthorizedAccessException("User not found.");
        }

        var isMember = await _dbContext.WorkspaceMembers.AnyAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == user.Id, cancellationToken);
        if (!isMember)
        {
            throw new UnauthorizedAccessException("User is not authorized to access this Storage Space.");
        }

        var workspace = await _dbContext.Workspaces.FindAsync(new object[] { workspaceId }, cancellationToken);
        var workspaceMap = new Dictionary<Guid, string>
        {
            { workspaceId, workspace?.Name ?? "Storage Space" }
        };

        return await ExecuteSearchAsync(identity, new[] { workspaceId }, workspaceMap, query, cancellationToken);
    }

    public async Task<IReadOnlyList<SearchResultDto>> SearchAuthorizedWorkspacesAsync(
        AuthenticatedIdentity identity,
        string query,
        CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.FirebaseUid == identity.FirebaseUid, cancellationToken);
        if (user == null)
        {
            return Array.Empty<SearchResultDto>();
        }

        var userWorkspaces = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(wm => wm.UserId == user.Id)
            .Include(wm => wm.Workspace)
            .Select(wm => wm.Workspace)
            .ToListAsync(cancellationToken);

        if (userWorkspaces.Count == 0)
        {
            return Array.Empty<SearchResultDto>();
        }

        var workspaceMap = userWorkspaces.ToDictionary(w => w.Id, w => w.Name);
        var authorizedWorkspaceIds = workspaceMap.Keys.ToList();

        return await ExecuteSearchAsync(identity, authorizedWorkspaceIds, workspaceMap, query, cancellationToken);
    }

    private async Task<IReadOnlyList<SearchResultDto>> ExecuteSearchAsync(
        AuthenticatedIdentity identity,
        IReadOnlyList<Guid> workspaceIds,
        Dictionary<Guid, string> workspaceMap,
        string query,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<SearchResultDto>();
        }

        // Build Structured Query Context with Phrase-Aware Resolution
        var context = BuildQueryContext(query);
        if (context.Components.Count == 0 && string.IsNullOrWhiteSpace(context.CleanedQuery))
        {
            return Array.Empty<SearchResultDto>();
        }

        // Fetch Candidate Data across authorized workspaces
        var containers = await _dbContext.Containers
            .AsNoTracking()
            .Include(c => c.StorageNode)
            .Where(c => workspaceIds.Contains(c.WorkspaceId) && !c.IsArchived)
            .ToListAsync(cancellationToken);

        var items = await _dbContext.Items
            .AsNoTracking()
            .Include(i => i.Container)
            .ThenInclude(c => c.StorageNode)
            .Where(i => workspaceIds.Contains(i.WorkspaceId) && !i.IsArchived && !i.Container.IsArchived)
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
                    await ResolveLocationBreadcrumbAsync(identity, c.WorkspaceId, c.StorageNodeId, c.StorageNode?.Name, cancellationToken);

                var boxDisplayId = c.BoxNumber < 1000 ? $"BOX {c.BoxNumber:D3}" : $"BOX {c.BoxNumber}";
                var wsName = workspaceMap.GetValueOrDefault(c.WorkspaceId, "Storage Space");

                candidateScores.Add((score, new SearchResultDto
                {
                    ResultType = "CONTAINER",
                    WorkspaceId = c.WorkspaceId,
                    WorkspaceName = wsName,
                    ItemId = null,
                    ItemName = null,
                    Quantity = null,
                    ContainerId = c.Id,
                    BoxNumber = c.BoxNumber,
                    BoxDisplayId = boxDisplayId,
                    ContainerName = c.Name,
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
                    await ResolveLocationBreadcrumbAsync(identity, item.WorkspaceId, item.Container.StorageNodeId, item.Container.StorageNode?.Name, cancellationToken);

                var boxDisplayId = item.Container.BoxNumber < 1000 ? $"BOX {item.Container.BoxNumber:D3}" : $"BOX {item.Container.BoxNumber}";
                var wsName = workspaceMap.GetValueOrDefault(item.WorkspaceId, "Storage Space");

                candidateScores.Add((score, new SearchResultDto
                {
                    ResultType = "ITEM",
                    WorkspaceId = item.WorkspaceId,
                    WorkspaceName = wsName,
                    ItemId = item.Id,
                    ItemName = item.Name,
                    Quantity = item.Quantity,
                    ContainerId = item.ContainerId,
                    BoxNumber = item.Container.BoxNumber,
                    BoxDisplayId = boxDisplayId,
                    ContainerName = item.Container.Name,
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
        var consumedIndices = new HashSet<int>();

        if (!isShortQuery && tokens.Count > 1)
        {
            // Stage A: 3-word phrase resolution
            for (int i = 0; i <= tokens.Count - 3; i++)
            {
                if (consumedIndices.Contains(i) || consumedIndices.Contains(i + 1) || consumedIndices.Contains(i + 2))
                    continue;

                string phrase3 = $"{tokens[i]} {tokens[i + 1]} {tokens[i + 2]}";
                string collapsed3 = $"{tokens[i]}{tokens[i + 1]}{tokens[i + 2]}";
                var matches = SearchVocabulary.FindConceptsForPhrase(phrase3);
                if (matches.Count == 0)
                {
                    matches = SearchVocabulary.FindConceptsForPhrase(collapsed3);
                }

                if (matches.Count > 0)
                {
                    foreach (var m in matches)
                    {
                        components.Add(new QueryComponent(phrase3, m));
                    }
                    consumedIndices.Add(i);
                    consumedIndices.Add(i + 1);
                    consumedIndices.Add(i + 2);
                }
            }

            // Stage B: 2-word phrase resolution
            for (int i = 0; i <= tokens.Count - 2; i++)
            {
                if (consumedIndices.Contains(i) || consumedIndices.Contains(i + 1))
                    continue;

                string phrase2 = $"{tokens[i]} {tokens[i + 1]}";
                string collapsed2 = $"{tokens[i]}{tokens[i + 1]}";

                var matches = SearchVocabulary.FindConceptsForPhrase(phrase2);
                if (matches.Count == 0)
                {
                    matches = SearchVocabulary.FindConceptsForPhrase(collapsed2);
                }

                if (matches.Count > 0)
                {
                    foreach (var m in matches)
                    {
                        components.Add(new QueryComponent(phrase2, m));
                    }
                    consumedIndices.Add(i);
                    consumedIndices.Add(i + 1);
                }
            }
        }

        // Stage C: Single-token resolution for remaining unconsumed tokens
        for (int i = 0; i < tokens.Count; i++)
        {
            if (consumedIndices.Contains(i)) continue;

            string token = tokens[i];

            // Exclude single-character letter noise tokens in multi-token queries
            if (tokens.Count > 1 && token.Length == 1 && !char.IsDigit(token[0]))
            {
                continue;
            }

            var matches = SearchVocabulary.FindConceptsForPhrase(token);
            if (matches.Count > 0)
            {
                foreach (var m in matches)
                {
                    components.Add(new QueryComponent(token, m));
                }
            }
            else if (!isShortQuery && token.Length >= 5)
            {
                string? bestTerm = FindClosestVocabularyTerm(token);
                if (bestTerm != null)
                {
                    var typoMatches = SearchVocabulary.FindConceptsForPhrase(bestTerm);
                    if (typoMatches.Count > 0)
                    {
                        foreach (var m in typoMatches)
                        {
                            components.Add(new QueryComponent(token, m));
                        }
                        continue;
                    }
                }
                components.Add(new QueryComponent(token, conceptMatch: null));
            }
            else
            {
                components.Add(new QueryComponent(token, conceptMatch: null));
            }
        }

        bool hasLocationIntent = DetectLocationIntent(rawTrimmed);
        return new SearchQueryContext(rawTrimmed, cleanedQuery, components, targetBoxNumber, isShortQuery, hasLocationIntent);
    }

    private static bool DetectLocationIntent(string rawQuery)
    {
        if (string.IsNullOrWhiteSpace(rawQuery)) return false;
        string q = rawQuery.ToLowerInvariant();
        return q.Contains(" in ") ||
               q.Contains(" inside ") ||
               q.Contains(" located in ") ||
               q.Contains(" under ") ||
               q.Contains(" on ") ||
               q.Contains(" at ") ||
               q.StartsWith("in ") ||
               q.StartsWith("items in") ||
               q.StartsWith("boxes in") ||
               q.StartsWith("stuff in") ||
               q.StartsWith("things in") ||
               q.StartsWith("what is in") ||
               q.StartsWith("whats in") ||
               q.StartsWith("where is");
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

            string normalized = SearchTextNormalizer.NormalizeTerm(t);
            tokens.Add(normalized);
        }

        return (q, tokens);
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
        if (string.IsNullOrEmpty(queryToken) || queryToken.Length < 5) return null;
        string? bestTerm = null;
        int minDistance = int.MaxValue;

        foreach (var concept in SearchVocabulary.Concepts)
        {
            foreach (var term in concept.Terms)
            {
                int dist = LevenshteinDistance(queryToken, term.Value);
                int maxAllowed = queryToken.Length <= 5 ? 1 : 2;

                if (dist <= maxAllowed && dist < minDistance)
                {
                    minDistance = dist;
                    bestTerm = term.Value;
                }
            }
        }

        return bestTerm;
    }

    private static string CollapseString(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var sb = new System.Text.StringBuilder(input.Length);
        foreach (char c in input)
        {
            if (char.IsLetterOrDigit(c))
            {
                sb.Append(char.ToLowerInvariant(c));
            }
        }
        return sb.ToString();
    }

    private static bool IsTokenMatch(string text, string token)
    {
        if (string.IsNullOrEmpty(text) || string.IsNullOrEmpty(token)) return false;
        if (token.Length > 1)
        {
            return text.Contains(token);
        }

        var words = text.Split(new[] { ' ', '-', '_', '/', '.', ',' }, StringSplitOptions.RemoveEmptyEntries);
        return words.Any(w => w.Equals(token, StringComparison.OrdinalIgnoreCase));
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

        string collapsedCName = CollapseString(cName);
        string collapsedCLabel = CollapseString(cLabel);
        string collapsedCleaned = CollapseString(context.CleanedQuery);
        string collapsedRaw = CollapseString(context.RawQuery);

        if (!string.IsNullOrEmpty(collapsedCleaned))
        {
            if (!string.IsNullOrEmpty(collapsedCName) && (collapsedCName == collapsedCleaned || collapsedCName == collapsedRaw))
            {
                return 90;
            }
            if (!string.IsNullOrEmpty(collapsedCLabel) && (collapsedCLabel == collapsedCleaned || collapsedCLabel == collapsedRaw))
            {
                return 85;
            }
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

            if (IsTokenMatch(cName, component.Token))
            {
                compScore += cName.Equals(component.Token) ? 40 : 30;
                compMatched = true;
            }
            else if (IsTokenMatch(cLabel, component.Token))
            {
                compScore += 25;
                compMatched = true;
            }
            else if (component.Concept != null)
            {
                var words = cName.Split(new[] { ' ', '-', '_', '/' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var w in words)
                {
                    var matchingTerm = component.Concept.FindMatchingTerm(w);
                    if (matchingTerm != null)
                    {
                        compScore += (20 * matchingTerm.Strength * component.Strength);
                        compMatched = true;
                        break;
                    }
                }
            }

            if (!compMatched)
            {
                if (IsTokenMatch(locName, component.Token))
                {
                    compScore += 15;
                    compMatched = true;
                }
                else if (IsTokenMatch(cDesc, component.Token))
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
        var cName = (item.Container?.Name ?? "").ToLowerInvariant();
        var cLabel = (item.Container?.PhysicalLabel ?? "").ToLowerInvariant();
        var cDesc = (item.Container?.Description ?? "").ToLowerInvariant();

        bool hasIndependentItemMatch = false;

        // 1. Exact Item Name Match (Weight: 95)
        if (iName == context.CleanedQuery || iName == context.RawQuery.ToLowerInvariant())
        {
            hasIndependentItemMatch = true;
            return CalculateScoreWithContextBoost(95, item, context);
        }

        // 2. Item Name Prefix Match (Weight: 80)
        if (iName.StartsWith(context.CleanedQuery))
        {
            hasIndependentItemMatch = true;
            return CalculateScoreWithContextBoost(80, item, context);
        }

        string collapsedIName = CollapseString(iName);
        string collapsedCleaned = CollapseString(context.CleanedQuery);
        string collapsedRaw = CollapseString(context.RawQuery);

        if (!string.IsNullOrEmpty(collapsedCleaned))
        {
            if (!string.IsNullOrEmpty(collapsedIName) && (collapsedIName == collapsedCleaned || collapsedIName == collapsedRaw))
            {
                hasIndependentItemMatch = true;
                return CalculateScoreWithContextBoost(95, item, context);
            }

            if (!string.IsNullOrEmpty(collapsedIName) && collapsedCleaned.Length >= 2 && collapsedIName.StartsWith(collapsedCleaned))
            {
                hasIndependentItemMatch = true;
                return CalculateScoreWithContextBoost(80, item, context);
            }
        }

        double rawScore = 0;
        int matchedItemComponents = 0;
        var itemWords = iName.Split(new[] { ' ', '-', '_', '/', '.' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var component in context.Components)
        {
            bool compMatchedOnItem = false;
            double compScore = 0;

            // Direct literal match in item name
            if (IsTokenMatch(iName, component.Token))
            {
                compScore += iName.Equals(component.Token) ? 40 : 30;
                compMatchedOnItem = true;
            }
            else if (component.Concept != null)
            {
                // Concept term match in item name
                foreach (var word in itemWords)
                {
                    var matchingTerm = component.Concept.FindMatchingTerm(word);
                    if (matchingTerm != null)
                    {
                        compScore += (25 * matchingTerm.Strength * component.Strength);
                        compMatchedOnItem = true;
                        break;
                    }
                }

                // Concept match in item category
                if (!compMatchedOnItem && component.Concept.MatchesCategory(iCategory))
                {
                    compScore += (18 * component.Strength);
                    compMatchedOnItem = true;
                }
            }

            if (compMatchedOnItem)
            {
                matchedItemComponents++;
                rawScore += compScore;
                hasIndependentItemMatch = true;
            }
        }

        // Fuzzy match on Item Name
        if (!hasIndependentItemMatch && !context.IsShortQuery && IsFuzzyMatch(context.CleanedQuery, iName))
        {
            hasIndependentItemMatch = true;
            rawScore = 20;
            matchedItemComponents = 1;
        }

        // Explicit Location Intent match (e.g., "items in garage")
        bool hasLocationIntentMatch = false;
        if (!hasIndependentItemMatch && context.HasLocationIntent)
        {
            foreach (var component in context.Components)
            {
                if (!string.IsNullOrEmpty(locName) && IsTokenMatch(locName, component.Token))
                {
                    hasLocationIntentMatch = true;
                    rawScore += 30;
                    break;
                }
            }
        }

        // QUALIFICATION CHECK: Item MUST have its own independent match signal (or explicit location intent).
        // A matching parent Container or Location ALONE must NOT qualify an otherwise unrelated Item!
        if (!hasIndependentItemMatch && !hasLocationIntentMatch)
        {
            return 0; // Excluded!
        }

        // Multi-component Coverage Ratio Calculation for Item Signals
        if (hasIndependentItemMatch && context.Components.Count > 1)
        {
            double coverageRatio = (double)matchedItemComponents / context.Components.Count;

            if (coverageRatio >= 1.0)
            {
                rawScore += 35;
            }
            else
            {
                rawScore *= (coverageRatio * 0.35);
            }
        }

        return CalculateScoreWithContextBoost(rawScore, item, context);
    }

    private static double CalculateScoreWithContextBoost(double baseScore, Item item, SearchQueryContext context)
    {
        var locName = (item.Container?.StorageNode?.Name ?? "").ToLowerInvariant();
        var cName = (item.Container?.Name ?? "").ToLowerInvariant();
        var cLabel = (item.Container?.PhysicalLabel ?? "").ToLowerInvariant();
        var cDesc = (item.Container?.Description ?? "").ToLowerInvariant();

        double contextBoost = 0;

        foreach (var component in context.Components)
        {
            if ((!string.IsNullOrEmpty(cName) && IsTokenMatch(cName, component.Token)) ||
                (!string.IsNullOrEmpty(cLabel) && IsTokenMatch(cLabel, component.Token)))
            {
                contextBoost += 15;
            }
            else if (component.Concept != null && !string.IsNullOrEmpty(cName))
            {
                var containerWords = cName.Split(new[] { ' ', '-', '_', '/' }, StringSplitOptions.RemoveEmptyEntries);
                if (containerWords.Any(w => component.Concept.ContainsTerm(w)))
                {
                    contextBoost += 15;
                }
            }
            else if (!string.IsNullOrEmpty(locName) && IsTokenMatch(locName, component.Token))
            {
                contextBoost += 10;
            }
            else if (!string.IsNullOrEmpty(cDesc) && IsTokenMatch(cDesc, component.Token))
            {
                contextBoost += 10;
            }
        }

        contextBoost = Math.Min(20, contextBoost);
        return baseScore + contextBoost;
    }

    private static bool IsFuzzyMatch(string query, string target)
    {
        if (string.IsNullOrWhiteSpace(query) || string.IsNullOrWhiteSpace(target)) return false;
        string q = query.Trim().ToLowerInvariant();
        string t = target.Trim().ToLowerInvariant();

        if (t.Contains(q)) return true;

        string collapsedQ = CollapseString(q);
        string collapsedT = CollapseString(t);
        if (!string.IsNullOrEmpty(collapsedQ) && !string.IsNullOrEmpty(collapsedT) && collapsedT.Contains(collapsedQ)) return true;

        var tokens = t.Split(new[] { ' ', '-', '_', '/', '.', ',' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var token in tokens)
        {
            if (token.StartsWith(q) || q.StartsWith(token)) return true;

            int maxDist = q.Length <= 4 ? 0 : q.Length <= 7 ? 1 : 2;
            if (LevenshteinDistance(q, token) <= maxDist) return true;
        }

        int fullMaxDist = q.Length <= 4 ? 0 : q.Length <= 7 ? 1 : 2;
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
