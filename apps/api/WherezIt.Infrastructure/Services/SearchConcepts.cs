using System;
using System.Collections.Generic;
using System.Linq;

namespace WherezIt.Infrastructure.Services;

public static class SearchTextNormalizer
{
    private static readonly HashSet<string> PluralExceptions = new(StringComparer.OrdinalIgnoreCase)
    {
        "jeans", "pants", "scissors", "electronics", "fitness", "christmas", "glass", "dress", "mattress",
        "trousers", "shorts", "sunglasses", "eyeglasses", "clothes", "compass", "moss", "grass"
    };

    public static string NormalizeTerm(string term)
    {
        if (string.IsNullOrWhiteSpace(term)) return string.Empty;

        string word = term.Trim().ToLowerInvariant();

        if (PluralExceptions.Contains(word))
        {
            return word;
        }

        if (word.EndsWith("ies") && word.Length > 4)
        {
            return word.Substring(0, word.Length - 3) + "y";
        }
        if (word.EndsWith("es") && word.Length > 3 && !word.EndsWith("shoes") && !word.EndsWith("clothes") && !word.EndsWith("glasses"))
        {
            return word.Substring(0, word.Length - 2);
        }
        if (word.EndsWith("s") && word.Length > 3 && !word.EndsWith("ss"))
        {
            return word.Substring(0, word.Length - 1);
        }

        return word;
    }
}

public sealed class SearchConceptTerm
{
    public string Value { get; }
    public double Strength { get; }

    public SearchConceptTerm(string value, double strength = 1.0)
    {
        Value = SearchTextNormalizer.NormalizeTerm(value);
        Strength = Math.Clamp(strength, 0.1, 1.0);
    }
}

public sealed class SearchConceptMatch
{
    public SearchConcept Concept { get; }
    public SearchConceptTerm MatchedTerm { get; }
    public double Strength => MatchedTerm.Strength;

    public SearchConceptMatch(SearchConcept concept, SearchConceptTerm matchedTerm)
    {
        Concept = concept;
        MatchedTerm = matchedTerm;
    }
}

public class SearchConcept
{
    public string Key { get; }
    public string DisplayName { get; }
    public IReadOnlyList<SearchConceptTerm> Terms { get; }
    public IReadOnlySet<string> CategoryNames { get; }

    public SearchConcept(
        string key,
        string displayName,
        IEnumerable<SearchConceptTerm> terms,
        IEnumerable<string>? categoryNames = null)
    {
        Key = key.Trim().ToUpperInvariant();
        DisplayName = displayName.Trim();
        Terms = terms.ToList();
        CategoryNames = new HashSet<string>((categoryNames ?? Array.Empty<string>()).Select(c => c.Trim().ToLowerInvariant()), StringComparer.OrdinalIgnoreCase);
    }

    public SearchConceptTerm? FindMatchingTerm(string term)
    {
        if (string.IsNullOrWhiteSpace(term)) return null;
        string norm = SearchTextNormalizer.NormalizeTerm(term);
        return Terms.FirstOrDefault(t => t.Value.Equals(norm, StringComparison.OrdinalIgnoreCase));
    }

    public bool ContainsTerm(string term)
    {
        return FindMatchingTerm(term) != null;
    }

    public bool MatchesCategory(string category)
    {
        if (string.IsNullOrWhiteSpace(category)) return false;
        return CategoryNames.Contains(category.Trim().ToLowerInvariant());
    }
}

public class QueryComponent
{
    public string Token { get; }
    public SearchConceptMatch? ConceptMatch { get; }
    public SearchConcept? Concept => ConceptMatch?.Concept;
    public double Strength => ConceptMatch?.Strength ?? 1.0;
    public bool IsLiteralOnly => ConceptMatch == null;

    public QueryComponent(string token, SearchConceptMatch? conceptMatch = null)
    {
        Token = token.Trim().ToLowerInvariant();
        ConceptMatch = conceptMatch;
    }
}

