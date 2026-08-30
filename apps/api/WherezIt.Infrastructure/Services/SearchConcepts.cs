using System;
using System.Collections.Generic;
using System.Linq;

namespace WherezIt.Infrastructure.Services;

public class SearchConcept
{
    public string CanonicalName { get; }
    public IReadOnlySet<string> Terms { get; }
    public IReadOnlySet<string> CategoryNames { get; }

    public SearchConcept(string canonicalName, IEnumerable<string> terms, IEnumerable<string>? categoryNames = null)
    {
        CanonicalName = canonicalName;
        Terms = new HashSet<string>(terms.Select(t => t.Trim().ToLowerInvariant()), StringComparer.OrdinalIgnoreCase);
        CategoryNames = new HashSet<string>((categoryNames ?? Array.Empty<string>()).Select(c => c.Trim().ToLowerInvariant()), StringComparer.OrdinalIgnoreCase);
    }

    public bool ContainsTerm(string term)
    {
        if (string.IsNullOrWhiteSpace(term)) return false;
        return Terms.Contains(term.Trim().ToLowerInvariant());
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
    public SearchConcept? Concept { get; }
    public bool IsLiteralOnly => Concept == null;

    public QueryComponent(string token, SearchConcept? concept = null)
    {
        Token = token.Trim().ToLowerInvariant();
        Concept = concept;
    }
}

public class SearchQueryContext
{
    public string RawQuery { get; }
    public string CleanedQuery { get; }
    public IReadOnlyList<QueryComponent> Components { get; }
    public int? TargetBoxNumber { get; }
    public bool IsShortQuery { get; }

