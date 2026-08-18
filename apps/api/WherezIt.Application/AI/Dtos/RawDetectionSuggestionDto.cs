namespace WherezIt.Application.AI.Dtos;

public class RawDetectionSuggestionDto
{
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal? Confidence { get; set; }
}