public class SearchQueryContext
{
    public string RawQuery { get; }
    public string CleanedQuery { get; }
    public IReadOnlyList<QueryComponent> Components { get; }
    public int? TargetBoxNumber { get; }
    public bool IsShortQuery { get; }
    public bool HasLocationIntent { get; }

    public SearchQueryContext(
        string rawQuery,
        string cleanedQuery,
        IReadOnlyList<QueryComponent> components,
        int? targetBoxNumber,
        bool isShortQuery,
        bool hasLocationIntent = false)
    {
        RawQuery = rawQuery;
        CleanedQuery = cleanedQuery;
        Components = components;
        TargetBoxNumber = targetBoxNumber;
        IsShortQuery = isShortQuery;
        HasLocationIntent = hasLocationIntent;
    }
}

public static class SearchVocabulary
{
    public static readonly IReadOnlyList<SearchConcept> Concepts = new List<SearchConcept>
    {
        // 1. FOOTWEAR
        new SearchConcept(
            "FOOTWEAR",
            "Footwear",
            new[]
            {
                new SearchConceptTerm("shoe", 0.9),
                new SearchConceptTerm("sneaker", 0.9),
                new SearchConceptTerm("boot", 0.9),
                new SearchConceptTerm("sandal", 0.9),
                new SearchConceptTerm("slipper", 0.8),
                new SearchConceptTerm("heel", 0.8),
                new SearchConceptTerm("loafer", 0.8),
                new SearchConceptTerm("cleat", 0.8),
                new SearchConceptTerm("footwear", 0.7)
            },
            new[] { "Footwear", "Shoes", "Clothing" }),

        // 2. CLOTHING
        new SearchConcept(
            "CLOTHING",
            "Clothing",
            new[]
            {
                new SearchConceptTerm("shirt", 0.9),
                new SearchConceptTerm("tshirt", 0.9),
                new SearchConceptTerm("t-shirt", 0.9),
                new SearchConceptTerm("pants", 0.9),
                new SearchConceptTerm("jeans", 0.9),
                new SearchConceptTerm("dress", 0.9),
                new SearchConceptTerm("jacket", 0.9),
                new SearchConceptTerm("coat", 0.9),
                new SearchConceptTerm("sweater", 0.9),
                new SearchConceptTerm("garment", 0.8),
                new SearchConceptTerm("clothes", 0.7),
                new SearchConceptTerm("clothing", 0.7),
                new SearchConceptTerm("apparel", 0.7)
            },
            new[] { "Clothing", "Apparel" }),

        // 3. HOLIDAY DECOR
        new SearchConcept(
            "HOLIDAY_DECOR",
            "Holiday Decor",
            new[]
            {
                new SearchConceptTerm("christmas", 1.0),
                new SearchConceptTerm("xmas", 1.0),
                new SearchConceptTerm("ornament", 0.9),
                new SearchConceptTerm("wreath", 0.9),
                new SearchConceptTerm("garland", 0.9),
                new SearchConceptTerm("holiday", 0.8),
                new SearchConceptTerm("decor", 0.7),
                new SearchConceptTerm("decoration", 0.7),
                new SearchConceptTerm("seasonal", 0.5)
            },
            new[] { "Holiday", "Decor", "Seasonal" }),

        // 4. KITCHENWARE
        new SearchConcept(
            "KITCHENWARE",
            "Kitchenware",
            new[]
            {
                new SearchConceptTerm("plate", 0.9),
                new SearchConceptTerm("cup", 0.9),
                new SearchConceptTerm("mug", 0.9),
                new SearchConceptTerm("bowl", 0.9),
                new SearchConceptTerm("dish", 0.8),
                new SearchConceptTerm("utensil", 0.8),
                new SearchConceptTerm("cutlery", 0.8),
                new SearchConceptTerm("cookware", 0.8),
                new SearchConceptTerm("pan", 0.8),
                new SearchConceptTerm("pot", 0.8),
                new SearchConceptTerm("kitchenware", 0.7),
                new SearchConceptTerm("kitchen", 0.6)
            },
            new[] { "Kitchen", "Dining", "Cookware" }),

        // 5. ELECTRONICS
        new SearchConcept(
            "ELECTRONICS",
            "Electronics",
            new[]
            {
                new SearchConceptTerm("smartphone", 1.0),
                new SearchConceptTerm("phone", 0.9),
                new SearchConceptTerm("laptop", 1.0),
                new SearchConceptTerm("computer", 0.9),
                new SearchConceptTerm("tablet", 1.0),
                new SearchConceptTerm("monitor", 0.9),
                new SearchConceptTerm("television", 0.9),
                new SearchConceptTerm("tv", 0.9),
                new SearchConceptTerm("electronics", 0.7),
                new SearchConceptTerm("electronic", 0.7),
                new SearchConceptTerm("device", 0.5)
            },
            new[] { "Electronics", "Devices", "Tech" }),

        // 6. CABLES & POWER
        new SearchConcept(
            "CABLES_POWER",
            "Cables & Power",
            new[]
            {
                new SearchConceptTerm("extension cord", 1.0),
                new SearchConceptTerm("power strip", 1.0),
                new SearchConceptTerm("charger", 0.9),
                new SearchConceptTerm("adapter", 0.9),
                new SearchConceptTerm("cable", 0.8),
                new SearchConceptTerm("cord", 0.8),
                new SearchConceptTerm("wire", 0.7),
                new SearchConceptTerm("plug", 0.7)
            },
            new[] { "Electronics", "Hardware" }),

        // 7. TOOLS
        new SearchConcept(
            "TOOLS",
            "Tools",
            new[]
            {
                new SearchConceptTerm("hammer", 1.0),
                new SearchConceptTerm("wrench", 1.0),
                new SearchConceptTerm("screwdriver", 1.0),
                new SearchConceptTerm("drill", 1.0),
                new SearchConceptTerm("pliers", 1.0),
                new SearchConceptTerm("saw", 1.0),
                new SearchConceptTerm("toolbox", 0.9),
                new SearchConceptTerm("tool", 0.7),
                new SearchConceptTerm("hardware", 0.6)
            },
            new[] { "Tools", "Hardware" }),

        // 8. CLEANING
        new SearchConcept(
            "CLEANING",
            "Cleaning",
            new[]
            {
                new SearchConceptTerm("vacuum", 1.0),
                new SearchConceptTerm("mop", 0.9),
                new SearchConceptTerm("broom", 0.9),
                new SearchConceptTerm("disinfectant", 0.9),
                new SearchConceptTerm("sponge", 0.8),
                new SearchConceptTerm("detergent", 0.8),
                new SearchConceptTerm("cleaner", 0.7),
                new SearchConceptTerm("cleaning", 0.7),
                new SearchConceptTerm("soap", 0.6)
            },
            new[] { "Cleaning", "Household" }),

        // 9. BEDDING / LINENS
        new SearchConcept(
            "BEDDING",
            "Bedding",
            new[]
            {
                new SearchConceptTerm("blanket", 0.9),
                new SearchConceptTerm("pillow", 0.9),
                new SearchConceptTerm("bedsheet", 0.9),
                new SearchConceptTerm("sheet", 0.8),
                new SearchConceptTerm("comforter", 0.9),
                new SearchConceptTerm("duvet", 0.9),
                new SearchConceptTerm("linen", 0.8),
                new SearchConceptTerm("bedding", 0.7)
            },
            new[] { "Bedding", "Home", "Linens" }),

        // 10. BATHROOM
        new SearchConcept(
            "BATHROOM",
            "Bathroom",
            new[]
            {
                new SearchConceptTerm("shampoo", 0.9),
                new SearchConceptTerm("conditioner", 0.9),
                new SearchConceptTerm("toothpaste", 0.9),
                new SearchConceptTerm("toothbrush", 0.9),
                new SearchConceptTerm("lotion", 0.8),
                new SearchConceptTerm("skincare", 0.8),
                new SearchConceptTerm("toiletry", 0.8),
                new SearchConceptTerm("toiletries", 0.8),
                new SearchConceptTerm("bathroom", 0.7),
                new SearchConceptTerm("soap", 0.6)
            },
            new[] { "Bathroom", "Personal Care", "Hygiene" }),

        // 11. CAMPING
        new SearchConcept(
            "CAMPING",
            "Camping",
            new[]
            {
                new SearchConceptTerm("tent", 1.0),
                new SearchConceptTerm("sleeping bag", 1.0),
                new SearchConceptTerm("camp stove", 1.0),
                new SearchConceptTerm("lantern", 0.9),
                new SearchConceptTerm("hiking", 0.8),
                new SearchConceptTerm("camping", 0.8),
                new SearchConceptTerm("camp", 0.7),
                new SearchConceptTerm("outdoor", 0.5)
            },
            new[] { "Outdoor", "Camping" }),

        // 12. SPORTS
        new SearchConcept(
            "SPORTS",
            "Sports",
            new[]
            {
                new SearchConceptTerm("football", 0.9),
                new SearchConceptTerm("soccer", 0.9),
                new SearchConceptTerm("basketball", 0.9),
                new SearchConceptTerm("dumbbell", 0.9),
                new SearchConceptTerm("yoga", 0.8),
                new SearchConceptTerm("workout", 0.8),
                new SearchConceptTerm("exercise", 0.8),
                new SearchConceptTerm("ball", 0.7),
                new SearchConceptTerm("sports", 0.7),
                new SearchConceptTerm("fitness", 0.6)
            },
            new[] { "Sports", "Fitness" }),

        // 13. BABY
        new SearchConcept(
            "BABY",
            "Baby",
            new[]
            {
                new SearchConceptTerm("baby bottle", 1.0),
                new SearchConceptTerm("diaper", 0.9),
                new SearchConceptTerm("stroller", 0.9),
                new SearchConceptTerm("pacifier", 0.9),
                new SearchConceptTerm("baby", 0.8),
                new SearchConceptTerm("infant", 0.8)
            },
            new[] { "Baby", "Nursery" }),

        // 14. PET
        new SearchConcept(
            "PET",
            "Pet",
            new[]
            {
                new SearchConceptTerm("pet food", 1.0),
                new SearchConceptTerm("dog food", 1.0),
                new SearchConceptTerm("cat food", 1.0),
                new SearchConceptTerm("pet toy", 0.9),
                new SearchConceptTerm("leash", 0.9),
                new SearchConceptTerm("dog", 0.8),
                new SearchConceptTerm("cat", 0.8),
                new SearchConceptTerm("pet", 0.7)
            },
            new[] { "Pet", "Animals" }),

        // 15. OFFICE & DOCUMENTS
        new SearchConcept(
            "OFFICE_DOCUMENTS",
            "Office & Documents",
            new[]
            {
                new SearchConceptTerm("passport", 1.0),
                new SearchConceptTerm("certificate", 0.9),
                new SearchConceptTerm("contract", 0.9),
                new SearchConceptTerm("receipt", 0.8),
                new SearchConceptTerm("tax", 0.8),
                new SearchConceptTerm("document", 0.8),
                new SearchConceptTerm("file", 0.7),
                new SearchConceptTerm("folder", 0.7),
                new SearchConceptTerm("paper", 0.6)
            },
            new[] { "Documents", "Office" }),

        // 16. TOYS & GAMES
        new SearchConcept(
            "TOYS_GAMES",
            "Toys & Games",
            new[]
            {
                new SearchConceptTerm("board game", 1.0),
                new SearchConceptTerm("video game", 1.0),
                new SearchConceptTerm("action figure", 1.0),
                new SearchConceptTerm("puzzle", 0.9),
                new SearchConceptTerm("doll", 0.9),
                new SearchConceptTerm("toy", 0.8),
                new SearchConceptTerm("game", 0.7)
            },
            new[] { "Toys", "Games" }),

        // 17. HOME DECOR
        new SearchConcept(
            "HOME_DECOR",
            "Home Decor",
            new[]
            {
                new SearchConceptTerm("wall art", 1.0),
                new SearchConceptTerm("picture frame", 1.0),
                new SearchConceptTerm("artwork", 0.9),
                new SearchConceptTerm("frame", 0.8),
                new SearchConceptTerm("vase", 0.8),
                new SearchConceptTerm("candle", 0.8),
                new SearchConceptTerm("decor", 0.7),
                new SearchConceptTerm("decoration", 0.7)
            },
            new[] { "Decor", "Home" }),

        // 18. WINTER
        new SearchConcept(
            "WINTER",
            "Winter",
            new[]
            {
                new SearchConceptTerm("winter", 0.9),
                new SearchConceptTerm("snow", 0.8),
                new SearchConceptTerm("cold", 0.6),
                new SearchConceptTerm("ice", 0.6)
            },
            new[] { "Seasonal", "Clothing" }),

        // 19. LIGHTING
        new SearchConcept(
            "LIGHTING",
            "Lighting",
            new[]
            {
                new SearchConceptTerm("string light", 1.0),
                new SearchConceptTerm("fairy light", 1.0),
                new SearchConceptTerm("night light", 1.0),
                new SearchConceptTerm("flashlight", 1.0),
                new SearchConceptTerm("lamp", 0.9),
                new SearchConceptTerm("bulb", 0.9),
                new SearchConceptTerm("lantern", 0.9),
                new SearchConceptTerm("torch", 0.9),
                new SearchConceptTerm("light", 0.6)
            },
            new[] { "Lighting", "Home" }),

        // 20. LAUNDRY
        new SearchConcept(
            "LAUNDRY",
            "Laundry",
            new[]
            {
                new SearchConceptTerm("laundry basket", 1.0),
                new SearchConceptTerm("fabric softener", 1.0),
                new SearchConceptTerm("dryer sheet", 1.0),
                new SearchConceptTerm("ironing board", 1.0),
                new SearchConceptTerm("hamper", 0.9),
                new SearchConceptTerm("detergent", 0.9),
                new SearchConceptTerm("iron", 0.8),
                new SearchConceptTerm("laundry", 0.8)
            },
            new[] { "Laundry", "Household" }),

        // 21. BEAUTY & GROOMING
        new SearchConcept(
            "BEAUTY_GROOMING",
            "Beauty & Grooming",
            new[]
            {
                new SearchConceptTerm("hair dryer", 1.0),
                new SearchConceptTerm("blow dryer", 1.0),
                new SearchConceptTerm("curling iron", 1.0),
                new SearchConceptTerm("straightener", 0.9),
                new SearchConceptTerm("makeup", 0.9),
                new SearchConceptTerm("cosmetic", 0.9),
                new SearchConceptTerm("hairbrush", 0.9),
                new SearchConceptTerm("comb", 0.8),
                new SearchConceptTerm("perfume", 0.8),
                new SearchConceptTerm("razor", 0.8),
                new SearchConceptTerm("nail polish", 0.9),
                new SearchConceptTerm("skincare", 0.8)
            },
            new[] { "Beauty", "Personal Care" }),

        // 22. MEDICAL & FIRST AID
        new SearchConcept(
            "MEDICAL_FIRST_AID",
            "Medical & First Aid",
            new[]
            {
                new SearchConceptTerm("first aid", 1.0),
                new SearchConceptTerm("n95", 1.0),
                new SearchConceptTerm("respirator", 1.0),
                new SearchConceptTerm("medicine", 0.9),
                new SearchConceptTerm("medication", 0.9),
                new SearchConceptTerm("pill", 0.9),
                new SearchConceptTerm("bandage", 0.9),
                new SearchConceptTerm("thermometer", 0.9),
                new SearchConceptTerm("medical supplies", 0.9),
                new SearchConceptTerm("mask", 0.7)
            },
            new[] { "Medical", "Safety", "Health" }),

        // 23. TRAVEL
        new SearchConcept(
            "TRAVEL",
            "Travel",
            new[]
            {
                new SearchConceptTerm("carry on", 1.0),
                new SearchConceptTerm("travel bag", 1.0),
                new SearchConceptTerm("suitcase", 0.9),
                new SearchConceptTerm("luggage", 0.9),
                new SearchConceptTerm("passport", 0.8),
                new SearchConceptTerm("backpack", 0.8),
                new SearchConceptTerm("travel", 0.7)
            },
            new[] { "Travel", "Luggage" }),

        // 24. GARDEN & YARD
        new SearchConcept(
            "GARDEN_YARD",
            "Garden & Yard",
            new[]
            {
                new SearchConceptTerm("garden hose", 1.0),
                new SearchConceptTerm("watering can", 1.0),
                new SearchConceptTerm("lawn mower", 1.0),
                new SearchConceptTerm("plant pot", 0.9),
                new SearchConceptTerm("gardening", 0.8),
                new SearchConceptTerm("garden", 0.8),
                new SearchConceptTerm("seed", 0.8),
                new SearchConceptTerm("soil", 0.8),
                new SearchConceptTerm("yard", 0.7)
            },
            new[] { "Garden", "Yard" }),

        // 25. AUTOMOTIVE
        new SearchConcept(
            "AUTOMOTIVE",
            "Automotive",
            new[]
            {
                new SearchConceptTerm("car supplies", 1.0),
                new SearchConceptTerm("jumper cable", 1.0),
                new SearchConceptTerm("car battery", 1.0),
                new SearchConceptTerm("motor oil", 1.0),
                new SearchConceptTerm("car cleaner", 0.9),
                new SearchConceptTerm("vehicle supplies", 0.9),
                new SearchConceptTerm("automotive", 0.8),
                new SearchConceptTerm("tire", 0.8)
            },
            new[] { "Automotive", "Car" }),

        // 26. CRAFTS & SEWING
        new SearchConcept(
            "CRAFTS_SEWING",
            "Crafts & Sewing",
            new[]
            {
                new SearchConceptTerm("craft supplies", 1.0),
                new SearchConceptTerm("paintbrush", 1.0),
                new SearchConceptTerm("sewing", 0.9),
                new SearchConceptTerm("thread", 0.8),
                new SearchConceptTerm("needle", 0.8),
                new SearchConceptTerm("yarn", 0.8),
                new SearchConceptTerm("knitting", 0.8),
                new SearchConceptTerm("crochet", 0.8),
                new SearchConceptTerm("craft", 0.7),
                new SearchConceptTerm("paint", 0.6)
            },
            new[] { "Crafts", "Hobbies" }),
    };

    private static readonly Dictionary<string, List<SearchConceptMatch>> TermToConceptsMap;

    static SearchVocabulary()
    {
        TermToConceptsMap = new Dictionary<string, List<SearchConceptMatch>>(StringComparer.OrdinalIgnoreCase);

        foreach (var concept in Concepts)
        {
            foreach (var term in concept.Terms)
            {
                string normValue = SearchTextNormalizer.NormalizeTerm(term.Value);
                if (!TermToConceptsMap.TryGetValue(normValue, out var list))
                {
                    list = new List<SearchConceptMatch>();
                    TermToConceptsMap[normValue] = list;
                }
                list.Add(new SearchConceptMatch(concept, term));
            }
        }
    }

    public static IReadOnlyList<SearchConceptMatch> FindConceptsForPhrase(string phrase)
    {
        if (string.IsNullOrWhiteSpace(phrase)) return Array.Empty<SearchConceptMatch>();
        string normPhrase = SearchTextNormalizer.NormalizeTerm(phrase);
        return TermToConceptsMap.TryGetValue(normPhrase, out var matches)
            ? matches
            : Array.Empty<SearchConceptMatch>();
    }
}