    public SearchQueryContext(
        string rawQuery,
        string cleanedQuery,
        IReadOnlyList<QueryComponent> components,
        int? targetBoxNumber,
        bool isShortQuery)
    {
        RawQuery = rawQuery;
        CleanedQuery = cleanedQuery;
        Components = components;
        TargetBoxNumber = targetBoxNumber;
        IsShortQuery = isShortQuery;
    }
}

public static class SearchVocabulary
{
    public static readonly IReadOnlyList<SearchConcept> Concepts = new List<SearchConcept>
    {
        // 1. FOOTWEAR
        new SearchConcept(
            "Footwear",
            new[] { "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals", "slipper", "slippers", "heel", "heels", "loafer", "loafers", "cleat", "cleats", "footwear" },
            new[] { "Footwear", "Shoes", "Clothing" }),

        // 2. CLOTHING
        new SearchConcept(
            "Clothing",
            new[] { "clothes", "clothing", "apparel", "shirt", "shirts", "tshirt", "t-shirt", "pants", "jeans", "dress", "dresses", "jacket", "jackets", "coat", "coats", "sweater", "sweaters", "garment", "garments" },
            new[] { "Clothing", "Apparel" }),

        // 3. CHRISTMAS / HOLIDAY DECOR
        new SearchConcept(
            "Holiday Decor",
            new[] { "christmas", "xmas", "holiday", "holidays", "ornament", "ornaments", "wreath", "wreaths", "garland", "garlands", "decor", "decoration", "decorations", "seasonal" },
            new[] { "Holiday", "Decor", "Seasonal" }),

        // 4. KITCHENWARE
        new SearchConcept(
            "Kitchenware",
            new[] { "kitchenware", "kitchen", "dish", "dishes", "plate", "plates", "cup", "cups", "mug", "mugs", "bowl", "bowls", "utensil", "utensils", "cutlery", "cookware", "pan", "pans", "pot", "pots" },
            new[] { "Kitchen", "Dining", "Cookware" }),

        // 5. ELECTRONICS
        new SearchConcept(
            "Electronics",
            new[] { "electronics", "electronic", "device", "devices", "phone", "phones", "smartphone", "smartphones", "laptop", "laptops", "computer", "computers", "tablet", "tablets", "monitor", "monitors", "television", "televisions", "tv", "tvs" },
            new[] { "Electronics", "Devices", "Tech" }),

        // 6. CABLES / POWER
        new SearchConcept(
            "Cables & Power",
            new[] { "cable", "cables", "cord", "cords", "wire", "wires", "charger", "chargers", "adapter", "adapters", "plug", "plugs", "extension cord", "power strip" },
            new[] { "Electronics", "Hardware" }),

        // 7. TOOLS
        new SearchConcept(
            "Tools",
            new[] { "tool", "tools", "hammer", "hammers", "wrench", "wrenches", "screwdriver", "screwdrivers", "drill", "drills", "pliers", "saw", "saws", "toolbox", "hardware" },
            new[] { "Tools", "Hardware" }),

        // 8. CLEANING
        new SearchConcept(
            "Cleaning",
            new[] { "cleaning", "cleaner", "cleaners", "detergent", "detergents", "soap", "soaps", "mop", "mops", "broom", "brooms", "vacuum", "vacuums", "sponge", "sponges", "disinfectant", "disinfectants" },
            new[] { "Cleaning", "Household", "Laundry" }),

        // 9. BEDDING / LINENS
        new SearchConcept(
            "Bedding",
            new[] { "bedding", "linen", "linens", "blanket", "blankets", "pillow", "pillows", "bedsheet", "bedsheets", "sheet", "sheets", "comforter", "comforters", "duvet", "duvets" },
            new[] { "Bedding", "Home", "Linens" }),

        // 10. BATHROOM / TOILETRIES
        new SearchConcept(
            "Bathroom",
            new[] { "bathroom", "toiletries", "toiletry", "shampoo", "shampoos", "conditioner", "conditioners", "lotion", "lotions", "soap", "soaps", "toothpaste", "toothbrush", "toothbrushes", "skincare" },
            new[] { "Bathroom", "Personal Care", "Hygiene" }),

        // 11. CAMPING / OUTDOOR
        new SearchConcept(
            "Camping",
            new[] { "camping", "camp", "outdoor", "outdoors", "tent", "tents", "sleeping bag", "sleeping bags", "lantern", "lanterns", "camp stove", "hiking" },
            new[] { "Outdoor", "Camping" }),

        // 12. SPORTS / FITNESS
        new SearchConcept(
            "Sports",
            new[] { "sports", "sport", "fitness", "exercise", "workout", "ball", "balls", "football", "soccer", "basketball", "weights", "dumbbell", "dumbbells", "yoga" },
            new[] { "Sports", "Fitness" }),

        // 13. BABY
        new SearchConcept(
            "Baby",
            new[] { "baby", "infant", "diaper", "diapers", "stroller", "strollers", "pacifier", "pacifiers", "baby bottle", "baby bottles" },
            new[] { "Baby", "Nursery" }),

        // 14. PET
        new SearchConcept(
            "Pet",
            new[] { "pet", "pets", "dog", "dogs", "cat", "cats", "leash", "leashes", "pet food", "dog food", "cat food", "pet toy", "pet toys" },
            new[] { "Pet", "Animals" }),

        // 15. OFFICE / DOCUMENTS
        new SearchConcept(
            "Office & Documents",
            new[] { "document", "documents", "paper", "papers", "file", "files", "folder", "folders", "passport", "passports", "certificate", "certificates", "contract", "contracts", "receipt", "receipts", "tax", "taxes" },
            new[] { "Documents", "Office" }),

        // 16. TOYS / GAMES
        new SearchConcept(
            "Toys & Games",
            new[] { "toy", "toys", "game", "games", "puzzle", "puzzles", "doll", "dolls", "action figure", "action figures", "board game", "board games", "video game", "video games" },
            new[] { "Toys", "Games" }),

        // 17. DECOR / HOME DECOR
        new SearchConcept(
            "Home Decor",
            new[] { "decor", "decoration", "decorations", "artwork", "wall art", "frame", "frames", "picture frame", "vase", "vases", "candle", "candles" },
            new[] { "Decor", "Home" }),

        // 18. SEASON / WEATHER
        new SearchConcept(
            "Winter",
            new[] { "winter", "snow", "cold", "ice", "frost" },
            new[] { "Seasonal", "Clothing" }),
    };

    private static readonly Dictionary<string, List<SearchConcept>> TermToConceptsMap;

    static SearchVocabulary()
    {
        TermToConceptsMap = new Dictionary<string, List<SearchConcept>>(StringComparer.OrdinalIgnoreCase);

        foreach (var concept in Concepts)
        {
            foreach (var term in concept.Terms)
            {
                if (!TermToConceptsMap.TryGetValue(term, out var list))
                {
                    list = new List<SearchConcept>();
                    TermToConceptsMap[term] = list;
                }
                list.Add(concept);
            }
        }
    }

    public static IReadOnlyList<SearchConcept> FindConceptsForTerm(string term)
    {
        if (string.IsNullOrWhiteSpace(term)) return Array.Empty<SearchConcept>();
        return TermToConceptsMap.TryGetValue(term.Trim().ToLowerInvariant(), out var concepts)
            ? concepts
            : Array.Empty<SearchConcept>();
    }
}
